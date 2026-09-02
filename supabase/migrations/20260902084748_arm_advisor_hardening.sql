create index arm_agents_owner_idx on public.arm_agents(owner_id) where owner_id is not null;
create index arm_agents_created_by_idx on public.arm_agents(created_by) where created_by is not null;
create index arm_agent_assignments_assigned_by_idx on public.arm_agent_assignments(assigned_by);
create index arm_relationships_created_by_idx on public.arm_relationships(created_by) where created_by is not null;
create index arm_interactions_initiated_by_idx on public.arm_interactions(initiated_by, created_at desc);
create index arm_interactions_stakeholder_idx on public.arm_interactions(stakeholder_id) where stakeholder_id is not null;
create index arm_interactions_approved_by_idx on public.arm_interactions(approved_by) where approved_by is not null;

drop policy "arm relationships managers write" on public.arm_relationships;

create policy "arm relationships managers insert"
on public.arm_relationships for insert to authenticated
with check (public.current_profile_role() in ('superadmin', 'gerencia_comercial'));

create policy "arm relationships managers update"
on public.arm_relationships for update to authenticated
using (public.current_profile_role() in ('superadmin', 'gerencia_comercial'))
with check (public.current_profile_role() in ('superadmin', 'gerencia_comercial'));

create policy "arm relationships managers delete"
on public.arm_relationships for delete to authenticated
using (public.current_profile_role() in ('superadmin', 'gerencia_comercial'));
