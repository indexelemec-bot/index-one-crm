create table if not exists public.opportunity_assignment_history (
  id uuid primary key default uuid_generate_v4(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  previous_owner_id uuid references public.profiles(id),
  new_owner_id uuid not null references public.profiles(id),
  changed_by uuid not null references public.profiles(id),
  change_reason text not null check (length(trim(change_reason)) >= 3),
  changed_at timestamptz not null default now()
);

create table if not exists public.sales_reports (
  id uuid primary key default uuid_generate_v4(),
  opportunity_id uuid not null unique references public.opportunities(id),
  account_id uuid not null references public.accounts(id),
  seller_id uuid not null references public.profiles(id),
  closed_by uuid not null references public.profiles(id),
  closed_at timestamptz not null default now(),
  initial_fee numeric(12,2) not null check (initial_fee >= 0),
  final_fee numeric(12,2) not null check (final_fee > 0),
  annual_value numeric(14,2) not null check (annual_value > 0),
  commission_rate numeric(5,4) not null default .5 check (commission_rate between 0 and 1),
  commission_base numeric(12,2) not null check (commission_base > 0),
  commission_amount numeric(12,2) not null check (commission_amount >= 0),
  commission_status text not null default 'ganada' check (commission_status in ('proyectada','ganada','pagadera','pagada','revertida')),
  first_payment_received_at timestamptz,
  commission_paid_at timestamptz,
  contract_reference text not null check (length(trim(contract_reference)) >= 3),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists assignment_history_opportunity_idx on public.opportunity_assignment_history(opportunity_id, changed_at desc);
create index if not exists sales_reports_seller_idx on public.sales_reports(seller_id, closed_at desc);
create index if not exists sales_reports_status_idx on public.sales_reports(commission_status);

alter table public.opportunity_assignment_history enable row level security;
alter table public.sales_reports enable row level security;

drop policy if exists "assignment_history_select" on public.opportunity_assignment_history;
create policy "assignment_history_select" on public.opportunity_assignment_history for select using (
  exists (select 1 from public.opportunities o where o.id = opportunity_id and public.can_access_owner(o.owner_id))
);
drop policy if exists "assignment_history_insert" on public.opportunity_assignment_history;
create policy "assignment_history_insert" on public.opportunity_assignment_history for insert with check (
  changed_by = auth.uid() and public.current_profile_role() in ('superadmin','gerencia_comercial')
);

drop policy if exists "sales_reports_select" on public.sales_reports;
create policy "sales_reports_select" on public.sales_reports for select using (
  public.current_profile_role() in ('superadmin','gerencia_comercial','administracion') or seller_id = auth.uid()
);
drop policy if exists "sales_reports_insert" on public.sales_reports;
create policy "sales_reports_insert" on public.sales_reports for insert with check (
  closed_by = auth.uid() and (seller_id = auth.uid() or public.current_profile_role() in ('superadmin','gerencia_comercial'))
);
drop policy if exists "sales_reports_update" on public.sales_reports;
create policy "sales_reports_update" on public.sales_reports for update using (
  public.current_profile_role() in ('superadmin','gerencia_comercial','administracion')
) with check (public.current_profile_role() in ('superadmin','gerencia_comercial','administracion'));

grant select, insert on public.opportunity_assignment_history to authenticated;
grant select, insert, update on public.sales_reports to authenticated;
