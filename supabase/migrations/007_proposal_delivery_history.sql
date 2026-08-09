alter table public.communications
  add column if not exists proposal_id uuid references public.proposals(id) on delete set null,
  add column if not exists attachment_format text;

alter table public.communications
  drop constraint if exists communications_attachment_format_check;

alter table public.communications
  add constraint communications_attachment_format_check
  check (attachment_format is null or attachment_format in ('docx', 'pdf'));

create index if not exists communications_proposal_idx
on public.communications(proposal_id, created_at desc)
where proposal_id is not null;

drop policy if exists "commercial_updates_proposals" on public.proposals;
create policy "commercial_updates_proposals" on public.proposals for update to authenticated using (
  exists (
    select 1 from public.opportunities o where o.id = opportunity_id
    and (public.current_profile_role() in ('superadmin','gerencia_comercial') or o.owner_id = auth.uid())
  )
) with check (
  exists (
    select 1 from public.opportunities o where o.id = opportunity_id
    and (public.current_profile_role() in ('superadmin','gerencia_comercial') or o.owner_id = auth.uid())
  )
);

grant update on public.proposals to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proposal-files',
  'proposal-files',
  false,
  15728640,
  array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on column public.communications.proposal_id is 'Versión exacta de la propuesta asociada a este envío o reenvío.';
comment on column public.communications.attachment_format is 'Formato del archivo entregado por este canal.';
