/**
 * Trustlify Backend — Currentness Engine
 *
 * Phase 5 (implemented with the Phase 4 pipeline): deterministic currentness
 * signals built ONLY where dates actually exist (spec 24).
 *
 * Sources of truth:
 *   - published date  (honestly parsed page metadata, never invented)
 *   - updated date    (page metadata)
 *   - retrieved date  (always known — recorded by the investigation)
 *
 * Rules (deterministic):
 *   - publishedAt within 365 days of "now"  → 'recent'
 *   - publishedAt older than 365 days       → 'dated'
 *   - no publishedAt                        → 'unknown'
 * The newest source is NOT automatically treated as the most authoritative —
 * currentness is a signal, not a ranking.
 */

export interface SourceDateInput {
  sourceId: string;
  publishedAt: string | null;
  retrievedAt: string;
}

export type SourceCurrentnessStatus = "recent" | "dated" | "unknown";

export interface SourceCurrentness {
  sourceId: string;
  status: SourceCurrentnessStatus;
  publishedAt: string | null;
  retrievedAt: string;
  /** Whole days between publication and retrieval — null when unknown. */
  ageDays: number | null;
}

const RECENT_WINDOW_DAYS = 365;

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Assess a single source's currentness. Never fabricates dates: an absent
 * publishedAt stays 'unknown'. Age is measured at retrieval time — the
 * deterministic recorded fact — so the same persisted data always yields the
 * same signal.
 */
export function assessSourceCurrentness(
  source: SourceDateInput,
): SourceCurrentness {
  if (!source.publishedAt) {
    return {
      sourceId: source.sourceId,
      status: "unknown",
      publishedAt: null,
      retrievedAt: source.retrievedAt,
      ageDays: null,
    };
  }

  const published = new Date(source.publishedAt);
  const retrieved = new Date(source.retrievedAt);
  if (Number.isNaN(published.getTime()) || Number.isNaN(retrieved.getTime())) {
    return {
      sourceId: source.sourceId,
      status: "unknown",
      publishedAt: null,
      retrievedAt: source.retrievedAt,
      ageDays: null,
    };
  }

  const ageDays = daysBetween(published, retrieved);
  return {
    sourceId: source.sourceId,
    status: ageDays <= RECENT_WINDOW_DAYS ? "recent" : "dated",
    publishedAt: source.publishedAt,
    retrievedAt: source.retrievedAt,
    ageDays,
  };
}

export type InvestigationCurrentnessStatus =
  | "recent"
  | "dated"
  | "mixed"
  | "unknown";

export interface InvestigationCurrentness {
  overall: InvestigationCurrentnessStatus;
  perSource: SourceCurrentness[];
}

/**
 * Aggregate per-source signals into one investigation-level signal.
 * 'mixed' reports honest disagreement (some recent, some dated).
 */
export function assessInvestigationCurrentness(
  sources: SourceDateInput[],
): InvestigationCurrentness {
  const perSource = sources.map((source) => assessSourceCurrentness(source));

  if (perSource.length === 0) {
    return { overall: "unknown", perSource };
  }

  const statuses = new Set(perSource.map((entry) => entry.status));
  statuses.delete("unknown");

  if (statuses.size === 0) return { overall: "unknown", perSource };
  if (statuses.size > 1) return { overall: "mixed", perSource };
  return { overall: [...statuses][0], perSource };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * STUDENT INTELLIGENCE UPDATE — deadline + opportunity currency
 *
 * Deterministic date arithmetic over ALREADY-EXTRACTED claims. No new Gemini
 * or Tavily call: the deadline is read out of the claim text the existing
 * pipeline already produced and persisted (spec 17 cost contract).
 *
 * Honesty rules (spec 09/10 of the update):
 *   - A date is never invented. A partial date ("Aug 30" with no year, a bare
 *     year, an ambiguous 05/09/2026) is reported as unreadable, not guessed.
 *   - When distinct deadline dates disagree, the conflict is surfaced — one
 *     date is never silently chosen.
 *   - Something being old is not the same as it being outdated, so an absent
 *     deadline never produces EXPIRED.
 * ═════════════════════════════════════════════════════════════════════════ */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Claims that state a deadline are these types, or say so in plain words. */
const DEADLINE_MENTION =
  /\b(?:deadline|closing date|last date|final date|due date|apply by|applications? close|submission (?:deadline|closes))\b/i;

/** Full-date spellings: 31 Dec 2026 · Dec 31, 2026 · 2026-12-31 · 31/12/2026. */
const DATE_PATTERNS: string[] = [
  String.raw`\b([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b`,
  String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*\.?,?\s+(\d{4})\b`,
  String.raw`\b(\d{4})-(\d{1,2})-(\d{1,2})\b`,
  String.raw`\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b`,
];

function isoOf(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Every unambiguous full date found in a piece of claim text (UTC ISO, sorted,
 * de-duplicated). Deliberately conservative: a numeric a/b/yyyy pair where both
 * halves are ≤ 12 is ambiguous, so it is dropped rather than guessed.
 */
export function findDatesInText(text: string): string[] {
  const found = new Set<string>();

  for (const source of DATE_PATTERNS) {
    // Fresh regex per pass — no shared lastIndex state between calls.
    const flags = new RegExp(source, "gi");

    let match: RegExpExecArray | null;
    while ((match = flags.exec(text)) !== null) {
      const [first, second, third] = [match[1], match[2], match[3]];
      if (!first || !second || !third) continue;

      if (/^\d{4}$/.test(first)) {
        // 2026-12-31 — year first, no ambiguity possible
        const iso = isoOf(Number(first), Number(second), Number(third));
        if (iso) found.add(iso);
        continue;
      }

      const monthByName = MONTHS[first.slice(0, 3).toLowerCase()];
      if (monthByName) {
        // "Dec 31, 2026"
        const iso = isoOf(Number(third), monthByName, Number(second));
        if (iso) found.add(iso);
        continue;
      }

      const trailingMonth = MONTHS[second.slice(0, 3).toLowerCase()];
      if (trailingMonth) {
        // "31 Dec 2026"
        const iso = isoOf(Number(third), trailingMonth, Number(first));
        if (iso) found.add(iso);
        continue;
      }

      // Numeric d/m/y or m/d/y — only decidable when one value exceeds 12
      const a = Number(first);
      const b = Number(second);
      const year = Number(third);
      if (a > 12 && b <= 12) {
        const iso = isoOf(year, b, a);
        if (iso) found.add(iso);
      } else if (b > 12 && a <= 12) {
        const iso = isoOf(year, a, b);
        if (iso) found.add(iso);
      }
      // otherwise: ambiguous → honestly unreadable, nothing is guessed
    }
  }

  return [...found].sort();
}

export interface DeadlineDate {
  claimId: string;
  iso: string;
}

export type DeadlineState = "ACTIVE" | "EXPIRED" | "CONFLICTING" | "UNKNOWN";

export interface DeadlineAssessment {
  state: DeadlineState;
  /** Distinct deadline dates actually found in the claims (may be empty). */
  dates: DeadlineDate[];
  /** Human sentence shown on the result page — built from the real dates. */
  detail: string;
}

export interface DeadlineClaimInput {
  id: string;
  text: string;
  type: string;
}

function startOfUtcDay(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function formatIso(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function wholeDaysUntil(iso: string, now: Date): number {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - startOfUtcDay(now)) / 86_400_000);
}

/**
 * Assess the application deadline of an opportunity from its existing claims.
 * Pure: the same persisted claims always produce the same assessment.
 */
export function assessDeadline(
  claims: DeadlineClaimInput[],
  now: Date = new Date(),
): DeadlineAssessment {
  const dates: DeadlineDate[] = [];

  for (const claim of claims) {
    const isDeadlineClaim =
      claim.type === "deadline" || DEADLINE_MENTION.test(claim.text);
    if (!isDeadlineClaim) continue;

    for (const iso of findDatesInText(claim.text)) {
      if (!dates.some((entry) => entry.claimId === claim.id && entry.iso === iso)) {
        dates.push({ claimId: claim.id, iso });
      }
    }
  }

  dates.sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0));

  const distinct = [...new Set(dates.map((entry) => entry.iso))];

  if (distinct.length === 0) {
    return {
      state: "UNKNOWN",
      dates: [],
      detail:
        "No complete deadline date could be read from this content, so Trustlify does not claim the deadline is open or closed.",
    };
  }

  const today = startOfUtcDay(now);
  const passed = distinct.filter((iso) => Date.parse(`${iso}T00:00:00Z`) < today);

  if (distinct.length === 1) {
    const [iso] = distinct;
    const days = wholeDaysUntil(iso, now);
    if (days < 0) {
      return {
        state: "EXPIRED",
        dates,
        detail: `The deadline recorded in the content is ${formatIso(iso)} — ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago.`,
      };
    }
    return {
      state: "ACTIVE",
      dates,
      detail: `The deadline recorded in the content is ${formatIso(iso)} — ${days} day${days === 1 ? "" : "s"} from today.`,
    };
  }

  const listed = distinct.map((iso) => formatIso(iso)).join(", ");
  if (passed.length === distinct.length) {
    return {
      state: "EXPIRED",
      dates,
      detail: `Every deadline found in the content has passed: ${listed}.`,
    };
  }

  return {
    state: "CONFLICTING",
    dates,
    detail: `The sources give different deadline dates (${listed}) — Trustlify will not silently pick one. Confirm the active deadline with the organising source.`,
  };
}

export type OpportunityCurrencyState =
  | "CURRENT"
  | "EXPIRED"
  | "POSSIBLY_OUTDATED"
  | "UNKNOWN";

export interface OpportunityCurrency {
  state: OpportunityCurrencyState;
  detail: string;
}

/**
 * Answer "is this outdated?" from the deadline plus the source publication
 * signals the pipeline already recorded. Never infers expiry from age alone:
 * an undated, unresolvable case stays UNKNOWN.
 */
export function assessOpportunityCurrency(
  deadline: DeadlineAssessment,
  sourceCurrentness: InvestigationCurrentnessStatus,
): OpportunityCurrency {
  switch (deadline.state) {
    case "EXPIRED":
      return { state: "EXPIRED", detail: deadline.detail };
    case "ACTIVE":
      return { state: "CURRENT", detail: deadline.detail };
    case "CONFLICTING":
      return { state: "POSSIBLY_OUTDATED", detail: deadline.detail };
    case "UNKNOWN":
      if (sourceCurrentness === "dated") {
        return {
          state: "POSSIBLY_OUTDATED",
          detail:
            "No deadline date could be read, and every supporting source is more than a year old. Treat the details as possibly outdated until the organising source confirms them.",
        };
      }
      if (sourceCurrentness === "recent") {
        return {
          state: "CURRENT",
          detail:
            "No deadline date could be read from the content, but the supporting sources were published within the last year.",
        };
      }
      return {
        state: "UNKNOWN",
        detail: `No complete deadline date and ${
          sourceCurrentness === "mixed" ? "mixed" : "no usable"
        } publication dates were available, so currency cannot be assessed honestly.`,
      };
  }
}

