create or replace function public.index_condo_landing_secret_valid(candidate text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select encode(extensions.digest(coalesce(candidate, ''), 'sha256'), 'hex') = '66f74728ddb4d2079ee5006bfbe7be7aa8d155dffc99532822f6024c27a2a8e6';
$$;

revoke all on function public.index_condo_landing_secret_valid(text) from public, anon, authenticated;
grant execute on function public.index_condo_landing_secret_valid(text) to service_role;

create or replace function public.start_index_condo_form(
  p_api_secret text,
  p_resume_token_hash text,
  p_environment text,
  p_current_step integer,
  p_total_steps integer,
  p_answers jsonb,
  p_tracking jsonb,
  p_ip_hash text,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_id uuid;
  recent_count integer;
begin
  if not public.index_condo_landing_secret_valid(p_api_secret) then
    raise exception 'invalid_landing_secret' using errcode = '42501';
  end if;

  select count(*) into recent_count
  from public.marketing_form_sessions
  where ip_hash = p_ip_hash
    and started_at >= now() - interval '1 hour';

  if recent_count >= 12 then
    raise exception 'rate_limit' using errcode = 'P0001';
  end if;

  insert into public.marketing_form_sessions (
    resume_token_hash,
    environment,
    current_step,
    total_steps,
    answers,
    tracking,
    ip_hash,
    user_agent
  ) values (
    p_resume_token_hash,
    p_environment,
    p_current_step,
    p_total_steps,
    coalesce(p_answers, '{}'::jsonb),
    coalesce(p_tracking, '{}'::jsonb),
    p_ip_hash,
    left(coalesce(p_user_agent, ''), 500)
  )
  returning id into session_id;

  return jsonb_build_object('sessionId', session_id, 'saved', true);
end;
$$;

revoke all on function public.start_index_condo_form(text,text,text,integer,integer,jsonb,jsonb,text,text) from public, authenticated;
grant execute on function public.start_index_condo_form(text,text,text,integer,integer,jsonb,jsonb,text,text) to anon, service_role;

create or replace function public.save_index_condo_form(
  p_api_secret text,
  p_session_id uuid,
  p_resume_token_hash text,
  p_current_step integer,
  p_answers jsonb,
  p_tracking jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.marketing_form_sessions%rowtype;
  merged_answers jsonb;
  merged_tracking jsonb;
begin
  if not public.index_condo_landing_secret_valid(p_api_secret) then
    raise exception 'invalid_landing_secret' using errcode = '42501';
  end if;

  select * into session_row
  from public.marketing_form_sessions
  where id = p_session_id
  for update;

  if not found or session_row.resume_token_hash <> p_resume_token_hash then
    raise exception 'invalid_form_session' using errcode = '28000';
  end if;

  if session_row.status = 'completed' then
    return jsonb_build_object(
      'completed', true,
      'duplicate', true,
      'synced', session_row.opportunity_id is not null,
      'answers', session_row.answers,
      'tracking', session_row.tracking
    );
  end if;

  merged_answers := session_row.answers || coalesce(p_answers, '{}'::jsonb);
  merged_tracking := session_row.tracking || coalesce(p_tracking, '{}'::jsonb);

  update public.marketing_form_sessions
  set answers = merged_answers,
      tracking = merged_tracking,
      current_step = p_current_step,
      last_seen_at = now(),
      updated_at = now()
  where id = session_row.id;

  return jsonb_build_object(
    'saved', true,
    'completed', false,
    'answers', merged_answers,
    'tracking', merged_tracking
  );
end;
$$;

revoke all on function public.save_index_condo_form(text,uuid,text,integer,jsonb,jsonb) from public, authenticated;
grant execute on function public.save_index_condo_form(text,uuid,text,integer,jsonb,jsonb) to anon, service_role;

create or replace function public.submit_index_condo_form(
  p_api_secret text,
  p_session_id uuid,
  p_resume_token_hash text,
  p_requested_owner uuid,
  p_sync_to_crm boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored_token_hash text;
begin
  if not public.index_condo_landing_secret_valid(p_api_secret) then
    raise exception 'invalid_landing_secret' using errcode = '42501';
  end if;

  select resume_token_hash into stored_token_hash
  from public.marketing_form_sessions
  where id = p_session_id;

  if stored_token_hash is null or stored_token_hash <> p_resume_token_hash then
    raise exception 'invalid_form_session' using errcode = '28000';
  end if;

  return public.complete_index_condo_form(p_session_id, p_requested_owner, p_sync_to_crm);
end;
$$;

revoke all on function public.submit_index_condo_form(text,uuid,text,uuid,boolean) from public, authenticated;
grant execute on function public.submit_index_condo_form(text,uuid,text,uuid,boolean) to anon, service_role;
