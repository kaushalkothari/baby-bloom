-- BabyBloom health records — core tables, indexes, RLS
-- Aligns with src/types/index.ts; column names use snake_case for SQL conventions.

-- ---------------------------------------------------------------------------
-- Extensions (Supabase usually enables these; IF NOT EXISTS is safe)
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_at helper (search_path locked — security best practice)
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users) — optional display data for the app
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- New auth user → profile row (idempotent)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger babybloom_profile_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Children (tenant root: each row owned by one auth user)
-- ---------------------------------------------------------------------------
create table public.children (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  date_of_birth date not null,
  gender text not null check (gender in ('male', 'female', 'other')),
  blood_group text,
  photo_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index children_user_id_idx on public.children (user_id);
create index children_user_id_created_at_idx on public.children (user_id, created_at desc);

create trigger children_touch_updated_at
  before update on public.children
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Hospital visits
-- visit_date maps to app field "date"
-- ---------------------------------------------------------------------------
create table public.hospital_visits (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  visit_date date not null,
  hospital_name text not null,
  doctor_name text not null default '',
  reason text not null,
  description text not null default '',
  weight_kg numeric(6, 2),
  height_cm numeric(6, 2),
  head_circumference_cm numeric(6, 2),
  temperature_f numeric(5, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index hospital_visits_child_id_idx on public.hospital_visits (child_id);
create index hospital_visits_child_visit_date_idx on public.hospital_visits (child_id, visit_date desc);

create trigger hospital_visits_touch_updated_at
  before update on public.hospital_visits
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Vaccinations
-- ---------------------------------------------------------------------------
create table public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  vaccine_name text not null,
  due_date date not null,
  completed_date date,
  batch_number text,
  expiry_date date,
  administered_by text,
  location text,
  notes text,
  card_photo_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vaccinations_child_id_idx on public.vaccinations (child_id);
create index vaccinations_child_due_date_idx on public.vaccinations (child_id, due_date);

create trigger vaccinations_touch_updated_at
  before update on public.vaccinations
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Prescriptions (+ normalized medicines — avoids heavy JSONB scans)
-- ---------------------------------------------------------------------------
create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  visit_id uuid references public.hospital_visits (id) on delete set null,
  medicine_name text,
  dosage text,
  frequency text,
  duration text,
  prescribing_doctor text not null default '',
  prescription_date date not null,
  active boolean not null default true,
  notes text,
  prescription_image_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prescriptions_child_id_idx on public.prescriptions (child_id);
create index prescriptions_visit_id_idx on public.prescriptions (visit_id)
  where visit_id is not null;
create index prescriptions_child_date_idx on public.prescriptions (child_id, prescription_date desc);

create trigger prescriptions_touch_updated_at
  before update on public.prescriptions
  for each row execute function public.touch_updated_at();

create table public.prescription_medicines (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions (id) on delete cascade,
  name text not null,
  dosage text not null default '',
  frequency text not null default '',
  duration text not null default '',
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create index prescription_medicines_prescription_id_idx on public.prescription_medicines (prescription_id);
create index prescription_medicines_prescription_sort_idx on public.prescription_medicines (prescription_id, sort_order);

-- ---------------------------------------------------------------------------
-- Documents — file bytes live in Storage; DB holds metadata + path only
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  visit_id uuid references public.hospital_visits (id) on delete set null,
  name text not null,
  document_type text not null check (
    document_type in (
      'receipt',
      'lab_report',
      'discharge_summary',
      'prescription',
      'vaccination_card',
      'other'
    )
  ),
  storage_path text not null,
  file_type text not null,
  file_size_bytes bigint,
  document_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_child_id_idx on public.documents (child_id);
create index documents_child_document_date_idx on public.documents (child_id, document_date desc);

create trigger documents_touch_updated_at
  before update on public.documents
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Billing
-- ---------------------------------------------------------------------------
create table public.billing_records (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  visit_id uuid references public.hospital_visits (id) on delete set null,
  bill_date date not null,
  amount numeric(12, 2) not null check (amount >= 0),
  hospital_name text not null,
  description text not null default '',
  receipt_image_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index billing_records_child_id_idx on public.billing_records (child_id);
create index billing_records_child_bill_date_idx on public.billing_records (child_id, bill_date desc);

create trigger billing_records_touch_updated_at
  before update on public.billing_records
  for each row execute function public.touch_updated_at();

-- visit_id must reference a visit for the same child (PG CHECK cannot use subqueries)
create or replace function public.enforce_visit_belongs_to_child()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.visit_id is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.hospital_visits v
    where v.id = new.visit_id
      and v.child_id = new.child_id
  ) then
    raise exception 'visit_id must reference a hospital_visit for the same child_id';
  end if;
  return new;
end;
$$;

create trigger prescriptions_enforce_visit_child
  before insert or update on public.prescriptions
  for each row execute function public.enforce_visit_belongs_to_child();

create trigger documents_enforce_visit_child
  before insert or update on public.documents
  for each row execute function public.enforce_visit_belongs_to_child();

create trigger billing_records_enforce_visit_child
  before insert or update on public.billing_records
  for each row execute function public.enforce_visit_belongs_to_child();

-- ---------------------------------------------------------------------------
-- Row Level Security — all tables; no access for anon
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.hospital_visits enable row level security;
alter table public.vaccinations enable row level security;
alter table public.prescriptions enable row level security;
alter table public.prescription_medicines enable row level security;
alter table public.documents enable row level security;
alter table public.billing_records enable row level security;

-- Profiles: only own row
create policy profiles_select_own on public.profiles
  for select using (id = (select auth.uid()));

create policy profiles_insert_own on public.profiles
  for insert with check (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy profiles_delete_own on public.profiles
  for delete using (id = (select auth.uid()));

-- Children
create policy children_select_own on public.children
  for select using (user_id = (select auth.uid()));

create policy children_insert_own on public.children
  for insert with check (user_id = (select auth.uid()));

create policy children_update_own on public.children
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy children_delete_own on public.children
  for delete using (user_id = (select auth.uid()));

-- Helper: child belongs to current user (stable for policies)
create or replace function public.user_owns_child(p_child_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.children c
    where c.id = p_child_id
      and c.user_id = (select auth.uid())
  );
$$;

-- Hospital visits
create policy hospital_visits_all_own on public.hospital_visits
  for all using (public.user_owns_child(child_id))
  with check (public.user_owns_child(child_id));

-- Vaccinations
create policy vaccinations_all_own on public.vaccinations
  for all using (public.user_owns_child(child_id))
  with check (public.user_owns_child(child_id));

-- Prescriptions
create policy prescriptions_all_own on public.prescriptions
  for all using (public.user_owns_child(child_id))
  with check (public.user_owns_child(child_id));

-- Prescription medicines (via prescription → child)
create policy prescription_medicines_all_own on public.prescription_medicines
  for all using (
    exists (
      select 1
      from public.prescriptions p
      where p.id = prescription_medicines.prescription_id
        and public.user_owns_child(p.child_id)
    )
  )
  with check (
    exists (
      select 1
      from public.prescriptions p
      where p.id = prescription_medicines.prescription_id
        and public.user_owns_child(p.child_id)
    )
  );

-- Documents
create policy documents_all_own on public.documents
  for all using (public.user_owns_child(child_id))
  with check (public.user_owns_child(child_id));

-- Billing
create policy billing_records_all_own on public.billing_records
  for all using (public.user_owns_child(child_id))
  with check (public.user_owns_child(child_id));

-- ---------------------------------------------------------------------------
-- Grants: authenticated API only; service_role bypasses RLS for admin jobs
-- ---------------------------------------------------------------------------
grant usage on schema public to postgres, anon, authenticated, service_role;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.children to authenticated;
grant select, insert, update, delete on table public.hospital_visits to authenticated;
grant select, insert, update, delete on table public.vaccinations to authenticated;
grant select, insert, update, delete on table public.prescriptions to authenticated;
grant select, insert, update, delete on table public.prescription_medicines to authenticated;
grant select, insert, update, delete on table public.documents to authenticated;
grant select, insert, update, delete on table public.billing_records to authenticated;

grant all on table public.profiles to service_role;
grant all on table public.children to service_role;
grant all on table public.hospital_visits to service_role;
grant all on table public.vaccinations to service_role;
grant all on table public.prescriptions to service_role;
grant all on table public.prescription_medicines to service_role;
grant all on table public.documents to service_role;
grant all on table public.billing_records to service_role;

-- Sequences (if any identity; uuid default none needed)
grant usage on all sequences in schema public to authenticated, service_role;

-- RLS policy evaluation calls user_owns_child; explicit EXECUTE (avoid relying on PUBLIC)
revoke all on function public.user_owns_child(uuid) from public;
grant execute on function public.user_owns_child(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Comments (documentation)
-- ---------------------------------------------------------------------------
comment on table public.children is 'Child profile; user_id scopes all health data (RLS).';
comment on column public.hospital_visits.visit_date is 'Maps to app field HospitalVisit.date (ISO date string).';
comment on column public.prescriptions.prescription_date is 'Maps to app field Prescription.date.';
comment on column public.billing_records.bill_date is 'Maps to app field BillingRecord.date.';
comment on function public.user_owns_child(uuid) is 'RLS helper; STABLE + security invoker for correct auth.uid() evaluation.';
