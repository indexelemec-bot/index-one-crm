create type public.arm_agent_kind as enum ('interno', 'externo');
create type public.arm_agent_status as enum ('borrador', 'piloto', 'activo', 'pausado', 'retirado');
create type public.arm_autonomy_level as enum ('asesor', 'supervisado', 'acotado', 'autonomo');
create type public.arm_decision_status as enum ('recomendacion', 'pendiente_aprobacion', 'aprobada', 'rechazada', 'ejecutada', 'fallida');

create table public.arm_agents (
  id uuid primary key default uuid_generate_v4(),
  name text not null check (length(trim(name)) >= 3),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  kind public.arm_agent_kind not null default 'interno',
  role_key text not null check (length(trim(role_key)) >= 3),
  description text not null check (length(trim(description)) >= 12),
  status public.arm_agent_status not null default 'borrador',
  autonomy_level public.arm_autonomy_level not null default 'asesor',
  risk_level text not null default 'bajo' check (risk_level in ('bajo', 'medio', 'alto')),
  requires_human_approval boolean not null default true,
  capabilities text[] not null default '{}',
  allowed_channels text[] not null default '{}',
  system_instructions text,
  owner_id uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.arm_agent_assignments (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references public.arm_agents(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  relationship_role text not null default 'apoyo' check (relationship_role in ('principal', 'apoyo', 'revision', 'escalamiento')),
  status text not null default 'activa' check (status in ('activa', 'pausada', 'completada')),
  notes text,
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, opportunity_id)
);

create table public.arm_relationships (
  id uuid primary key default uuid_generate_v4(),
  source_agent_id uuid not null references public.arm_agents(id) on delete cascade,
  target_agent_id uuid references public.arm_agents(id) on delete cascade,
  target_profile_id uuid references public.profiles(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('supervisa', 'entrega_a', 'apoya', 'propietario_humano', 'representa_cliente')),
  status text not null default 'activa' check (status in ('activa', 'pausada', 'finalizada')),
  terms jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arm_relationship_exactly_one_target check (
    ((target_agent_id is not null)::integer + (target_profile_id is not null)::integer) = 1
  ),
  constraint arm_relationship_no_self_link check (target_agent_id is null or target_agent_id <> source_agent_id)
);

create table public.arm_interactions (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references public.arm_agents(id),
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  stakeholder_id uuid references public.stakeholders(id) on delete set null,
  initiated_by uuid not null references public.profiles(id),
  interaction_type text not null check (length(trim(interaction_type)) >= 3),
  input_summary text not null check (length(trim(input_summary)) >= 3),
  output_summary text,
  decision_status public.arm_decision_status not null default 'recomendacion',
  confidence_score integer check (confidence_score between 0 and 100),
  requires_approval boolean not null default true,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  outcome text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arm_approval_consistency check (
    (approved_by is null and approved_at is null) or (approved_by is not null and approved_at is not null)
  )
);

create index arm_agents_status_idx on public.arm_agents(status, kind);
create index arm_agent_assignments_opportunity_idx on public.arm_agent_assignments(opportunity_id, status);
create index arm_agent_assignments_agent_idx on public.arm_agent_assignments(agent_id, status);
create index arm_relationships_source_idx on public.arm_relationships(source_agent_id, status);
create index arm_relationships_target_agent_idx on public.arm_relationships(target_agent_id) where target_agent_id is not null;
create index arm_relationships_target_profile_idx on public.arm_relationships(target_profile_id) where target_profile_id is not null;
create index arm_interactions_opportunity_idx on public.arm_interactions(opportunity_id, created_at desc);
create index arm_interactions_agent_idx on public.arm_interactions(agent_id, created_at desc);
create index arm_interactions_pending_idx on public.arm_interactions(created_at desc) where decision_status = 'pendiente_aprobacion';

alter table public.arm_agents enable row level security;
alter table public.arm_agent_assignments enable row level security;
alter table public.arm_relationships enable row level security;
alter table public.arm_interactions enable row level security;

create policy "arm agents authenticated read"
on public.arm_agents for select to authenticated
using (status <> 'retirado' or public.current_profile_role() in ('superadmin', 'gerencia_comercial'));

create policy "arm agents managers insert"
on public.arm_agents for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.current_profile_role() in ('superadmin', 'gerencia_comercial')
);

create policy "arm agents managers update"
on public.arm_agents for update to authenticated
using (public.current_profile_role() in ('superadmin', 'gerencia_comercial'))
with check (public.current_profile_role() in ('superadmin', 'gerencia_comercial'));

create policy "arm assignments scoped read"
on public.arm_agent_assignments for select to authenticated
using (
  exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id and public.can_access_owner(o.owner_id)
  )
);

create policy "arm assignments commercial write"
on public.arm_agent_assignments for insert to authenticated
with check (
  assigned_by = (select auth.uid())
  and exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id
      and (o.owner_id = (select auth.uid()) or public.current_profile_role() in ('superadmin', 'gerencia_comercial'))
  )
);

create policy "arm assignments commercial update"
on public.arm_agent_assignments for update to authenticated
using (
  exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id
      and (o.owner_id = (select auth.uid()) or public.current_profile_role() in ('superadmin', 'gerencia_comercial'))
  )
)
with check (
  exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id
      and (o.owner_id = (select auth.uid()) or public.current_profile_role() in ('superadmin', 'gerencia_comercial'))
  )
);

create policy "arm relationships authenticated read"
on public.arm_relationships for select to authenticated
using (true);

create policy "arm relationships managers write"
on public.arm_relationships for all to authenticated
using (public.current_profile_role() in ('superadmin', 'gerencia_comercial'))
with check (public.current_profile_role() in ('superadmin', 'gerencia_comercial'));

create policy "arm interactions scoped read"
on public.arm_interactions for select to authenticated
using (
  (opportunity_id is null and (initiated_by = (select auth.uid()) or public.current_profile_role() in ('superadmin', 'gerencia_comercial')))
  or exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id and public.can_access_owner(o.owner_id)
  )
);

create policy "arm interactions scoped insert"
on public.arm_interactions for insert to authenticated
with check (
  initiated_by = (select auth.uid())
  and (
    opportunity_id is null
    or exists (
      select 1 from public.opportunities o
      where o.id = opportunity_id and public.can_access_owner(o.owner_id)
    )
  )
);

create policy "arm interactions managers approve"
on public.arm_interactions for update to authenticated
using (public.current_profile_role() in ('superadmin', 'gerencia_comercial'))
with check (
  public.current_profile_role() in ('superadmin', 'gerencia_comercial')
  and (approved_by is null or approved_by = (select auth.uid()))
);

grant select, insert, update on public.arm_agents to authenticated;
grant select, insert, update on public.arm_agent_assignments to authenticated;
grant select, insert, update, delete on public.arm_relationships to authenticated;
grant select, insert, update on public.arm_interactions to authenticated;

insert into public.arm_agents (
  name, slug, kind, role_key, description, status, autonomy_level, risk_level,
  requires_human_approval, capabilities, allowed_channels, system_instructions
) values
  (
    'Orquestador comercial', 'orquestador-comercial', 'interno', 'orquestacion',
    'Coordina los agentes, distribuye el trabajo y escala decisiones sensibles a una persona.',
    'piloto', 'supervisado', 'medio', true,
    array['coordinar_agentes', 'priorizar_oportunidades', 'crear_handoffs'], array['crm'],
    'Coordina sin ejecutar comunicaciones ni compromisos comerciales sin aprobación humana.'
  ),
  (
    'Coach consultivo', 'coach-comercial', 'interno', 'coaching_ventas',
    'Analiza el expediente comercial y recomienda preguntas, riesgos y próximos pasos éticos.',
    'activo', 'asesor', 'bajo', false,
    array['analizar_oportunidad', 'recomendar_proximo_paso', 'detectar_riesgos'], array['crm'],
    'Usa solo evidencia del CRM. Distingue hechos de hipótesis y no manipula al cliente.'
  ),
  (
    'Analista de oportunidad', 'analista-oportunidad', 'interno', 'analisis',
    'Evalúa señales del embudo, cobertura de decisores, tareas y probabilidad de avance.',
    'piloto', 'asesor', 'bajo', false,
    array['calcular_salud', 'detectar_bloqueos', 'comparar_historial'], array['crm'],
    'Explica cada indicador y nunca presenta una estimación como un hecho.'
  ),
  (
    'Asistente de propuestas', 'asistente-propuestas', 'interno', 'propuestas',
    'Prepara borradores y verifica consistencia entre diagnóstico, solución, precio y referencias.',
    'piloto', 'supervisado', 'medio', true,
    array['preparar_borrador', 'validar_propuesta', 'comparar_versiones'], array['crm', 'email', 'whatsapp'],
    'Toda propuesta y todo envío requieren aprobación explícita de un usuario autorizado.'
  ),
  (
    'Seguimiento ético', 'seguimiento-etico', 'interno', 'seguimiento',
    'Sugiere seguimientos oportunos y evita mensajes repetitivos, presión engañosa o contacto excesivo.',
    'piloto', 'supervisado', 'medio', true,
    array['sugerir_seguimiento', 'detectar_inactividad', 'proponer_mensaje'], array['crm', 'email', 'whatsapp'],
    'Respeta frecuencia, consentimiento, horario y canal preferido. Nunca envía sin aprobación.'
  ),
  (
    'Gateway B2A', 'gateway-b2a', 'interno', 'agente_a_agente',
    'Gestiona futuras interacciones verificadas entre INDEX CONDO y asistentes de IA de clientes.',
    'borrador', 'supervisado', 'alto', true,
    array['identificar_agente_externo', 'intercambiar_datos_autorizados', 'escalar_a_humano'], array['api'],
    'No comparte datos personales ni compromete precio, contrato o alcance sin autorización verificable.'
  )
on conflict (slug) do nothing;
