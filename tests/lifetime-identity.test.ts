import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalLinkedin,emailIdentity,identitiesFor,normalizeAlternateEmails} from '../lib/safety.ts';
import {gmailComposeUrl} from '../lib/gmail-compose.ts';

test('LinkedIn profile URL variants resolve to the same permanent identity',()=>{
 const canonical='https://www.linkedin.com/in/alex-trader';
 for(const input of [canonical,'http://linkedin.com/in/Alex-Trader/','https://uk.linkedin.com/in/alex-trader?trk=people#about','https://m.linkedin.com/in/alex-trader/details/experience/','https://www.linkedin.com/in/%61lex-trader'])assert.equal(canonicalLinkedin(input),canonical,input);
});

test('non-profile links and lookalike domains cannot become person identities',()=>{
 for(const input of ['https://linkedin.com.evil.example/in/alex','https://evil.example/linkedin.com/in/alex','https://linkedin.com/company/alex','https://user@linkedin.com/in/alex','javascript:alert(1)','https://linkedin.com:8443/in/alex','https://linkedin.com/in/'])assert.equal(canonicalLinkedin(input),'',input);
});

test('alternate emails survive imports and canonical Gmail aliases collapse',()=>{
 const alternateEmails=normalizeAlternateEmails('["A.B+markets@googlemail.com","other@Bank.com","other@bank.com"]');
 assert.deepEqual(alternateEmails,['a.b+markets@googlemail.com','other@bank.com']);
 assert.deepEqual(identitiesFor({email:'ab@gmail.com',alternateEmails,linkedin:'https://linkedin.com/in/alex-trader/'}),['email:ab@gmail.com','email:other@bank.com','linkedin:https://www.linkedin.com/in/alex-trader']);
 assert.deepEqual(normalizeAlternateEmails('first@example.com; second@example.com\nthird@example.com'),['first@example.com','second@example.com','third@example.com']);
 assert.throws(()=>normalizeAlternateEmails(['not an email']));
 assert.throws(()=>normalizeAlternateEmails({email:'person@example.com'}));
});

test('corporate plus aliases and identical names are not guessed to be the same person',()=>{
 assert.equal(emailIdentity('Alex+desk@Bank.com'),'alex+desk@bank.com');
 assert.notDeepEqual(identitiesFor({name:'Alex Trader',email:'alex@one.example'}),identitiesFor({name:'Alex Trader',email:'alex@two.example'}));
});

test('a previous Gmail handoff cannot be reopened by changing the message state',()=>{
 const c:any={email:'alex@example.com',identityConfirmed:true,emailOrigin:'published',sources:[{url:'https://example.com/team'}],verification:'valid'};
 for(const state of ['draft','waiting_approval','held'])assert.throws(()=>gmailComposeUrl(c,{id:'one',state,subject:'Markets',body:'A question about trading.',gmailPreparedAt:'2026-09-22T14:00:00Z'} as any,'owner@example.com'),/already been prepared or sent/);
});
