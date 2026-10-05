create index if not exists marketing_form_sessions_marketing_lead_idx
  on public.marketing_form_sessions (marketing_lead_id)
  where marketing_lead_id is not null;

create index if not exists marketing_form_sessions_stakeholder_idx
  on public.marketing_form_sessions (stakeholder_id)
  where stakeholder_id is not null;

create index if not exists marketing_form_sessions_opportunity_idx
  on public.marketing_form_sessions (opportunity_id)
  where opportunity_id is not null;
