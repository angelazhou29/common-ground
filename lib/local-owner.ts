import 'server-only';
import {headers} from 'next/headers';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
let pending:Promise<SupabaseClient>|undefined;
export async function localOwnerEnabled(){
 // Hosted mode relies on Vercel Authentication protecting ALL deployment URLs.
 // Never enable it on a public deployment or add protection exceptions.
 if(process.env.VERCEL)return process.env.VERCEL_PROTECTED_OWNER_MODE==='true';
 if(process.env.LOCAL_OWNER_MODE!=='true')return false;
 const h=await headers();
 return ['localhost:5173','127.0.0.1:5173'].includes(h.get('host')||'')&&(!h.get('x-forwarded-host')||h.get('x-forwarded-host')===h.get('host'));
}
async function connect(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
 const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const owner=await admin.auth.admin.getUserById(process.env.OWNER_USER_ID!);
 if(owner.error||owner.data.user.email?.toLowerCase()!==process.env.OWNER_EMAIL?.toLowerCase())throw Error('Local owner configuration does not match.');
 // Creates a session for the existing configured owner; no email is sent.
 const link=await admin.auth.admin.generateLink({type:'magiclink',email:owner.data.user.email!});
 if(link.error)throw Error('Could not open your local workspace.');
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const session=await client.auth.verifyOtp({token_hash:link.data.properties.hashed_token,type:'magiclink'});
 if(session.error)throw Error('Local owner session failed.');
 return client;
}
export async function localOwnerClient(){
 if(!await localOwnerEnabled())throw Error('Owner access is not enabled for this deployment.');
 if(!pending)pending=connect().catch(e=>{pending=undefined;throw e});
 const client=await pending;const {data}=await client.auth.getSession();
 if((data.session?.expires_at||0)*1000<Date.now()+60000){const r=await client.auth.refreshSession();if(r.error){pending=undefined;return localOwnerClient();}}
 return client;
}
