alter table public.opportunity_assignment_history
  add column if not exists note text;

alter table public.opportunity_assignment_history
  drop constraint if exists opportunity_assignment_history_note_length;
alter table public.opportunity_assignment_history
  add constraint opportunity_assignment_history_note_length
  check (note is null or length(trim(note)) between 1 and 2000);

create index if not exists activities_opportunity_created_idx
  on public.activities(opportunity_id, created_at desc);
create index if not exists tasks_opportunity_created_idx
  on public.tasks(opportunity_id, created_at desc);
create index if not exists tasks_pending_opportunity_owner_idx
  on public.tasks(opportunity_id, owner_id)
  where status = 'pendiente';
create index if not exists assignment_history_previous_owner_idx
  on public.opportunity_assignment_history(previous_owner_id);
create index if not exists assignment_history_new_owner_idx
  on public.opportunity_assignment_history(new_owner_id);
create index if not exists assignment_history_changed_by_idx
  on public.opportunity_assignment_history(changed_by);

create or replace function public.enforce_opportunity_assignment_audit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.owner_id is distinct from new.owner_id and not exists (
    select 1
    from public.opportunity_assignment_history h
    where h.opportunity_id = old.id
      and h.previous_owner_id is not distinct from old.owner_id
      and h.new_owner_id = new.owner_id
      and h.changed_by = (select auth.uid())
      and h.changed_at >= statement_timestamp() - interval '30 seconds'
  ) then
    raise exception 'La reasignación requiere un motivo registrado.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists opportunities_assignment_requires_audit on public.opportunities;
create trigger opportunities_assignment_requires_audit
before update of owner_id on public.opportunities
for each row execute function public.enforce_opportunity_assignment_audit();

create or replace function public.prevent_assignment_history_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'El historial de asignaciones es inmutable.' using errcode = 'P0001';
end;
$$;

drop trigger if exists opportunity_assignment_history_immutable on public.opportunity_assignment_history;
create trigger opportunity_assignment_history_immutable
before update or delete on public.opportunity_assignment_history
for each row execute function public.prevent_assignment_history_mutation();

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- INDEX ONE currently models one commercial opportunity per account. Refuse the
-- reassignment instead of changing account visibility ambiguously if legacy or
-- imported data violates that invariant.
create or replace function private.reassign_opportunity(
  target_opportunity uuid,
  replacement_owner uuid,
  assignment_reason text,
  assignment_note text default null
)
returns table (
  id uuid,
  opportunity_id uuid,
  previous_owner_id uuid,
  new_owner_id uuid,
  changed_by uuid,
  change_reason text,
  note text,
  changed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_role public.user_role := public.current_profile_role();
  old_owner uuid;
  linked_account uuid;
  history_id uuid := public.uuid_generate_v4();
  changed_on timestamptz := clock_timestamp();
begin
  if actor_id is null then raise exception 'Sesión no disponible.' using errcode = '42501'; end if;
  if actor_role is null or actor_role not in ('superadmin', 'gerencia_comercial') then
    raise exception 'Solo gerencia comercial puede reasignar oportunidades.' using errcode = '42501';
  end if;
  if nullif(trim(assignment_reason), '') is null or length(trim(assignment_reason)) < 3 then
    raise exception 'El motivo debe tener al menos 3 caracteres.' using errcode = '22023';
  end if;
  if length(trim(assignment_reason)) > 500 then raise exception 'El motivo excede 500 caracteres.' using errcode = '22023'; end if;
  if assignment_note is not null and length(trim(assignment_note)) > 2000 then raise exception 'La nota excede 2000 caracteres.' using errcode = '22023'; end if;

  select o.owner_id, o.account_id into old_owner, linked_account
  from public.opportunities o
  where o.id = target_opportunity
  for update;
  if not found then raise exception 'La oportunidad no existe o no está disponible.' using errcode = 'P0002'; end if;
  if (select count(*) from public.opportunities o where o.account_id = linked_account) <> 1 then
    raise exception 'La cuenta debe tener exactamente una oportunidad para ser reasignada.' using errcode = 'P0001';
  end if;
  if old_owner = replacement_owner then raise exception 'Selecciona un vendedor diferente al actual.' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = replacement_owner and p.active and p.deleted_at is null
      and p.role in ('superadmin', 'gerencia_comercial', 'ejecutivo')
  ) then raise exception 'El vendedor seleccionado no está activo.' using errcode = '22023'; end if;

  insert into public.opportunity_assignment_history (
    id, opportunity_id, previous_owner_id, new_owner_id, changed_by, change_reason, note, changed_at
  ) values (
    history_id, target_opportunity, old_owner, replacement_owner, actor_id,
    trim(assignment_reason), nullif(trim(assignment_note), ''), changed_on
  );

  update public.opportunities
  set owner_id = replacement_owner, updated_at = changed_on
  where opportunities.id = target_opportunity;
  update public.accounts
  set owner_id = replacement_owner, updated_at = changed_on
  where accounts.id = linked_account;
  update public.tasks
  set owner_id = replacement_owner
  where tasks.opportunity_id = target_opportunity
    and tasks.owner_id = old_owner
    and tasks.status = 'pendiente';

  return query
  select h.id, h.opportunity_id, h.previous_owner_id, h.new_owner_id, h.changed_by,
         h.change_reason, h.note, h.changed_at
  from public.opportunity_assignment_history h
  where h.id = history_id;
end;
$$;

create or replace function public.reassign_opportunity(
  target_opportunity uuid,
  replacement_owner uuid,
  assignment_reason text,
  assignment_note text default null
)
returns table (
  id uuid,
  opportunity_id uuid,
  previous_owner_id uuid,
  new_owner_id uuid,
  changed_by uuid,
  change_reason text,
  note text,
  changed_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.reassign_opportunity(
    target_opportunity,
    replacement_owner,
    assignment_reason,
    assignment_note
  )
$$;

revoke all on function public.enforce_opportunity_assignment_audit() from public;
revoke all on function public.prevent_assignment_history_mutation() from public;
revoke all on function public.reassign_opportunity(uuid, uuid, text, text) from public;
revoke all on function private.reassign_opportunity(uuid, uuid, text, text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.reassign_opportunity(uuid, uuid, text, text) to authenticated;
grant execute on function public.reassign_opportunity(uuid, uuid, text, text) to authenticated;

revoke insert, update, delete, truncate on public.opportunity_assignment_history from anon, authenticated;

drop policy if exists "assignment_history_select" on public.opportunity_assignment_history;
create policy "assignment_history_select"
on public.opportunity_assignment_history
for select
to authenticated
using (
  exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id and public.can_access_owner(o.owner_id)
  )
);

drop policy if exists "assignment_history_insert" on public.opportunity_assignment_history;

do $$
declare
  relation_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach relation_name in array array[
      'accounts', 'stakeholders', 'opportunities', 'activities', 'tasks', 'proposals',
      'opportunity_assignment_history', 'sales_reports', 'communications',
      'scheduled_communications', 'contracts', 'client_documents', 'opportunity_speech_usage'
    ] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = relation_name
      ) then
        execute format('alter publication supabase_realtime add table %I.%I', 'public', relation_name);
      end if;
    end loop;
  end if;
end;
$$;
