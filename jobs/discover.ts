import {createClient} from '@supabase/supabase-js';
import {runDiscoveryJob} from '../lib/discovery-job.ts';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,owner=process.env.OWNER_USER_ID;
if(!url||!key||!owner){console.error('Missing server Supabase credentials or owner ID.');process.exitCode=1;}
else {
  try{
    const result=await runDiscoveryJob(createClient(url,key,{auth:{persistSession:false}}),owner);
    // Counts only: never log contacts, emails, source bodies or credentials in Actions.
    console.log(JSON.stringify(result));
    if(!result.ok)process.exitCode=1;
  }catch{console.error('Discovery stopped because configuration or durable history is unavailable.');process.exitCode=1;}
}
