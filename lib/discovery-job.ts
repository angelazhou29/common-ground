import type {SupabaseClient} from '@supabase/supabase-js';
import type {DiscoveryStatus} from './types.ts';
import {isSalesAndTrading} from './targeting.ts';
import {identitiesFor} from './safety.ts';
import {QUERY_RECIPES,queryPlan,queryWithPreferences,matchesPreferences,emptyObservation,publishedPeople,corroborates,discoveredContact,type QueryObservation,type DiscoveryPreferences} from './discovery.ts';
import {allowedSource,PublicSourceReader,DISCOVERY_AGENT} from './discovery-policy.ts';

type Environment=Record<string,string|undefined>;
export type DiscoveryConfig={enabled:boolean;configured:boolean;apiKey:string;hosts:string[];agent:string;dailyCap:number;searchCap:number;pageCap:number;note:string};
function bounded(value:string|undefined,fallback:number,max:number){const n=Number(value);return Number.isInteger(n)&&n>0?Math.min(n,max):fallback;}
export function discoveryConfig(env:Environment=process.env):DiscoveryConfig {
  const hosts=(env.DISCOVERY_ALLOWED_HOSTS||'').split(',').map(h=>h.trim().toLowerCase()).filter(Boolean).slice(0,8);
  const contact=env.DISCOVERY_CONTACT_URL||'';
  let validContact=false;try{const u=new URL(contact);validContact=u.protocol==='https:'&&!u.username&&!u.password;}catch{}
  const configured=Boolean(env.BRAVE_SEARCH_API_KEY&&hosts.length&&hosts.every(h=>allowedSource('https://'+h,hosts))&&validContact);
  return {enabled:env.DISCOVERY_ENABLED==='true',configured,apiKey:env.BRAVE_SEARCH_API_KEY||'',hosts,agent:`${DISCOVERY_AGENT}/1.0 (+${contact})`,dailyCap:bounded(env.DISCOVERY_DAILY_CAP,10,25),searchCap:bounded(env.DISCOVERY_MAX_SEARCHES,12,30),pageCap:bounded(env.DISCOVERY_MAX_PAGES,24,60),note:configured?'Configured public research only; published email still requires outreach review.':'Configure a licensed Brave Search API key, approved public source hosts and a bot contact URL to activate discovery.'};
}
type JobPayload={startedAt:string;finishedAt?:string;updatedAt:string;searchRequests:number;pageRequests:number;completedQueries:string[];queryStats:QueryObservation[];accepted:number;salesAndTrading:number;fallback:number;note:string;error?:string;plan?:string[]};
function initialPayload(at:string):JobPayload{return {startedAt:at,updatedAt:at,searchRequests:0,pageRequests:0,completedQueries:[],queryStats:[],accepted:0,salesAndTrading:0,fallback:0,note:'Public-source discovery; no messages created or sent.'};}
export function payloadSummary(payload:Partial<JobPayload>){return {accepted:payload.accepted||0,salesAndTrading:payload.salesAndTrading||0,fallback:payload.fallback||0,requests:(payload.searchRequests||0)+(payload.pageRequests||0),rejected:(payload.queryStats||[]).reduce((n,q)=>n+q.rejected,0)};}
export async function discoveryStatus(db:SupabaseClient,owner:string,preference:boolean,env:Environment=process.env):Promise<DiscoveryStatus> {
  const config=discoveryConfig(env);
  const result=await db.from('jobs').select('state,payload').eq('owner',owner).eq('kind','discovery').order('due',{ascending:false}).limit(1);
  if(result.error)throw Error('Discovery history is unavailable');
  const job=result.data?.[0],payload=job?.payload as Partial<JobPayload>|undefined;
  return {configured:config.configured,enabled:config.enabled&&preference,lastRunAt:payload?.finishedAt||payload?.startedAt,state:job?.state,summary:payload?payloadSummary(payload):undefined,note:payload?.error||(!config.enabled?'Daily discovery is disabled on the server. ':!preference?'Enable daily discovery in preferences. ':'')+config.note};
}
export async function braveSearch(query:string,apiKey:string):Promise<string[]> {
  const endpoint=new URL('https://api.search.brave.com/res/v1/web/search');
  endpoint.searchParams.set('q',query.slice(0,600));endpoint.searchParams.set('count','10');endpoint.searchParams.set('search_lang','en');endpoint.searchParams.set('safesearch','strict');
  const response=await fetch(endpoint,{headers:{Accept:'application/json','X-Subscription-Token':apiKey},signal:AbortSignal.timeout(10000),redirect:'error'});
  if(!response.ok)throw Error(`Search provider stopped with HTTP ${response.status}; no retry or bypass attempted`);
  const json=await response.json() as {web?:{results?:{url?:unknown}[]}};
  return (json.web?.results||[]).flatMap(r=>typeof r.url==='string'?[r.url]:[]).slice(0,10);
}
type DiscoveryIO={search?:typeof braveSearch;read?:(url:string)=>Promise<string>;wait?:(ms:number)=>Promise<void>};
export async function runDiscoveryJob(db:SupabaseClient,owner:string,env:Environment=process.env,io:DiscoveryIO={}) {
  const config=discoveryConfig(env);
  if(!config.enabled)return {ok:true,state:'disabled',note:config.note};
  if(!config.configured)return {ok:false,state:'not-configured',note:config.note};
  const preference=await db.from('records').select('data').eq('owner',owner).eq('kind','settings').maybeSingle();
  if(preference.error)throw Error('Settings unavailable; discovery stopped');
  if(preference.data?.data?.discovery!==true)return {ok:true,state:'paused',note:'Enable daily discovery in workspace preferences.'};
  const at=new Date().toISOString(),day=at.slice(0,10),key='discovery-'+day;
  const deadline=Date.now()+240000;const lockUntil=new Date(Date.now()+360000).toISOString();
  let payload=initialPayload(at),attempts=1;
  const claim=await db.from('jobs').insert({owner,dedupe_key:key,kind:'discovery',state:'running',locked_until:lockUntil,attempts,payload}).select('id').single();
  let id:string;
  if(claim.error){
    if(claim.error.code!=='23505')throw Error('Discovery job history unavailable; stopped before searching');
    const old=await db.from('jobs').select('id,state,locked_until,payload,attempts').eq('owner',owner).eq('dedupe_key',key).single();
    if(old.error)throw Error('Discovery history unavailable');
    if(['complete','cancelled'].includes(old.data.state)||old.data.attempts>=3||Date.parse(old.data.locked_until||'')>Date.now())return {ok:true,duplicate:true,state:old.data.state};
    attempts=old.data.attempts+1;
    const retry=await db.from('jobs').update({state:'running',locked_until:lockUntil,attempts}).eq('id',old.data.id).eq('attempts',old.data.attempts).select('id');
    if(retry.error)throw Error('Could not claim discovery retry');
    if(!retry.data?.length)return {ok:true,duplicate:true,state:'running'};
    id=old.data.id;payload={...initialPayload(at),...old.data.payload};
  }else id=claim.data.id;
  const persist=async(state='running')=>{
    payload.updatedAt=new Date().toISOString();
    const result=await db.from('jobs').update({payload,state,locked_until:state==='running'?lockUntil:null}).eq('id',id).eq('attempts',attempts).select('id');
    if(result.error||!result.data?.length)throw Error('Discovery checkpoint failed; stopping to protect budgets and history');
  };
  const spend=async(kind:'searchRequests'|'pageRequests')=>{
    if(Date.now()>=deadline)throw Error('Daily run time limit reached');
    if(payload[kind]>=(kind==='searchRequests'?config.searchCap:config.pageCap))throw Error('Daily research request budget reached');
    const p=await db.from('records').select('data').eq('owner',owner).eq('kind','settings').maybeSingle();
    if(p.error||p.data?.data?.discovery!==true)throw Error('Discovery paused or preferences unavailable');
    payload[kind]++;await persist(); // Reserve before each external request; failures consume budget too.
  };
  let searchAfter=0;
  const search=async(query:string)=>{
    if(searchAfter>Date.now())await (io.wait||((ms:number)=>new Promise<void>(r=>setTimeout(r,ms))))(searchAfter-Date.now());
    await spend('searchRequests');searchAfter=Date.now()+1100;return (io.search||braveSearch)(query,config.apiKey);
  };
  const reader=new PublicSourceReader(config.hosts,config.agent,()=>spend('pageRequests'));
  const pages=new Map<string,string>();
  const read=async(url:string)=>{if(pages.has(url))return pages.get(url)!;if(io.read)await spend('pageRequests');const html=await (io.read?io.read(url):reader.read(url));pages.set(url,html);return html;};
  try{
    // Load the complete durable identity registry before any public research. No truncation fallback.
    const identities=new Set<string>();
    for(let offset=0;;offset+=1000){
      const result=await db.from('identities').select('identity').eq('owner',owner).order('identity').range(offset,offset+999);
      if(result.error)throw Error('Lifetime identity history unavailable; discovery stopped');
      for(const row of result.data||[])identities.add(row.identity);
      if(!result.data||result.data.length<1000)break;
      if(offset>=99000)throw Error('Identity history exceeds this worker limit; no partial-history discovery');
    }
    const today=await db.from('records').select('data').eq('owner',owner).eq('kind','contact').eq('data->>discoveryDate',day);
    if(today.error)throw Error('Today’s discovery history unavailable');
    const foundToday=today.data||[],primaryToday=foundToday.filter(r=>isSalesAndTrading(r.data)).length;
    // Deleting/redacting a discovered contact must never replenish today's quota.
    payload.accepted=Math.max(payload.accepted,foundToday.length);
    payload.salesAndTrading=Math.max(payload.salesAndTrading,primaryToday);
    payload.fallback=Math.max(payload.fallback,foundToday.length-primaryToday);
    const history=await db.from('jobs').select('payload').eq('owner',owner).eq('kind','discovery').neq('id',id).order('due',{ascending:false}).limit(60);
    if(history.error)throw Error('Query learning history unavailable');
    const observations=(history.data||[]).flatMap(j=>(j.payload.queryStats||[]) as QueryObservation[]);
    const plan=payload.plan?.map(key=>QUERY_RECIPES.find(q=>q.id===key)).filter(q=>!!q)||queryPlan(observations,day);
    payload.plan=plan.map(q=>q.id);await persist();
    for(const recipe of plan){
      if(payload.accepted>=config.dailyCap)break;
      if(payload.completedQueries.includes(recipe.id))continue;
      if(recipe.family==='fallback'&&!QUERY_RECIPES.filter(q=>q.family==='sales-trading').every(q=>payload.completedQueries.includes(q.id)))break;
      const stats=payload.queryStats.find(q=>q.id===recipe.id)||emptyObservation(recipe.id);
      if(!payload.queryStats.includes(stats))payload.queryStats.push(stats);
      stats.searches++;await persist();
      const preferences=preference.data.data as DiscoveryPreferences;
      const urls=await search(`${queryWithPreferences(recipe.query,preferences,day)} (${config.hosts.map(h=>'site:'+h).join(' OR ')})`);stats.results+=urls.length;
      for(const url of urls){
        if(payload.accepted>=config.dailyCap)break;
        if(!allowedSource(url,config.hosts)){stats.blocked++;continue;}
        let html:string;
        try{html=await read(url);stats.pages++;}catch(error){if(/budget|time limit|checkpoint|paused|preferences/.test((error as Error).message))throw error;stats.blocked++;continue;}
        const people=publishedPeople(html,url);stats.profiles+=people.length;
        for(const person of people){
          if(payload.accepted>=config.dailyCap)break;
          if(!matchesPreferences(person,preferences)){stats.rejected++;continue;}
          if(identitiesFor(person).some(k=>identities.has(k))){stats.duplicates++;continue;}
          if(recipe.family==='sales-trading'&&!isSalesAndTrading({title:person.title,industry:'Financial services'})){stats.rejected++;continue;}
          if(recipe.family==='fallback'&&!/research|investment bank|portfolio|asset management/i.test(person.title)){stats.rejected++;continue;}
          const corroborationUrls=await search(`"${person.name}" "${person.company}" (${config.hosts.map(h=>'site:'+h).join(' OR ')})`);
          let source='';
          for(const other of corroborationUrls.slice(0,5)){
            if(!allowedSource(other,config.hosts)||new URL(other).hostname===new URL(url).hostname)continue;
            try{if(corroborates(person,await read(other),other)){source=other;break;}}catch(error){if(/budget|time limit|checkpoint|paused|preferences/.test((error as Error).message))throw error;stats.blocked++;}
          }
          if(!source){stats.rejected++;continue;}
          stats.qualified++;
          const contact=discoveredContact(person,[{url,note:'Published Person biography with full name, role, employer, direct email and LinkedIn.',retrievedAt:at},{url:source,note:'Independent approved public source corroborates name, employer, role and stable identity.',retrievedAt:at}],recipe,at);
          // The service-only database RPC rechecks durable identities under the same owner lock as imports and outreach.
          const result=await db.rpc('save_discovered_contact',{p_owner:owner,p_data:contact});
          if(result.error)throw Error('Database rejected discovery history check; stopped');
          if(!result.data){stats.duplicates++;continue;}
          identitiesFor(contact).forEach(k=>identities.add(k));stats.accepted++;payload.accepted++;
          if(isSalesAndTrading(contact))payload.salesAndTrading++;else payload.fallback++;
          await persist();
        }
      }
      payload.completedQueries.push(recipe.id);await persist();
    }
    payload.finishedAt=new Date().toISOString();payload.error=undefined;
    payload.note='Completed bounded research. Search results are not exhaustive; accepted contacts retain public evidence and require outreach review.';
    await persist('complete');
    return {ok:true,state:'complete',summary:payloadSummary(payload)};
  }catch(error){
    const message=(error as Error).message;
    payload.error=message.slice(0,300);payload.finishedAt=new Date().toISOString();
    const current=payload.queryStats.find(q=>!payload.completedQueries.includes(q.id));if(current)current.errors++;
    await persist('partial');
    return {ok:false,state:'partial',error:payload.error,summary:payloadSummary(payload)};
  }
}
