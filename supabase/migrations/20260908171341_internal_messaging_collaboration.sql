-- INDEX ONE CRM - Internal messaging and commercial collaboration (Issue #34)
-- Internal data is deliberately isolated from communications/scheduled_communications,
-- so it cannot be picked up by WhatsApp, email or delivery cron jobs.

create table public.internal_conversations (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 2 and 160),
  conversation_type text not null default 'group' check (conversation_type in ('direct','group')),
  opportunity_id uuid references public.opportunities(id) on delete set null,
  status text not null default 'open' check (status in ('open','pending','waiting_client','waiting_internal','closed')),
  priority text not null default 'normal' check (priority in ('normal','important','urgent')),
  responsible_id uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.internal_conversation_members (
  conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('responsible','member','observer')),
  added_by uuid not null references public.profiles(id),
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table public.internal_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body_text text not null default '' check (length(body_text) <= 10000),
  reply_to_id uuid references public.internal_messages(id) on delete set null,
  message_type text not null default 'internal_note' check (message_type in ('internal_note','system')),
  attachment_path text,
  attachment_name text,
  attachment_mime text,
  attachment_size bigint check (attachment_size is null or attachment_size between 1 and 15728640),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint internal_message_has_content check (nullif(trim(body_text),'') is not null or attachment_path is not null),
  constraint internal_attachment_path_isolated check (attachment_path is null or attachment_path like 'internal/%')
);

create table public.internal_message_mentions (
  message_id uuid not null references public.internal_messages(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, mentioned_user_id)
);

create table public.internal_conversation_assignment_history (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
  previous_responsible_id uuid references public.profiles(id) on delete set null,
  new_responsible_id uuid references public.profiles(id) on delete set null,
  changed_by uuid not null references public.profiles(id),
  reason text not null check (length(trim(reason)) between 3 and 500),
  note text check (note is null or length(note) <= 1000),
  changed_at timestamptz not null default now()
);

create table public.internal_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
  message_id uuid references public.internal_messages(id) on delete cascade,
  notification_type text not null check (notification_type in ('message','mention','assignment')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (recipient_id, message_id, notification_type)
);

alter table public.tasks add column source_internal_message_id uuid references public.internal_messages(id) on delete set null;
create unique index tasks_source_internal_message_idx on public.tasks(source_internal_message_id) where source_internal_message_id is not null;

create index internal_conversations_opportunity_idx on public.internal_conversations(opportunity_id, updated_at desc);
create index internal_conversations_responsible_idx on public.internal_conversations(responsible_id, status, updated_at desc);
create index internal_members_user_idx on public.internal_conversation_members(user_id, removed_at, conversation_id);
create index internal_messages_conversation_idx on public.internal_messages(conversation_id, created_at);
create index internal_mentions_user_idx on public.internal_message_mentions(mentioned_user_id, created_at desc);
create index internal_assignment_history_idx on public.internal_conversation_assignment_history(conversation_id, changed_at desc);
create index internal_notifications_unread_idx on public.internal_notifications(recipient_id, created_at desc) where read_at is null;

-- This narrowly scoped SECURITY DEFINER helper avoids recursive RLS checks on the
-- membership table. It cannot inspect another user's membership.
create or replace function public.is_internal_conversation_member(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.internal_conversation_members m
    join public.profiles p on p.id=m.user_id
    where m.conversation_id = target_conversation_id
      and m.user_id = (select auth.uid())
      and m.removed_at is null
      and p.active and p.deleted_at is null
  )
$$;
revoke all on function public.is_internal_conversation_member(uuid) from public;
grant execute on function public.is_internal_conversation_member(uuid) to authenticated;

create or replace function public.is_internal_conversation_coordinator(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.internal_conversations c
    where c.id = target_conversation_id
      and (c.created_by = (select auth.uid()) or c.responsible_id = (select auth.uid()) or public.current_profile_role() in ('superadmin','gerencia_comercial'))
  )
$$;
revoke all on function public.is_internal_conversation_coordinator(uuid) from public;
grant execute on function public.is_internal_conversation_coordinator(uuid) to authenticated;

create or replace function public.touch_internal_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.internal_conversations
  set last_message_at = new.created_at, updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;
revoke all on function public.touch_internal_conversation() from public;

create trigger internal_messages_touch_conversation
after insert on public.internal_messages
for each row execute function public.touch_internal_conversation();

create or replace function public.reject_internal_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Internal assignment history is immutable';
end;
$$;
revoke all on function public.reject_internal_audit_mutation() from public;

create or replace function public.enforce_internal_member_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_internal_conversation_coordinator(old.conversation_id) then
    if old.user_id <> (select auth.uid())
      or new.conversation_id is distinct from old.conversation_id
      or new.user_id is distinct from old.user_id
      or new.member_role is distinct from old.member_role
      or new.added_by is distinct from old.added_by
      or new.joined_at is distinct from old.joined_at
      or new.removed_at is distinct from old.removed_at then
      raise exception 'Only a conversation coordinator can change membership';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_internal_member_update() from public;

create trigger internal_members_safe_update
before update on public.internal_conversation_members
for each row execute function public.enforce_internal_member_update();

create trigger internal_assignment_history_immutable
before update or delete on public.internal_conversation_assignment_history
for each row execute function public.reject_internal_audit_mutation();

alter table public.internal_conversations enable row level security;
alter table public.internal_conversation_members enable row level security;
alter table public.internal_messages enable row level security;
alter table public.internal_message_mentions enable row level security;
alter table public.internal_conversation_assignment_history enable row level security;
alter table public.internal_notifications enable row level security;

create policy "internal conversations member read" on public.internal_conversations
for select to authenticated using (public.is_internal_conversation_member(id));
create policy "internal conversations create" on public.internal_conversations
for insert to authenticated with check (
  created_by = (select auth.uid())
  and exists (select 1 from public.profiles p where p.id = responsible_id and p.active and p.deleted_at is null)
  and (
    opportunity_id is null
    or exists (select 1 from public.opportunities o where o.id = opportunity_id and public.can_access_owner(o.owner_id))
  )
);
create policy "internal conversations coordinators update" on public.internal_conversations
for update to authenticated
using (
  public.is_internal_conversation_member(id)
  and public.is_internal_conversation_coordinator(id)
)
with check (
  public.is_internal_conversation_member(id)
  and exists (
    select 1 from public.internal_conversation_members cm
    join public.profiles p on p.id = cm.user_id
    where cm.conversation_id = id and cm.user_id = responsible_id
      and cm.removed_at is null and p.active and p.deleted_at is null
  )
);

create policy "internal members conversation read" on public.internal_conversation_members
for select to authenticated using (public.is_internal_conversation_member(conversation_id));
create policy "internal members coordinators insert" on public.internal_conversation_members
for insert to authenticated with check (
  added_by = (select auth.uid())
  and public.is_internal_conversation_coordinator(conversation_id)
);
create policy "internal members coordinators update" on public.internal_conversation_members
for update to authenticated
using (
  public.is_internal_conversation_member(conversation_id)
  and public.is_internal_conversation_coordinator(conversation_id)
)
with check (
  public.is_internal_conversation_coordinator(conversation_id)
);
create policy "internal members mark self read" on public.internal_conversation_members
for update to authenticated
using (user_id = (select auth.uid()) and removed_at is null)
with check (user_id = (select auth.uid()) and removed_at is null);

create policy "internal messages member read" on public.internal_messages
for select to authenticated using (public.is_internal_conversation_member(conversation_id));
create policy "internal messages member create" on public.internal_messages
for insert to authenticated with check (
  sender_id = (select auth.uid())
  and message_type = 'internal_note'
  and public.is_internal_conversation_member(conversation_id)
);

create policy "internal mentions member read" on public.internal_message_mentions
for select to authenticated using (
  mentioned_user_id = (select auth.uid())
  or exists (select 1 from public.internal_messages m where m.id = message_id and public.is_internal_conversation_member(m.conversation_id))
);
create policy "internal mentions sender create" on public.internal_message_mentions
for insert to authenticated with check (
  exists (
    select 1 from public.internal_messages m
    where m.id = message_id and m.sender_id = (select auth.uid())
      and public.is_internal_conversation_member(m.conversation_id)
  )
  and exists (
    select 1 from public.internal_conversation_members cm
    join public.internal_messages im on im.conversation_id = cm.conversation_id
    where im.id = message_id and cm.user_id = mentioned_user_id and cm.removed_at is null
  )
);

create policy "internal assignment history member read" on public.internal_conversation_assignment_history
for select to authenticated using (public.is_internal_conversation_member(conversation_id));
create policy "internal assignment history coordinator create" on public.internal_conversation_assignment_history
for insert to authenticated with check (
  changed_by = (select auth.uid())
  and public.is_internal_conversation_member(conversation_id)
  and public.is_internal_conversation_coordinator(conversation_id)
);

create policy "internal notifications recipient read" on public.internal_notifications
for select to authenticated using (recipient_id = (select auth.uid()));
create policy "internal notifications sender create" on public.internal_notifications
for insert to authenticated with check (
  recipient_id <> (select auth.uid())
  and public.is_internal_conversation_member(conversation_id)
  and exists (
    select 1 from public.internal_conversation_members cm
    where cm.conversation_id = internal_notifications.conversation_id
      and cm.user_id = recipient_id and cm.removed_at is null
  )
  and (message_id is null or exists (select 1 from public.internal_messages m where m.id = message_id and m.sender_id = (select auth.uid())))
);
create policy "internal notifications recipient update" on public.internal_notifications
for update to authenticated using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));

-- All active CRM users are available as an internal directory. No authorization
-- decision relies on editable auth user metadata.
create policy "active colleague directory read" on public.profiles
for select to authenticated using (active = true and deleted_at is null);

-- Atomic write APIs keep conversation creation and reassignment from leaving
-- partial membership or audit data when any validation fails.
create or replace function public.create_internal_conversation(
  conversation_title text,
  conversation_kind text,
  linked_opportunity_id uuid,
  initial_responsible_id uuid,
  participant_ids uuid[],
  observer_ids uuid[],
  conversation_priority text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_conversation_id uuid := gen_random_uuid();
  all_user_ids uuid[];
  active_user_count integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if linked_opportunity_id is not null and not exists(
    select 1 from public.opportunities o
    where o.id=linked_opportunity_id and public.can_access_owner(o.owner_id)
  ) then raise exception 'Linked opportunity unavailable'; end if;
  all_user_ids := array(select distinct unnest(array[(select auth.uid()), initial_responsible_id] || coalesce(participant_ids, '{}') || coalesce(observer_ids, '{}')));
  if conversation_kind = 'direct' and cardinality(all_user_ids) <> 2 then
    raise exception 'A direct conversation requires exactly two participants';
  end if;
  select count(*) into active_user_count from public.profiles p where p.id = any(all_user_ids) and p.active and p.deleted_at is null;
  if active_user_count <> cardinality(all_user_ids) then raise exception 'One or more participants are unavailable'; end if;

  insert into public.internal_conversations(id,title,conversation_type,opportunity_id,priority,responsible_id,created_by)
  values (new_conversation_id,conversation_title,conversation_kind,linked_opportunity_id,conversation_priority,initial_responsible_id,(select auth.uid()));

  insert into public.internal_conversation_members(conversation_id,user_id,member_role,added_by)
  select new_conversation_id, user_id,
    case when user_id = initial_responsible_id then 'responsible'
         when user_id = any(coalesce(observer_ids, '{}')) then 'observer'
         else 'member' end,
    (select auth.uid())
  from unnest(all_user_ids) as user_id;
  return new_conversation_id;
end;
$$;
revoke all on function public.create_internal_conversation(text,text,uuid,uuid,uuid[],uuid[],text) from public;
grant execute on function public.create_internal_conversation(text,text,uuid,uuid,uuid[],uuid[],text) to authenticated;

create or replace function public.update_internal_conversation(
  target_conversation_id uuid,
  new_title text default null,
  new_status text default null,
  new_priority text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null
    or not public.is_internal_conversation_member(target_conversation_id)
    or not public.is_internal_conversation_coordinator(target_conversation_id) then
    raise exception 'Conversation coordinator membership required';
  end if;
  update public.internal_conversations set
    title=coalesce(new_title,title), status=coalesce(new_status,status), priority=coalesce(new_priority,priority), updated_at=now()
  where id=target_conversation_id;
  if not found then raise exception 'Conversation unavailable'; end if;
end;
$$;
revoke all on function public.update_internal_conversation(uuid,text,text,text) from public;
grant execute on function public.update_internal_conversation(uuid,text,text,text) to authenticated;

create or replace function public.update_internal_conversation_members(
  target_conversation_id uuid,
  added_user_ids uuid[],
  added_roles text[],
  removed_user_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_kind text;
  current_responsible uuid;
  member_index integer;
  target_user uuid;
  affected_rows integer;
begin
  if (select auth.uid()) is null
    or not public.is_internal_conversation_member(target_conversation_id)
    or not public.is_internal_conversation_coordinator(target_conversation_id) then
    raise exception 'Conversation coordinator membership required';
  end if;
  select conversation_type,responsible_id into conversation_kind,current_responsible
  from public.internal_conversations where id=target_conversation_id for update;
  if conversation_kind is null then raise exception 'Conversation unavailable'; end if;
  if conversation_kind='direct' and (cardinality(coalesce(added_user_ids,'{}'))>0 or cardinality(coalesce(removed_user_ids,'{}'))>0) then
    raise exception 'Direct conversation membership is fixed';
  end if;
  if cardinality(coalesce(added_user_ids,'{}')) <> cardinality(coalesce(added_roles,'{}')) then
    raise exception 'Member roles do not match participants';
  end if;
  if cardinality(coalesce(added_user_ids,'{}'))>0 then
    for member_index in 1..cardinality(added_user_ids) loop
      if added_roles[member_index] not in ('member','observer') then raise exception 'Invalid member role'; end if;
      if not exists(select 1 from public.profiles p where p.id=added_user_ids[member_index] and p.active and p.deleted_at is null) then
        raise exception 'Participant unavailable';
      end if;
      insert into public.internal_conversation_members(conversation_id,user_id,member_role,added_by,removed_at)
      values(target_conversation_id,added_user_ids[member_index],added_roles[member_index],(select auth.uid()),null)
      on conflict(conversation_id,user_id) do update set member_role=excluded.member_role,removed_at=null;
    end loop;
  end if;
  foreach target_user in array coalesce(removed_user_ids,'{}') loop
    if target_user=(select auth.uid()) or target_user=current_responsible then raise exception 'Responsible or current user cannot be removed'; end if;
    update public.internal_conversation_members set removed_at=now()
    where conversation_id=target_conversation_id and user_id=target_user and removed_at is null;
    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then raise exception 'Active participant not found'; end if;
  end loop;
  update public.internal_conversations set updated_at=now() where id=target_conversation_id;
end;
$$;
revoke all on function public.update_internal_conversation_members(uuid,uuid[],text[],uuid[]) from public;
grant execute on function public.update_internal_conversation_members(uuid,uuid[],text[],uuid[]) to authenticated;

create or replace function public.reassign_internal_conversation(
  target_conversation_id uuid,
  target_responsible_id uuid,
  assignment_reason text,
  assignment_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prior_responsible_id uuid;
begin
  if (select auth.uid()) is null
    or not public.is_internal_conversation_member(target_conversation_id)
    or not public.is_internal_conversation_coordinator(target_conversation_id) then
    raise exception 'Conversation coordinator membership required';
  end if;
  if length(trim(coalesce(assignment_reason,''))) < 3 then raise exception 'Assignment reason is required'; end if;
  select responsible_id into prior_responsible_id from public.internal_conversations where id = target_conversation_id for update;
  if prior_responsible_id is null then raise exception 'Conversation unavailable'; end if;
  if prior_responsible_id = target_responsible_id then return; end if;
  if not exists(select 1 from public.profiles p where p.id = target_responsible_id and p.active and p.deleted_at is null) then raise exception 'Responsible unavailable'; end if;

  insert into public.internal_conversation_members(conversation_id,user_id,member_role,added_by,removed_at)
  values(target_conversation_id,target_responsible_id,'responsible',(select auth.uid()),null)
  on conflict(conversation_id,user_id) do update set member_role='responsible',removed_at=null;
  update public.internal_conversation_members set member_role='member'
  where conversation_id=target_conversation_id and user_id=prior_responsible_id;
  insert into public.internal_conversation_assignment_history(conversation_id,previous_responsible_id,new_responsible_id,changed_by,reason,note)
  values(target_conversation_id,prior_responsible_id,target_responsible_id,(select auth.uid()),trim(assignment_reason),nullif(trim(assignment_note),''));
  update public.internal_conversations set responsible_id=target_responsible_id,updated_at=now() where id=target_conversation_id;
  insert into public.internal_notifications(recipient_id,conversation_id,notification_type)
  values(target_responsible_id,target_conversation_id,'assignment');
end;
$$;
revoke all on function public.reassign_internal_conversation(uuid,uuid,text,text) from public;
grant execute on function public.reassign_internal_conversation(uuid,uuid,text,text) to authenticated;

create or replace function public.send_internal_message(
  target_conversation_id uuid,
  message_body text,
  replied_message_id uuid,
  mentioned_user_ids uuid[],
  file_path text,
  file_name text,
  file_mime text,
  file_size bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_message_id uuid := gen_random_uuid();
  notification_recipient uuid;
  conversation_status text;
begin
  if (select auth.uid()) is null or not public.is_internal_conversation_member(target_conversation_id) then
    raise exception 'Active conversation membership required';
  end if;
  if file_path is not null and file_path not like ('internal/' || target_conversation_id::text || '/%') then
    raise exception 'Attachment does not belong to this conversation';
  end if;
  select status into conversation_status from public.internal_conversations where id = target_conversation_id;
  if conversation_status is null then raise exception 'Conversation unavailable'; end if;
  if conversation_status = 'closed' then raise exception 'Closed conversations cannot receive messages'; end if;
  if replied_message_id is not null and not exists(
    select 1 from public.internal_messages m where m.id=replied_message_id and m.conversation_id=target_conversation_id
  ) then raise exception 'Reply target is not in this conversation'; end if;
  if exists(
    select 1 from unnest(coalesce(mentioned_user_ids,'{}')) mentioned_id
    where not exists(
      select 1 from public.internal_conversation_members cm
      where cm.conversation_id=target_conversation_id and cm.user_id=mentioned_id and cm.removed_at is null
    )
  ) then raise exception 'Mentions must reference active participants'; end if;

  insert into public.internal_messages(id,conversation_id,sender_id,body_text,reply_to_id,message_type,attachment_path,attachment_name,attachment_mime,attachment_size)
  values(new_message_id,target_conversation_id,(select auth.uid()),coalesce(message_body,''),replied_message_id,'internal_note',file_path,file_name,file_mime,file_size);
  insert into public.internal_message_mentions(message_id,mentioned_user_id)
  select new_message_id, mentioned_id from (select distinct unnest(coalesce(mentioned_user_ids,'{}')) as mentioned_id) mentions
  where mentioned_id <> (select auth.uid());
  for notification_recipient in
    select cm.user_id from public.internal_conversation_members cm
    where cm.conversation_id=target_conversation_id and cm.removed_at is null and cm.user_id <> (select auth.uid())
  loop
    insert into public.internal_notifications(recipient_id,conversation_id,message_id,notification_type)
    values(notification_recipient,target_conversation_id,new_message_id,
      case when notification_recipient=any(coalesce(mentioned_user_ids,'{}')) then 'mention' else 'message' end);
  end loop;
  return new_message_id;
end;
$$;
revoke all on function public.send_internal_message(uuid,text,uuid,uuid[],text,text,text,bigint) from public;
grant execute on function public.send_internal_message(uuid,text,uuid,uuid[],text,text,text,bigint) to authenticated;

create or replace function public.mark_internal_conversation_read(target_conversation_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  read_timestamp timestamptz := now();
begin
  if (select auth.uid()) is null or not public.is_internal_conversation_member(target_conversation_id) then
    raise exception 'Active conversation membership required';
  end if;
  update public.internal_conversation_members
  set last_read_at = read_timestamp
  where conversation_id = target_conversation_id
    and user_id = (select auth.uid()) and removed_at is null;
  if not found then raise exception 'Conversation unavailable'; end if;
  update public.internal_notifications
  set read_at = read_timestamp
  where conversation_id = target_conversation_id
    and recipient_id = (select auth.uid()) and read_at is null;
  return read_timestamp;
end;
$$;
revoke all on function public.mark_internal_conversation_read(uuid) from public;
grant execute on function public.mark_internal_conversation_read(uuid) to authenticated;

grant select on public.internal_conversations to authenticated;
grant select on public.internal_conversation_members to authenticated;
grant select on public.internal_messages to authenticated;
grant select on public.internal_message_mentions to authenticated;
grant select on public.internal_conversation_assignment_history to authenticated;
grant select on public.internal_notifications to authenticated;

-- Keep the new collaboration feed live without changing the locked realtime schema.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='internal_conversations') then
    alter publication supabase_realtime add table public.internal_conversations;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='internal_messages') then
    alter publication supabase_realtime add table public.internal_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='internal_notifications') then
    alter publication supabase_realtime add table public.internal_notifications;
  end if;
end;
$$;
