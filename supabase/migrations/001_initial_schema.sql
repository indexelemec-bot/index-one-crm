create extension if not exists "uuid-ossp";
create type public.user_role as enum ('superadmin','gerencia_comercial','ejecutivo','administracion','consulta');
create type public.opportunity_stage as enum ('prospecto_identificado','problema_detectado','contacto_decisor','diagnostico','solucion_recomendada','presentacion','propuesta','negociacion','aprobacion','contrato_transicion','cliente_activo','perdida');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null, role public.user_role not null default 'ejecutivo', active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.accounts (
  id uuid primary key default uuid_generate_v4(), name text not null, account_type text not null,
  address text, sector text, city text, units integer check(units > 0), towers integer not null default 1 check(towers > 0),
  profile text, source text, created_by uuid references public.profiles(id), owner_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.stakeholders (
  id uuid primary key default uuid_generate_v4(), account_id uuid not null references public.accounts(id) on delete cascade,
  full_name text not null, role text, phone text, email text, influence integer check(influence between 1 and 5),
  position text check(position in ('champion','neutral','opposed','unknown')), is_decision_maker boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.opportunities (
  id uuid primary key default uuid_generate_v4(), account_id uuid not null references public.accounts(id) on delete cascade,
  stage public.opportunity_stage not null default 'prospecto_identificado', primary_problem text not null, impact text,
  proposed_solution text, monthly_fee numeric(12,2) not null default 0 check(monthly_fee >= 0), probability integer not null default 10 check(probability between 0 and 100),
  next_action text, next_action_at timestamptz, owner_id uuid not null references public.profiles(id), lost_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint active_opportunity_requires_next_action check(stage in ('cliente_activo','perdida') or (nullif(trim(next_action),'') is not null and next_action_at is not null))
);
create table public.activities (
  id uuid primary key default uuid_generate_v4(), opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  activity_type text not null, outcome text, next_action text, due_at timestamptz, completed_at timestamptz,
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table public.tasks (
  id uuid primary key default uuid_generate_v4(), opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  title text not null, due_at timestamptz not null, priority text not null default 'media' check(priority in ('alta','media','baja')),
  status text not null default 'pendiente' check(status in ('pendiente','completada','vencida')), outcome text,
  owner_id uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table public.references_catalog (
  id uuid primary key default uuid_generate_v4(), client_name text not null, location text not null, units integer not null check(units > 0),
  account_type text not null, profile text, approved boolean not null default true, contact_share_authorized boolean not null default false
);
create table public.proposals (
  id uuid primary key default uuid_generate_v4(), opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  version integer not null default 1 check(version > 0), client_name text not null, issue_date date not null default current_date,
  monthly_fee numeric(12,2) not null check(monthly_fee > 0), template_key text not null default 'propuesta-index-condo-2026',
  reference_ids uuid[] not null, status text not null default 'borrador', generated_by uuid not null references public.profiles(id),
  generated_at timestamptz not null default now(), sent_at timestamptz, expires_at date generated always as (issue_date + 30) stored,
  unique(opportunity_id, version), constraint exactly_three_references check(cardinality(reference_ids) = 3)
);

create or replace function public.current_profile_role() returns public.user_role language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid() and active=true $$;
create or replace function public.can_access_owner(owner uuid) returns boolean language sql stable security definer set search_path=public as $$ select public.current_profile_role() in ('superadmin','gerencia_comercial','administracion','consulta') or owner=auth.uid() $$;
revoke all on function public.current_profile_role() from public; grant execute on function public.current_profile_role() to authenticated;
revoke all on function public.can_access_owner(uuid) from public; grant execute on function public.can_access_owner(uuid) to authenticated;

alter table public.profiles enable row level security; alter table public.accounts enable row level security; alter table public.stakeholders enable row level security;
alter table public.opportunities enable row level security; alter table public.activities enable row level security; alter table public.tasks enable row level security;
alter table public.references_catalog enable row level security; alter table public.proposals enable row level security;

create policy "profiles self or managers read" on public.profiles for select to authenticated using(id=auth.uid() or public.current_profile_role() in ('superadmin','gerencia_comercial'));
create policy "superadmin manages profiles" on public.profiles for all to authenticated using(public.current_profile_role()='superadmin') with check(public.current_profile_role()='superadmin');
create policy "accounts scoped read" on public.accounts for select to authenticated using(public.can_access_owner(owner_id));
create policy "commercial creates accounts" on public.accounts for insert to authenticated with check(public.current_profile_role() in ('superadmin','gerencia_comercial','ejecutivo') and (owner_id=auth.uid() or public.current_profile_role() in ('superadmin','gerencia_comercial')));
create policy "accounts scoped update" on public.accounts for update to authenticated using(public.can_access_owner(owner_id)) with check(public.current_profile_role() in ('superadmin','gerencia_comercial') or owner_id=auth.uid());
create policy "opportunities scoped" on public.opportunities for select to authenticated using(public.can_access_owner(owner_id));
create policy "commercial writes opportunities" on public.opportunities for all to authenticated using(public.current_profile_role() in ('superadmin','gerencia_comercial') or owner_id=auth.uid()) with check(public.current_profile_role() in ('superadmin','gerencia_comercial') or owner_id=auth.uid());
create policy "stakeholders via account" on public.stakeholders for select to authenticated using(exists(select 1 from public.accounts a where a.id=account_id and public.can_access_owner(a.owner_id)));
create policy "commercial writes stakeholders" on public.stakeholders for all to authenticated using(exists(select 1 from public.accounts a where a.id=account_id and (public.current_profile_role() in ('superadmin','gerencia_comercial') or a.owner_id=auth.uid()))) with check(exists(select 1 from public.accounts a where a.id=account_id and (public.current_profile_role() in ('superadmin','gerencia_comercial') or a.owner_id=auth.uid())));
create policy "activities via opportunity" on public.activities for all to authenticated using(exists(select 1 from public.opportunities o where o.id=opportunity_id and public.can_access_owner(o.owner_id))) with check(exists(select 1 from public.opportunities o where o.id=opportunity_id and (public.current_profile_role() in ('superadmin','gerencia_comercial') or o.owner_id=auth.uid())));
create policy "tasks scoped" on public.tasks for all to authenticated using(public.can_access_owner(owner_id)) with check(public.current_profile_role() in ('superadmin','gerencia_comercial') or owner_id=auth.uid());
create policy "approved references readable" on public.references_catalog for select to authenticated using(approved or public.current_profile_role() in ('superadmin','gerencia_comercial'));
create policy "managers manage references" on public.references_catalog for all to authenticated using(public.current_profile_role() in ('superadmin','gerencia_comercial')) with check(public.current_profile_role() in ('superadmin','gerencia_comercial'));
create policy "proposals via opportunity" on public.proposals for select to authenticated using(exists(select 1 from public.opportunities o where o.id=opportunity_id and public.can_access_owner(o.owner_id)));
create policy "commercial creates proposals" on public.proposals for insert to authenticated with check(generated_by=auth.uid() and exists(select 1 from public.opportunities o where o.id=opportunity_id and (public.current_profile_role() in ('superadmin','gerencia_comercial') or o.owner_id=auth.uid())));

create index accounts_owner_idx on public.accounts(owner_id); create index opportunities_owner_idx on public.opportunities(owner_id);
create index opportunities_account_idx on public.opportunities(account_id); create index tasks_owner_due_idx on public.tasks(owner_id,due_at);
create index stakeholders_account_idx on public.stakeholders(account_id); create index proposals_opportunity_idx on public.proposals(opportunity_id);
