begin;

-- Identity history and outreach claims are intentionally independent of records:
-- deleting/redacting a contact or its messages must never make it eligible again.
create table public.contact_identity_history (
 owner uuid not null references auth.users(id) on delete cascade,
 contact_id uuid not null,
 identity text not null,
 created timestamptz not null default now(),
 primary key(owner,contact_id,identity)
);
create index contact_identity_lookup on public.contact_identity_history(owner,identity,contact_id);
create table public.outreach_history (
 owner uuid not null references auth.users(id) on delete cascade,
 message_id uuid not null,
 contact_id uuid not null,
 prepared_at timestamptz,
 sent_at timestamptz,
 created timestamptz not null default now(),
 primary key(owner,message_id)
);
create index outreach_history_person on public.outreach_history(owner,contact_id);
alter table public.contact_identity_history enable row level security;
alter table public.outreach_history enable row level security;
create policy contact_identity_history_read on public.contact_identity_history for select to authenticated using(owner=(select auth.uid()));
create policy outreach_history_read on public.outreach_history for select to authenticated using(owner=(select auth.uid()));
grant select on public.contact_identity_history,public.outreach_history to authenticated,service_role;

create function public.canonical_email(p_value text) returns text
language plpgsql immutable set search_path='' as $$
declare v text:=lower(regexp_replace(coalesce(p_value,''),'^[[:space:]]+|[[:space:]]+$','','g')); local_part text; domain_part text;
begin
 if v='' then return ''; end if;
 local_part:=split_part(v,'@',1); domain_part:=split_part(v,'@',2);
 if domain_part in ('gmail.com','googlemail.com') then return replace(split_part(local_part,'+',1),'.','')||'@gmail.com'; end if;
 return v;
end $$;

create function public.canonical_linkedin(p_value text) returns text
language plpgsql immutable set search_path='' as $$
declare slug text; n integer; ch text; raw text;
begin
 raw:=lower(regexp_replace(coalesce(p_value,''),'^[[:space:]]+|[[:space:]]+$','','g'));
 slug:=substring(raw from '^https?://(?:www\.|m\.|[a-z]{2,3}\.)?linkedin\.com/in/([a-z0-9_%~-]+)(?:/[a-z0-9_%~/-]*)?(?:[?#][^\r\n]*)?$');
 if slug is null then return ''; end if;
 if split_part(split_part(raw,'?',1),'#',1) ~ '%(?![0-9a-f]{2})|%(?:2e|2f|5c)' then return ''; end if;
 -- Decode only unreserved profile-slug bytes, matching the application helper.
 for n in 45..126 loop
  ch:=chr(n);
  if ch ~ '^[a-zA-Z0-9_~-]$' then slug:=replace(slug,'%'||lpad(to_hex(n),2,'0'),lower(ch)); end if;
 end loop;
 return 'https://www.linkedin.com/in/'||slug;
end $$;

create function public.contact_identity_keys(p_data jsonb) returns text[]
language sql immutable set search_path='' as $$
 select coalesce(array_agg(distinct identity order by identity),'{}'::text[]) from (
  select 'email:'||public.canonical_email(value) identity from jsonb_array_elements_text(
   jsonb_build_array(coalesce(p_data->>'email',''))||case when jsonb_typeof(p_data->'alternateEmails')='array' then p_data->'alternateEmails' else '[]'::jsonb end
  ) where btrim(value)<>''
  union all
  select 'linkedin:'||public.canonical_linkedin(p_data->>'linkedin') where public.canonical_linkedin(p_data->>'linkedin')<>''
 ) keys;
$$;

-- Preserve every legacy key (including identities retained after soft deletion),
-- while also adding canonical forms. Existing collisions are retained for review.
insert into public.contact_identity_history(owner,contact_id,identity)
select owner,contact_id,identity from public.identities on conflict do nothing;
insert into public.contact_identity_history(owner,contact_id,identity)
select owner,contact_id,case
 when identity like 'email:%' then 'email:'||public.canonical_email(substr(identity,7))
 when identity like 'linkedin:%' and public.canonical_linkedin(substr(identity,10))<>'' then 'linkedin:'||public.canonical_linkedin(substr(identity,10))
 else identity end from public.identities on conflict do nothing;
insert into public.contact_identity_history(owner,contact_id,identity)
select r.owner,r.id,k from public.records r cross join lateral unnest(public.contact_identity_keys(r.data)) k
where r.kind='contact' on conflict do nothing;

-- Include manually recorded sends and Gmail handoffs even if their current state
-- was later cancelled. Unknown timestamps fail closed using record creation time.
insert into public.outreach_history(owner,message_id,contact_id,prepared_at,sent_at,created)
select owner,id,(data->>'contactId')::uuid,
 case when nullif(data->>'gmailPreparedAt','') is not null then created end,
 case when nullif(data->>'sentAt','') is not null or data->>'state' in ('sent','replied','bounced','submitted','uncertain') then created end,
 created
from public.records where kind='message'
 and data->>'contactId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 and (nullif(data->>'gmailPreparedAt','') is not null or nullif(data->>'sentAt','') is not null or data->>'state' in ('sent','replied','bounced','submitted','uncertain'))
on conflict do nothing;

-- Linked legacy duplicates can form an alias chain. Follow it transitively;
-- never merge people on name, company, or a guessed address.
create function public.related_contact_ids(p_owner uuid,p_contact uuid) returns table(contact_id uuid)
language sql stable security definer set search_path='' as $$
 with recursive related(id) as (
  select p_contact
  union
  select b.contact_id from related r
  join public.contact_identity_history a on a.owner=p_owner and a.contact_id=r.id
  join public.contact_identity_history b on b.owner=p_owner and b.identity=a.identity
 ) select id from related;
$$;

create function public.outreach_status(p_owner uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid()<>p_owner then raise exception 'Unauthorized'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('contact_id',c.id)),'[]'::jsonb) from public.records c where c.owner=p_owner and c.kind='contact'
 and (exists(select 1 from public.related_contact_ids(p_owner,c.id) related join public.outreach_history h on h.owner=p_owner and h.contact_id=related.contact_id)
 or exists(select 1 from public.related_contact_ids(p_owner,c.id) related join public.records suppressed on suppressed.owner=p_owner and suppressed.id=related.contact_id and suppressed.kind='contact' where suppressed.data->>'excluded'='true')));
end $$;

create or replace function public.save_contact(p_owner uuid,p_id uuid,p_version integer,p_data jsonb,p_keys text[])
returns uuid language plpgsql security definer set search_path='' as $$
declare key text; affected integer; old_data jsonb; keys text[];
begin
 if auth.uid() is null or p_owner<>auth.uid() then raise exception 'Unauthorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 select data into old_data from public.records where id=p_id and owner=p_owner and kind='contact' for update;
 if old_data->>'excluded'='true' and coalesce(p_data->>'excluded','false')<>'true' then raise exception 'Suppression cannot be removed by editing'; end if;
 if coalesce(p_data->>'linkedin','')<>'' and public.canonical_linkedin(p_data->>'linkedin')='' then raise exception 'Use a public LinkedIn profile URL'; end if;
 -- Never trust caller-supplied identity keys, including the legacy p_keys argument.
 keys:=public.contact_identity_keys(p_data);
 foreach key in array keys loop
  if exists(select 1 from public.contact_identity_history where owner=p_owner and identity=key and contact_id<>p_id) then raise exception 'This identity already exists in lifetime history or is suppressed'; end if;
 end loop;
 p_data:=(p_data-'outreachLocked')||jsonb_build_object('linkedin',public.canonical_linkedin(p_data->>'linkedin'));
 if p_version is null then
  insert into public.records(id,owner,kind,data) values(p_id,p_owner,'contact',p_data||jsonb_build_object('id',p_id,'updatedAt',now()));
 else
  update public.records set data=p_data||jsonb_build_object('id',p_id,'updatedAt',now()),version=version+1,updated=now() where id=p_id and owner=p_owner and kind='contact' and version=p_version;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Contact changed in another window. Refresh before saving.'; end if;
 end if;
 foreach key in array keys loop
  insert into public.contact_identity_history(owner,contact_id,identity) values(p_owner,p_id,key) on conflict do nothing;
  insert into public.identities(owner,identity,contact_id) values(p_owner,key,p_id) on conflict(owner,identity) do nothing;
 end loop;
 insert into public.events(owner,type,data) values(p_owner,'Contact saved',jsonb_build_object('id',p_id));
 return p_id;
end $$;

create or replace function public.save_record(p_owner uuid,p_kind text,p_id uuid,p_version integer,p_data jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare affected integer; old_data jsonb; cid uuid; field text;
begin
 if auth.uid() is null or p_owner<>auth.uid() then raise exception 'Unauthorized'; end if;
 if p_kind not in ('message','meeting','conversation','settings') then raise exception 'Unsupported record type'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 if p_version is not null then
  select data into old_data from public.records where id=p_id and owner=p_owner and kind=p_kind for update;
 end if;
 if p_kind='message' then
  cid:=(p_data->>'contactId')::uuid;
  if not exists(select 1 from public.records where owner=p_owner and id=cid and kind='contact') then raise exception 'Contact not found'; end if;
  if old_data is not null and old_data->>'contactId' is distinct from p_data->>'contactId' then raise exception 'A message cannot be reassigned to another contact'; end if;
  if (p_data->>'gmailPreparedAt') is distinct from (old_data->>'gmailPreparedAt') or (p_data->>'sentAt') is distinct from (old_data->>'sentAt') then raise exception 'Outreach requires an atomic reservation'; end if;
  if p_data->>'state' in ('sent','replied','bounced','submitted','uncertain') and coalesce(old_data->>'sentAt','')='' then raise exception 'Outreach requires an atomic reservation'; end if;
  if exists(select 1 from public.outreach_history where owner=p_owner and message_id=p_id) then
   foreach field in array array['subject','body','recipientEmail','recipientName','recipientTitle','recipientLinkedin','companyAtSend','industryAtSend','locationAtSend','recipientTimezone'] loop
    if (p_data->field) is distinct from (old_data->field) then raise exception 'Prepared and sent content is immutable'; end if;
   end loop;
  end if;
  if p_data->>'state' in ('draft','waiting_approval','queued') or p_version is null then
   if exists(select 1 from public.related_contact_ids(p_owner,cid) r join public.outreach_history h on h.owner=p_owner and h.contact_id=r.contact_id) then raise exception 'This person was already prepared or sent an email. Lifetime hold.'; end if;
   if exists(select 1 from public.related_contact_ids(p_owner,cid) r join public.records c on c.owner=p_owner and c.id=r.contact_id and c.kind='contact' where c.data->>'excluded'='true') then raise exception 'This person is suppressed in lifetime identity history'; end if;
   if exists(select 1 from public.related_contact_ids(p_owner,cid) r join public.records m on m.owner=p_owner and m.kind='message' and m.data->>'contactId'=r.contact_id::text where m.id<>p_id and coalesce(m.data->>'state','')<>'cancelled') then raise exception 'An email already exists for this person'; end if;
  end if;
 end if;
 if p_version is null then
  insert into public.records(id,owner,kind,data) values(p_id,p_owner,p_kind,p_data||jsonb_build_object('id',p_id,'updatedAt',now()));
 else
  update public.records set data=p_data||jsonb_build_object('id',p_id,'updatedAt',now()),version=version+1,updated=now() where id=p_id and owner=p_owner and kind=p_kind and version=p_version;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Record changed in another window. Refresh before saving.'; end if;
 end if;
 insert into public.events(owner,type,data) values(p_owner,p_kind||' saved',jsonb_build_object('id',p_id));
 return p_id;
end $$;

create function public.reserve_outreach(p_owner uuid,p_message_id uuid,p_version integer,p_contact_version integer,p_mode text,p_sent_at timestamptz default null)
returns void language plpgsql security definer set search_path='' as $$
declare m public.records%rowtype; c public.records%rowtype; claimed public.outreach_history%rowtype;
begin
 if auth.uid() is null or auth.uid()<>p_owner then raise exception 'Unauthorized'; end if;
 if coalesce(p_mode,'') not in ('prepare','record_sent') then raise exception 'Unknown outreach action'; end if;
 -- Every supported mutation takes this owner lock BEFORE acquiring row locks.
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 select * into m from public.records where owner=p_owner and kind='message' and id=p_message_id for update;
 if not found or m.version is distinct from p_version then raise exception 'This draft changed. Refresh and approve the exact version again.'; end if;
 select * into c from public.records where owner=p_owner and kind='contact' and id=(m.data->>'contactId')::uuid for update;
 if not found or c.version is distinct from p_contact_version then raise exception 'This contact changed. Refresh and review again.'; end if;
 if coalesce(m.data->>'state','') not in ('draft','waiting_approval','held') or nullif(m.data->>'sentAt','') is not null then raise exception 'This email is already sent or cannot be opened'; end if;
 if exists(select 1 from public.related_contact_ids(p_owner,c.id) r join public.outreach_history h on h.owner=p_owner and h.contact_id=r.contact_id where h.message_id<>m.id) then raise exception 'This person was already prepared or sent an email. Lifetime hold.'; end if;
 select * into claimed from public.outreach_history where owner=p_owner and message_id=m.id;
 if p_mode='prepare' then
  if claimed.message_id is not null or nullif(m.data->>'gmailPreparedAt','') is not null then raise exception 'This email was already opened in Gmail. Another handoff is permanently blocked.'; end if;
  if exists(select 1 from public.related_contact_ids(p_owner,c.id) r join public.records suppressed on suppressed.owner=p_owner and suppressed.id=r.contact_id and suppressed.kind='contact' where suppressed.data->>'excluded'='true') then raise exception 'This person is suppressed in lifetime identity history'; end if;
  if c.data->>'synthetic'='true' or coalesce(c.data->>'identityConfirmed','false')<>'true' then raise exception 'Review this contact before opening Gmail'; end if;
  if coalesce(c.data->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or c.data->>'verification' in ('invalid','catch-all') then raise exception 'A supported business email is required'; end if;
  if coalesce(c.data->>'emailOrigin','') not in ('published','authorized provider') or jsonb_typeof(c.data->'sources') is distinct from 'array' or jsonb_array_length(c.data->'sources')=0 then raise exception 'A supported email source is required'; end if;
  if btrim(coalesce(m.data->>'subject',''))='' or btrim(coalesce(m.data->>'body',''))='' or m.data->>'body' ~ '[\[\]{}<>]' then raise exception 'Resolve empty content or placeholders first'; end if;
  if exists(select 1 from public.related_contact_ids(p_owner,c.id) r join public.records x on x.owner=p_owner and x.data->>'contactId'=r.contact_id::text where x.kind='conversation' or (x.kind='meeting' and x.data->>'state'<>'Cancelled')) then raise exception 'This person already replied or has a meeting. Continue the existing conversation.'; end if;
  insert into public.outreach_history(owner,message_id,contact_id,prepared_at) values(p_owner,m.id,c.id,now());
  update public.records set data=data||jsonb_build_object('state','held','gmailPreparedAt',now(),'recipientEmail',c.data->>'email','recipientName',c.data->>'name','recipientTitle',c.data->>'title','recipientLinkedin',c.data->>'linkedin','companyAtSend',c.data->>'company','industryAtSend',c.data->>'industry','locationAtSend',c.data->>'location','recipientTimezone',c.data->>'timezone','updatedAt',now()),version=version+1,updated=now() where id=m.id;
 else
  if p_sent_at is null or p_sent_at>now() then raise exception 'Enter the actual past send time'; end if;
  if claimed.sent_at is not null then raise exception 'This email is already recorded as sent'; end if;
  insert into public.outreach_history(owner,message_id,contact_id,sent_at) values(p_owner,m.id,c.id,p_sent_at)
   on conflict(owner,message_id) do update set sent_at=excluded.sent_at;
  update public.records set data=data||jsonb_build_object('state','sent','sentAt',p_sent_at,'sentEvidence','manual','recipientEmail',case when claimed.prepared_at is null then c.data->>'email' else m.data->>'recipientEmail' end,'recipientName',case when claimed.prepared_at is null then c.data->>'name' else m.data->>'recipientName' end,'recipientTitle',case when claimed.prepared_at is null then c.data->>'title' else m.data->>'recipientTitle' end,'recipientLinkedin',case when claimed.prepared_at is null then c.data->>'linkedin' else m.data->>'recipientLinkedin' end,'companyAtSend',case when claimed.prepared_at is null then c.data->>'company' else m.data->>'companyAtSend' end,'industryAtSend',case when claimed.prepared_at is null then c.data->>'industry' else m.data->>'industryAtSend' end,'locationAtSend',case when claimed.prepared_at is null then c.data->>'location' else m.data->>'locationAtSend' end,'recipientTimezone',case when claimed.prepared_at is null then c.data->>'timezone' else m.data->>'recipientTimezone' end,'updatedAt',now()),version=version+1,updated=now() where id=m.id;
 end if;
 insert into public.events(owner,type,data) values(p_owner,case when p_mode='prepare' then 'Gmail handoff reserved permanently' else 'Sent email recorded' end,jsonb_build_object('id',m.id,'contactId',c.id));
end $$;

-- Only the job's service credential may insert discoveries. Existing identities
-- are skipped instead of edited, including contacts removed from the workspace.
create function public.save_discovered_contact(p_owner uuid,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare key text; keys text[]; cid uuid:=gen_random_uuid();
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Unauthorized'; end if;
 if p_owner is null then raise exception 'Owner required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 keys:=public.contact_identity_keys(p_data);
 if cardinality(keys)=0 then raise exception 'An evidenced identity is required'; end if;
 if exists(select 1 from public.contact_identity_history where owner=p_owner and identity=any(keys)) then return null; end if;
 p_data:=(p_data-'id'-'version'-'outreachLocked')||jsonb_build_object('id',cid,'linkedin',public.canonical_linkedin(p_data->>'linkedin'),'synthetic',false,'excluded',false,'updatedAt',now());
 insert into public.records(id,owner,kind,data) values(cid,p_owner,'contact',p_data);
 foreach key in array keys loop
  insert into public.contact_identity_history(owner,contact_id,identity) values(p_owner,cid,key);
  insert into public.identities(owner,contact_id,identity) values(p_owner,cid,key) on conflict(owner,identity) do nothing;
 end loop;
 return cid;
end $$;

-- Existing suppression/redaction already preserves the contact tombstone and
-- identities; its message deletions leave the new independent claim ledger intact.
alter function public.stop_contact(uuid,uuid,text,boolean) security definer;

-- Browser/API callers cannot erase history or bypass reservations with table writes.
revoke insert,update,delete,truncate,references,trigger on public.records,public.identities,public.contact_identity_history,public.outreach_history from public,anon,authenticated,service_role;
revoke all on function public.canonical_email(text),public.canonical_linkedin(text),public.contact_identity_keys(jsonb),public.related_contact_ids(uuid,uuid),public.outreach_status(uuid),public.reserve_outreach(uuid,uuid,integer,integer,text,timestamptz),public.save_discovered_contact(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.outreach_status(uuid),public.reserve_outreach(uuid,uuid,integer,integer,text,timestamptz) to authenticated;
grant execute on function public.save_discovered_contact(uuid,jsonb) to service_role;

commit;
