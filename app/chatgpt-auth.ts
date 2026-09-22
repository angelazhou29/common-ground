// Compatibility names retained while replacing Sites auth with verified Supabase sessions.
import {redirect} from 'next/navigation';
import {configured,supabase} from '@/lib/supabase';
export type ChatGPTUser={userId:string;displayName:string;email:string;fullName:string|null};
export async function getChatGPTUser():Promise<ChatGPTUser|null>{if(!configured())return null;const client=await supabase();const {data:{user},error}=await client.auth.getUser();if(error||!user||user.email?.toLowerCase()!==process.env.OWNER_EMAIL?.toLowerCase())return null;const fullName=user.user_metadata?.full_name||null;return {userId:user.id,email:user.email!,fullName,displayName:fullName||user.email!};}
export async function requireChatGPTUser(_returnTo:string){const user=await getChatGPTUser();if(!user)redirect('/login');return user;}
export function chatGPTSignInPath(_returnTo:string){return '/login';}
export function chatGPTSignOutPath(){return '/auth/signout';}
