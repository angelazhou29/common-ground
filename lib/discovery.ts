import {allowedCompany,canonicalCompany} from './company-scope.ts';
import type {Contact,Source} from './types.ts';
import {canonicalLinkedin,normalizedEmail} from './safety.ts';
import {isSalesAndTrading,contactLevel} from './targeting.ts';

export type QueryRecipe={id:string;family:'sales-trading'|'fallback';query:string};
export const QUERY_RECIPES:QueryRecipe[]=[
  {id:'markets-sales',family:'sales-trading',query:'"institutional sales" "team" "email"'},
  {id:'sales-trading',family:'sales-trading',query:'"sales and trading" "biography" "email"'},
  {id:'trading-desk',family:'sales-trading',query:'"trader" "fixed income" "team"'},
  {id:'equity-sales',family:'sales-trading',query:'"equity sales" "team" "contact"'},
];
export type QueryObservation={id:string;searches:number;results:number;pages:number;profiles:number;qualified:number;accepted:number;duplicates:number;rejected:number;blocked:number;errors:number};
export function emptyObservation(id:string):QueryObservation{return {id,searches:0,results:0,pages:0,profiles:0,qualified:0,accepted:0,duplicates:0,rejected:0,blocked:0,errors:0};}
export type DiscoveryPreferences={targets?:string;regions?:string;exclusions?:string};
function terms(value:string|undefined){return (value||'').split(/[,;\n]/).map(x=>x.trim().slice(0,100)).filter(Boolean).slice(0,30);}
function normalized(value:string){return value.toLowerCase().replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
export function matchesPreferences(person:PublishedPerson,preferences:DiscoveryPreferences):boolean {
  if(!allowedCompany(person.company))return false;
  const text=normalized(`${person.name} ${person.company} ${person.title} ${person.location}`);
  if(terms(preferences.exclusions).some(term=>text.includes(normalized(term))))return false;
  const regions=terms(preferences.regions);if(regions.length&&!regions.some(r=>normalized(person.location).includes(normalized(r))))return false;
  const targets=terms(preferences.targets).filter(t=>!/^sales\s*(?:&|and)\s*trading$/i.test(t));
  return !targets.length||targets.some(t=>canonicalCompany(t)!==''&&canonicalCompany(t)===canonicalCompany(person.company));
}
export function queryWithPreferences(query:string,preferences:DiscoveryPreferences,day:string):string {
  const regions=terms(preferences.regions),targets=terms(preferences.targets),index=Math.floor(Date.parse(day)/86400000);
  const quote=(s:string)=>'"'+s.replace(/["\\]/g,' ').slice(0,80)+'"';
  return [query,targets.length?quote(targets[index%targets.length]):'',regions.length?quote(regions[index%regions.length]):'',...terms(preferences.exclusions).slice(0,4).map(t=>'-'+quote(t))].filter(Boolean).join(' ');
}
export function queryPlan(history:QueryObservation[],day:string):QueryRecipe[] {
  const totals=new Map<string,{accepted:number;searches:number}>();
  for(const row of history){const t=totals.get(row.id)||{accepted:0,searches:0};t.accepted+=row.accepted;t.searches+=row.searches;totals.set(row.id,t);}
  const rank=(rows:QueryRecipe[])=>{
    const scored=rows.slice().sort((a,b)=>{
      const x=totals.get(a.id),y=totals.get(b.id);
      return ((y?.accepted||0)+1)/((y?.searches||0)+2)-((x?.accepted||0)+1)/((x?.searches||0)+2)||a.id.localeCompare(b.id);
    });
    // Rotate one exploration slot daily, even when yesterday's query had no yield.
    const explore=rows[Math.floor(Date.parse(day)/86400000)%rows.length];
    return [explore,...scored.filter(r=>r.id!==explore.id)];
  };
  return rank(QUERY_RECIPES.filter(r=>r.family==='sales-trading'));
}
export type PublishedPerson={name:string;title:string;company:string;email:string;linkedin:string;location:string;url:string};
const object=(value:unknown):Record<string,unknown>|null=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
const strings=(value:unknown):string[]=>Array.isArray(value)?value.flatMap(strings):typeof value==='string'?[value]:[];
export function publishedPeople(html:string,url:string):PublishedPerson[] {
  const people:PublishedPerson[]=[];const nodes:Record<string,unknown>[]=[];
  function walk(value:unknown,depth=0){if(depth>8)return;if(Array.isArray(value)){value.slice(0,100).forEach(v=>walk(v,depth+1));return;}const row=object(value);if(!row)return;nodes.push(row);for(const [key,item] of Object.entries(row))if(key==='@graph'||key==='mainEntity'||key==='employee'||key==='member'||key==='itemListElement'||key==='item')walk(item,depth+1);}
  for(const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{walk(JSON.parse(match[1]));}catch{/* Invalid structured evidence cannot create a person. */}
  }
  for(const node of nodes){
    if(!strings(node['@type']).some(t=>t==='Person'||t==='https://schema.org/Person'))continue;
    const company=object(node.worksFor)||object(node.affiliation);
    const name=typeof node.name==='string'?node.name.trim():'';
    const title=typeof node.jobTitle==='string'?node.jobTitle.trim():'';
    const employer=typeof company?.name==='string'?company.name.trim():'';
    const email=normalizedEmail(strings(node.email)[0]?.replace(/^mailto:/i,'')||'');
    const linkedin=[...strings(node.sameAs),...strings(node.url)].map(canonicalLinkedin).find(Boolean)||'';
    const address=object(node.address);const location=[address?.addressLocality,address?.addressRegion,address?.addressCountry].filter(x=>typeof x==='string').join(', ');
    if(!/^[\p{L}\p{M}.'’ -]{3,160}$/u.test(name)||name.split(/\s+/).length<2||!title||title.length>250||!employer||employer.length>250||!linkedin)continue;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||/^(info|contact|hello|sales|support|careers|recruiting|admin|office|team|press|media)@/i.test(email))continue;
    if(!people.some(p=>p.linkedin===linkedin))people.push({name,title,company:employer,email,linkedin,location,url});
  }
  return people.slice(0,30);
}
function visible(html:string){return html.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&(?:amp|nbsp|quot);/g,' ').replace(/\s+/g,' ').toLowerCase();}
export function corroborates(person:PublishedPerson,html:string,url:string):boolean {
  // Distinct approved host plus matching name, company, role and a stable identity.
  // Search snippets alone never constitute corroboration.
  const first=new URL(person.url).hostname.replace(/^www\./,''),second=new URL(url).hostname.replace(/^www\./,'');
  if(first===second||first.endsWith('.'+second)||second.endsWith('.'+first))return false;
  if(publishedPeople(html,url).some(p=>p.name.toLowerCase()===person.name.toLowerCase()&&p.company.toLowerCase()===person.company.toLowerCase()&&p.title.toLowerCase()===person.title.toLowerCase()&&(p.linkedin===person.linkedin||p.email===person.email)))return true;
  const text=visible(html),raw=html.toLowerCase();
  return text.includes(person.name.toLowerCase())&&text.includes(person.company.toLowerCase())&&text.includes(person.title.toLowerCase())&&(raw.includes(person.linkedin.toLowerCase())||raw.includes(person.email));
}
export function discoveredContact(person:PublishedPerson,evidence:Source[],query:QueryRecipe,at:string):Contact {
  const primary=isSalesAndTrading({title:person.title,industry:'Financial services'} as Contact);
  return {id:'',name:person.name,title:person.title,company:person.company,email:person.email,linkedin:person.linkedin,location:person.location,industry:'Financial services',timezone:'',status:'Research needed',verification:'unknown',verifiedAt:'',emailOrigin:'published',identityConfirmed:true,fit:`Your published role is ${person.title} at ${person.company}.`,topic:person.title,notes:'Public structured biography corroborated by a separate approved source. Email is published, not deliverability-tested. Review currency and recipient timezone before outreach.',sources:evidence,synthetic:false,roleFamily:primary?'Sales & Trading':'Other finance',level:contactLevel({title:person.title} as Contact),discoveredAt:at,discoveryDate:at.slice(0,10),discoveryQuery:query.id,selectionReason:primary?'Sales & Trading priority; corroborated public professional profile.':'Fallback: the full configured Sales & Trading query set completed without filling today’s remaining slots.'};
}
