begin;

-- A unique public biography can replace LinkedIn as durable identity evidence.
-- Query strings, fragments, credentials, ports and host-only URLs are rejected.
create function public.canonical_public_profile(p_value text) returns text
language plpgsql immutable set search_path='' as $$
declare raw text:=btrim(coalesce(p_value,'')); host text; path text;
begin
 if raw !~ '^https://[^/@:[:space:]]+(\.[^/@:[:space:]]+)+/[^?#[:space:]]+' then return ''; end if;
 if raw ~ '^https://[^/]*@' or raw ~ '^https://[^/]+:[0-9]+' then return ''; end if;
 host:=lower(substring(raw from '^https://([^/?#]+)'));
 path:=substring(raw from '^https://[^/?#]+(/[^?#]*)');
 path:=regexp_replace(coalesce(path,''),'/+$','','g');
 if path='' then return ''; end if;
 return 'https://'||host||path;
end $$;

create or replace function public.contact_identity_keys(p_data jsonb) returns text[]
language sql immutable set search_path='' as $$
 select coalesce(array_agg(distinct identity order by identity),'{}'::text[]) from (
  select 'email:'||public.canonical_email(value) identity from jsonb_array_elements_text(
   jsonb_build_array(coalesce(p_data->>'email',''))||case when jsonb_typeof(p_data->'alternateEmails')='array' then p_data->'alternateEmails' else '[]'::jsonb end
  ) where btrim(value)<>''
  union all
  select 'linkedin:'||public.canonical_linkedin(p_data->>'linkedin') where public.canonical_linkedin(p_data->>'linkedin')<>''
  union all
  select 'profile:'||public.canonical_public_profile(p_data->>'profileUrl') where public.canonical_public_profile(p_data->>'profileUrl')<>''
 ) keys;
$$;

insert into public.contact_identity_history(owner,contact_id,identity)
select r.owner,r.id,k from public.records r cross join lateral unnest(public.contact_identity_keys(r.data)) k
where r.kind='contact' on conflict do nothing;
insert into public.identities(owner,identity,contact_id)
select owner,identity,contact_id from public.contact_identity_history where identity like 'profile:%'
on conflict(owner,identity) do nothing;

revoke all on function public.canonical_public_profile(text),public.contact_identity_keys(jsonb) from public,anon,authenticated,service_role;

commit;
