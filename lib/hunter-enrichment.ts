import {validateHitlIdentity} from './hitl-intake.ts';
import {safeUrl} from './safety.ts';

type Row=Record<string,string>;
type Fetch=typeof fetch;
type HunterSource={uri?:string;last_seen_on?:string};
type FinderData={email?:string;domain?:string;source_type?:string;accept_all?:boolean;sources?:HunterSource[];verification?:{status?:string;date?:string}};
type VerifyData={status?:string;result?:string};

const COMPANY_DOMAINS:Record<string,Set<string>>={
  'Evercore':new Set(['evercore.com']),
  'Wells Fargo':new Set(['wellsfargo.com']),
  'Deutsche Bank':new Set(['db.com']),
  'Citi':new Set(['citi.com']),
  'Nomura':new Set(['nomura.com','nomura.net']),
  'HSBC':new Set(['hsbc.com']),
  'Morgan Stanley':new Set(['morganstanley.com']),
  'Bank of America':new Set(['bofa.com']),
  'BlackRock':new Set(['blackrock.com']),
  'JP Morgan':new Set(['jpmorgan.com']),
  'Goldman Sachs':new Set(['gs.com']),
  'UBS':new Set(['ubs.com']),
  'Barclays':new Set(['barclays.com']),
  'Fidelity':new Set(['fidelity.com','fmr.com']),
  'Balyasny':new Set(['bamfunds.com'])
};

async function hunterGet<T>(path:string,params:Record<string,string>,apiKey:string,fetcher:Fetch):Promise<T>{
  const endpoint=new URL('https://api.hunter.io/v2/'+path);
  for(const [key,value] of Object.entries(params))endpoint.searchParams.set(key,value);
  const response=await fetcher(endpoint,{headers:{Accept:'application/json',Authorization:`Bearer ${apiKey}`},signal:AbortSignal.timeout(25000),redirect:'error'});
  if(response.status===451)throw Error('Provider reports this person requested that their data not be processed.');
  if(!response.ok)throw Error(`Email provider stopped with HTTP ${response.status}; no bypass attempted.`);
  return response.json() as Promise<T>;
}

function linkedinHandle(url:string){return new URL(url).pathname.split('/').filter(Boolean).at(-1)!;}
function emailDomain(email:string){return email.toLowerCase().split('@').at(-1)||'';}

/** Enrich only a manually confirmed identity. Inferred and accept-all results fail closed. */
export async function enrichHunterFoundEmail(row:Row,apiKey:string,fetcher:Fetch=fetch,now=Date.now()):Promise<Row>{
  if(!apiKey)throw Error('HUNTER_API_KEY is required.');
  const identity=validateHitlIdentity(row,now);
  const lookup:Record<string,string>=identity.linkedin?{linkedin_handle:linkedinHandle(identity.linkedin),max_duration:'20'}:{full_name:identity.name,company:identity.company,max_duration:'20'};
  const found=await hunterGet<{data?:FinderData}>('email-finder/found',lookup,apiKey,fetcher);
  const data=found.data;
  if(!data?.email)throw Error('No publicly found email was returned.');
  const email=data.email.trim().toLowerCase();
  if(data.source_type!=='found')throw Error('Provider result was not publicly found.');
  if(data.accept_all===true||data.verification?.status==='accept_all')throw Error('Provider returned an accept-all address.');
  if(!COMPANY_DOMAINS[identity.company]?.has(emailDomain(email)))throw Error('Returned email domain does not match the confirmed target company.');
  const verified=await hunterGet<{data?:VerifyData}>('email-verifier',{email},apiKey,fetcher);
  if(verified.data?.status!=='valid')throw Error(`Fresh email verification is ${verified.data?.status||'unknown'}, not valid.`);
  const day=new Date(now).toISOString().slice(0,10);
  const publicSources=(data.sources||[]).flatMap(source=>safeUrl(source.uri||'')?[safeUrl(source.uri||'')]:[]);
  const evidenceUrl=publicSources[0]||'https://hunter.io/api-documentation';
  const evidenceNote=`Hunter Email Finder (Found) returned source_type=found and a fresh verifier result of valid on ${day}. Accept-all was false.${publicSources.length?` Public sources: ${publicSources.slice(0,3).join(' ')}`:''}`;
  return {...row,email,email_origin:'authorized provider',email_verification:'valid',email_verified_at:day,email_evidence_url:evidenceUrl,email_evidence_note:evidenceNote};
}
