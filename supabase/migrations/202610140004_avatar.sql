begin;
alter table public.forum_profiles add column if not exists avatar_data text;
alter table public.forum_profiles add constraint forum_avatar_size check (
  avatar_data is null or (octet_length(avatar_data)<=45000 and avatar_data ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$')
);
-- Existing RLS and service-only grants apply to the new column as well.
commit;
