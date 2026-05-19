-- Reliable audit writes from the browser: row owner is always auth.uid() from the JWT.
-- Direct INSERT can fail if client sends a mismatched user_id or subtle RLS timing issues.

create or replace function public.log_audit_event(
  p_action text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    user_agent
  )
  values (
    v_uid,
    p_action,
    p_entity_type,
    p_entity_id,
    coalesce(p_metadata, '{}'::jsonb),
    nullif(trim(coalesce(p_user_agent, '')), '')
  );
end;
$$;

comment on function public.log_audit_event(text, text, uuid, jsonb, text)
  is 'Append-only audit row; user_id is always the current auth user (JWT).';

revoke all on function public.log_audit_event(text, text, uuid, jsonb, text) from public;
grant execute on function public.log_audit_event(text, text, uuid, jsonb, text) to authenticated;
