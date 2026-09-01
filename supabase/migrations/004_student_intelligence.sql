-- ═══════════════════════════════════════════════════════════════════════════
-- TRUSTLIFY — Student Intelligence Migration (004_student_intelligence.sql)
--
-- Student intelligence update: the optional question a user attaches to an
-- investigation ("Can I apply for this, and am I eligible?").
--
-- This is the ONLY schema change the update requires:
--   - The question must be stored SEPARATELY from the investigated content
--     (input_text), because input_text is the untrusted material the claims are
--     extracted from. Mixing them would let the question masquerade as content.
--   - Existing columns were inspected first: `investigations` has no field that
--     can hold a user question without polluting claims/evidence.
--   - Student match, currentness and recommended-source results are NOT stored
--     here. They are derived deterministically at read time from data that is
--     already persisted (claims, evidence, sources, decisions, profiles), so no
--     new tables and no extra columns are needed (update spec 06/18).
--   - Text + image in one investigation needs no change at all: input_text and
--     input_file_path are independent nullable columns and input_type already
--     permits 'image'.
--
-- Nullable, additive, idempotent: safe to re-run, destroys no data, and every
-- pre-existing investigation keeps working with the question left as NULL.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.investigations
  add column if not exists investigation_question text;

comment on column public.investigations.investigation_question is
  'Optional user question / context attached to the investigation. Untrusted input, stored separately from input_text; used only by deterministic intent classification.';
