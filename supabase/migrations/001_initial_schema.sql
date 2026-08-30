-- ═══════════════════════════════════════════════════════════════════════════
-- TRUSTLIFY — Initial Schema Migration (001_initial_schema.sql)
-- Tables: profiles, investigations, claims, sources, evidence, decisions,
--         monitoring_items, change_events, uploads
-- RLS enabled on all user-owned tables
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── PROFILES ───────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'general' check (role in ('student', 'general')),
  display_name text,
  education text,
  age int check (age > 0 and age < 150),
  location text,
  skills text[] default '{}',
  interests text[] default '{}',
  experience text,
  portfolio_url text,
  language text default 'English',
  timezone text default 'Asia/Karachi',
  notification_preferences jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(auth_user_id)
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = auth_user_id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = auth_user_id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

create index idx_profiles_auth_user_id on public.profiles(auth_user_id);

-- ─── INVESTIGATIONS ─────────────────────────────────────────────────────────
create table public.investigations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_type text not null check (input_type in ('url', 'text', 'image', 'pdf')),
  input_text text,
  input_file_path text,
  status text not null default 'created' check (status in ('created', 'processing', 'complete', 'failed')),
  current_stage text default 'NORMALIZING',
  verdict text check (verdict in ('VERIFIED', 'CAUTION', 'HIGH_RISK', 'UNVERIFIED')),
  trust_score int check (trust_score >= 0 and trust_score <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.investigations enable row level security;

create policy "Users can view own investigations"
  on public.investigations for select
  using (auth.uid() = user_id);

create policy "Users can insert own investigations"
  on public.investigations for insert
  with check (auth.uid() = user_id);

create policy "Users can update own investigations"
  on public.investigations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_investigations_user_id on public.investigations(user_id);
create index idx_investigations_created_at on public.investigations(created_at desc);

-- ─── CLAIMS ─────────────────────────────────────────────────────────────────
create table public.claims (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  claim_text text not null,
  claim_type text not null default 'other',
  importance text default 'supporting' check (importance in ('critical', 'important', 'supporting')),
  verification_status text default 'pending' check (verification_status in ('pending', 'supported', 'contradicted', 'conflicting', 'insufficient')),
  reasoning_summary text,
  created_at timestamptz not null default now()
);

alter table public.claims enable row level security;

create policy "Users can access claims of own investigations"
  on public.claims for select
  using (exists (select 1 from public.investigations where investigations.id = claims.investigation_id and investigations.user_id = auth.uid()));

create policy "Users can insert claims of own investigations"
  on public.claims for insert
  with check (exists (select 1 from public.investigations where investigations.id = claims.investigation_id and investigations.user_id = auth.uid()));

create index idx_claims_investigation_id on public.claims(investigation_id);

-- ─── SOURCES ────────────────────────────────────────────────────────────────
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  url text not null,
  title text,
  domain text,
  source_type text not null default 'submitted',
  publisher text,
  authority_level int default 4 check (authority_level between 1 and 4),
  published_at timestamptz,
  updated_at timestamptz,
  retrieved_at timestamptz default now(),
  access_status text default 'available' check (access_status in ('available', 'restricted', 'unavailable', 'error')),
  created_at timestamptz not null default now()
);

alter table public.sources enable row level security;

create policy "Users can access sources of own investigations"
  on public.sources for select
  using (exists (select 1 from public.investigations where investigations.id = sources.investigation_id and investigations.user_id = auth.uid()));

create policy "Users can insert sources of own investigations"
  on public.sources for insert
  with check (exists (select 1 from public.investigations where investigations.id = sources.investigation_id and investigations.user_id = auth.uid()));

create index idx_sources_investigation_id on public.sources(investigation_id);

-- ─── EVIDENCE ───────────────────────────────────────────────────────────────
create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  excerpt text,
  relation text not null default 'neutral' check (relation in ('supports', 'contradicts', 'neutral')),
  exact_location text,
  verification_status text default 'pending' check (verification_status in ('pending', 'approved', 'rejected', 'uncertain')),
  created_at timestamptz not null default now()
);

alter table public.evidence enable row level security;

create policy "Users can access evidence of own investigations"
  on public.evidence for select
  using (exists (select 1 from public.claims join public.investigations on investigations.id = claims.investigation_id where claims.id = evidence.claim_id and investigations.user_id = auth.uid()));

create policy "Users can insert evidence of own investigations"
  on public.evidence for insert
  with check (exists (select 1 from public.claims join public.investigations on investigations.id = claims.investigation_id where claims.id = evidence.claim_id and investigations.user_id = auth.uid()));

create index idx_evidence_claim_id on public.evidence(claim_id);
create index idx_evidence_source_id on public.evidence(source_id);

-- ─── DECISIONS ──────────────────────────────────────────────────────────────
create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  verdict text check (verdict in ('VERIFIED', 'CAUTION', 'HIGH_RISK', 'UNVERIFIED')),
  trust_score int check (trust_score >= 0 and trust_score <= 100),
  explanation text,
  recommended_action text[],
  created_at timestamptz not null default now()
);

alter table public.decisions enable row level security;

create policy "Users can access decisions of own investigations"
  on public.decisions for select
  using (exists (select 1 from public.investigations where investigations.id = decisions.investigation_id and investigations.user_id = auth.uid()));

create policy "Users can insert decisions of own investigations"
  on public.decisions for insert
  with check (exists (select 1 from public.investigations where investigations.id = decisions.investigation_id and investigations.user_id = auth.uid()));

create index idx_decisions_investigation_id on public.decisions(investigation_id);

-- ─── MONITORING ITEMS ───────────────────────────────────────────────────────
create table public.monitoring_items (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.monitoring_items enable row level security;

create policy "Users can view own monitoring items"
  on public.monitoring_items for select
  using (auth.uid() = user_id);

create policy "Users can insert own monitoring items"
  on public.monitoring_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update own monitoring items"
  on public.monitoring_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_monitoring_items_user_id on public.monitoring_items(user_id);
create index idx_monitoring_items_investigation_id on public.monitoring_items(investigation_id);

-- ─── CHANGE EVENTS ──────────────────────────────────────────────────────────
create table public.change_events (
  id uuid primary key default gen_random_uuid(),
  monitoring_item_id uuid not null references public.monitoring_items(id) on delete cascade,
  field text not null,
  before_value text,
  after_value text,
  source_id uuid references public.sources(id),
  importance text default 'medium' check (importance in ('high', 'medium', 'low')),
  detected_at timestamptz not null default now()
);

alter table public.change_events enable row level security;

create policy "Users can access change events of own monitoring items"
  on public.change_events for select
  using (exists (select 1 from public.monitoring_items where monitoring_items.id = change_events.monitoring_item_id and monitoring_items.user_id = auth.uid()));

create policy "Users can insert change events of own monitoring items"
  on public.change_events for insert
  with check (exists (select 1 from public.monitoring_items where monitoring_items.id = change_events.monitoring_item_id and monitoring_items.user_id = auth.uid()));

create index idx_change_events_monitoring_item_id on public.change_events(monitoring_item_id);

-- ─── UPLOADS ────────────────────────────────────────────────────────────────
create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investigation_id uuid references public.investigations(id) on delete set null,
  storage_path text not null,
  original_filename text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);

alter table public.uploads enable row level security;

create policy "Users can view own uploads"
  on public.uploads for select
  using (auth.uid() = user_id);

create policy "Users can insert own uploads"
  on public.uploads for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own uploads"
  on public.uploads for delete
  using (auth.uid() = user_id);

create index idx_uploads_user_id on public.uploads(user_id);
create index idx_uploads_investigation_id on public.uploads(investigation_id);

-- ─── STORAGE BUCKET ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('trustlify-uploads', 'trustlify-uploads', false);

create policy "Users can upload own files"
  on storage.objects for insert
  with check (bucket_id = 'trustlify-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can view own files"
  on storage.objects for select
  using (bucket_id = 'trustlify-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own files"
  on storage.objects for delete
  using (bucket_id = 'trustlify-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─── UPDATED_AT TRIGGER ─────────────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_profile_updated
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger on_investigation_updated
  before update on public.investigations
  for each row execute procedure public.handle_updated_at();
