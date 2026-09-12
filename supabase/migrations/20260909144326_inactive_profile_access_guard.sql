-- Deny every authenticated Data API request unless auth.uid() maps to a current,
-- active CRM profile. Service-role integrations and authorized webhooks bypass
-- RLS as before, so their ingestion flows are not affected.
create or replace function public.has_active_profile()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.active = true
      and p.deleted_at is null
  )
$$;

revoke all on function public.has_active_profile() from public, anon, authenticated;
grant execute on function public.has_active_profile() to authenticated;

create or replace function public.current_profile_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.active = true
    and p.deleted_at is null
$$;

create or replace function public.can_access_owner(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.active = true
      and p.deleted_at is null
      and (
        p.role in ('superadmin', 'gerencia_comercial', 'administracion', 'consulta')
        or owner = p.id
      )
  )
$$;

revoke all on function public.current_profile_role() from public, anon, authenticated;
revoke all on function public.can_access_owner(uuid) from public, anon, authenticated;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.can_access_owner(uuid) to authenticated;

-- Keep collaboration RLS aligned with the central account guard. These helpers
-- remain scoped to the signed-in user and now reject archived CRM identities.
create or replace function public.is_internal_conversation_member(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_active_profile() and exists (
    select 1
    from public.internal_conversation_members m
    where m.conversation_id = target_conversation_id
      and m.user_id = (select auth.uid())
      and m.removed_at is null
  )
$$;

create or replace function public.is_internal_conversation_coordinator(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_active_profile() and exists (
    select 1
    from public.internal_conversations c
    where c.id = target_conversation_id
      and (
        c.created_by = (select auth.uid())
        or c.responsible_id = (select auth.uid())
        or public.current_profile_role() in ('superadmin', 'gerencia_comercial')
      )
  )
$$;

revoke all on function public.is_internal_conversation_member(uuid) from public, anon, authenticated;
revoke all on function public.is_internal_conversation_coordinator(uuid) from public, anon, authenticated;
grant execute on function public.is_internal_conversation_member(uuid) to authenticated;
grant execute on function public.is_internal_conversation_coordinator(uuid) to authenticated;

-- Restrictive policies are ANDed with every existing permissive policy. This
-- closes tables whose read policy does not call can_access_owner (for example,
-- the active references catalog and recipient-scoped notifications).
do $$
declare
  protected_table record;
begin
  for protected_table in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      'active CRM profile required',
      protected_table.schema_name,
      protected_table.table_name
    );
    execute format(
      'create policy %I on %I.%I as restrictive for all to authenticated using ((select public.has_active_profile())) with check ((select public.has_active_profile()))',
      'active CRM profile required',
      protected_table.schema_name,
      protected_table.table_name
    );
  end loop;
end
$$;

comment on function public.has_active_profile() is
  'True only when auth.uid() belongs to an active, non-deleted CRM profile.';
