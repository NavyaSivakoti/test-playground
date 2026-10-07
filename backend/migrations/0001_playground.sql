-- Test Playground schema (plain Postgres). Every row is scoped by a namespace (ns) so parallel test runs never collide.
create extension if not exists pgcrypto;

create table if not exists public.records (
  id uuid primary key default gen_random_uuid(),
  ns text not null,
  kind text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists records_ns_kind on public.records (ns, kind, created_at);

create table if not exists public.page_state (
  ns text not null,
  page text not null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (ns, page)
);

create table if not exists public.ns_config (
  ns text primary key,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.inbox (
  id uuid primary key default gen_random_uuid(),
  ns text not null,
  to_addr text not null,
  subject text not null,
  body text not null,
  delivered text not null default 'mock',
  created_at timestamptz not null default now()
);
create index if not exists inbox_ns on public.inbox (ns, created_at desc);

-- Static reference data for "Database Verification" steps.
create table if not exists public.customers (
  id int primary key,
  name text not null,
  email text not null,
  plan text not null,
  country text not null
);
insert into public.customers (id, name, email, plan, country) values
  (1, 'Ada Lovelace', 'ada@example.com', 'enterprise', 'uk'),
  (2, 'Grace Hopper', 'grace@example.com', 'professional', 'us'),
  (3, 'Alan Turing', 'alan@example.com', 'starter', 'uk'),
  (4, 'Katherine Johnson', 'katherine@example.com', 'professional', 'us'),
  (5, 'Margaret Hamilton', 'margaret@example.com', 'enterprise', 'us')
on conflict (id) do nothing;

-- Only the API function writes. Other clients get no direct table access.
alter table public.records enable row level security;
alter table public.page_state enable row level security;
alter table public.ns_config enable row level security;
alter table public.inbox enable row level security;
alter table public.customers enable row level security;

-- Read-only role for "Database Verification" test steps. Set its password outside git:
--   alter role playground_reader with login password '<choose one>';
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'playground_reader') then
    create role playground_reader nologin;
  end if;
end $$;
grant usage on schema public to playground_reader;
grant select on public.customers, public.records, public.page_state, public.inbox to playground_reader;
create policy playground_reader_customers on public.customers for select to playground_reader using (true);
create policy playground_reader_records on public.records for select to playground_reader using (true);
create policy playground_reader_state on public.page_state for select to playground_reader using (true);
create policy playground_reader_inbox on public.inbox for select to playground_reader using (true);

-- Housekeeping: namespaces expire after 24 hours (needs the pg_cron extension; skip if unavailable).
create extension if not exists pg_cron;
select cron.schedule(
  'playground-cleanup',
  '17 * * * *',
  $$
    delete from public.records where updated_at < now() - interval '24 hours';
    delete from public.page_state where updated_at < now() - interval '24 hours';
    delete from public.ns_config where updated_at < now() - interval '24 hours';
    delete from public.inbox where created_at < now() - interval '24 hours';
  $$
);
