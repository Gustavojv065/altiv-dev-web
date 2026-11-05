-- ALTIV DEV AI: licenças exclusivas do APK, geridas pelo Painel Master existente.
-- Não altera saas_accounts/saas_subscriptions: a assinatura do site é independente.
-- REVISAR EM STAGING ANTES DE EXECUTAR. Nunca inserir credenciais ou tokens aqui.

create table if not exists public.altiv_service_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_code text not null default 'monthly' check (plan_code in ('monthly', 'trial')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended', 'cancelled')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint altiv_valid_dates check (valid_until > valid_from)
);

alter table public.altiv_service_subscriptions enable row level security;
revoke all on public.altiv_service_subscriptions from public, anon, authenticated;
grant select (user_id, plan_code, status, valid_from, valid_until)
  on public.altiv_service_subscriptions to authenticated;

drop policy if exists altiv_subscription_read_own on public.altiv_service_subscriptions;
create policy altiv_subscription_read_own
on public.altiv_service_subscriptions for select to authenticated
using ((select auth.uid()) = user_id);

-- Exatamente o contrato RPC que o Android ALTIV DEV AI já espera.
-- Data e prazo validados no relógio do servidor; jamais no relógio Android.
create or replace function public.altiv_my_subscription()
returns table (
  is_active boolean,
  plan_code text,
  subscription_status text,
  expires_at timestamptz,
  checked_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (s.status = 'active' and s.valid_from <= now() and s.valid_until > now()) as is_active,
    s.plan_code,
    s.status as subscription_status,
    s.valid_until as expires_at,
    now() as checked_at
  from public.altiv_service_subscriptions s
  where s.user_id = (select auth.uid())
  limit 1;
$$;

revoke all on function public.altiv_my_subscription() from public, anon;
grant execute on function public.altiv_my_subscription() to authenticated;

-- Auditoria interna do Painel Master; clientes não recebem SELECT ou INSERT.
create table if not exists public.altiv_apk_license_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('invited','linked','renewed','suspended','cancelled')),
  previous_expires_at timestamptz,
  new_expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.altiv_apk_license_events enable row level security;
revoke all on public.altiv_apk_license_events from public, anon, authenticated;

create index if not exists altiv_apk_license_events_user_idx
  on public.altiv_apk_license_events (user_id, created_at desc);

comment on table public.altiv_service_subscriptions is
  'ALTIV-hosted commercial service subscription; never blocks customer local GPL tools.';
