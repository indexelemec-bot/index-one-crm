alter table public.profiles add column if not exists email text;
create unique index if not exists profiles_email_unique on public.profiles(lower(email)) where email is not null;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role public.user_role;
begin
  assigned_role := case
    when not exists(select 1 from public.profiles) then 'superadmin'::public.user_role
    else 'ejecutivo'::public.user_role
  end;

  insert into public.profiles(id, full_name, email, role, active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, 'Usuario'), '@', 1)),
    new.email,
    assigned_role,
    true
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute function public.handle_new_auth_user();

grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.profiles,
  public.accounts,
  public.stakeholders,
  public.opportunities,
  public.activities,
  public.tasks,
  public.references_catalog,
  public.proposals
to authenticated;

create unique index if not exists references_catalog_client_name_unique
on public.references_catalog(client_name);

insert into public.references_catalog(id, client_name, location, units, account_type, profile, approved, contact_share_authorized)
values
  ('10000000-0000-4000-8000-000000000001', 'Condominio Torre Ducal', 'C. Padre Fantino Falco 79, Serrallés, D.N.', 64, 'torre_residencial', 'premium', true, false),
  ('10000000-0000-4000-8000-000000000002', 'Torre Arche Tres', 'C. General Cambiazo No. 8, Ens. Naco, D.N.', 23, 'torre_residencial', 'premium', true, false),
  ('10000000-0000-4000-8000-000000000003', 'Torre Kesington', 'C. Rafael Augusto Sánchez 13, Ens. Naco', 16, 'torre_residencial', 'premium', true, false),
  ('10000000-0000-4000-8000-000000000004', 'Residencial Jardines del Sur', 'Av. Independencia, D.N.', 40, 'condominio_existente', 'familiar', true, false),
  ('10000000-0000-4000-8000-000000000005', 'Condominio Paseo del Este', 'Av. Ecológica, Santo Domingo Este', 32, 'condominio_existente', 'familiar', true, false),
  ('10000000-0000-4000-8000-000000000006', 'Torres del Parque', 'Ensanche Paraíso, D.N.', 96, 'proyecto_nuevo', 'premium', true, false)
on conflict (client_name) do update set
  location = excluded.location,
  units = excluded.units,
  account_type = excluded.account_type,
  profile = excluded.profile,
  approved = excluded.approved;
