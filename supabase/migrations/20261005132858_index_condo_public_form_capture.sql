-- Public Index Condo diagnostic capture.
-- The browser never talks to these tables directly. A server-side endpoint uses
-- the service role, while CRM users get read-only access through RLS.

create table if not exists public.marketing_form_sessions (
  id uuid primary key default gen_random_uuid(),
  resume_token_hash text not null unique,
  status text not null default 'started'
    check (status in ('started', 'completed', 'abandoned')),
  environment text not null default 'development'
    check (environment in ('development', 'preview', 'production', 'test')),
  current_step integer not null default 0 check (current_step between 0 and 12),
  total_steps integer not null default 10 check (total_steps between 1 and 20),
  answers jsonb not null default '{}'::jsonb,
  tracking jsonb not null default '{}'::jsonb,
  ip_hash text,
  user_agent text,
  account_id uuid references public.accounts(id) on delete set null,
  stakeholder_id uuid references public.stakeholders(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  marketing_lead_id uuid references public.marketing_leads(id) on delete set null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.marketing_form_sessions is
  'Progressive, resumable Index Condo public diagnostic sessions. answers preserves the original questionnaire payload.';

alter table public.marketing_leads
  add column if not exists form_session_id uuid references public.marketing_form_sessions(id) on delete set null,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists fbclid text,
  add column if not exists referrer text;

create unique index if not exists marketing_leads_form_session_unique
  on public.marketing_leads(form_session_id)
  where form_session_id is not null;
create index if not exists marketing_form_sessions_status_seen_idx
  on public.marketing_form_sessions(status, last_seen_at desc);
create index if not exists marketing_form_sessions_campaign_idx
  on public.marketing_form_sessions((tracking->>'utmSource'), (tracking->>'utmCampaign'), started_at desc);
create index if not exists marketing_form_sessions_account_idx
  on public.marketing_form_sessions(account_id, started_at desc);
create index if not exists stakeholders_phone_normalized_idx
  on public.stakeholders((regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')));
create index if not exists stakeholders_email_normalized_idx
  on public.stakeholders((lower(trim(coalesce(email, '')))));

alter table public.marketing_form_sessions enable row level security;
revoke all on table public.marketing_form_sessions from anon, authenticated;
grant select on table public.marketing_form_sessions to authenticated;
grant select, insert, update, delete on table public.marketing_form_sessions to service_role;
grant select, insert, update on table public.accounts, public.stakeholders, public.opportunities to service_role;
grant select, insert on table public.tasks to service_role;

drop policy if exists "marketing_form_sessions_crm_read" on public.marketing_form_sessions;
create policy "marketing_form_sessions_crm_read"
on public.marketing_form_sessions for select
to authenticated
using (
  public.current_profile_role() in ('superadmin', 'gerencia_comercial', 'administracion', 'consulta')
  or exists (
    select 1 from public.accounts a
    where a.id = account_id and public.can_access_owner(a.owner_id)
  )
);

create or replace function public.complete_index_condo_form(
  target_session uuid,
  requested_owner uuid default null,
  sync_to_crm boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  session_row public.marketing_form_sessions%rowtype;
  answers jsonb;
  tracking jsonb;
  project_name text;
  contact_name_value text;
  phone_value text;
  phone_digits text;
  email_value text;
  location_value text;
  city_value text;
  project_type_value text;
  residential_subtype_value text;
  custom_unit_type_value text;
  stakeholder_role_value text;
  primary_problem_value text;
  source_detail text;
  unit_count integer;
  owner_id_value uuid;
  account_id_value uuid;
  stakeholder_id_value uuid;
  opportunity_id_value uuid;
  lead_id_value uuid;
  next_action_at_value timestamptz := now() + interval '15 minutes';
begin
  select * into session_row
  from public.marketing_form_sessions s
  where s.id = target_session
  for update;

  if not found then
    raise exception 'La sesión no existe.' using errcode = 'P0002';
  end if;

  if session_row.status = 'completed' then
    return jsonb_build_object(
      'completed', true,
      'duplicate', true,
      'synced', session_row.opportunity_id is not null,
      'accountId', session_row.account_id,
      'stakeholderId', session_row.stakeholder_id,
      'opportunityId', session_row.opportunity_id
    );
  end if;

  answers := session_row.answers;
  tracking := session_row.tracking;
  project_name := nullif(trim(answers->>'projectName'), '');
  contact_name_value := nullif(trim(answers->>'contactName'), '');
  phone_value := nullif(trim(answers->>'phone'), '');
  phone_digits := nullif(regexp_replace(coalesce(phone_value, ''), '[^0-9]', '', 'g'), '');
  email_value := nullif(lower(trim(answers->>'email')), '');
  location_value := nullif(trim(answers->>'location'), '');
  city_value := coalesce(nullif(trim(answers->>'city'), ''), 'Santo Domingo');
  project_type_value := nullif(trim(answers->>'projectType'), '');
  residential_subtype_value := case when project_type_value = 'residencial' then nullif(trim(answers->>'residentialSubtype'), '') else null end;
  custom_unit_type_value := case when residential_subtype_value = 'otros' then nullif(trim(answers->>'customUnitType'), '') else null end;
  stakeholder_role_value := coalesce(nullif(trim(answers->>'contactRole'), ''), 'otro');
  source_detail := nullif(trim(answers->>'source'), '');
  unit_count := case
    when coalesce(answers->>'units', '') ~ '^[0-9]{1,6}$' then (answers->>'units')::integer
    else null
  end;

  select string_agg(value, ', ' order by ordinality)
  into primary_problem_value
  from jsonb_array_elements_text(coalesce(answers->'priorities', '[]'::jsonb)) with ordinality as p(value, ordinality);
  primary_problem_value := coalesce(nullif(primary_problem_value, ''), nullif(trim(answers->>'primaryProblem'), ''), 'Formulario de diagnóstico recibido');

  if project_name is null or contact_name_value is null or project_type_value not in ('comercial', 'residencial')
     or phone_digits is null or length(phone_digits) < 10 or email_value is null or email_value not like '%@%'
     or unit_count is null or unit_count < 1 then
    raise exception 'El formulario no contiene los datos mínimos requeridos.' using errcode = '22023';
  end if;

  if project_type_value = 'residencial' and residential_subtype_value not in ('apartamento', 'casa', 'otros') then
    raise exception 'La subcategoría residencial no es válida.' using errcode = '22023';
  end if;
  if residential_subtype_value = 'otros' and length(coalesce(custom_unit_type_value, '')) < 2 then
    raise exception 'El tipo de unidad residencial debe especificarse.' using errcode = '22023';
  end if;
  if stakeholder_role_value not in ('presidente', 'tesorero', 'secretario', 'miembro_junta', 'propietario_influyente', 'constructora', 'administrador_actual', 'otro') then
    stakeholder_role_value := 'otro';
  end if;

  if not sync_to_crm then
    update public.marketing_form_sessions
    set status = 'completed', completed_at = now(), last_seen_at = now(), updated_at = now()
    where id = target_session;
    return jsonb_build_object('completed', true, 'duplicate', false, 'synced', false);
  end if;

  select p.id into owner_id_value
  from public.profiles p
  where p.id = requested_owner and p.active and p.deleted_at is null
    and p.role in ('ejecutivo', 'gerencia_comercial', 'superadmin')
  limit 1;

  if owner_id_value is null then
    select p.id into owner_id_value
    from public.profiles p
    where p.active and p.deleted_at is null
      and p.role in ('ejecutivo', 'gerencia_comercial', 'superadmin')
    order by case p.role when 'ejecutivo' then 1 when 'gerencia_comercial' then 2 else 3 end,
             p.created_at asc
    limit 1;
  end if;
  if owner_id_value is null then
    raise exception 'No hay un usuario comercial activo para asignar el prospecto.' using errcode = 'P0001';
  end if;

  insert into public.marketing_leads (
    provider, source_channel, lead_id, form_id, form_name, full_name, phone, email,
    condominium_name, sector, units, project_type, residential_subtype, custom_unit_type,
    primary_problem, stakeholder_role, raw_payload, status, assigned_to, received_at,
    form_session_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, referrer
  ) values (
    'website', 'website', target_session::text, 'index-condo-public-diagnostic', 'Formulario Web Index Condo',
    contact_name_value, phone_value, email_value, project_name, location_value, unit_count,
    project_type_value, residential_subtype_value, custom_unit_type_value,
    primary_problem_value, stakeholder_role_value,
    jsonb_build_object('answers', answers, 'tracking', tracking, 'sessionId', target_session, 'submittedAt', now()),
    'new', owner_id_value, session_row.started_at, target_session,
    tracking->>'utmSource', tracking->>'utmMedium', tracking->>'utmCampaign',
    tracking->>'utmContent', tracking->>'utmTerm', tracking->>'fbclid', tracking->>'referrer'
  )
  on conflict (provider, lead_id) do update set
    raw_payload = excluded.raw_payload,
    assigned_to = excluded.assigned_to,
    updated_at = now()
  returning id into lead_id_value;

  select a.id into account_id_value
  from public.accounts a
  where lower(trim(a.name)) = lower(project_name)
  order by a.created_at asc
  limit 1
  for update;

  if account_id_value is null then
    insert into public.accounts (
      name, account_type, project_type, residential_subtype, custom_unit_type,
      address, sector, city, units, towers, profile, source, created_by, owner_id
    ) values (
      project_name, 'condominio_existente', project_type_value,
      residential_subtype_value, custom_unit_type_value,
      location_value, location_value, city_value, unit_count, 1,
      'Prospecto captado desde el diagnóstico web de Index Condo',
      case when source_detail is null then 'Web Index Condo' else 'Web Index Condo · ' || source_detail end,
      owner_id_value, owner_id_value
    ) returning id into account_id_value;
  else
    update public.accounts
    set address = coalesce(location_value, address),
        sector = coalesce(location_value, sector),
        city = coalesce(city_value, city),
        units = coalesce(unit_count, units),
        updated_at = now()
    where id = account_id_value;
  end if;

  select s.id into stakeholder_id_value
  from public.stakeholders s
  where s.account_id = account_id_value
    and (
      (phone_digits is not null and regexp_replace(coalesce(s.phone, ''), '[^0-9]', '', 'g') = phone_digits)
      or (email_value is not null and lower(trim(coalesce(s.email, ''))) = email_value)
    )
  order by s.created_at asc
  limit 1
  for update;

  if stakeholder_id_value is null then
    insert into public.stakeholders (
      account_id, full_name, role, phone, email, influence, position, is_decision_maker
    ) values (
      account_id_value, contact_name_value, stakeholder_role_value, phone_value, email_value,
      case when stakeholder_role_value in ('presidente', 'tesorero', 'secretario', 'miembro_junta', 'constructora') then 5 else 3 end,
      'unknown', stakeholder_role_value in ('presidente', 'tesorero', 'secretario', 'miembro_junta', 'constructora')
    ) returning id into stakeholder_id_value;
  else
    update public.stakeholders
    set full_name = contact_name_value,
        role = stakeholder_role_value,
        phone = phone_value,
        email = email_value
    where id = stakeholder_id_value;
  end if;

  select o.id into opportunity_id_value
  from public.opportunities o
  where o.account_id = account_id_value
    and o.stage not in ('cliente_activo', 'perdida')
  order by o.updated_at desc
  limit 1
  for update;

  if opportunity_id_value is null then
    insert into public.opportunities (
      account_id, stage, primary_problem, impact, proposed_solution, monthly_fee,
      probability, next_action, next_action_at, owner_id
    ) values (
      account_id_value, 'prospecto_identificado', primary_problem_value,
      coalesce(nullif(trim(answers->>'financialSituation'), ''), 'Pendiente de diagnóstico comercial'),
      'Evaluar solución integral de administración INDEX CONDO', 0, 10,
      'Contactar prospecto recibido desde Web Index Condo', next_action_at_value, owner_id_value
    ) returning id into opportunity_id_value;
  end if;

  if not exists (
    select 1 from public.tasks t
    where t.opportunity_id = opportunity_id_value
      and t.status = 'pendiente'
      and t.title = 'Contactar prospecto de Web Index Condo'
  ) then
    insert into public.tasks (opportunity_id, title, due_at, priority, status, owner_id)
    values (opportunity_id_value, 'Contactar prospecto de Web Index Condo', next_action_at_value, 'alta', 'pendiente', owner_id_value);
  end if;

  update public.marketing_leads
  set status = 'converted', account_id = account_id_value, stakeholder_id = stakeholder_id_value,
      opportunity_id = opportunity_id_value, assigned_to = owner_id_value,
      converted_at = now(), error_message = null, updated_at = now()
  where id = lead_id_value;

  update public.marketing_form_sessions
  set status = 'completed', account_id = account_id_value, stakeholder_id = stakeholder_id_value,
      opportunity_id = opportunity_id_value, marketing_lead_id = lead_id_value,
      completed_at = now(), last_seen_at = now(), updated_at = now()
  where id = target_session;

  return jsonb_build_object(
    'completed', true, 'duplicate', false, 'synced', true,
    'accountId', account_id_value, 'stakeholderId', stakeholder_id_value,
    'opportunityId', opportunity_id_value, 'marketingLeadId', lead_id_value
  );
end;
$$;

revoke all on function public.complete_index_condo_form(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.complete_index_condo_form(uuid, uuid, boolean) to service_role;
