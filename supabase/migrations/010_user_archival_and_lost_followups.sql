alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.profiles add column if not exists reassigned_to uuid references public.profiles(id);

alter table public.opportunities add column if not exists lost_reason text;
alter table public.opportunities add column if not exists followup_enabled boolean not null default false;
alter table public.opportunities add column if not exists next_followup_at timestamptz;
alter table public.opportunities add column if not exists followup_interval_months integer not null default 6 check (followup_interval_months > 0);

create or replace function public.current_profile_role() returns public.user_role
language sql stable security definer set search_path=public as $$
  select role from public.profiles where id=auth.uid() and active=true and deleted_at is null
$$;

create or replace function public.reassign_and_archive_user(target_user uuid, replacement_user uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  target_name text;
  replacement_name text;
begin
  if public.current_profile_role() <> 'superadmin' then
    raise exception 'Solo el superadministrador puede eliminar usuarios.';
  end if;
  if target_user = auth.uid() then
    raise exception 'No puedes eliminar tu propio usuario.';
  end if;
  if target_user = replacement_user then
    raise exception 'Selecciona un usuario distinto para la reasignación.';
  end if;

  select full_name into target_name from public.profiles where id=target_user and deleted_at is null;
  if target_name is null then raise exception 'Usuario no disponible.'; end if;

  select full_name into replacement_name from public.profiles where id=replacement_user and active=true and deleted_at is null;
  if replacement_name is null then raise exception 'El usuario receptor debe estar activo.'; end if;

  insert into public.opportunity_assignment_history (id, opportunity_id, previous_owner_id, new_owner_id, changed_by, change_reason, changed_at)
  select uuid_generate_v4(), o.id, target_user, replacement_user, auth.uid(),
         'Reasignación obligatoria por eliminación de usuario: ' || target_name || ' → ' || replacement_name, now()
  from public.opportunities o
  where o.owner_id = target_user;

  update public.accounts set owner_id=replacement_user, updated_at=now() where owner_id=target_user;
  update public.opportunities set owner_id=replacement_user, updated_at=now() where owner_id=target_user;
  update public.tasks set owner_id=replacement_user where owner_id=target_user and status <> 'completada';

  update public.profiles
  set active=false, deleted_at=now(), reassigned_to=replacement_user, updated_at=now()
  where id=target_user;
end;
$$;

revoke all on function public.reassign_and_archive_user(uuid,uuid) from public;
grant execute on function public.reassign_and_archive_user(uuid,uuid) to authenticated;

create index if not exists opportunities_lost_followup_idx on public.opportunities(stage, followup_enabled, next_followup_at);
create index if not exists profiles_deleted_idx on public.profiles(deleted_at);
