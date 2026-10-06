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
