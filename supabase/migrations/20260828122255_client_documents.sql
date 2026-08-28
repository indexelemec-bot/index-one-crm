create table public.client_documents (
  id uuid primary key default uuid_generate_v4(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  stakeholder_id uuid references public.stakeholders(id) on delete set null,
  template_key text not null check (template_key in ('onboarding_30_60_90', 'document_request')),
  title text not null,
  file_name text not null,
  data_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'generated' check (status in ('generated', 'sent')),
  generated_by uuid not null references public.profiles(id),
  generated_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.client_documents enable row level security;

create policy "client documents follow opportunity access"
on public.client_documents for select to authenticated
using (
  exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id and public.can_access_owner(o.owner_id)
  )
);

create policy "commercial creates client documents"
on public.client_documents for insert to authenticated
with check (
  generated_by = auth.uid()
  and exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id
      and (public.current_profile_role() in ('superadmin', 'gerencia_comercial') or o.owner_id = auth.uid())
  )
  and (
    stakeholder_id is null
    or exists (
      select 1
      from public.stakeholders s
      join public.opportunities o on o.account_id = s.account_id
      where s.id = stakeholder_id and o.id = opportunity_id
    )
  )
);

create policy "commercial updates client documents"
on public.client_documents for update to authenticated
using (
  exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id
      and (public.current_profile_role() in ('superadmin', 'gerencia_comercial') or o.owner_id = auth.uid())
  )
)
with check (
  exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id
      and (public.current_profile_role() in ('superadmin', 'gerencia_comercial') or o.owner_id = auth.uid())
  )
);

grant select, insert, update on public.client_documents to authenticated;

create index client_documents_opportunity_idx
on public.client_documents(opportunity_id, generated_at desc);

alter table public.communications
  add column if not exists client_document_id uuid references public.client_documents(id) on delete set null;

create index communications_client_document_idx
on public.communications(client_document_id, created_at desc)
where client_document_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-document-files',
  'client-document-files',
  false,
  15728640,
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.client_documents is 'PDFs personalizados generados para clientes desde Propuestas.';
comment on column public.client_documents.data_snapshot is 'Datos usados para reproducir exactamente el documento; no contiene secretos.';
comment on column public.communications.client_document_id is 'Documento personalizado asociado al envío.';
