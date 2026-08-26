create table public.admin_password_change_audit (
  id uuid primary key,
  actor_user_id uuid not null references public.profiles(id),
  target_user_id uuid not null references public.profiles(id),
  status text not null default 'requested'
    check (status in ('requested', 'succeeded', 'failed')),
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.admin_password_change_audit is
  'Audit trail for manual password changes. Passwords and password-derived data must never be stored here.';

alter table public.admin_password_change_audit enable row level security;

create policy "superadmin reads password change audit"
on public.admin_password_change_audit
for select
to authenticated
using (public.current_profile_role() = 'superadmin');

revoke all on table public.admin_password_change_audit from anon, authenticated;
grant select on table public.admin_password_change_audit to authenticated;
grant select, insert, update on table public.admin_password_change_audit to service_role;

create index admin_password_change_audit_actor_created_idx
  on public.admin_password_change_audit(actor_user_id, created_at desc);
create index admin_password_change_audit_target_created_idx
  on public.admin_password_change_audit(target_user_id, created_at desc);
