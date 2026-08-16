-- INDEX ONE WhatsApp approved template registry
-- Keeps Meta template metadata and language/category mapping inside the CRM.

create table if not exists public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  meta_name text not null,
  language_code text not null default 'es',
  category text not null default 'UTILITY' check (category in ('AUTHENTICATION','MARKETING','UTILITY')),
  description text,
  body_preview text,
  active boolean not null default true,
  approved boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_templates_active_idx
  on public.whatsapp_templates(active, approved, template_key);

alter table public.whatsapp_templates enable row level security;

drop policy if exists "whatsapp_templates_authenticated_read" on public.whatsapp_templates;
create policy "whatsapp_templates_authenticated_read" on public.whatsapp_templates
for select to authenticated using (true);

drop policy if exists "whatsapp_templates_managers_write" on public.whatsapp_templates;
create policy "whatsapp_templates_managers_write" on public.whatsapp_templates
for all to authenticated
using (public.current_profile_role() in ('superadmin','gerencia_comercial'))
with check (public.current_profile_role() in ('superadmin','gerencia_comercial'));

grant select on public.whatsapp_templates to authenticated;
grant insert, update, delete on public.whatsapp_templates to authenticated;
grant select, insert, update, delete on public.whatsapp_templates to service_role;
