create table if not exists public.opportunity_speech_usage (
  id uuid primary key default uuid_generate_v4(),
  speech_id text not null,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  stakeholder_id uuid references public.stakeholders(id) on delete set null,
  stage public.opportunity_stage not null,
  user_id uuid not null references public.profiles(id),
  channel text not null check (channel in ('llamada','reunion','email','whatsapp')),
  outcome text not null check (outcome in ('sin_respuesta','interes','reunion','propuesta','objecion','cierre','no_interes')),
  notes text,
  next_action text not null check (length(trim(next_action)) >= 3),
  next_action_at timestamptz not null,
  used_at timestamptz not null default now()
);

create unique index if not exists opportunity_speech_no_repeat_idx
on public.opportunity_speech_usage(opportunity_id, stage, speech_id, coalesce(stakeholder_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists opportunity_speech_usage_opportunity_idx
on public.opportunity_speech_usage(opportunity_id, used_at desc);
create index if not exists opportunity_speech_usage_user_idx
on public.opportunity_speech_usage(user_id, used_at desc);

alter table public.opportunity_speech_usage enable row level security;

drop policy if exists "speech_usage_scoped_read" on public.opportunity_speech_usage;
create policy "speech_usage_scoped_read" on public.opportunity_speech_usage for select to authenticated using (
  exists (select 1 from public.opportunities o where o.id = opportunity_id and public.can_access_owner(o.owner_id))
);

drop policy if exists "commercial_registers_speech_usage" on public.opportunity_speech_usage;
create policy "commercial_registers_speech_usage" on public.opportunity_speech_usage for insert to authenticated with check (
  user_id = auth.uid() and exists (
    select 1 from public.opportunities o where o.id = opportunity_id
    and (o.owner_id = auth.uid() or public.current_profile_role() in ('superadmin','gerencia_comercial'))
  )
);

grant select, insert on public.opportunity_speech_usage to authenticated;
