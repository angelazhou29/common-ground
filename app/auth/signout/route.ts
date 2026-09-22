import {supabase} from '@/lib/supabase';
import {NextResponse} from 'next/server';
export async function POST(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)return new Response('Invalid origin',{status:403});await (await supabase()).auth.signOut();return NextResponse.redirect(new URL('/login',req.url),303);}
