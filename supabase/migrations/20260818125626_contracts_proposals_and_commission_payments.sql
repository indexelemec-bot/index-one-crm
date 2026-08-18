alter table public.contract_versions
  add column if not exists proposal_id uuid references public.proposals(id) on delete restrict;

comment on column public.contract_versions.proposal_id is
  'Versión exacta de la propuesta comercial aprobada que aportó los honorarios al contrato.';

create index if not exists contract_versions_proposal_idx
  on public.contract_versions(proposal_id)
  where proposal_id is not null;

alter table public.sales_reports
  add column if not exists commission_paid_by uuid references public.profiles(id) on delete restrict;

alter table public.sales_reports
  drop constraint if exists sales_reports_commission_status_check;

update public.sales_reports
set commission_status = 'pendiente'
where commission_status in ('proyectada', 'ganada', 'pagadera', 'revertida');

alter table public.sales_reports
  add constraint sales_reports_commission_status_check
  check (commission_status in ('pendiente', 'pagada'));

alter table public.sales_reports
  alter column commission_status set default 'pendiente';

create table if not exists public.commission_payment_history (
  id uuid primary key default uuid_generate_v4(),
  sales_report_id uuid not null references public.sales_reports(id) on delete cascade,
  previous_status text not null check (previous_status in ('pendiente', 'pagada')),
  new_status text not null check (new_status in ('pendiente', 'pagada')),
  changed_by uuid not null references public.profiles(id) on delete restrict,
  changed_at timestamptz not null default now(),
  notes text
);

create index if not exists commission_payment_history_report_idx
  on public.commission_payment_history(sales_report_id, changed_at desc);

alter table public.commission_payment_history enable row level security;

drop policy if exists "commission_payment_history_select" on public.commission_payment_history;
create policy "commission_payment_history_select"
on public.commission_payment_history for select
to authenticated
using (
  exists (
    select 1
    from public.sales_reports report
    where report.id = sales_report_id
      and (
        public.current_profile_role() in ('superadmin', 'gerencia_comercial', 'administracion')
        or report.seller_id = (select auth.uid())
      )
  )
);

drop policy if exists "commission_payment_history_insert" on public.commission_payment_history;
create policy "commission_payment_history_insert"
on public.commission_payment_history for insert
to authenticated
with check (
  changed_by = (select auth.uid())
  and public.current_profile_role() in ('superadmin', 'gerencia_comercial', 'administracion')
);

revoke all on table public.commission_payment_history from anon, authenticated;
grant select, insert on table public.commission_payment_history to authenticated;

create or replace function public.mark_commission_paid(target_report_id uuid)
returns public.sales_reports
language plpgsql
security invoker
set search_path = ''
as $$
declare
  paid_report public.sales_reports;
  payment_time timestamptz := now();
begin
  if (select auth.uid()) is null then
    raise exception 'Sesión no disponible.' using errcode = '42501';
  end if;

  if public.current_profile_role() not in ('superadmin', 'gerencia_comercial', 'administracion') then
    raise exception 'No tienes permiso para registrar pagos de comisiones.' using errcode = '42501';
  end if;

  update public.sales_reports
  set commission_status = 'pagada',
      commission_paid_at = payment_time,
      commission_paid_by = (select auth.uid())
  where id = target_report_id
    and commission_status = 'pendiente'
  returning * into paid_report;

  if paid_report.id is null then
    raise exception 'La comisión no existe o ya fue pagada.' using errcode = 'P0002';
  end if;

  insert into public.commission_payment_history (
    sales_report_id, previous_status, new_status, changed_by, changed_at, notes
  ) values (
    paid_report.id, 'pendiente', 'pagada', (select auth.uid()), payment_time, 'Comisión marcada como pagada desde el CRM.'
  );

  return paid_report;
end;
$$;

revoke all on function public.mark_commission_paid(uuid) from public, anon;
grant execute on function public.mark_commission_paid(uuid) to authenticated;
