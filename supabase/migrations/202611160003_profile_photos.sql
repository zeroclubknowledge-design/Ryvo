-- Run in Supabase SQL Editor. Photos are public profile media, never private documents.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-photos','profile-photos',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists ryvo_photo_insert on storage.objects;
create policy ryvo_photo_insert on storage.objects for insert to authenticated with check (
 bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
 and name ~ '^[a-f0-9-]{36}/avatar-[a-f0-9-]{36}\.jpg$'
);
drop policy if exists ryvo_photo_select on storage.objects;
create policy ryvo_photo_select on storage.objects for select to authenticated using (
 bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
);
drop policy if exists ryvo_photo_delete on storage.objects;
create policy ryvo_photo_delete on storage.objects for delete to authenticated using (
 bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
);
commit;
