begin;
create table public.forum_backup (
 user_id uuid primary key references public.forum_identities(user_id) on delete cascade,
 email text not null unique,
 verified_at timestamptz not null default now()
);
create table public.forum_recovery_guard (
 user_id uuid primary key references public.forum_identities(user_id) on delete cascade,
 blocked boolean not null default false,
 revoked_before timestamptz not null default '-infinity'
);
create table public.forum_mail_challenges (
 id uuid primary key,
 user_id uuid not null references public.forum_identities(user_id) on delete cascade,
 purpose text not null check(purpose in ('bind','recover')),
 email text not null,
 code_hash text not null,
 primary_hash text,
 attempts integer not null default 0,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '10 minutes',
 consumed_at timestamptz
);
create index forum_mail_challenges_user_time on public.forum_mail_challenges(user_id,created_at);
create index forum_mail_challenges_email_time on public.forum_mail_challenges(email,created_at);
alter table public.forum_backup enable row level security;
alter table public.forum_recovery_guard enable row level security;
alter table public.forum_mail_challenges enable row level security;
revoke all on public.forum_backup,public.forum_recovery_guard,public.forum_mail_challenges from public,anon,authenticated;
grant select,insert,update,delete on public.forum_backup,public.forum_recovery_guard,public.forum_mail_challenges to service_role;

-- Verified Auth identity is always resolved server-side, never from user metadata.
create function public.forum_recovery_target(primary_email text,backup_email text) returns uuid
language sql security definer set search_path='' as $$
 select u.id from auth.users u
 join public.forum_identities i on i.user_id=u.id
 join public.forum_backup b on b.user_id=u.id
 where i.gmail_key=primary_email and b.email=backup_email
 and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<now())
 and i.gmail_key=public.forum_gmail_key(u.email)
 and u.id<>'7484fe06-801d-44be-807f-3b773e4d21d2'::uuid
$$;

create function public.forum_mail_issue(actor_id uuid,ticket_id uuid,kind text,target_email text,proof text,primary_proof text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare primary_email text;
begin
 select i.gmail_key into primary_email from public.forum_identities i join auth.users u on u.id=i.user_id
 where i.user_id=actor_id and u.email_confirmed_at is not null
 and (u.banned_until is null or u.banned_until<now()) and i.gmail_key=public.forum_gmail_key(u.email)
 and u.id<>'7484fe06-801d-44be-807f-3b773e4d21d2'::uuid;
 if primary_email is null or kind not in ('bind','recover') or proof !~ '^[a-f0-9]{64}$' then return false;end if;
 if kind='bind' and (target_email=primary_email or primary_proof is null or primary_proof !~ '^[a-f0-9]{64}$') then return false;end if;
 -- Shared lock order serializes recipient and account quotas, across all actions.
 perform pg_advisory_xact_lock(hashtextextended('forum-mail-quota',0));
 if exists(select 1 from public.forum_mail_challenges where (user_id=actor_id or email=target_email) and created_at>now()-interval '60 seconds') then return false;end if;
 if (select count(*) from public.forum_mail_challenges where (user_id=actor_id or email=target_email) and created_at>now()-interval '1 hour')>=5 then return false;end if;
 if kind='recover' and not exists(select 1 from public.forum_backup where user_id=actor_id and email=target_email) then return false;end if;
 if kind='bind' and exists(select 1 from public.forum_backup where email=target_email and user_id<>actor_id) then return false;end if;
 insert into public.forum_mail_challenges(id,user_id,purpose,email,code_hash,primary_hash)
 values(ticket_id,actor_id,kind,target_email,proof,primary_proof);
 return true;
end $$;

-- Failed attempts RETURN rather than RAISE: the counter must be committed.
create function public.forum_mail_consume(ticket_id uuid,kind text,proof text,primary_proof text default null,actor_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.forum_mail_challenges%rowtype; lock_user uuid;
begin
 select user_id into lock_user from public.forum_mail_challenges where id=ticket_id;
 if lock_user is null then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended('forum-recovery:'||lock_user::text,0));
 select * into c from public.forum_mail_challenges where id=ticket_id for update;
 if c.purpose<>kind or c.consumed_at is not null or c.expires_at<=now() or c.attempts>=5 then return null;end if;
 if kind='bind' and actor_id is distinct from c.user_id then return null;end if;
 update public.forum_mail_challenges set attempts=attempts+1 where id=ticket_id;
 if proof is distinct from c.code_hash or (kind='bind' and primary_proof is distinct from c.primary_hash) then return null;end if;
 if not exists(select 1 from auth.users u join public.forum_identities i on i.user_id=u.id where u.id=c.user_id
   and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<now())
   and i.gmail_key=public.forum_gmail_key(u.email)) then return null;end if;
 if kind='recover' and not exists(select 1 from public.forum_backup where user_id=c.user_id and email=c.email) then return null;end if;
 if kind='bind' then
   if exists(select 1 from public.forum_recovery_guard where user_id=c.user_id and blocked) then return null;end if;
   if exists(select 1 from public.forum_backup where email=c.email and user_id<>c.user_id) then return null;end if;
   insert into public.forum_backup(user_id,email) values(c.user_id,c.email)
   on conflict(user_id) do update set email=excluded.email,verified_at=now();
 else
   -- Fail closed across the external Auth password update; failed updates require a new recovery.
   insert into public.forum_recovery_guard(user_id,blocked,revoked_before) values(c.user_id,true,now())
   on conflict(user_id) do update set blocked=true,revoked_before=now();
 end if;
 update public.forum_mail_challenges set consumed_at=now() where user_id=c.user_id and consumed_at is null;
 return c.user_id;
end $$;

create function public.forum_session_allowed(actor_id uuid,session_key uuid) returns boolean
language sql security definer set search_path='' as $$
 select exists(select 1 from auth.sessions s join public.forum_auth_links l on l.auth_user_id=s.user_id
 join auth.users owner on owner.id=l.user_id
 left join public.forum_recovery_guard g on g.user_id=l.user_id
 where s.id=session_key and s.user_id=actor_id and not coalesce(g.blocked,false)
 and owner.email_confirmed_at is not null and (owner.banned_until is null or owner.banned_until<now())
 and s.created_at>coalesce(g.revoked_before,'-infinity'::timestamptz))
$$;
revoke all on function public.forum_recovery_target(text,text),public.forum_mail_issue(uuid,uuid,text,text,text,text),public.forum_mail_consume(uuid,text,text,text,uuid),public.forum_session_allowed(uuid,uuid) from public,anon,authenticated;
grant execute on function public.forum_recovery_target(text,text),public.forum_mail_issue(uuid,uuid,text,text,text,text),public.forum_mail_consume(uuid,text,text,text,uuid),public.forum_session_allowed(uuid,uuid) to service_role;
commit;
