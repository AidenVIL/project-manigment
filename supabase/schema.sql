-- Sponsor Command Centre schema for a shared F1 team workspace.
-- Mk 1 version: frontend site password plus anonymous Supabase access.
-- This is convenient for a prototype but not secure for sensitive production data.
-- Tighten these policies and move to real auth before wider rollout.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  contact_role text,
  contact_email text,
  sector text,
  status text not null default 'prospect',
  ask_type text,
  ask_value numeric(12, 2) not null default 0,
  contribution_value numeric(12, 2) not null default 0,
  contribution_type text,
  first_contacted date,
  next_follow_up date,
  proposal_date date,
  interview_date date,
  response_status text not null default 'waiting',
  request_from_us text,
  giving_in_return text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'General',
  subject text not null,
  html text not null,
  design jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.email_templates
add column if not exists design jsonb;

drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at
before update on public.companies
for each row
execute function public.set_updated_at();

drop trigger if exists trg_email_templates_updated_at on public.email_templates;
create trigger trg_email_templates_updated_at
before update on public.email_templates
for each row
execute function public.set_updated_at();

alter table public.companies enable row level security;
alter table public.email_templates enable row level security;

drop policy if exists "Shared access can read companies" on public.companies;
create policy "Shared access can read companies"
on public.companies
for select
to anon, authenticated
using (true);

drop policy if exists "Shared access can insert companies" on public.companies;
create policy "Shared access can insert companies"
on public.companies
for insert
to anon, authenticated
with check (true);

drop policy if exists "Shared access can update companies" on public.companies;
create policy "Shared access can update companies"
on public.companies
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Shared access can delete companies" on public.companies;
create policy "Shared access can delete companies"
on public.companies
for delete
to anon, authenticated
using (true);

drop policy if exists "Shared access can read templates" on public.email_templates;
create policy "Shared access can read templates"
on public.email_templates
for select
to anon, authenticated
using (true);

drop policy if exists "Shared access can insert templates" on public.email_templates;
create policy "Shared access can insert templates"
on public.email_templates
for insert
to anon, authenticated
with check (true);

drop policy if exists "Shared access can update templates" on public.email_templates;
create policy "Shared access can update templates"
on public.email_templates
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Shared access can delete templates" on public.email_templates;
create policy "Shared access can delete templates"
on public.email_templates
for delete
to anon, authenticated
using (true);
