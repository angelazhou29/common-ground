/* eslint-disable @typescript-eslint/no-explicit-any -- PostgREST JSON fixture builder; real SQL invariants are separately tested. */
import test from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {queryPlan,publishedPeople,corroborates,discoveredContact,QUERY_RECIPES,emptyObservation,matchesPreferences,queryWithPreferences} from '../lib/discovery.ts';
import {allowedSource,robotsPolicy,publicIpv4,PublicSourceReader} from '../lib/discovery-policy.ts';
import {braveSearch,discoveryConfig,runDiscoveryJob} from '../lib/discovery-job.ts';
import {canonicalCompany,dailyCompanyQuotas,TARGET_COMPANIES} from '../lib/targeting.ts';

const person={'@type':'Person',name:'Fixture Person',jobTitle:'Vice President, Fixed Income Trading',worksFor:{name:'JPMorgan'},email:'fixture@fixtures.test',sameAs:'https://www.linkedin.com/in/fixture-person',address:{addressLocality:'Chicago'}};
const html=(p:unknown=person)=>`<script type="application/ld+json">${JSON.stringify(p)}</script>`;
const env={DISCOVERY_ENABLED:'true',BRAVE_SEARCH_API_KEY:'fixture-secret',DISCOVERY_ALLOWED_HOSTS:'alpha.example.org,beta.example.org',DISCOVERY_CONTACT_URL:'https://operator.example.org/contact'};

test('the fixed query vocabulary contains only Sales & Trading families',()=>{
  const history=QUERY_RECIPES.map(q=>({...emptyObservation(q.id),searches:5,accepted:0}));
  const plan=queryPlan(history,'2026-09-22');assert.equal(plan.length,4);assert.ok(plan.every(q=>q.family==='sales-trading'));
  assert.notEqual(queryPlan(history,'2026-09-22')[0].id,queryPlan(history,'2026-09-23')[0].id);
});
test('profile extraction never guesses missing identity, employer, title or email',()=>{
  const people=publishedPeople(html(),'https://alpha.example.org/bio');assert.equal(people.length,1);assert.equal(people[0].linkedin,person.sameAs);
  for(const key of ['name','jobTitle','worksFor','email','sameAs']){const partial={...person,[key]:''};assert.equal(publishedPeople(html(partial),'https://alpha.example.org').length,0);}
  assert.equal(publishedPeople(html({...person,email:'sales@fixtures.test'}),'https://alpha.example.org').length,0);
  assert.equal(publishedPeople('<h1>Fixture Person</h1><p>Probably firstname.lastname@fixtures.test</p>','https://alpha.example.org').length,0);
});
test('independent corroboration requires matching current employer, role and stable identity',()=>{
  const p=publishedPeople(html(),'https://alpha.example.org/bio')[0];
  assert.equal(corroborates(p,html(),'https://beta.example.org/bio'),true);
  assert.equal(corroborates(p,html(),'https://www.alpha.example.org/other'),false);
  assert.equal(corroborates(p,html({...person,worksFor:{name:'Different Firm'}}),'https://beta.example.org/bio'),false);
  const c=discoveredContact(p,[],QUERY_RECIPES[0],'2026-09-22T12:00:00Z');assert.equal(c.verification,'unknown');assert.equal(c.timezone,'');assert.equal(c.level,'Vice President');
});
test('saved targeting, regions and exclusions constrain both queries and accepted profiles',()=>{
  const p=publishedPeople(html(),'https://alpha.example.org/bio')[0];
  assert.equal(matchesPreferences(p,{targets:'JPMorgan',regions:'Chicago'}),true);
  assert.equal(matchesPreferences(p,{regions:'New York'}),false);
  assert.equal(matchesPreferences(p,{exclusions:'JPMorgan'}),false);
  assert.equal(matchesPreferences(p,{targets:'Unrelated Firm'}),true);
  assert.equal(matchesPreferences({...p,company:'Unrelated Firm'},{targets:'JPMorgan'}),false);
  assert.match(queryWithPreferences('trader',{regions:'Chicago; New York',exclusions:'Retail'},'2026-09-22'),/-"Retail"/);
});
test('fetch destinations are exact approved HTTPS public domains and never protected platforms',()=>{
  for(const u of ['http://alpha.example.org','https://user:pass@alpha.example.org','https://evil.alpha.example.org','https://alpha.example.org:444','https://alpha.example.org/login','https://www.linkedin.com/in/x','https://127.0.0.1'])assert.equal(allowedSource(u,['alpha.example.org','www.linkedin.com','127.0.0.1']),null);
  for(const ip of ['127.0.0.1','10.2.3.4','169.254.169.254','192.168.1.2','100.64.0.1','198.18.1.2','203.0.113.3'])assert.equal(publicIpv4(ip),false);
  assert.equal(publicIpv4('93.184.216.34'),true);
});
test('robots use specific groups, longest match, allow ties, wildcards and crawl delay',()=>{
  assert.equal(robotsPolicy('User-agent: *\nDisallow: /','/bio').allowed,false);
  assert.equal(robotsPolicy('User-agent: *\nDisallow: /private\nAllow: /private/bio','/private/bio').allowed,true);
  assert.equal(robotsPolicy('User-agent: *\nDisallow: /\nUser-agent: CommonGroundResearchBot\nAllow: /\nCrawl-delay: 12','/bio').delayMs,12000);
  assert.equal(robotsPolicy('User-agent: *\nDisallow: /*?','/bio?id=3').allowed,false);
});
test('robots refusals and source failures stop before any biography fetch',async()=>{
  let calls=0;
  const reader=new PublicSourceReader(['alpha.example.org'],'fixture',async()=>{},async()=>{calls++;return {status:403,body:'denied',contentType:'text/plain'};});
  await assert.rejects(reader.read('https://alpha.example.org/bio'),/permission/);
  await assert.rejects(reader.read('https://alpha.example.org/bio'),/stopped/);assert.equal(calls,1);
});
test('discovery stays unconfigured without provider, approved hosts and bot contact',()=>{
  assert.equal(discoveryConfig(env).configured,true);
  for(const key of ['BRAVE_SEARCH_API_KEY','DISCOVERY_ALLOWED_HOSTS','DISCOVERY_CONTACT_URL'])assert.equal(discoveryConfig({...env,[key]:''}).configured,false);
});
test('Brave uses documented endpoint/header and never retries a provider rate limit',async()=>{
  const original=globalThis.fetch;let calls=0;
  try{
    globalThis.fetch=(async(input:URL|RequestInfo,init?:RequestInit)=>{calls++;assert.equal(new URL(String(input)).hostname,'api.search.brave.com');assert.equal((init?.headers as Record<string,string>)['X-Subscription-Token'],'fixture-secret');return new Response('{}',{status:429});}) as typeof fetch;
    await assert.rejects(braveSearch('fixture','fixture-secret'),/429/);assert.equal(calls,1);
  }finally{globalThis.fetch=original;}
});

// In-memory PostgREST behavior tests orchestration. SQL locking and identity safety
// are separately exercised against actual PostgreSQL semantics in database.test.mjs.
type Row=Record<string,any>;
function fakeDb(options:{historyFails?:boolean;settings?:Row}={}){
  const jobs:Row[]=[],contacts:Row[]=[],identities:Row[]=[];
  function from(table:string){
    let action='select',value:Row={},single=false;const filters:{key:string;value:unknown;not:boolean}[]=[];
    const builder:any={select(){return builder;},insert(v:Row){action='insert';value=v;return builder;},update(v:Row){action='update';value=v;return builder;},eq(key:string,value:unknown){filters.push({key,value,not:false});return builder;},neq(key:string,value:unknown){filters.push({key,value,not:true});return builder;},order(){return builder;},limit(){return builder;},range(){return builder;},single(){single=true;return builder;},maybeSingle(){single=true;return builder;},then(resolve:(value:any)=>unknown,reject:(error:unknown)=>unknown){return Promise.resolve().then(()=>{
      if(table==='identities'&&options.historyFails)return {data:null,error:{message:'offline'}};
      let rows:Row[]=table==='jobs'?jobs:table==='identities'?identities:[{kind:'settings',owner:'owner',data:{discovery:true,...options.settings}},...contacts];
      const match=(row:Row)=>filters.every(f=>{const actual=f.key==='data->>discoveryDate'?row.data.discoveryDate:row[f.key];return f.not?actual!==f.value:actual===f.value;});
      if(action==='insert'){
        if(jobs.some(j=>j.dedupe_key===value.dedupe_key))return {data:null,error:{code:'23505'}};
        const row={...structuredClone(value),id:'job-'+jobs.length};jobs.push(row);return {data:single?row:[row],error:null};
      }
      rows=rows.filter(match);
      if(action==='update')rows.forEach(r=>Object.assign(r,structuredClone(value)));
      return {data:single?(rows[0]||null):structuredClone(rows),error:null};
    }).then(resolve,reject);}};return builder;
  }
  const db={from,async rpc(_name:string,args:Row){contacts.push({owner:'owner',kind:'contact',data:args.p_data});return {data:'contact-'+contacts.length,error:null};}} as unknown as SupabaseClient;
  return {db,jobs,contacts,identities};
}
const noWait=async()=>{};
test('an empty run checks every company/query pair once and resumes idempotently',async()=>{
  const f=fakeDb();const calls:string[]=[];
  const io={search:async(q:string)=>{calls.push(q);return [];},wait:noWait};
  const first=await runDiscoveryJob(f.db,'owner',env,io);assert.equal(first.ok,false);assert.equal(calls.length,60);assert.equal(first.shortfall,50);
  const second=await runDiscoveryJob(f.db,'owner',env,io);assert.equal(second.ok,false);assert.equal(calls.length,60);
});
test('unavailable lifetime history stops before a provider request',async()=>{
  const f=fakeDb({historyFails:true});let calls=0;
  const result=await runDiscoveryJob(f.db,'owner',env,{search:async()=>{calls++;return [];},wait:noWait});assert.equal(result.ok,false);assert.equal(calls,0);
});
test('provider failure and consumed S&T budget never authorize fallback or exceed request cap',async()=>{
  for(const failed of [true,false]){
    const f=fakeDb();let calls=0;
    const result=await runDiscoveryJob(f.db,'owner',{...env,DISCOVERY_MAX_SEARCHES:'2'},{search:async()=>{calls++;if(failed)throw Error('provider failure');return [];},wait:noWait});
    assert.equal(result.ok,false);assert.equal(calls,failed?1:2);assert.ok(f.jobs[0].payload.completedQueries.length<4);
    assert.equal(f.jobs[0].payload.searchRequests,calls);
  }
});
test('a qualified target is stored without invented deliverability and reports the remaining shortfall',async()=>{
  const f=fakeDb();const queries:string[]=[];
  const result=await runDiscoveryJob(f.db,'owner',{...env,DISCOVERY_DAILY_CAP:'1'}, {search:async(q:string)=>{queries.push(q);return [q.includes('"Fixture Person"')?'https://beta.example.org/bio':'https://alpha.example.org/bio'];},read:async()=>html(),wait:noWait});
  assert.equal(result.ok,false);assert.equal(result.shortfall,49);assert.equal(f.contacts.length,1);assert.equal(f.contacts[0].data.verification,'unknown');assert.equal(f.contacts[0].data.sources.length,2);assert.ok(queries.length>=2);
});
test('active lease and cancelled day cannot start another researcher',async()=>{
  for(const state of ['running','cancelled']){
    const f=fakeDb();f.jobs.push({id:'existing',owner:'owner',kind:'discovery',dedupe_key:'discovery-'+new Date().toISOString().slice(0,10),state,attempts:1,locked_until:state==='running'?new Date(Date.now()+60000).toISOString():null,payload:{}});
    let calls=0;const result=await runDiscoveryJob(f.db,'owner',env,{search:async()=>{calls++;return [];},wait:noWait});assert.equal('duplicate' in result&&result.duplicate,true);assert.equal(calls,0);
  }
});
test('redacting contacts does not replenish a durable completed daily quota',async()=>{
  const day=new Date().toISOString().slice(0,10),companyCounts=dailyCompanyQuotas(day);
  const f=fakeDb();f.jobs.push({id:'existing',owner:'owner',kind:'discovery',dedupe_key:'discovery-'+day,state:'partial',attempts:1,locked_until:null,payload:{accepted:50,salesAndTrading:50,fallback:0,companyCounts}});
  let calls=0;const result=await runDiscoveryJob(f.db,'owner',env,{search:async()=>{calls++;return [];},wait:noWait});
  assert.equal(result.ok,true);assert.equal(calls,0);assert.equal(f.jobs[0].payload.accepted,50);
});

test('daily target is fixed at 50 with rotating three-or-four-per-firm quotas',()=>{
  assert.equal(discoveryConfig(env).dailyCap,50);assert.equal(discoveryConfig(env).companyCap,4);
  const quotas=dailyCompanyQuotas('2026-09-23');assert.equal(Object.keys(quotas).length,15);assert.equal(Object.values(quotas).reduce((a,b)=>a+b,0),50);assert.equal(Object.values(quotas).filter(n=>n===4).length,5);assert.ok(Object.values(quotas).every(n=>n===3||n===4));
});

test('company focus is explicit and cannot be expanded through saved targets',()=>{
  const preferences={targets:'Unrelated Firm'};
  const queries=['UBS','JPMorgan','Bank of America'].map(company=>queryWithPreferences('trader',preferences,'2026-09-22',{company}));
  assert.equal(new Set(queries).size,3);
  assert.match(queries[2],/"Bank of America"/);assert.doesNotMatch(queries[2],/Unrelated Firm/);
  const p=publishedPeople(html({...person,worksFor:{name:'JPMorgan'}}),'https://alpha.example.org')[0];
  assert.equal(matchesPreferences(p,{targets:'J.P. Morgan'}),true);
  assert.equal(matchesPreferences(p,{exclusions:'J.P. Morgan'}),false);
});

const diversePeople=(companies:string[])=>companies.map((company,index)=>({...person,name:`Fixture ${String.fromCharCode(65+Math.floor(index/26))}${String.fromCharCode(65+index%26)} Person`,worksFor:{name:company},email:`fixture${index}@fixtures.test`,sameAs:`https://www.linkedin.com/in/fixture-${index}`}));
function researchFixture(profiles:unknown[]){
  return {search:async(q:string)=>[q.startsWith('"Fixture ')?'https://beta.example.org/team':'https://alpha.example.org/team'],read:async()=>html({'@graph':profiles}),wait:noWait};
}
test('one bank cannot fill a shortfall beyond its rotating quota',async()=>{
  const f=fakeDb();
  const result=await runDiscoveryJob(f.db,'owner',env,researchFixture(diversePeople(['UBS','UBS Financial Services','UBS AG','UBS Securities LLC','UBS'])));
  const quota=dailyCompanyQuotas(new Date().toISOString().slice(0,10)).ubs;
  assert.equal(result.ok,false);assert.equal(f.contacts.length,quota);assert.equal(f.jobs[0].payload.companyCounts.ubs,quota);
  assert.equal(f.jobs[0].payload.accepted,quota);assert.ok(f.jobs[0].payload.queryStats.some((s:Row)=>s.companyCapped>0));
});
test('qualified S&T fills exactly 50 across all 15 target companies',async()=>{
  const companies=TARGET_COMPANIES.flatMap(company=>Array.from({length:4},()=>company.label));
  const f=fakeDb();const result=await runDiscoveryJob(f.db,'owner',env,researchFixture(diversePeople(companies)));
  assert.equal(result.ok,true);
  const buckets=new Map<string,number>();for(const row of f.contacts){const key=canonicalCompany(row.data.company);buckets.set(key,(buckets.get(key)||0)+1);}
  assert.equal(f.contacts.length,50);assert.equal(buckets.size,15);assert.deepEqual(Object.fromEntries(buckets),dailyCompanyQuotas(new Date().toISOString().slice(0,10)));assert.equal(f.jobs[0].payload.fallback,0);
});
test('company quota survives deleted contacts and refuses that firm on a retry',async()=>{
  const day=new Date().toISOString().slice(0,10),quota=dailyCompanyQuotas(day).ubs;
  const f=fakeDb();f.jobs.push({id:'existing',owner:'owner',kind:'discovery',dedupe_key:'discovery-'+day,state:'partial',attempts:1,locked_until:null,payload:{accepted:quota,salesAndTrading:quota,fallback:0,companyCounts:{ubs:quota}}});
  const result=await runDiscoveryJob(f.db,'owner',env,researchFixture(diversePeople(['UBS Financial Services','J.P. Morgan'])));
  assert.equal(result.ok,false);assert.ok(f.contacts.some(c=>c.data.company==='J.P. Morgan'));assert.equal(f.jobs[0].payload.companyCounts.ubs,quota);
});
test('missing legacy company provenance fails closed before searching',async()=>{
  const f=fakeDb();f.jobs.push({id:'existing',owner:'owner',kind:'discovery',dedupe_key:'discovery-'+new Date().toISOString().slice(0,10),state:'partial',attempts:1,locked_until:null,payload:{accepted:2,salesAndTrading:2,fallback:0}});
  let calls=0;const result=await runDiscoveryJob(f.db,'owner',env,{search:async()=>{calls++;return [];},wait:noWait});
  assert.equal(result.ok,false);assert.equal(calls,0);assert.match(f.jobs[0].payload.error,/company history/);
});
test('an uncertain insertion consumes its company reservation before any retry',async()=>{
  const f=fakeDb();const original=f.db.rpc;
  f.db.rpc=(async()=>({data:null,error:{message:'uncertain write'}})) as unknown as typeof f.db.rpc;
  const first=await runDiscoveryJob(f.db,'owner',{...env,DISCOVERY_DAILY_CAP:'5'},researchFixture(diversePeople(['UBS'])));
  assert.equal(first.ok,false);assert.equal(f.jobs[0].payload.companyCounts.ubs,1);
  f.db.rpc=original;
  const second=await runDiscoveryJob(f.db,'owner',{...env,DISCOVERY_DAILY_CAP:'5'},researchFixture(diversePeople(['UBS Financial Services','BofA'])));
  assert.equal(second.ok,false);assert.ok(f.contacts.some(c=>c.data.company==='BofA'));assert.ok(f.jobs[0].payload.companyCounts.ubs>=1);assert.ok(f.jobs[0].payload.companyCounts.ubs<=dailyCompanyQuotas(new Date().toISOString().slice(0,10)).ubs);
});
