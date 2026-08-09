create table if not exists public.communications (
  id uuid primary key default uuid_generate_v4(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  stakeholder_id uuid references public.stakeholders(id) on delete set null,
  channel text not null check (channel in ('email','whatsapp')),
  direction text not null default 'outbound' check (direction in ('outbound','inbound')),
  from_address text not null,
  to_address text not null,
  subject text,
  body_text text not null check (length(trim(body_text)) >= 2),
  template_key text,
  provider text,
  provider_message_id text,
  status text not null default 'queued' check (status in ('draft','queued','sent','delivered','opened','delayed','bounced','failed','complained','received')),
  error_message text,
  created_by uuid not null references public.profiles(id),
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.communication_webhook_events (
  id text primary key,
  provider text not null,
  event_type text not null,
  provider_message_id text,
  event_created_at timestamptz,
  received_at timestamptz not null default now()
);

create index if not exists communications_opportunity_idx on public.communications(opportunity_id, created_at desc);
create unique index if not exists communications_provider_message_idx on public.communications(provider, provider_message_id) where provider_message_id is not null;

alter table public.communications enable row level security;
alter table public.communication_webhook_events enable row level security;

drop policy if exists "communications_scoped_read" on public.communications;
create policy "communications_scoped_read" on public.communications for select to authenticated using (
  exists (select 1 from public.opportunities o where o.id = opportunity_id and public.can_access_owner(o.owner_id))
);
drop policy if exists "commercial_creates_communications" on public.communications;
create policy "commercial_creates_communications" on public.communications for insert to authenticated with check (
  created_by = auth.uid() and exists (
    select 1 from public.opportunities o where o.id = opportunity_id
    and (public.current_profile_role() in ('superadmin','gerencia_comercial') or o.owner_id = auth.uid())
  )
);
drop policy if exists "commercial_updates_communications" on public.communications;
create policy "commercial_updates_communications" on public.communications for update to authenticated using (
  created_by = auth.uid() and exists (
    select 1 from public.opportunities o where o.id = opportunity_id
    and (public.current_profile_role() in ('superadmin','gerencia_comercial') or o.owner_id = auth.uid())
  )
) with check (created_by = auth.uid());

grant select, insert, update on public.communications to authenticated;
