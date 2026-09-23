import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {canonicalLinkedin,canonicalPublicProfile,emailIdentity} from '../lib/safety.ts';

test('database and application agree on canonical profile and email identities',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 const migration=await readFile(new URL('../supabase/migrations/202609220002_lifetime_outreach.sql',import.meta.url),'utf8');
 for(const name of ['canonical_email','canonical_linkedin']){
  const statement=migration.match(new RegExp(`create function public\\.${name}\\([\\s\\S]*?end \\$\\$;`))?.[0];
  assert.ok(statement,`actual migration function ${name}`);await db.exec(statement);
 }
 const profile='https://www.linkedin.com/in/alex-trader';
 const profiles=[
  [profile,profile],['http://linkedin.com/in/ALEX-TRADER/',profile],['https://uk.linkedin.com/in/alex-trader?trk=search#about',profile],
  ['https://m.linkedin.com/in/%61lex-trader/details/experience/',profile],[`\t${profile}\n`,profile],
  ['https://linkedin.com/in/jos%C3%A9','https://www.linkedin.com/in/jos%c3%a9'],
  ['https://linkedin.com:443/in/alex-trader',''],['https://linkedin.com/in/alex/../other',''],
  ['https://linkedin.com/in/alex/%2e%2e/other',''],['https://linkedin.com/in/alex%2fother',''],
  ['https://linkedin.com/in/%zz',''],['https://linkedin.com/in/alex\\other',''],
  ['https://linkedin.com.evil.example/in/alex',''],['https://person@linkedin.com/in/alex',''],
  ['https://linkedin.com/company/alex',''],['https://linkedin.com/in/',''],['','']
 ];
 for(const [input,expected] of profiles){
  assert.equal(canonicalLinkedin(input),expected,`application profile ${input}`);
  assert.equal((await db.query('select public.canonical_linkedin($1) value',[input])).rows[0].value,expected,`database profile ${input}`);
 }
 for(const input of ['A.B+rates@googlemail.com','ab@gmail.com','Alex+desk@Bank.com','\t A.B+tag@GMAIL.com \r\n','']){
  assert.equal((await db.query('select public.canonical_email($1) value',[input])).rows[0].value,emailIdentity(input),`email ${input}`);
 }
 const profileMigration=await readFile(new URL('../supabase/migrations/202609230001_public_profile_identity.sql',import.meta.url),'utf8');
 const profileStatement=profileMigration.match(/create function public\.canonical_public_profile\([\s\S]*?end \$\$;/)?.[0];
 assert.ok(profileStatement);await db.exec(profileStatement);
 for(const input of ['https://www.example.com/people/Alex-Trader/?ref=team#bio','https://www.example.com/people/Alex-Trader','https://example.com/','https://user@example.com/person','https://example.com:8443/person','http://example.com/person'])assert.equal((await db.query('select public.canonical_public_profile($1) value',[input])).rows[0].value,canonicalPublicProfile(input),`public profile ${input}`);
});
