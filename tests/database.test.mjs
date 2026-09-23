import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

// Executes the real migrations and permissions in a disposable PostgreSQL engine.
// PGlite has one connection: this tests transactions/retries, not live lock contention.
test('database migration preserves lifetime identities and enforces outreach reservations', async t=>{
  const db=new PGlite();
  t.after(()=>db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on function auth.uid(),auth.role() to anon,authenticated,service_role;`);
  await db.exec(await readFile(new URL('../supabase/migrations/202609220001_initial.sql',import.meta.url),'utf8'));
  const owner=randomUUID(),otherOwner=randomUUID(),legacy=randomUUID(),legacyAlias=randomUUID(),chain=randomUUID(),oldMessage=randomUUID(),deleted=randomUUID(),suppressed=randomUUID(),suppressedPeer=randomUUID(),suppressedMessage=randomUUID();
  await db.query('insert into auth.users(id) values ($1),($2)',[owner,otherOwner]);
  const contact=(suffix,changes={})=>({name:'Test professional '+suffix,email:`${suffix}@example.com`,linkedin:`https://www.linkedin.com/in/test-${suffix}`,title:'Rates Trader',company:'Example Bank',industry:'Sales & Trading',location:'Chicago',timezone:'America/Chicago',identityConfirmed:true,emailOrigin:'published',verification:'unknown',sources:[{url:'https://example.com/team',note:'Test fixture',retrievedAt:new Date().toISOString()}],...changes});
  for(const [id,data] of [[legacy,contact('legacy',{linkedin:'https://uk.linkedin.com/in/legacy-person/?trk=old'})],[legacyAlias,contact('legacy-alias',{linkedin:'https://www.linkedin.com/in/legacy-person#bio',alternateEmails:['shared-chain@example.com']})],[chain,contact('legacy-chain',{email:'shared-chain@example.com'})],[deleted,{name:'Deleted contact',excluded:true,email:'',linkedin:''}],[suppressed,contact('suppressed',{excluded:true,alternateEmails:['suppressed-alias@example.com']})],[suppressedPeer,contact('suppressed-peer',{email:'suppressed-alias@example.com'})]])await db.query("insert into public.records(id,owner,kind,data) values($1,$2,'contact',$3)",[id,owner,data]);
  await db.query("insert into public.records(id,owner,kind,data) values($1,$2,'message',$3)",[suppressedMessage,owner,{contactId:suppressedPeer,state:'waiting_approval',subject:'Existing draft',body:'Hi Test, a professional question.'}]);
  await db.query("insert into public.identities(owner,identity,contact_id) values($1,'email:old.deleted@example.com',$2)",[owner,deleted]);
  await db.query("insert into public.records(id,owner,kind,data) values($1,$2,'message',$3)",[oldMessage,owner,{contactId:legacy,state:'cancelled',gmailPreparedAt:'2025-01-01T00:00:00Z',subject:'Prior handoff',body:'Already opened'}]);
  await db.exec(await readFile(new URL('../supabase/migrations/202609220002_lifetime_outreach.sql',import.meta.url),'utf8'));
  async function asOwner(id=owner){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[id]);await db.exec('set role authenticated');}
  async function row(id){return (await db.query('select * from public.records where id=$1',[id])).rows[0];}
  async function saveContact(data,id=randomUUID(),version=null){await db.query('select public.save_contact($1,$2,$3,$4,$5)',[owner,id,version,data,[]]);return id;}
  async function saveMessage(cid,changes={},id=randomUUID(),version=null){await db.query("select public.save_record($1,'message',$2,$3,$4)",[owner,id,version,{contactId:cid,subject:'Question about rates',body:'Hi Test,\nWhat does a typical trading day look like?',state:'waiting_approval',sequence:0,...changes}]);return id;}
  async function reserve(mid,cid,mode='prepare',sentAt=null){const m=await row(mid),c=await row(cid);return db.query('select public.reserve_outreach($1,$2,$3,$4,$5,$6)',[owner,mid,m.version,c.version,mode,sentAt]);}
  await asOwner();

  await t.test('historical cancelled handoff blocks canonical LinkedIn aliases',async()=>{
    const locks=(await db.query('select public.outreach_status($1) locks',[owner])).rows[0].locks.map(x=>x.contact_id);
    assert.ok(locks.includes(legacy));assert.ok(locks.includes(legacyAlias));assert.ok(locks.includes(chain));
    await assert.rejects(saveMessage(chain),/Lifetime hold/);
    await assert.rejects(saveMessage(legacyAlias),/Lifetime hold/);
    await assert.rejects(saveContact(contact('new-email',{linkedin:'http://m.linkedin.com/in/legacy-person/'})),/identity already exists/);
    await assert.rejects(saveContact(contact('deleted-reimport',{email:'OLD.DELETED@example.com'})),/identity already exists/);
  });
  await t.test('suppression follows legacy alias chains even without sent history',async()=>{
    const locks=(await db.query('select public.outreach_status($1) locks',[owner])).rows[0].locks.map(x=>x.contact_id);
    assert.ok(locks.includes(suppressedPeer));
    await assert.rejects(saveMessage(suppressedPeer),/suppressed/);
    await assert.rejects(reserve(suppressedMessage,suppressedPeer),/suppressed/);
  });
  await t.test('identity checks ignore forged key arrays and preserve previous addresses',async()=>{
    const c=contact('alex',{email:'a.lex+work@gmail.com'}),id=await saveContact(c);
    await assert.rejects(saveContact(contact('alex-alias',{email:'alex@googlemail.com'})),/identity already exists/);
    await saveContact({...c,email:'alex.new@example.com',linkedin:'https://www.linkedin.com/in/new-profile'},id,1);
    await assert.rejects(saveContact(contact('alex-old',{email:'alex@gmail.com'})),/identity already exists/);
    await assert.rejects(saveContact(contact('alex-link',{linkedin:c.linkedin})),/identity already exists/);
    const distinct=await saveContact(contact('different',{name:c.name}));assert.ok(distinct);
  });
  await t.test('one permanent reservation survives state changes, reimports, and redaction',async()=>{
    const c=contact('reserve'),cid=await saveContact(c),mid=await saveMessage(cid);
    await reserve(mid,cid);
    await assert.rejects(reserve(mid,cid),/permanently blocked/);
    let m=await row(mid);
    await assert.rejects(saveMessage(cid,{...m.data,body:'Changed after handoff'},mid,m.version),/immutable/);
    await saveMessage(cid,{...m.data,state:'cancelled'},mid,m.version);
    await assert.rejects(saveMessage(cid),/Lifetime hold/);
    await db.query('select public.stop_contact($1,$2,$3,true)',[owner,cid,'Test redaction']);
    assert.equal(await row(mid),undefined);
    assert.equal((await db.query('select count(*)::int n from public.outreach_history where message_id=$1',[mid])).rows[0].n,1);
    await assert.rejects(saveContact(c),/identity already exists/);
  });
  await t.test('manual sent history claims the person and permits only recording the existing handoff',async()=>{
    const cid=await saveContact(contact('manual')),mid=await saveMessage(cid);
    await reserve(mid,cid,'record_sent','2026-01-01T00:00:00Z');
    await assert.rejects(saveMessage(cid),/Lifetime hold/);
    await assert.rejects(reserve(mid,cid,'record_sent','2026-01-01T00:00:00Z'),/already sent/);
    const cid2=await saveContact(contact('prepared-sent')),mid2=await saveMessage(cid2);
    await reserve(mid2,cid2);
    const c2=await row(cid2);
    await saveContact({...c2.data,email:'new-job@example.com',company:'Different Bank'},cid2,c2.version);
    await reserve(mid2,cid2,'record_sent','2026-01-01T00:00:00Z');
    const sent=(await row(mid2)).data;
    assert.equal(sent.state,'sent');assert.equal(sent.recipientEmail,'prepared-sent@example.com');assert.equal(sent.companyAtSend,'Example Bank');
  });
  await t.test('stale contact approval does not reserve anything',async()=>{
    const c=contact('stale'),cid=await saveContact(c),mid=await saveMessage(cid);
    await saveContact({...c,email:'stale-updated@example.com'},cid,1);
    await assert.rejects(db.query('select public.reserve_outreach($1,$2,1,1,\'prepare\')',[owner,mid]),/contact changed/);
    assert.equal((await db.query('select count(*)::int n from public.outreach_history where message_id=$1',[mid])).rows[0].n,0);
  });
  await t.test('generic saves cannot forge sends or erase claims',async()=>{
    const cid=await saveContact(contact('forged')),mid=await saveMessage(cid),m=await row(mid);
    await assert.rejects(saveMessage(cid,{...m.data,sentAt:new Date().toISOString(),state:'sent'},mid,m.version),/atomic reservation/);
    await assert.rejects(db.query('delete from public.outreach_history where owner=$1',[owner]),/permission denied/);
    await assert.rejects(db.query('delete from public.contact_identity_history where owner=$1',[owner]),/permission denied/);
    await assert.rejects(db.query("update public.records set data='{}' where id=$1",[cid]),/permission denied/);
    await assert.rejects(db.query('delete from public.identities where owner=$1',[owner]),/permission denied/);
  });
  await t.test('owner isolation applies to tables and privileged RPCs',async()=>{
    await asOwner(otherOwner);
    assert.equal((await db.query('select count(*)::int n from public.records')).rows[0].n,0);
    await assert.rejects(db.query('select * from public.outreach_status($1)',[owner]),/Unauthorized/);
    await assert.rejects(saveContact(contact('foreign')),/Unauthorized/);
    await assert.rejects(db.query('select public.save_discovered_contact($1,$2)',[otherOwner,contact('fake-job')]),/permission denied/);
    await asOwner();
  });
  await t.test('service discovery skips all old identities and cannot erase lifetime claims',async()=>{
    await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claim.role','service_role',false)");await db.exec('set role service_role');
    const data=contact('discovered',{discoveryDate:'2026-09-22',discoveryQuery:'markets-sales'});
    const discoveredId=(await db.query('select public.save_discovered_contact($1,$2) id',[owner,data])).rows[0].id;
    assert.ok(discoveredId);
    assert.equal((await db.query('select public.save_discovered_contact($1,$2) id',[owner,data])).rows[0].id,null);
    assert.equal((await db.query('select public.save_discovered_contact($1,$2) id',[owner,contact('again',{email:'old.deleted@example.com'})])).rows[0].id,null);
    await assert.rejects(db.query('delete from public.outreach_history'),/permission denied/);
    await asOwner();
    await saveContact(contact('discovered',{discoveryDate:'2099-01-01'}),discoveredId,1);
    assert.equal((await row(discoveredId)).data.discoveryDate,'2026-09-22');
    assert.equal((await row(discoveredId)).data.discoveryQuery,'markets-sales');
  });
});
