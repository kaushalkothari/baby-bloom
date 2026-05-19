-- If auth.uid() is null inside SECURITY DEFINER (rare), fall back to JWT sub claim.

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
  v_sub text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    v_sub := nullif(trim(current_setting('request.jwt.claim.sub', true)), '');
    if v_sub is not null then
      begin
        v_uid := v_sub::uuid;
      exception
        when invalid_text_representation then
          v_uid := null;
      end;
    end if;
  end if;

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

revoke all on function public.log_audit_event(text, text, uuid, jsonb, text) from public;
grant execute on function public.log_audit_event(text, text, uuid, jsonb, text) to authenticated;
