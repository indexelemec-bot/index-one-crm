-- INDEX ONE Communications Center v1
-- Isolated feature migration: conversations, agent attribution, inbound messages,
-- scheduling and assignment history for WhatsApp/email.

create table if not exists public.communication_threads (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  stakeholder_id uuid references public.stakeholders(id) on delete set null,
  channel text not null check (channel in ('email','whatsapp')),
  assigned_to uuid references public.profiles(id) on delete set null,
  status text not null default 'open' check (status in ('open','pending','closed','archived')),
  unread_count integer not null default 0 check (unread_count >= 0),
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists communication_threads_unique_contact_channel
  on public.communication_threads(opportunity_id, stakeholder_id, channel)
  where stakeholder_id is not null;
create index if not exists communication_threads_assigned_idx
  on public.communication_threads(assigned_to, status, last_message_at desc);
create index if not exists communication_threads_opportunity_idx
  on public.communication_threads(opportunity_id, last_message_at desc);

alter table public.communications
  add column if not exists thread_id uuid references public.communication_threads(id) on delete set null,
  add column if not exists agent_id uuid references public.profiles(id) on delete set null,
  add column if not exists agent_name_snapshot text,
  add column if not exists message_type text not null default 'text',
  add column if not exists media_path text,
  add column if not exists media_name text,
  add column if not exists media_mime_type text,
  add column if not exists reply_to_provider_message_id text,
  add column if not exists is_internal boolean not null default false;

-- Inbound webhook messages do not originate from a CRM user.
alter table public.communications alter column created_by drop not null;

create index if not exists communications_thread_created_idx
  on public.communications(thread_id, created_at);
create index if not exists communications_agent_idx
  on public.communications(agent_id, created_at desc);

create table if not exists public.communication_assignment_history (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.communication_threads(id) on delete cascade,
  previous_agent_id uuid references public.profiles(id) on delete set null,
  new_agent_id uuid references public.profiles(id) on delete set null,
  changed_by uuid references public.profiles(id) on delete set null,
  reason text,
  changed_at timestamptz not null default now()
);
create index if not exists communication_assignment_history_thread_idx
  on public.communication_assignment_history(thread_id, changed_at desc);

create table if not exists public.scheduled_communications (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.communication_threads(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  stakeholder_id uuid references public.stakeholders(id) on delete set null,
  channel text not null check (channel in ('email','whatsapp')),
  body_text text not null check (length(trim(body_text)) >= 2),
  template_key text,
  attachment_path text,
  attachment_name text,
  scheduled_for timestamptz not null,
  recurrence_months integer check (recurrence_months is null or recurrence_months > 0),
  status text not null default 'scheduled' check (status in ('scheduled','processing','sent','failed','cancelled')),
  created_by uuid not null references public.profiles(id),
  sent_communication_id uuid references public.communications(id) on delete set null,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists scheduled_communications_due_idx
  on public.scheduled_communications(status, scheduled_for)
  where status = 'scheduled';
create index if not exists scheduled_communications_opportunity_idx
  on public.scheduled_communications(opportunity_id, scheduled_for desc);

alter table public.communication_threads enable row level security;
alter table public.communication_assignment_history enable row level security;
alter table public.scheduled_communications enable row level security;

drop policy if exists "communication_threads_scoped_read" on public.communication_threads;
create policy "communication_threads_scoped_read" on public.communication_threads
for select to authenticated using (
  exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id and public.can_access_owner(o.owner_id)
  )
);

drop policy if exists "communication_threads_commercial_write" on public.communication_threads;
create policy "communication_threads_commercial_write" on public.communication_threads
for all to authenticated using (
  exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id
      and (public.current_profile_role() in ('superadmin','gerencia_comercial') or o.owner_id = auth.uid())
  )
) with check (
  exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id
      and (public.current_profile_role() in ('superadmin','gerencia_comercial') or o.owner_id = auth.uid())
  )
);

drop policy if exists "communication_assignment_history_scoped_read" on public.communication_assignment_history;
create policy "communication_assignment_history_scoped_read" on public.communication_assignment_history
for select to authenticated using (
  exists (
    select 1
    from public.communication_threads t
    join public.opportunities o on o.id = t.opportunity_id
    where t.id = thread_id and public.can_access_owner(o.owner_id)
  )
);

drop policy if exists "communication_assignment_history_managers_write" on public.communication_assignment_history;
create policy "communication_assignment_history_managers_write" on public.communication_assignment_history
for insert to authenticated with check (
  public.current_profile_role() in ('superadmin','gerencia_comercial')
  and changed_by = auth.uid()
);

drop policy if exists "scheduled_communications_scoped_read" on public.scheduled_communications;
create policy "scheduled_communications_scoped_read" on public.scheduled_communications
for select to authenticated using (
  exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id and public.can_access_owner(o.owner_id)
  )
);

drop policy if exists "scheduled_communications_commercial_write" on public.scheduled_communications;
create policy "scheduled_communications_commercial_write" on public.scheduled_communications
for all to authenticated using (
  created_by = auth.uid()
  and exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id
      and (public.current_profile_role() in ('superadmin','gerencia_comercial') or o.owner_id = auth.uid())
  )
) with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id
      and (public.current_profile_role() in ('superadmin','gerencia_comercial') or o.owner_id = auth.uid())
  )
);

grant select, insert, update on public.communication_threads to authenticated;
grant select, insert on public.communication_assignment_history to authenticated;
grant select, insert, update, delete on public.scheduled_communications to authenticated;
