-- Private Storage for documents, prescription images, vaccine cards, receipts.
-- Paths should be: {auth.uid()}/{child_id}/... so RLS can scope by folder prefix.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'babybloom',
  'babybloom',
  false,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf'
  ]::text[]
)
on conflict (id) do nothing;

-- RLS is enabled on storage.objects by default in Supabase; add policies for our bucket.

create policy babybloom_storage_select_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'babybloom'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy babybloom_storage_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'babybloom'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy babybloom_storage_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'babybloom'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'babybloom'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy babybloom_storage_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'babybloom'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

comment on column public.documents.storage_path is 'Format: {user_id}/{child_id}/{filename} in bucket babybloom (see storage migration).';
