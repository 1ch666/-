-- Run once in this project's SQL editor. No changes to site_members or curriculum policies.
begin;
create table public.forum_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gmail_key text not null unique,
  created_at timestamptz not null default now()
);
create table public.forum_profiles (
  user_id uuid primary key references public.forum_identities(user_id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.forum_auth_links (
 auth_user_id uuid primary key references auth.users(id) on delete cascade,
 user_id uuid not null references public.forum_identities(user_id) on delete cascade
);
alter table public.forum_auth_links enable row level security;
revoke all on public.forum_auth_links from public,anon,authenticated;
grant select,insert,update,delete on public.forum_auth_links to service_role;
create table public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.forum_profiles(user_id),
  title text not null check (char_length(btrim(title)) between 2 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 20000),
  created_at timestamptz not null default now()
);
create table public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  author_id uuid not null references public.forum_profiles(user_id),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  created_at timestamptz not null default now()
);
create index forum_posts_created_idx on public.forum_posts(created_at desc,id desc);
create index forum_comments_post_idx on public.forum_comments(post_id,created_at,id);
create index forum_posts_author_idx on public.forum_posts(author_id,created_at);
create index forum_comments_author_idx on public.forum_comments(author_id,created_at);
alter table public.forum_identities enable row level security;
alter table public.forum_profiles enable row level security;
alter table public.forum_posts enable row level security;
alter table public.forum_comments enable row level security;
-- All access goes through forum-api, which verifies BOTH school and personal JWTs.
revoke all on public.forum_identities,public.forum_profiles,public.forum_posts,public.forum_comments from anon,authenticated;
grant select,insert,update,delete on public.forum_identities,public.forum_profiles,public.forum_posts,public.forum_comments to service_role;

create function public.forum_gmail_key(email text) returns text
language plpgsql immutable set search_path='' as $$
declare cleaned text:=lower(btrim(email)); local_part text;
begin
  if cleaned is null or cleaned !~ '^[a-z0-9.]+(\+[a-z0-9._-]+)?@gmail\.com$' then
    raise exception 'Only Gmail accounts are accepted' using errcode='22023';
  end if;
  local_part:=replace(split_part(split_part(cleaned,'@',1),'+',1),'.','');
  if char_length(local_part) not between 1 and 64 then raise exception 'Invalid Gmail'; end if;
  return local_part||'@gmail.com';
end $$;
create function public.forum_reserve_identity() returns trigger
language plpgsql security definer set search_path='' as $$
declare canonical text; member_id uuid;
begin
  -- The existing shared school login is not a forum member.
  if new.id='7484fe06-801d-44be-807f-3b773e4d21d2'::uuid then return new; end if;
  canonical:=public.forum_gmail_key(new.email);
  if tg_op='UPDATE' and old.email_confirmed_at is not null then
    if canonical is distinct from public.forum_gmail_key(old.email) then
      raise exception 'Forum email changes are disabled';
    end if;
  end if;
  if new.email_confirmed_at is null then return new;end if;
  -- Only verified identities may claim or join the canonical Gmail member.
  insert into public.forum_identities(user_id,gmail_key) values(new.id,canonical)
  on conflict(gmail_key) do update set gmail_key=excluded.gmail_key
  returning user_id into member_id;
  insert into public.forum_auth_links(auth_user_id,user_id) values(new.id,member_id)
  on conflict(auth_user_id) do nothing;
  return new;
end $$;
create trigger forum_identity_created after insert on auth.users
for each row execute function public.forum_reserve_identity();
create trigger forum_identity_email_changed after update of email,email_confirmed_at on auth.users
for each row execute function public.forum_reserve_identity();
revoke all on function public.forum_gmail_key(text),public.forum_reserve_identity() from public,anon,authenticated;

-- Server-only write entry point: current Auth row, ownership and rate limit are
-- checked inside one transaction. The Edge Function derives actor_id from getUser.
create function public.forum_write(actor_id uuid,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid; result jsonb; n text; last_write timestamptz;
begin
  if actor_id='7484fe06-801d-44be-807f-3b773e4d21d2'::uuid then raise exception 'Personal login required'; end if;
  select u.id into uid from auth.users u join public.forum_identities f on f.user_id=u.id
  where u.id=actor_id and u.email_confirmed_at is not null
    and (u.banned_until is null or u.banned_until<now())
    and f.gmail_key=public.forum_gmail_key(u.email);
  if uid is null then raise exception 'Verified Gmail required'; end if;
  -- One lock per account prevents concurrent requests bypassing the posting interval.
  perform pg_advisory_xact_lock(hashtextextended(actor_id::text,0));
  if operation='profile' then
    n:=btrim(payload->>'display_name');
    if n is null or char_length(n) not between 2 and 30 or n ~ '[[:cntrl:]]' then raise exception 'Invalid name'; end if;
    insert into public.forum_profiles(user_id,display_name) values(actor_id,n)
    on conflict(user_id) do update set display_name=excluded.display_name,updated_at=now();
    select to_jsonb(p) into result from public.forum_profiles p where user_id=actor_id;return result;
  end if;
  if not exists(select 1 from public.forum_profiles where user_id=actor_id) then raise exception 'Profile required';end if;
  if operation in ('post','comment') then
    select max(t.created_at) into last_write from (
      select created_at from public.forum_posts where author_id=actor_id
      union all select created_at from public.forum_comments where author_id=actor_id
    ) t;
    if last_write>now()-interval '15 seconds' then raise exception 'Please wait 15 seconds between messages';end if;
  end if;
  if operation='post' then
    insert into public.forum_posts(author_id,title,body) values(actor_id,btrim(payload->>'title'),btrim(payload->>'body'))
    returning jsonb_build_object('id',id) into result;
  elsif operation='comment' then
    insert into public.forum_comments(author_id,post_id,body) values(actor_id,(payload->>'post_id')::uuid,btrim(payload->>'body'))
    returning jsonb_build_object('id',id) into result;
  else raise exception 'Unsupported operation';end if;
  return result;
end $$;
revoke all on function public.forum_write(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.forum_write(uuid,text,jsonb) to service_role;
commit;
