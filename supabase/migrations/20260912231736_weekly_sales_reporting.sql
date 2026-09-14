create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.commercial_report_settings (
  setting_key text primary key default 'default' check (setting_key = 'default'),
  never_contacted_business_days integer not null default 1 check (never_contacted_business_days between 0 and 30),
  inactive_days integer not null default 7 check (inactive_days between 1 and 365),
  proposal_followup_days integer not null default 3 check (proposal_followup_days between 1 and 90),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.commercial_report_settings (setting_key)
values ('default')
on conflict (setting_key) do nothing;

create table if not exists public.opportunity_stage_history (
  id uuid primary key default extensions.uuid_generate_v4(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  previous_stage public.opportunity_stage,
  new_stage public.opportunity_stage not null,
  moved_by uuid references public.profiles(id),
  owner_id_snapshot uuid not null references public.profiles(id),
  moved_at timestamptz not null default now(),
  previous_stage_entered_at timestamptz,
  previous_stage_duration_seconds bigint check (previous_stage_duration_seconds is null or previous_stage_duration_seconds >= 0),
  change_note text check (change_note is null or length(trim(change_note)) between 1 and 1000)
);

create index if not exists opportunity_stage_history_opportunity_moved_idx
  on public.opportunity_stage_history (opportunity_id, moved_at desc);
create index if not exists opportunity_stage_history_owner_moved_idx
  on public.opportunity_stage_history (owner_id_snapshot, moved_at desc);
create index if not exists opportunity_stage_history_stage_moved_idx
  on public.opportunity_stage_history (new_stage, moved_at desc);
create index if not exists opportunities_reporting_owner_stage_idx
  on public.opportunities (owner_id, stage, updated_at desc);
create index if not exists accounts_reporting_created_idx
  on public.accounts (created_at desc, owner_id);
create index if not exists communications_reporting_created_idx
  on public.communications (opportunity_id, created_at desc);
create index if not exists proposals_reporting_generated_idx
  on public.proposals (opportunity_id, generated_at desc);

create or replace function private.capture_opportunity_stage_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entered_at timestamptz;
  changed_on timestamptz := clock_timestamp();
  note_value text := nullif(trim(current_setting('index.stage_change_note', true)), '');
begin
  if old.stage is not distinct from new.stage then
    return new;
  end if;

  select h.moved_at
  into entered_at
  from public.opportunity_stage_history h
  where h.opportunity_id = old.id
  order by h.moved_at desc
  limit 1;

  entered_at := coalesce(entered_at, old.created_at);

  insert into public.opportunity_stage_history (
    opportunity_id,
    account_id,
    previous_stage,
    new_stage,
    moved_by,
    owner_id_snapshot,
    moved_at,
    previous_stage_entered_at,
    previous_stage_duration_seconds,
    change_note
  ) values (
    old.id,
    old.account_id,
    old.stage,
    new.stage,
    (select auth.uid()),
    new.owner_id,
    changed_on,
    entered_at,
    greatest(0, extract(epoch from (changed_on - entered_at))::bigint),
    note_value
  );

  return new;
end;
$$;

drop trigger if exists opportunities_capture_stage_change on public.opportunities;
create trigger opportunities_capture_stage_change
after update of stage on public.opportunities
for each row
when (old.stage is distinct from new.stage)
execute function private.capture_opportunity_stage_change();

create or replace function public.prevent_stage_history_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'El historial de etapas es inmutable.' using errcode = 'P0001';
end;
$$;

drop trigger if exists opportunity_stage_history_immutable on public.opportunity_stage_history;
create trigger opportunity_stage_history_immutable
before update or delete on public.opportunity_stage_history
for each row execute function public.prevent_stage_history_mutation();

insert into public.opportunity_stage_history (
  opportunity_id,
  account_id,
  previous_stage,
  new_stage,
  moved_by,
  owner_id_snapshot,
  moved_at,
  previous_stage_entered_at,
  previous_stage_duration_seconds,
  change_note
)
select
  o.id,
  o.account_id,
  null,
  o.stage,
  null,
  o.owner_id,
  o.created_at,
  null,
  null,
  'Registro inicial incorporado al habilitar la auditoría semanal'
from public.opportunities o
where not exists (
  select 1 from public.opportunity_stage_history h where h.opportunity_id = o.id
);

create or replace function private.move_opportunity_stage(
  target_opportunity uuid,
  replacement_stage public.opportunity_stage,
  stage_note text default null
)
returns public.opportunities
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_role public.user_role := public.current_profile_role();
  target_row public.opportunities%rowtype;
begin
  if actor_id is null then
    raise exception 'Sesión no disponible.' using errcode = '42501';
  end if;

  select * into target_row
  from public.opportunities o
  where o.id = target_opportunity
  for update;

  if not found then
    raise exception 'La oportunidad no existe.' using errcode = 'P0002';
  end if;

  if actor_role not in ('superadmin', 'gerencia_comercial') and target_row.owner_id <> actor_id then
    raise exception 'No tienes permiso para mover esta oportunidad.' using errcode = '42501';
  end if;

  if stage_note is not null and length(trim(stage_note)) > 1000 then
    raise exception 'La nota del movimiento excede 1000 caracteres.' using errcode = '22023';
  end if;

  if target_row.stage = replacement_stage then
    return target_row;
  end if;

  perform set_config('index.stage_change_note', coalesce(trim(stage_note), ''), true);

  update public.opportunities
  set stage = replacement_stage,
      updated_at = clock_timestamp()
  where id = target_opportunity
  returning * into target_row;

  return target_row;
end;
$$;

create or replace function public.move_opportunity_stage(
  target_opportunity uuid,
  replacement_stage public.opportunity_stage,
  stage_note text default null
)
returns public.opportunities
language sql
security invoker
set search_path = ''
as $$
  select private.move_opportunity_stage(target_opportunity, replacement_stage, stage_note)
$$;

alter table public.commercial_report_settings enable row level security;
alter table public.opportunity_stage_history enable row level security;

drop policy if exists "report_settings_read" on public.commercial_report_settings;
create policy "report_settings_read"
on public.commercial_report_settings
for select
to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "report_settings_manage" on public.commercial_report_settings;
create policy "report_settings_manage"
on public.commercial_report_settings
for all
to authenticated
using (public.current_profile_role() in ('superadmin', 'gerencia_comercial'))
with check (
  public.current_profile_role() in ('superadmin', 'gerencia_comercial')
  and updated_by = (select auth.uid())
);

drop policy if exists "stage_history_scoped_read" on public.opportunity_stage_history;
create policy "stage_history_scoped_read"
on public.opportunity_stage_history
for select
to authenticated
using (
  exists (
    select 1
    from public.opportunities o
    where o.id = opportunity_id
      and public.can_access_owner(o.owner_id)
  )
);

revoke all on public.commercial_report_settings from public, anon;
revoke all on public.opportunity_stage_history from public, anon;
grant select, insert, update on public.commercial_report_settings to authenticated;
grant select on public.opportunity_stage_history to authenticated;
revoke insert, update, delete, truncate on public.opportunity_stage_history from authenticated;

revoke all on function private.capture_opportunity_stage_change() from public, anon, authenticated;
revoke all on function public.prevent_stage_history_mutation() from public, anon, authenticated;
revoke all on function private.move_opportunity_stage(uuid, public.opportunity_stage, text) from public, anon, authenticated;
revoke all on function public.move_opportunity_stage(uuid, public.opportunity_stage, text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.move_opportunity_stage(uuid, public.opportunity_stage, text) to authenticated;
grant execute on function public.move_opportunity_stage(uuid, public.opportunity_stage, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'opportunity_stage_history'
    ) then
      alter publication supabase_realtime add table public.opportunity_stage_history;
    end if;
  end if;
end;
$$;
