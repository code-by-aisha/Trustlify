-- ═══════════════════════════════════════════════════════════════════════════
-- TRUSTLIFY — Evidence-Driven Investigation Migration (003_evidence_investigation.sql)
--
-- Supports the Phase 4 investigation pipeline:
--   - investigations: URL fetch / redirect-signal columns (spec 08/11)
--   - claims: 'unsupported' verification status (spec 23)
--   - evidence: model reason + confidence persistence, 'insufficient' relation
--     (spec 20/21)
--   - decisions: structured why-this-verdict reasons (spec 29)
--
-- Idempotent: safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── INVESTIGATIONS: URL fetch signal columns ───────────────────────────────
alter table public.investigations
  add column if not exists original_url text,
  add column if not exists final_url text,
  add column if not exists original_domain text,
  add column if not exists final_domain text,
  add column if not exists domain_changed boolean not null default false,
  add column if not exists content_truncated boolean not null default false;

-- ─── CLAIMS: widen verification_status with 'unsupported' (spec 23) ─────────
alter table public.claims
  drop constraint if exists claims_verification_status_check;

alter table public.claims
  add constraint claims_verification_status_check
  check (verification_status in (
    'pending', 'supported', 'contradicted', 'conflicting', 'insufficient', 'unsupported'
  ));

-- ─── EVIDENCE: reason + confidence, 'insufficient' relation (spec 20/21) ────
alter table public.evidence
  add column if not exists reason text,
  add column if not exists confidence text
    check (confidence is null or confidence in ('high', 'medium', 'low'));

alter table public.evidence
  drop constraint if exists evidence_relation_check;

alter table public.evidence
  add constraint evidence_relation_check
  check (relation in ('supports', 'contradicts', 'neutral', 'insufficient'));

-- ─── DECISIONS: structured why-this-verdict reasons (spec 29) ───────────────
alter table public.decisions
  add column if not exists reasons text[] not null default '{}';
