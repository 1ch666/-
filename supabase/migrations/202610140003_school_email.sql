begin;
-- Preserve the existing function/column names and all member identifiers.
-- Only consumer Gmail receives dot/plus normalization; school addresses do not.
create or replace function public.forum_gmail_key(email text) returns text
language plpgsql immutable set search_path='' as $$
declare cleaned text:=lower(btrim(email)); local_part text;
begin
  if cleaned is null or char_length(cleaned)>254 then
    raise exception 'Invalid email' using errcode='22023';
  end if;
  if cleaned ~ '^[a-z0-9]+([._-][a-z0-9]+)*@stu\.tcssh\.tc\.edu\.tw$' then
    if char_length(split_part(cleaned,'@',1))>64 then raise exception 'Invalid email'; end if;
    return cleaned;
  end if;
  if cleaned !~ '^[a-z0-9.]+(\+[a-z0-9._-]+)?@gmail\.com$' then
    raise exception 'Only Gmail or TCSSH student email accounts are accepted' using errcode='22023';
  end if;
  local_part:=replace(split_part(split_part(cleaned,'@',1),'+',1),'.','');
  if char_length(local_part) not between 1 and 64 then raise exception 'Invalid email'; end if;
  return local_part||'@gmail.com';
end $$;
revoke all on function public.forum_gmail_key(text) from public,anon,authenticated;
commit;
