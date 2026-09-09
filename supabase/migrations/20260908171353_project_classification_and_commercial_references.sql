-- BLOQUES C/D: clasificación operativa y catálogo administrable de referencias.
-- Compatibilidad: los tipos históricos de condominios/proyectos se clasifican
-- como residenciales; constructora/desarrollador/aliado se clasifican comercial.

alter table public.accounts
  add column if not exists project_type text,
  add column if not exists residential_subtype text,
  add column if not exists custom_unit_type text;

update public.accounts
set project_type = case
  when account_type in ('constructora', 'desarrollador', 'aliado') then 'comercial'
  else 'residencial'
end
where project_type is null;

update public.accounts
set residential_subtype = 'apartamento'
where project_type = 'residencial' and residential_subtype is null;

alter table public.accounts alter column project_type set not null;
alter table public.accounts
  drop constraint if exists accounts_project_type_check,
  add constraint accounts_project_type_check check (project_type in ('comercial', 'residencial')),
  drop constraint if exists accounts_residential_subtype_check,
  add constraint accounts_residential_subtype_check check (
    (project_type = 'comercial' and residential_subtype is null and custom_unit_type is null)
    or
    (project_type = 'residencial' and residential_subtype in ('apartamento', 'casa')) and custom_unit_type is null
    or
    (project_type = 'residencial' and residential_subtype = 'otros' and length(trim(custom_unit_type)) >= 2)
  );

comment on column public.accounts.project_type is 'Clasificación obligatoria: comercial o residencial.';
comment on column public.accounts.residential_subtype is 'Para residencial: apartamento, casa u otros.';
comment on column public.accounts.custom_unit_type is 'Término obligatorio cuando residential_subtype=otros.';

alter table public.marketing_leads
  add column if not exists project_type text,
  add column if not exists residential_subtype text,
  add column if not exists custom_unit_type text;

alter table public.marketing_leads
  drop constraint if exists marketing_leads_project_type_check,
  add constraint marketing_leads_project_type_check check (project_type is null or project_type in ('comercial', 'residencial')),
  drop constraint if exists marketing_leads_residential_subtype_check,
  add constraint marketing_leads_residential_subtype_check check (residential_subtype is null or residential_subtype in ('apartamento', 'casa', 'otros'));

alter table public.references_catalog
  add column if not exists active boolean not null default true,
  add column if not exists preferred boolean not null default false,
  add column if not exists priority integer not null default 0,
  add column if not exists project_type text,
  add column if not exists residential_subtype text,
  add column if not exists custom_unit_type text,
  add column if not exists incorporated_at date not null default current_date,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

update public.references_catalog
set project_type = case
  when account_type in ('constructora', 'desarrollador', 'aliado') then 'comercial'
  else 'residencial'
end
where project_type is null;

update public.references_catalog
set residential_subtype = 'apartamento'
where project_type = 'residencial' and residential_subtype is null;

alter table public.references_catalog alter column project_type set not null;
alter table public.references_catalog
  drop constraint if exists references_priority_check,
  add constraint references_priority_check check (priority between 0 and 100),
  drop constraint if exists references_project_type_check,
  add constraint references_project_type_check check (project_type in ('comercial', 'residencial')),
  drop constraint if exists references_residential_subtype_check,
  add constraint references_residential_subtype_check check (
    (project_type = 'comercial' and residential_subtype is null and custom_unit_type is null)
    or
    (project_type = 'residencial' and residential_subtype in ('apartamento', 'casa') and custom_unit_type is null)
    or
    (project_type = 'residencial' and residential_subtype = 'otros' and length(trim(custom_unit_type)) >= 2)
  );

-- approved se conserva por compatibilidad; active es el control de vigencia.
update public.references_catalog set active = approved where active is distinct from approved;

create index if not exists accounts_project_type_idx
  on public.accounts(project_type, residential_subtype);
create index if not exists references_catalog_matching_idx
  on public.references_catalog(active, project_type, residential_subtype, preferred desc, priority desc, incorporated_at desc);

drop policy if exists "approved references readable" on public.references_catalog;
create policy "active references readable"
  on public.references_catalog for select to authenticated
  using (active or public.current_profile_role() in ('superadmin','gerencia_comercial','administracion'));

drop policy if exists "managers manage references" on public.references_catalog;
create policy "administration manages references"
  on public.references_catalog for all to authenticated
  using (public.current_profile_role() in ('superadmin','gerencia_comercial','administracion'))
  with check (public.current_profile_role() in ('superadmin','gerencia_comercial','administracion'));

grant select, insert, update, delete on table public.references_catalog to authenticated;

-- Fail before backfilling if any historical proposal cannot resolve exactly
-- three distinct catalog references. Supabase applies a migration in one
-- transaction, so this exception leaves the database unchanged.
do $$
declare
  invalid_count integer;
  invalid_examples text;
begin
  select count(*) into invalid_count
  from public.proposals p
  where (
    select count(*)
    from public.references_catalog r
    where r.id = any(p.reference_ids)
  ) <> 3;

  select string_agg(id::text, ', ' order by id::text) into invalid_examples
  from (
    select p.id
    from public.proposals p
    where (
      select count(*)
      from public.references_catalog r
      where r.id = any(p.reference_ids)
    ) <> 3
    order by p.id
    limit 20
  ) invalid;

  if invalid_count > 0 then
    raise exception using
      errcode = '23514',
      message = format(
        'Preflight falló: %s propuesta(s) legacy no resuelven exactamente 3 referencias. Ejemplos (máximo 20): %s',
        invalid_count,
        coalesce(invalid_examples, 'sin identificadores')
      ),
      hint = 'Restaure o sustituya los reference_ids faltantes antes de volver a aplicar la migración.';
  end if;
end;
$$;

alter table public.proposals
  add column if not exists project_type text,
  add column if not exists residential_subtype text,
  add column if not exists custom_unit_type text,
  add column if not exists references_snapshot jsonb not null default '[]'::jsonb;

update public.proposals p
set project_type = a.project_type,
    residential_subtype = a.residential_subtype,
    custom_unit_type = a.custom_unit_type,
    references_snapshot = coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'clientName', r.client_name, 'location', r.location,
        'units', r.units, 'projectType', r.project_type,
        'residentialSubtype', r.residential_subtype,
        'customUnitType', r.custom_unit_type
      ) order by array_position(p.reference_ids, r.id))
      from public.references_catalog r where r.id = any(p.reference_ids)
    ), '[]'::jsonb)
from public.opportunities o
join public.accounts a on a.id = o.account_id
where o.id = p.opportunity_id and p.project_type is null;

do $$
declare
  invalid_count integer;
  invalid_examples text;
begin
  select count(*) into invalid_count
  from public.proposals p
  where p.project_type is null
     or jsonb_typeof(p.references_snapshot) is distinct from 'array'
     or jsonb_array_length(p.references_snapshot) <> 3;

  select string_agg(id::text, ', ' order by id::text) into invalid_examples
  from (
    select p.id
    from public.proposals p
    where p.project_type is null
       or jsonb_typeof(p.references_snapshot) is distinct from 'array'
       or jsonb_array_length(p.references_snapshot) <> 3
    order by p.id
    limit 20
  ) invalid;

  if invalid_count > 0 then
    raise exception using
      errcode = '23514',
      message = format(
        'Backfill inválido: %s propuesta(s) no conservan clasificación y snapshot de 3 referencias. Ejemplos (máximo 20): %s',
        invalid_count,
        coalesce(invalid_examples, 'sin identificadores')
      );
  end if;
end;
$$;

alter table public.proposals alter column project_type set not null;
alter table public.proposals
  drop constraint if exists proposals_project_type_check,
  add constraint proposals_project_type_check check (project_type in ('comercial', 'residencial')),
  drop constraint if exists proposals_references_snapshot_three_check,
  add constraint proposals_references_snapshot_three_check check (
    jsonb_typeof(references_snapshot) = 'array'
    and jsonb_array_length(references_snapshot) = 3
  );

comment on column public.proposals.references_snapshot is 'Snapshot inmutable de las tres referencias usadas al generar esta versión.';

create or replace function public.populate_proposal_classification_snapshot()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  account_row record;
  reference_count integer;
begin
  select a.project_type, a.residential_subtype, a.custom_unit_type
    into account_row
  from public.opportunities o join public.accounts a on a.id = o.account_id
  where o.id = new.opportunity_id;
  if account_row.project_type is null then raise exception 'La oportunidad no tiene clasificación de proyecto'; end if;

  select count(*) into reference_count
  from public.references_catalog r
  where r.id = any(new.reference_ids) and r.active and r.approved
    and r.project_type = account_row.project_type;
  if reference_count <> 3 then raise exception 'Las tres referencias deben estar activas y corresponder al tipo del proyecto'; end if;

  new.project_type := account_row.project_type;
  new.residential_subtype := account_row.residential_subtype;
  new.custom_unit_type := account_row.custom_unit_type;
  select jsonb_agg(jsonb_build_object(
    'id', r.id, 'clientName', r.client_name, 'location', r.location,
    'units', r.units, 'accountType', r.account_type, 'profile', r.profile,
    'approved', r.approved, 'active', r.active, 'preferred', r.preferred,
    'priority', r.priority, 'incorporatedAt', r.incorporated_at,
    'projectType', r.project_type, 'residentialSubtype', r.residential_subtype,
    'customUnitType', r.custom_unit_type,
    'contactShareAuthorized', r.contact_share_authorized, 'notes', r.notes
  ) order by array_position(new.reference_ids, r.id)) into new.references_snapshot
  from public.references_catalog r where r.id = any(new.reference_ids);
  return new;
end;
$$;

drop trigger if exists proposals_populate_classification_snapshot on public.proposals;
create trigger proposals_populate_classification_snapshot
before insert on public.proposals for each row execute function public.populate_proposal_classification_snapshot();
revoke all on function public.populate_proposal_classification_snapshot() from public, anon, authenticated;

create or replace function public.proposal_snapshot_immutable()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.reference_ids is distinct from old.reference_ids
     or new.references_snapshot is distinct from old.references_snapshot
     or new.project_type is distinct from old.project_type
     or new.residential_subtype is distinct from old.residential_subtype
     or new.custom_unit_type is distinct from old.custom_unit_type then
    raise exception 'La clasificación y referencias históricas de una propuesta son inmutables';
  end if;
  return new;
end;
$$;

drop trigger if exists proposals_snapshot_immutable on public.proposals;
create trigger proposals_snapshot_immutable
before update on public.proposals for each row execute function public.proposal_snapshot_immutable();
revoke all on function public.proposal_snapshot_immutable() from public, anon, authenticated;

-- Proposal identity and generated content are insert-only. Delivery flows only
-- need to advance status and sent_at after the immutable version is created.
revoke update on table public.proposals from authenticated;
grant update(status, sent_at) on table public.proposals to authenticated;
