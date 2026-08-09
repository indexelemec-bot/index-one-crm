alter table public.proposals
  add column if not exists file_format text not null default 'docx',
  add column if not exists change_reason text;

alter table public.proposals
  drop constraint if exists proposals_file_format_check;

alter table public.proposals
  add constraint proposals_file_format_check check (file_format in ('docx', 'pdf'));

comment on column public.proposals.file_format is 'Formato descargado para esta versión de la propuesta.';
comment on column public.proposals.change_reason is 'Motivo comercial de la nueva versión o variación de honorarios.';
