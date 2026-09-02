/**
 * Trustlify Backend — Monitoring persistence and change detection (fix pass)
 *
 * The SAVE & MONITOR button had never been wired to these endpoints, so this is
 * the first test coverage for the flow. Everything here is fixture-based: a fake
 * Supabase builder resolves each table's calls in order, and no provider,
 * network or database is touched.
 *
 * Pinned behavior:
 *   - a monitoring row is stored against the authenticated user and the right
 *     investigation, and survives being pressed twice without duplicating;
 *   - the list reports a change ONLY when the investigation's own persisted
 *     evidence proves one — the recorded window closing while monitored;
 *   - nothing is ever claimed about a source page's current content, because
 *     this path performs no fetch.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

type Result = { data: unknown; error: unknown };

const db = vi.hoisted(() => {
  const state: { script: Record<string, Result[]> } = { script: {} };
  const calls: { table: string; method: string; args: unknown[] }[] = [];

  const take = (table: string, method: string, args: unknown[]): Result => {
    calls.push({ table, method, args });
    return state.script[table]?.shift() ?? { data: null, error: null };
  };

  const builder = (table: string): any => {
    const query: any = {};
    for (const method of ["select", "insert", "update", "eq", "in", "order"]) {
      query[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return query;
      };
    }
    const terminal = (method: string) => () => take(table, method, []);
    query.maybeSingle = terminal("maybeSingle");
    query.single = terminal("single");
    // A list query is awaited with no terminal verb at the end.
    query.then = (resolve: (value: Result) => void) => resolve(take(table, "await", []));
    return query;
  };

  return {
    from: (table: string) => builder(table),
    calls,
    setScript(script: Record<string, Result[]>) {
      state.script = script;
      calls.length = 0;
    },
  };
});

vi.mock("../config/supabase.js", () => ({
  supabaseAdmin: { from: db.from },
}));

import * as monitoringService from "../services/monitoringService.js";

const USER = "11111111-1111-1111-1111-111111111111";
const INVESTIGATION = "22222222-2222-2222-2222-222222222222";

const ITEM_ROW = {
  id: "33333333-3333-3333-3333-333333333333",
  investigation_id: INVESTIGATION,
  user_id: USER,
  active: true,
  last_checked_at: null,
  // Long in the past, so "while monitored" is always a real span of time.
  created_at: "2020-01-01T00:00:00.000Z",
};

/** A deadline the stored text already places in the past. */
const EXPIRED_CLAIM_ROW = {
  id: "44444444-4444-4444-4444-444444444444",
  investigation_id: INVESTIGATION,
  claim_text: "Applications close 15 January 2020, at 11:00 (UTC).",
  claim_type: "deadline",
};

/** A deadline that is still open today, and was open when monitoring started. */
const OPEN_CLAIM_ROW = {
  id: "55555555-5555-5555-5555-555555555555",
  investigation_id: INVESTIGATION,
  claim_text: "Applications close 31 December 2099, at 11:00 (UTC).",
  claim_type: "deadline",
};

beforeEach(() => {
  vi.clearAllMocks();
  db.setScript({});
});

/* ─── 1. Persistence — the part that was missing entirely ─────────────────── */

describe("startMonitoring", () => {
  it("stores one row for the authenticated user and the given investigation", async () => {
    db.setScript({
      investigations: [{ data: { id: INVESTIGATION, user_id: USER }, error: null }],
      monitoring_items: [
        { data: null, error: null }, // no existing item
        { data: ITEM_ROW, error: null }, // insert().select().single()
      ],
    });

    const item = await monitoringService.startMonitoring(INVESTIGATION, USER);

    const insert = db.calls.find((call) => call.method === "insert");
    expect(insert?.args[0]).toEqual({
      investigation_id: INVESTIGATION,
      user_id: USER,
      active: true,
    });
    // snake_case never leaks to the client
    expect(item).toMatchObject({
      id: ITEM_ROW.id,
      investigationId: INVESTIGATION,
      active: true,
    });
    expect(item).not.toHaveProperty("investigation_id");
  });

  it("re-activates the existing row instead of inserting a second one", async () => {
    db.setScript({
      investigations: [{ data: { id: INVESTIGATION, user_id: USER }, error: null }],
      monitoring_items: [
        { data: { id: ITEM_ROW.id }, error: null }, // existing item found
        { data: { ...ITEM_ROW, active: true }, error: null }, // update().select().single()
      ],
    });

    await monitoringService.startMonitoring(INVESTIGATION, USER);

    const writes = db.calls.filter(
      (call) => call.table === "monitoring_items" && (call.method === "insert" || call.method === "update"),
    );
    expect(writes).toHaveLength(1);
    expect(writes[0].method).toBe("update");
    expect(writes[0].args[0]).toEqual({ active: true });
  });

  it("refuses to monitor an investigation the caller does not own", async () => {
    db.setScript({
      // The ownership filter is part of the query, so a foreign row never comes back.
      investigations: [{ data: null, error: null }],
    });

    await expect(monitoringService.startMonitoring(INVESTIGATION, USER)).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
    expect(db.calls.some((call) => call.method === "insert")).toBe(false);
    const userFilter = db.calls.find((call) => call.method === "eq" && call.args[0] === "user_id");
    expect(userFilter?.args[1]).toBe(USER);
  });
});

/* ─── 2. Retrieval + honest change detection ──────────────────────────────── */

describe("getMonitoringItems", () => {
  it("reports the recorded deadline expiring while the item was monitored", async () => {
    db.setScript({
      monitoring_items: [{ data: [ITEM_ROW], error: null }],
      claims: [{ data: [EXPIRED_CLAIM_ROW], error: null }],
    });

    const items = await monitoringService.getMonitoringItems(USER);

    expect(items).toHaveLength(1);
    expect(items[0].changes).toHaveLength(1);
    expect(items[0].changes[0]).toMatchObject({
      field: "deadline_state",
      before: "ACTIVE",
      after: "EXPIRED",
    });
    // The detail is the engine's own sentence about the stored date — not prose
    // about a page nobody re-read.
    expect(items[0].changes[0].detail).toMatch(/2020/);
  });

  it("reports nothing when the stored evidence says the window is still open", async () => {
    db.setScript({
      monitoring_items: [{ data: [ITEM_ROW], error: null }],
      claims: [{ data: [OPEN_CLAIM_ROW], error: null }],
    });

    const items = await monitoringService.getMonitoringItems(USER);
    expect(items[0].changes).toEqual([]);
  });

  it("reports nothing when no deadline was ever recorded", async () => {
    db.setScript({
      monitoring_items: [{ data: [ITEM_ROW], error: null }],
      claims: [{ data: [], error: null }],
    });

    const items = await monitoringService.getMonitoringItems(USER);
    expect(items[0].changes).toEqual([]);
    expect(items[0].lastCheckedAt).toBeNull();
  });

  it("lists only the caller's own items and reads no provider", async () => {
    db.setScript({ monitoring_items: [{ data: [], error: null }] });

    const items = await monitoringService.getMonitoringItems(USER);

    expect(items).toEqual([]);
    const scoped = db.calls.filter((call) => call.method === "eq" && call.args[0] === "user_id");
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((call) => call.args[1] === USER)).toBe(true);
    // A check must not write: pressing refresh cannot create rows or events.
    expect(
      db.calls.some((call) => call.method === "insert" || call.method === "update"),
    ).toBe(false);
  });
});
