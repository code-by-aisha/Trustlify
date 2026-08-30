-- ═══════════════════════════════════════════════════════════════════════════
-- TRUSTLIFY — Search Metadata Migration (002_search_metadata.sql)
-- Phase 3C: mini-investigation pipeline support.
--
-- - sources.snippet: normalized search-result snippet (untrusted data, stored
--   as plain text; evidence excerpts remain in the evidence table for later
--   phases — a snippet is NOT evidence and implies no claim relationship)
-- - investigations.selected_claim_id: the claim chosen for the targeted search
-- - investigations.search_query: the deterministic query built from the
--   selected claim
-- - investigations.error_message: safe, user-facing failure reason (never
--   provider internals, keys, or stack traces)
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.sources
  add column if not exists snippet text;

alter table public.investigations
  add column if not exists selected_claim_id uuid references public.claims(id) on delete set null;

alter table public.investigations
  add column if not exists search_query text;

alter table public.investigations
  add column if not exists error_message text;
