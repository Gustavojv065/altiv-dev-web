-- ALTIV DEV base schema. Apply only after reviewing the target Supabase project.
create extension if not exists vector;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  github_repo text,
  vercel_project_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_memories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  scope text not null check (scope in ('user','workspace','project','session')),
  kind text not null,
  content text not null,
  importance smallint not null default 50 check (importance between 0 and 100),
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.agent_memories enable row level security;

create policy "projects_select_own" on public.projects for select to authenticated using ((select auth.uid()) = owner_id);
create policy "projects_insert_own" on public.projects for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "projects_update_own" on public.projects for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "projects_delete_own" on public.projects for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "memories_select_own" on public.agent_memories for select to authenticated using ((select auth.uid()) = owner_id);
create policy "memories_insert_own" on public.agent_memories for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "memories_update_own" on public.agent_memories for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "memories_delete_own" on public.agent_memories for delete to authenticated using ((select auth.uid()) = owner_id);


-- Encrypted BYOK credentials. Ciphertext is encrypted by the server before storage.
create table if not exists public.user_credentials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('openrouter','opencode-zen','openai','gemini','nvidia','groq','cerebras','deepseek','mistral','together','fireworks','xai','anthropic','github')),
  label text not null,
  encrypted_secret text not null,
  secret_iv text not null,
  secret_tag text not null,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, kind)
);

alter table public.user_credentials enable row level security;
create policy "credentials_select_own" on public.user_credentials for select to authenticated using ((select auth.uid()) = owner_id);
create policy "credentials_insert_own" on public.user_credentials for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "credentials_update_own" on public.user_credentials for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "credentials_delete_own" on public.user_credentials for delete to authenticated using ((select auth.uid()) = owner_id);


-- SaaS commercial foundation
alter table if exists public.profiles add column if not exists role text not null default 'user';
alter table if exists public.profiles add constraint profiles_role_check check (role in ('user','support','admin','super_admin')) not valid;

create table if not exists public.saas_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('trial','active','past_due','suspended','canceled')),
  trial_plan_code text check (trial_plan_code is null or trial_plan_code in ('starter','pro','business')),
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saas_memberships (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.saas_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  unique(account_id,user_id)
);

create table if not exists public.saas_plans (
  code text primary key,
  name text not null,
  price_monthly_brl numeric(10,2),
  price_yearly_brl numeric(10,2),
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saas_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.saas_accounts(id) on delete cascade,
  plan_code text not null references public.saas_plans(code),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  status text not null default 'trialing' check (status in ('trialing','active','past_due','paused','canceled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id bigint generated by default as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.saas_accounts(id) on delete set null,
  event_type text not null,
  quantity numeric not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.saas_accounts enable row level security;
alter table public.saas_memberships enable row level security;
alter table public.saas_plans enable row level security;
alter table public.saas_subscriptions enable row level security;
alter table public.usage_events enable row level security;

create policy "saas_accounts_owner_select" on public.saas_accounts for select to authenticated using ((select auth.uid()) = owner_id);
create policy "saas_accounts_owner_update" on public.saas_accounts for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "saas_accounts_owner_insert" on public.saas_accounts for insert to authenticated with check ((select auth.uid()) = owner_id);

create policy "saas_memberships_member_select" on public.saas_memberships for select to authenticated using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.saas_accounts a where a.id = account_id and a.owner_id = (select auth.uid())
  )
);

create policy "saas_plans_authenticated_select" on public.saas_plans for select to authenticated using (active = true);

create policy "saas_subscriptions_account_select" on public.saas_subscriptions for select to authenticated using (
  exists (select 1 from public.saas_accounts a where a.id = account_id and a.owner_id = (select auth.uid()))
);

create policy "usage_events_owner_select" on public.usage_events for select to authenticated using ((select auth.uid()) = owner_id);
create policy "usage_events_owner_insert" on public.usage_events for insert to authenticated with check ((select auth.uid()) = owner_id);

alter table if exists public.projects add column if not exists account_id uuid references public.saas_accounts(id) on delete set null;

insert into public.saas_plans(code,name,limits,features,sort_order)
values
  ('free','Free','{"projects":2,"monthlyAgentRuns":30,"members":1}'::jsonb,'{"customDomain":false,"privateRepositories":false,"priorityModels":false}'::jsonb,10),
  ('starter','Starter','{"projects":10,"monthlyAgentRuns":300,"members":2}'::jsonb,'{"customDomain":true,"privateRepositories":true,"priorityModels":false}'::jsonb,20),
  ('pro','Pro','{"projects":50,"monthlyAgentRuns":2000,"members":5}'::jsonb,'{"customDomain":true,"privateRepositories":true,"priorityModels":true}'::jsonb,30),
  ('business','Business','{"projects":250,"monthlyAgentRuns":10000,"members":25}'::jsonb,'{"customDomain":true,"privateRepositories":true,"priorityModels":true}'::jsonb,40)
on conflict (code) do update set
  name=excluded.name,
  limits=excluded.limits,
  features=excluded.features,
  sort_order=excluded.sort_order,
  updated_at=now();


create table if not exists public.billing_events (
  id bigint generated by default as identity primary key,
  provider text not null,
  provider_event_id text,
  event_type text,
  account_id uuid references public.saas_accounts(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider, provider_event_id)
);
alter table public.billing_events enable row level security;
