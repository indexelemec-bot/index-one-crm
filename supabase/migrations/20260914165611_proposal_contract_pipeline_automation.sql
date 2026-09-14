alter table public.contract_versions
  add column if not exists data_snapshot jsonb not null default '{}'::jsonb;

create or replace function private.sync_account_owner_from_opportunity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.accounts
  set owner_id = new.owner_id,
      updated_at = clock_timestamp()
  where id = new.account_id
    and owner_id is distinct from new.owner_id;
  return new;
end;
$$;

drop trigger if exists opportunities_sync_account_owner on public.opportunities;
create trigger opportunities_sync_account_owner
after insert or update of owner_id on public.opportunities
for each row execute function private.sync_account_owner_from_opportunity();

update public.accounts a
set owner_id = o.owner_id,
    updated_at = clock_timestamp()
from public.opportunities o
where o.account_id = a.id
  and a.owner_id is distinct from o.owner_id
  and (select count(*) from public.opportunities siblings where siblings.account_id = a.id) = 1;

create or replace function private.advance_pipeline_from_proposal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.opportunities
    set stage = 'propuesta',
        next_action = 'Enviar propuesta y acordar fecha de revisión',
        next_action_at = greatest(coalesce(next_action_at, clock_timestamp()), clock_timestamp() + interval '2 days'),
        updated_at = clock_timestamp()
    where id = new.opportunity_id
      and stage in ('prospecto_identificado','problema_detectado','contacto_decisor','diagnostico','solucion_recomendada','presentacion');
  end if;

  if new.status = 'enviada' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    update public.opportunities
    set stage = 'propuesta_enviada',
        next_action = 'Confirmar recepción y revisar la propuesta con el cliente',
        next_action_at = clock_timestamp() + interval '2 days',
        updated_at = clock_timestamp()
    where id = new.opportunity_id
      and stage in ('prospecto_identificado','problema_detectado','contacto_decisor','diagnostico','solucion_recomendada','presentacion','propuesta');
  end if;

  return new;
end;
$$;

drop trigger if exists proposals_advance_pipeline on public.proposals;
create trigger proposals_advance_pipeline
after insert or update of status on public.proposals
for each row execute function private.advance_pipeline_from_proposal();

revoke all on function private.sync_account_owner_from_opportunity() from public, anon, authenticated;
revoke all on function private.advance_pipeline_from_proposal() from public, anon, authenticated;

comment on column public.contract_versions.data_snapshot is
  'Datos legales, económicos y fechas exactas utilizados para generar esta versión inmutable.';
