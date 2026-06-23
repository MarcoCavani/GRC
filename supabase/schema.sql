-- ============================================================
-- RACM ITGC — Supabase schema
-- Run this in the Supabase SQL editor (or via `supabase db push`)
-- ============================================================

-- 1. PROFILES (one row per authenticated user)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text default 'reviewer',         -- e.g. reviewer, manager, admin
  created_at timestamptz default now()
);

-- 2. RISK LIBRARY (the master ITGC RACM reference data —
--    imported from racm.json, one row per group/ref control. Field names
--    intentionally mirror the JSON exactly, so importing is a 1:1 copy.)
create table if not exists risk_library (
  id uuid primary key default gen_random_uuid(),
  "group" text not null,                          -- e.g. "A", "B" ... "I"
  ref text not null unique,                       -- e.g. "A.1", "B.2"
  category text not null,                         -- e.g. "GOVERNANCE AND STRATEGY MANAGEMENT"
  risk_title text not null,
  risk_description text not null,
  control_objective text,
  control_description text,
  design_effectiveness_test_procedures text,
  operating_effectiveness_test_procedures text,
  created_at timestamptz default now()
);

-- 3. ASSESSMENTS (one "engagement" — e.g. "Q2 2026 ITGC review")
create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  scope text,
  period text,                          -- e.g. "Q2 2026"
  status text default 'in_progress',    -- in_progress | completed | archived
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. RACM ITEMS (the actual matrix rows for a given assessment — seeded
--    from risk_library, with the descriptive text copied across so that
--    editing the master library later doesn't rewrite history, plus the
--    assessment-specific result fields a reviewer fills in)
create table if not exists racm_items (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  risk_library_id uuid references risk_library(id),

  -- copied from risk_library at import time
  "group" text,
  ref text,
  category text,
  risk_title text,
  risk_description text,
  control_objective text,
  control_description text,
  design_effectiveness_test_procedures text,
  operating_effectiveness_test_procedures text,

  -- filled in during the assessment
  control_owner text,
  tested_by text,
  tested_date date,
  design_effectiveness_result text,     -- effective | ineffective | not_tested | not_applicable
  operating_effectiveness_result text,  -- effective | ineffective | not_tested | not_applicable
  overall_conclusion text,              -- effective | partially_effective | ineffective | not_tested
  observations_noted text,
  testing_workpapers text,              -- reference / link / filename to supporting workpaper

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. REPORT TEMPLATES (your JSON template structure for generated reports)
create table if not exists report_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,  -- null = shared/global template
  name text not null,
  template_json jsonb not null,
  created_at timestamptz default now()
);

-- 6. GENERATED REPORTS (snapshot of data + template used, for audit trail)
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  template_id uuid references report_templates(id),
  report_data jsonb not null,           -- the populated, rendered report payload
  generated_at timestamptz default now()
);

-- ============================================================
-- Auto-create a profile row whenever a new user signs up
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY — this is what gives every user a private dashboard
-- ============================================================
alter table profiles enable row level security;
alter table assessments enable row level security;
alter table racm_items enable row level security;
alter table report_templates enable row level security;
alter table reports enable row level security;
alter table risk_library enable row level security;

-- profiles: a user can only see/edit their own profile
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- risk_library: readable by any authenticated user (shared reference data)
create policy "risk_library_select_all" on risk_library for select using (auth.role() = 'authenticated');

-- assessments: full CRUD, but only on rows you own
create policy "assessments_select_own" on assessments for select using (auth.uid() = owner_id);
create policy "assessments_insert_own" on assessments for insert with check (auth.uid() = owner_id);
create policy "assessments_update_own" on assessments for update using (auth.uid() = owner_id);
create policy "assessments_delete_own" on assessments for delete using (auth.uid() = owner_id);

-- racm_items: scoped through the parent assessment's owner
create policy "racm_items_select_own" on racm_items for select
  using (exists (select 1 from assessments a where a.id = racm_items.assessment_id and a.owner_id = auth.uid()));
create policy "racm_items_insert_own" on racm_items for insert
  with check (exists (select 1 from assessments a where a.id = racm_items.assessment_id and a.owner_id = auth.uid()));
create policy "racm_items_update_own" on racm_items for update
  using (exists (select 1 from assessments a where a.id = racm_items.assessment_id and a.owner_id = auth.uid()));
create policy "racm_items_delete_own" on racm_items for delete
  using (exists (select 1 from assessments a where a.id = racm_items.assessment_id and a.owner_id = auth.uid()));

-- report_templates: own templates, plus any shared (owner_id is null) templates, read-only for shared
create policy "templates_select" on report_templates for select
  using (owner_id = auth.uid() or owner_id is null);
create policy "templates_insert_own" on report_templates for insert with check (auth.uid() = owner_id);
create policy "templates_update_own" on report_templates for update using (auth.uid() = owner_id);
create policy "templates_delete_own" on report_templates for delete using (auth.uid() = owner_id);

-- reports: scoped through the parent assessment's owner
create policy "reports_select_own" on reports for select
  using (exists (select 1 from assessments a where a.id = reports.assessment_id and a.owner_id = auth.uid()));
create policy "reports_insert_own" on reports for insert
  with check (exists (select 1 from assessments a where a.id = reports.assessment_id and a.owner_id = auth.uid()));
