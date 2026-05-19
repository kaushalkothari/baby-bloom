-- Audit logging table for tracking all user actions on health records.
-- Each row captures who did what, on which entity, and when.

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (
    action in (
      'sign_in', 'sign_up', 'sign_out', 'password_reset_request',
      'create', 'update', 'delete',
      'export_data', 'import_data',
      'view', 'upload', 'download'
    )
  ),
  entity_type text check (
    entity_type is null or entity_type in (
      'child', 'hospital_visit', 'vaccination',
      'prescription', 'document', 'billing_record', 'profile'
    )
  ),
  entity_id uuid,
  metadata jsonb default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_logs_user_id_idx on public.audit_logs (user_id);
create index audit_logs_user_created_idx on public.audit_logs (user_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs (action);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id)
  where entity_type is not null;

alter table public.audit_logs enable row level security;

create policy audit_logs_select_own on public.audit_logs
  for select using (user_id = (select auth.uid()));

create policy audit_logs_insert_own on public.audit_logs
  for insert with check (user_id = (select auth.uid()));

grant select, insert on table public.audit_logs to authenticated;
grant all on table public.audit_logs to service_role;

comment on table public.audit_logs is 'Immutable audit trail of user actions across all health record entities.';
comment on column public.audit_logs.action is 'The type of action performed (CRUD, auth events, data export).';
comment on column public.audit_logs.entity_type is 'Which table/resource the action targets (null for auth-only events).';
comment on column public.audit_logs.entity_id is 'Primary key of the affected row (null for bulk or auth-only events).';
comment on column public.audit_logs.metadata is 'Additional context: changed fields, child name, etc. Never stores PHI/PII in cleartext.';
