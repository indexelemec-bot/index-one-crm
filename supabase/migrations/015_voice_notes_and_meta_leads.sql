-- INDEX ONE: WhatsApp voice notes + Meta/Instagram lead capture

alter table public.communications
  add column if not exists provider_media_id text,
  add column if not exists transcription_text text,
  add column if not exists transcription_status text not null default 'not_requested'
    check (transcription_status in ('not_requested','pending','processing','completed','failed')),
  add column if not exists transcription_error text,
  add column if not exists transcription_provider text,
  add column if not exists transcription_language text,
  add column if not exists transcription_completed_at timestamptz;

create index if not exists communications_transcription_status_idx
  on public.communications(transcription_status)
  where message_type in ('audio','voice');

create table if not exists public.marketing_leads (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'meta' check (provider in ('meta','manual','website','other')),
  source_channel text not null default 'instagram' check (source_channel in ('instagram','facebook','whatsapp','website','other')),
  lead_id text,
  form_id text,
  form_name text,
  campaign_id text,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_id text,
  ad_name text,
  full_name text,
  phone text,
  email text,
  condominium_name text,
  sector text,
  units integer,
  current_admin boolean,
  primary_problem text,
  stakeholder_role text,
  board_member boolean,
  wants_assessment boolean,
  raw_payload jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new','matched','converted','ignored','error')),
  account_id uuid references public.accounts(id) on delete set null,
  stakeholder_id uuid references public.stakeholders(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  error_message text,
  received_at timestamptz not null default now(),
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, lead_id)
);

create index if not exists marketing_leads_status_idx on public.marketing_leads(status, received_at desc);
create index if not exists marketing_leads_campaign_idx on public.marketing_leads(campaign_id, received_at desc);
create index if not exists marketing_leads_assigned_idx on public.marketing_leads(assigned_to, status, received_at desc);

alter table public.marketing_leads enable row level security;

drop policy if exists "marketing_leads_commercial_read" on public.marketing_leads;
create policy "marketing_leads_commercial_read" on public.marketing_leads
for select to authenticated
using (public.current_profile_role() in ('superadmin','gerencia_comercial','ejecutivo','consulta'));

drop policy if exists "marketing_leads_managers_write" on public.marketing_leads;
create policy "marketing_leads_managers_write" on public.marketing_leads
for all to authenticated
using (public.current_profile_role() in ('superadmin','gerencia_comercial'))
with check (public.current_profile_role() in ('superadmin','gerencia_comercial'));

grant select on public.marketing_leads to authenticated;
grant insert, update, delete on public.marketing_leads to authenticated;
grant select, insert, update, delete on public.marketing_leads to service_role;
