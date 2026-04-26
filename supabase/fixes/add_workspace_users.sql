-- Workspace user accounts with first-login password setup.
-- Run this in Supabase SQL editor before using username-based login.

create extension if not exists "pgcrypto";

create table if not exists public.workspace_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  role text not null default 'member',
  password_hash text,
  must_set_password boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.workspace_users
add column if not exists role text default 'member',
add column if not exists password_hash text,
add column if not exists must_set_password boolean default true,
add column if not exists is_active boolean default true,
add column if not exists created_at timestamptz default timezone('utc', now()),
add column if not exists updated_at timestamptz default timezone('utc', now());

drop trigger if exists trg_workspace_users_updated_at on public.workspace_users;
create trigger trg_workspace_users_updated_at
before update on public.workspace_users
for each row
execute function public.set_updated_at();

alter table public.workspace_users enable row level security;

drop policy if exists "Shared access can read workspace users" on public.workspace_users;
create policy "Shared access can read workspace users"
on public.workspace_users
for select
to anon, authenticated
using (true);

drop policy if exists "Shared access can insert workspace users" on public.workspace_users;
create policy "Shared access can insert workspace users"
on public.workspace_users
for insert
to anon, authenticated
with check (true);

drop policy if exists "Shared access can update workspace users" on public.workspace_users;
create policy "Shared access can update workspace users"
on public.workspace_users
for update
to anon, authenticated
using (true)
with check (true);

create or replace function public.workspace_create_user(
  p_username text,
  p_role text default 'member'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  normalized_username text := lower(trim(coalesce(p_username, '')));
  normalized_role text := case when lower(trim(coalesce(p_role, 'member'))) = 'admin' then 'admin' else 'member' end;
  output_row public.workspace_users;
begin
  if normalized_username = '' then
    raise exception 'Username is required';
  end if;

  insert into public.workspace_users (username, role, must_set_password, is_active)
  values (normalized_username, normalized_role, true, true)
  on conflict (username)
  do update set
    role = excluded.role,
    is_active = true,
    updated_at = timezone('utc', now())
  returning * into output_row;

  return jsonb_build_object(
    'status', 'ok',
    'username', output_row.username,
    'role', output_row.role
  );
end;
$$;

create or replace function public.workspace_login(
  p_username text,
  p_password text default ''
)
returns jsonb
language plpgsql
security definer
as $$
declare
  normalized_username text := lower(trim(coalesce(p_username, '')));
  input_password text := coalesce(p_password, '');
  user_row public.workspace_users;
begin
  if normalized_username = '' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select *
  into user_row
  from public.workspace_users
  where username = normalized_username
  limit 1;

  if user_row.id is null or user_row.is_active is false then
    return jsonb_build_object('status', 'invalid');
  end if;

  if user_row.must_set_password is true or coalesce(user_row.password_hash, '') = '' then
    return jsonb_build_object(
      'status', 'setup_required',
      'username', user_row.username,
      'role', user_row.role
    );
  end if;

  if crypt(input_password, user_row.password_hash) = user_row.password_hash then
    return jsonb_build_object(
      'status', 'ok',
      'username', user_row.username,
      'role', user_row.role
    );
  end if;

  return jsonb_build_object('status', 'invalid');
end;
$$;

create or replace function public.workspace_set_password(
  p_username text,
  p_new_password text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  normalized_username text := lower(trim(coalesce(p_username, '')));
  next_password text := coalesce(p_new_password, '');
  user_row public.workspace_users;
begin
  if normalized_username = '' then
    raise exception 'Username is required';
  end if;

  if length(next_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;

  select *
  into user_row
  from public.workspace_users
  where username = normalized_username
  limit 1;

  if user_row.id is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  update public.workspace_users
  set
    password_hash = crypt(next_password, gen_salt('bf')),
    must_set_password = false,
    updated_at = timezone('utc', now())
  where username = normalized_username;

  return jsonb_build_object(
    'status', 'ok',
    'username', normalized_username,
    'role', user_row.role
  );
end;
$$;

create or replace function public.workspace_reset_user_password(
  p_username text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  normalized_username text := lower(trim(coalesce(p_username, '')));
begin
  if normalized_username = '' then
    raise exception 'Username is required';
  end if;

  update public.workspace_users
  set
    password_hash = null,
    must_set_password = true,
    updated_at = timezone('utc', now())
  where username = normalized_username;

  return jsonb_build_object('status', 'ok', 'username', normalized_username);
end;
$$;

grant execute on function public.workspace_create_user(text, text) to anon, authenticated;
grant execute on function public.workspace_login(text, text) to anon, authenticated;
grant execute on function public.workspace_set_password(text, text) to anon, authenticated;
grant execute on function public.workspace_reset_user_password(text) to anon, authenticated;

-- Bootstrap admin requested in this workspace.
select public.workspace_create_user('aiden', 'admin');
select public.workspace_set_password('aiden', '2013!Aiden');
