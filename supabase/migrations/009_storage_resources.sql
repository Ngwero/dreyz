-- Public bucket for resource handouts and studio uploads (API uses service role).

insert into storage.buckets (id, name, public, file_size_limit)
values ('resources', 'resources', true, 26214400)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

drop policy if exists resources_public_read on storage.objects;
create policy resources_public_read
  on storage.objects for select
  using (bucket_id = 'resources');
