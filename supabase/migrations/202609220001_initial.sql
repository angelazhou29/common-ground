begin;
create table if not exists public.records (
 id uuid primary key default gen_random_uuid(), owner uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('contact','message','meeting','conversation','settings','integration','approval')),
 data jsonb not null default '{}', version integer not null default 1,
 created timestamptz not null default now(), updated timestamptz not null default now()
);
create index if not exists records_owner_kind on public.records(owner,kind);
create unique index if not exists one_settings_per_owner on public.records(owner) where kind='settings';
create table if not exists public.identities (
 id uuid primary key default gen_random_uuid(), owner uuid not null references auth.users(id) on delete cascade,
 identity text not null, contact_id uuid not null references public.records(id), unique(owner,identity)
);
create table if not exists public.events (
 id uuid primary key default gen_random_uuid(), owner uuid not null references auth.users(id) on delete cascade,
 type text not null, data jsonb not null default '{}', created timestamptz not null default now()
);
create index if not exists events_owner_created on public.events(owner,created desc);
create table if not exists public.jobs (
 id uuid primary key default gen_random_uuid(), owner uuid not null references auth.users(id) on delete cascade,
 dedupe_key text not null, kind text not null, state text not null default 'queued', due timestamptz not null default now(),
 locked_until timestamptz, payload jsonb not null default '{}', attempts integer not null default 0, unique(owner,dedupe_key)
);
alter table public.records enable row level security;
alter table public.identities enable row level security;
alter table public.events enable row level security;
alter table public.jobs enable row level security;
create policy records_owner on public.records for all to authenticated using (owner=(select auth.uid())) with check (owner=(select auth.uid()));
create policy identities_owner on public.identities for all to authenticated using (owner=(select auth.uid())) with check (owner=(select auth.uid()));
create policy events_owner on public.events for all to authenticated using (owner=(select auth.uid())) with check (owner=(select auth.uid()));
create policy jobs_read_owner on public.jobs for select to authenticated using (owner=(select auth.uid()));
grant usage on schema public to authenticated, service_role;
grant select,insert,update,delete on public.records, public.identities, public.events to authenticated;
grant select on public.jobs to authenticated;
grant all on public.records, public.identities, public.events, public.jobs to service_role;

create or replace function public.save_record(p_owner uuid,p_kind text,p_id uuid,p_version integer,p_data jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare affected integer; old_data jsonb;
begin
 if auth.uid() is null or p_owner<>auth.uid() then raise exception 'Unauthorized'; end if;
 if p_kind not in ('message','meeting','conversation','settings') then raise exception 'Unsupported record type'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 if p_version is null then
  insert into public.records(id,owner,kind,data) values(p_id,p_owner,p_kind,p_data || jsonb_build_object('id',p_id,'updatedAt',now()));
 else
  select data into old_data from public.records where id=p_id and owner=p_owner and kind=p_kind for update;
  if p_kind='message' and old_data->>'sentAt' is not null and ((p_data->>'subject') is distinct from (old_data->>'subject') or (p_data->>'body') is distinct from (old_data->>'body') or (p_data->>'contactId') is distinct from (old_data->>'contactId')) then raise exception 'Sent content is immutable'; end if;
  update public.records set data=p_data || jsonb_build_object('id',p_id,'updatedAt',now()),version=version+1,updated=now() where id=p_id and owner=p_owner and kind=p_kind and version=p_version;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Record changed in another window. Refresh before saving.'; end if;
 end if;
 insert into public.events(owner,type,data) values(p_owner,p_kind||' saved',jsonb_build_object('id',p_id));
 return p_id;
end $$;

create or replace function public.save_contact(p_owner uuid,p_id uuid,p_version integer,p_data jsonb,p_keys text[])
returns uuid language plpgsql security invoker set search_path='' as $$
declare key text; existing uuid; affected integer; old_data jsonb;
begin
 if auth.uid() is null or p_owner<>auth.uid() then raise exception 'Unauthorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 select data into old_data from public.records where id=p_id and owner=p_owner and kind='contact' for update;
 if old_data->>'excluded'='true' and coalesce(p_data->>'excluded','false')<>'true' then raise exception 'Suppression cannot be removed by editing'; end if;
 foreach key in array p_keys loop
  select contact_id into existing from public.identities where owner=p_owner and identity=key;
  if existing is not null and existing<>p_id then raise exception 'This identity already exists or is suppressed'; end if;
 end loop;
 if p_version is null then
  insert into public.records(id,owner,kind,data) values(p_id,p_owner,'contact',p_data || jsonb_build_object('id',p_id,'updatedAt',now()));
 else
  update public.records set data=p_data || jsonb_build_object('id',p_id,'updatedAt',now()),version=version+1,updated=now() where id=p_id and owner=p_owner and kind='contact' and version=p_version;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Contact changed in another window. Refresh before saving.'; end if;
 end if;
 foreach key in array p_keys loop
  insert into public.identities(owner,identity,contact_id) values(p_owner,key,p_id) on conflict(owner,identity) do nothing;
 end loop;
 insert into public.events(owner,type,data) values(p_owner,'Contact saved',jsonb_build_object('id',p_id));
 return p_id;
end $$;

create or replace function public.stop_contact(p_owner uuid,p_id uuid,p_reason text,p_remove boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or p_owner<>auth.uid() then raise exception 'Unauthorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 if not exists(select 1 from public.records where id=p_id and owner=p_owner and kind='contact') then raise exception 'Contact not found'; end if;
 if p_remove then
  update public.records set data=jsonb_build_object('id',p_id,'name','Deleted contact','excluded',true,'status','Deleted — suppressed','email','','linkedin','','sources','[]'::jsonb,'notes','Minimal identity keys retained to prevent recontact.'),version=version+1,updated=now() where id=p_id and owner=p_owner;
  delete from public.records where owner=p_owner and kind in ('message','meeting','conversation') and data->>'contactId'=p_id::text;
  update public.events set data=jsonb_build_object('id',p_id,'redacted',true) where owner=p_owner and (data->>'id'=p_id::text or data->>'contactId'=p_id::text);
 else
  update public.records set data=data||jsonb_build_object('excluded',true,'status',p_reason),version=version+1,updated=now() where id=p_id and owner=p_owner;
  update public.records set data=data||jsonb_build_object('state','cancelled'),version=version+1,updated=now() where owner=p_owner and kind='message' and data->>'contactId'=p_id::text and data->>'state' in ('draft','waiting_approval','queued','held');
 end if;
 update public.jobs set state='cancelled' where owner=p_owner and payload->>'contactId'=p_id::text and state in ('queued','held');
 insert into public.events(owner,type,data) values(p_owner,case when p_remove then 'Contact deleted; suppression retained' else 'Contact suppressed' end,jsonb_build_object('id',p_id));
end $$;
-- stop_contact cancels jobs under the same owner policy.
create policy jobs_update_owner on public.jobs for update to authenticated using(owner=(select auth.uid())) with check(owner=(select auth.uid()));
grant update on public.jobs to authenticated;
revoke all on function public.save_record(uuid,text,uuid,integer,jsonb) from public,anon;
revoke all on function public.save_contact(uuid,uuid,integer,jsonb,text[]) from public,anon;
revoke all on function public.stop_contact(uuid,uuid,text,boolean) from public,anon;
grant execute on function public.save_record(uuid,text,uuid,integer,jsonb),public.save_contact(uuid,uuid,integer,jsonb,text[]),public.stop_contact(uuid,uuid,text,boolean) to authenticated;
commit;
