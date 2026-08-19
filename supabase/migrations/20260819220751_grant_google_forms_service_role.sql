grant select, insert on table
  public.accounts,
  public.stakeholders,
  public.opportunities
to service_role;

grant insert on table public.tasks to service_role;
