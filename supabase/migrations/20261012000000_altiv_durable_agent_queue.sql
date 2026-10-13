-- ALTIV durable queue, server-side only. Apply manually after reviewing in Supabase.
create extension if not exists pgmq;
select pgmq.create('altiv_agent_jobs');

create table if not exists public.altiv_agent_job_index (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  queue_message_id bigint not null unique,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  idempotency_key text not null,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, idempotency_key)
);
create index if not exists altiv_agent_job_index_project on public.altiv_agent_job_index(owner_id,project_id,created_at desc);
alter table public.altiv_agent_job_index enable row level security;
revoke all on public.altiv_agent_job_index from anon, authenticated;
grant select on public.altiv_agent_job_index to authenticated;
create policy "Owners may read own agent job status" on public.altiv_agent_job_index for select to authenticated using (owner_id = (select auth.uid()));

-- SECURITY: Only trusted backend/worker roles should call pgmq.send/read/delete/archive.
-- No direct grants to authenticated or anon for pgmq schemas.
