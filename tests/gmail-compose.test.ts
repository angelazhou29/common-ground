import test from 'node:test';
import assert from 'node:assert/strict';
import {gmailComposeUrl} from '../lib/gmail-compose.ts';
const c:any={email:'person@example.com',identityConfirmed:true,emailOrigin:'published',sources:[{url:'https://example.com/team'}],verification:'unknown'};
const m:any={state:'waiting_approval',subject:'Northwestern & markets?',body:'Hi Alex,\n\nA question about wealth management.'};
test('Gmail handoff preserves exact recipient and reviewed text without sending',()=>{const u=new URL(gmailComposeUrl(c,m,'owner@example.com'));assert.equal(u.hostname,'mail.google.com');assert.equal(u.searchParams.get('to'),c.email);assert.equal(u.searchParams.get('su'),m.subject);assert.equal(u.searchParams.get('body'),m.body);assert.equal(u.searchParams.get('authuser'),'owner@example.com');});
test('Gmail handoff rejects exclusions, synthetic data, inferred emails, sent messages and placeholders',()=>{for(const change of [{excluded:true},{synthetic:true},{identityConfirmed:false},{emailOrigin:'inferred'},{verification:'invalid'},{verification:'catch-all'}])assert.throws(()=>gmailComposeUrl({...c,...change},m,'owner@example.com'));assert.throws(()=>gmailComposeUrl(c,{...m,sentAt:'2026-01-01'},'owner@example.com'));assert.throws(()=>gmailComposeUrl(c,{...m,body:'Hi [name]'},'owner@example.com'));});
