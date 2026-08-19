alter table public.marketing_leads
  drop constraint if exists marketing_leads_provider_check;

alter table public.marketing_leads
  add constraint marketing_leads_provider_check
  check (provider in ('meta', 'manual', 'website', 'other', 'google_forms'))
  not valid;

alter table public.marketing_leads
  validate constraint marketing_leads_provider_check;
