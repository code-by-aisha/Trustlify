-- ═══════════════════════════════════════════════════════════════════════════
-- TRUSTLIFY — Structured Student Profile (005_student_profile_structure.sql)
--
-- Student intelligence + multi-question update, spec 01–03. The eligibility
-- matcher must not depend on ambiguous free-form strings where a structured
-- field genuinely helps. The existing `profiles` columns were inspected first:
--
--   already present (REUSED, not recreated):
--     role, display_name, education (free text), age, location (city/region),
--     skills[], interests[], experience, portfolio_url, language, timezone
--
--   genuinely missing for matching:
--     country          — "karachi" names no country, so a "Pakistani students
--                        only" requirement could never be compared. Location
--                        stays as the city field; country is its own fact.
--     education_level  — a bounded ladder the requirement side can compare
--                        against, instead of guessing from "BS (Hons) 3rd year".
--     field_of_study   — discipline is currently only inferable from the
--                        education string, which many profiles leave blank.
--
-- All three are NULLable and additive: no existing profile row is modified,
-- no data is moved, dropped or rewritten, and every student who never touches
-- the new fields keeps exactly the behaviour they have today (the matcher
-- falls back to the free-text columns). portfolio_url already exists, so this
-- update adds NO new URL storage and NO new table.
--
-- No student_match / recommendation / translation tables: those stay derived.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists country text;

alter table public.profiles
  add column if not exists education_level text;

alter table public.profiles
  add column if not exists field_of_study text;

-- Idempotent bounded enum. NULL always passes, so existing rows are unaffected.
alter table public.profiles
  drop constraint if exists profiles_education_level_check;

alter table public.profiles
  add constraint profiles_education_level_check
  check (
    education_level is null
    or education_level in (
      'HIGH_SCHOOL',
      'COLLEGE',
      'UNDERGRADUATE',
      'GRADUATE',
      'POSTGRADUATE',
      'OTHER'
    )
  );

comment on column public.profiles.country is
  'Structured country for eligibility matching. Nullable; location stays the free-text city/region field.';

comment on column public.profiles.education_level is
  'Bounded education ladder (HIGH_SCHOOL..POSTGRADUATE, OTHER). Derived alongside, never replacing, the free-text education value.';

comment on column public.profiles.field_of_study is
  'Discipline the student studies, e.g. "Computer Science". Nullable; used for field-of-study requirement matching.';
