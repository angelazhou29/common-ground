import {createClient} from '@supabase/supabase-js';
import {timingSafeEqual} from 'node:crypto';
import {runDiscoveryJob} from '@/lib/discovery-job';
export const runtime='nodejs';
export const maxDuration=300;
export async function POST(req:Request){
  const secret=process.env.CRON_SECRET,provided=req.headers.get('authorization')||'',expected=`Bearer ${secret}`;
  if(!secret||Buffer.byteLength(provided)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(provided),Buffer.from(expected)))return Response.json({error:'Unauthorized'},{status:401});
  if(process.env.VERCEL_ENV&&process.env.VERCEL_ENV!=='production')return Response.json({error:'Production only'},{status:403});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,owner=process.env.OWNER_USER_ID;
  if(!url||!key||!owner)return Response.json({error:'Maintenance credentials not configured'},{status:503});
  const db=createClient(url,key,{auth:{persistSession:false}});
  if(new URL(req.url).searchParams.get('kind')==='discovery'){
    try{const result=await runDiscoveryJob(db,owner);return Response.json(result,{status:result.ok?200:503,headers:{'Cache-Control':'no-store'}});}
    catch{return Response.json({error:'Discovery stopped: database or history check unavailable.'},{status:503});}
  }
  const at=new Date().toISOString();
  const {error}=await db.from('jobs').insert({owner,dedupe_key:'health-'+at.slice(0,13),kind:'health',state:'complete',payload:{checkedAt:at}});
  if(error?.code==='23505')return Response.json({ok:true,duplicate:true});
  if(error)return Response.json({error:'Database unavailable'},{status:503});
  return Response.json({ok:true,checkedAt:at,sending:'disabled',note:'Health heartbeat. Daily discovery uses the separate authenticated workflow.'});
}
