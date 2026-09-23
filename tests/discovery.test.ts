/* eslint-disable @typescript-eslint/no-explicit-any -- PostgREST JSON fixture builder; real SQL invariants are separately tested. */
import test from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {queryPlan,publishedPeople,corroborates,discoveredContact,QUERY_RECIPES,emptyObservation,matchesPreferences,queryWithPreferences} from '../lib/discovery.ts';
import {allowedSource,robotsPolicy,publicIpv4,PublicSourceReader} from '../lib/discovery-policy.ts';
import {braveSearch,discoveryConfig,runDiscoveryJob} from '../lib/discovery-job.ts';

const person={'@type':'Person',name:'Fixture Person',jobTitle:'Vice President, Fixed Income Trading',worksFor:{name:'Fixture Markets'},email:'fixture@fixtures.test',sameAs:'https://www.linkedin.com/in/fixture-person',address:{addressLocality:'Chicago'}};
const html=(p:unknown=person)=>`<script type="application/ld+json">${JSON.stringify(p)}</script>`;
const env={DISCOVERY_ENABLED:'true',BRAVE_SEARCH_API_KEY:'fixture-secret',DISCOVERY_ALLOWED_HOSTS:'alpha.example.org,beta.example.org',DISCOVERY_CONTACT_URL:'https://operator.example.org/contact'};

test('all S&T query families precede fallback regardless of historical yield',()=>{
  const history=QUERY_RECIPES.map(q=>({...emptyObservation(q.id),searches:5,accepted:q.family==='fallback'?100:0}));
  const plan=queryPlan(history,'2026-09-22');assert.equal(plan.length,6);assert.ok(plan.slice(0,4).every(q=>q.family==='sales-trading'));
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
  assert.equal(matchesPreferences(p,{targets:'Fixture Markets',regions:'Chicago'}),true);
  assert.equal(matchesPreferences(p,{regions:'New York'}),false);
  assert.equal(matchesPreferences(p,{exclusions:'Fixture Markets'}),false);
  assert.equal(matchesPreferences(p,{targets:'Unrelated Firm'}),false);
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
test('a complete day is idempotent and only searches fallback after the entire S&T set',async()=>{
  const f=fakeDb();const calls:string[]=[];
  const io={search:async(q:string)=>{calls.push(q);return [];},wait:noWait};
  const first=await runDiscoveryJob(f.db,'owner',env,io);assert.equal(first.ok,true);assert.equal(calls.length,6);
  assert.ok(calls.slice(0,4).every(q=>!q.includes('"equity research"')&&!q.includes('"investment banking"')));
  const second=await runDiscoveryJob(f.db,'owner',env,io);assert.equal('duplicate' in second&&second.duplicate,true);assert.equal(calls.length,6);
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
test('qualified S&T fills the cap before fallback; stored address stays unverified',async()=>{
  const f=fakeDb();const queries:string[]=[];
  const result=await runDiscoveryJob(f.db,'owner',{...env,DISCOVERY_DAILY_CAP:'1'}, {search:async(q:string)=>{queries.push(q);return [q.includes('"Fixture Person"')?'https://beta.example.org/bio':'https://alpha.example.org/bio'];},read:async()=>html(),wait:noWait});
  assert.equal(result.ok,true);assert.equal(f.contacts.length,1);assert.equal(f.contacts[0].data.verification,'unknown');assert.equal(f.contacts[0].data.sources.length,2);assert.equal(queries.length,2);
});
test('active lease and cancelled day cannot start another researcher',async()=>{
  for(const state of ['running','cancelled']){
    const f=fakeDb();f.jobs.push({id:'existing',owner:'owner',kind:'discovery',dedupe_key:'discovery-'+new Date().toISOString().slice(0,10),state,attempts:1,locked_until:state==='running'?new Date(Date.now()+60000).toISOString():null,payload:{}});
    let calls=0;const result=await runDiscoveryJob(f.db,'owner',env,{search:async()=>{calls++;return [];},wait:noWait});assert.equal('duplicate' in result&&result.duplicate,true);assert.equal(calls,0);
  }
});
test('redacting a contact does not replenish a durable daily acceptance quota',async()=>{
  const f=fakeDb();f.jobs.push({id:'existing',owner:'owner',kind:'discovery',dedupe_key:'discovery-'+new Date().toISOString().slice(0,10),state:'partial',attempts:1,locked_until:null,payload:{accepted:1,salesAndTrading:1,fallback:0}});
  let calls=0;const result=await runDiscoveryJob(f.db,'owner',{...env,DISCOVERY_DAILY_CAP:'1'},{search:async()=>{calls++;return [];},wait:noWait});
  assert.equal(result.ok,true);assert.equal(calls,0);assert.equal(f.jobs[0].payload.accepted,1);
});
