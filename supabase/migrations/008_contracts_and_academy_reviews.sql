create table if not exists public.contracts (
  id uuid primary key default uuid_generate_v4(), opportunity_id uuid not null unique references public.opportunities(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade, status text not null default 'borrador' check (status in ('borrador','revision_cliente','aprobado','enviado','firmado','activo','vencido','cancelado')),
  client_legal_name text not null, client_rnc text, client_address text, representative_name text, representative_id text,
  effective_date date, signature_date date, expiration_date date, current_version integer not null default 0,
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.contract_versions (
  id uuid primary key default uuid_generate_v4(), contract_id uuid not null references public.contracts(id) on delete cascade,
  version integer not null check (version > 0), monthly_fee numeric(12,2) not null check (monthly_fee > 0),
  change_reason text not null check (length(trim(change_reason)) >= 3), negotiated_terms text,
  file_path text not null, master_sha256 text not null, generated_by uuid not null references public.profiles(id), generated_at timestamptz not null default now(),
  unique(contract_id, version)
);

create table if not exists public.contract_status_history (
  id uuid primary key default uuid_generate_v4(), contract_id uuid not null references public.contracts(id) on delete cascade,
  previous_status text, new_status text not null, notes text, changed_by uuid not null references public.profiles(id), changed_at timestamptz not null default now()
);

create table if not exists public.academy_review_runs (
  id uuid primary key default uuid_generate_v4(), review_period date not null unique, status text not null default 'borrador' check (status in ('borrador','aprobado','descartado')),
  source_summary jsonb not null default '{}'::jsonb, recommendations jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(), approved_by uuid references public.profiles(id), approved_at timestamptz
);

create index if not exists contracts_account_idx on public.contracts(account_id, updated_at desc);
create index if not exists contract_versions_contract_idx on public.contract_versions(contract_id, version desc);
alter table public.contracts enable row level security; alter table public.contract_versions enable row level security; alter table public.contract_status_history enable row level security; alter table public.academy_review_runs enable row level security;

drop policy if exists "contracts_scoped" on public.contracts;
drop policy if exists "contract_versions_scoped" on public.contract_versions;
drop policy if exists "contract_versions_insert" on public.contract_versions;
drop policy if exists "contract_history_scoped" on public.contract_status_history;
drop policy if exists "academy_managers" on public.academy_review_runs;

create policy "contracts_scoped" on public.contracts for all to authenticated using (exists(select 1 from public.opportunities o where o.id=opportunity_id and public.can_access_owner(o.owner_id))) with check (created_by=auth.uid() and exists(select 1 from public.opportunities o where o.id=opportunity_id and (public.current_profile_role() in ('superadmin','gerencia_comercial') or o.owner_id=auth.uid())));
create policy "contract_versions_scoped" on public.contract_versions for select to authenticated using (exists(select 1 from public.contracts c join public.opportunities o on o.id=c.opportunity_id where c.id=contract_id and public.can_access_owner(o.owner_id)));
create policy "contract_versions_insert" on public.contract_versions for insert to authenticated with check (generated_by=auth.uid() and exists(select 1 from public.contracts c join public.opportunities o on o.id=c.opportunity_id where c.id=contract_id and (public.current_profile_role() in ('superadmin','gerencia_comercial') or o.owner_id=auth.uid())));
create policy "contract_history_scoped" on public.contract_status_history for all to authenticated using (exists(select 1 from public.contracts c join public.opportunities o on o.id=c.opportunity_id where c.id=contract_id and public.can_access_owner(o.owner_id))) with check (changed_by=auth.uid());
create policy "academy_managers" on public.academy_review_runs for all to authenticated using (public.current_profile_role() in ('superadmin','gerencia_comercial')) with check (public.current_profile_role() in ('superadmin','gerencia_comercial'));

grant select,insert,update on public.contracts to authenticated; grant select,insert on public.contract_versions to authenticated; grant select,insert on public.contract_status_history to authenticated; grant select,insert,update on public.academy_review_runs to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('contract-files','contract-files',false,15728640,array['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/pdf']) on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
