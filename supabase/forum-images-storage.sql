-- Storage configuration (not an application schema migration).
-- No direct client policies: only forum-api's verified server requests access this bucket.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('forum-images','forum-images',false,524288,array['image/jpeg'])
on conflict (id) do nothing;
