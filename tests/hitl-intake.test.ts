import test from 'node:test';
import assert from 'node:assert/strict';
import {contactFromHitlRow,hitlTemplateCsv,hitlWorksheetCsv,HITL_HEADERS,validateHitlIdentity} from '../lib/hitl-intake.ts';
import {parseCsv,reviewReasons} from '../lib/safety.ts';

const now=Date.parse('2026-09-23T16:00:00Z');
const row={
  name:'Alex Markets',title:'Equity Derivatives Trader',company:'JPMorgan Chase',
  linkedin:'https://www.linkedin.com/in/alex-markets/',identity_confirmed:'yes',desk:'trading',
  product_group:'Equity derivatives',role_evidence_url:'https://www.linkedin.com/in/alex-markets/',
  role_evidence_note:'Profile reviewed manually: current equity derivatives trader at JPMorgan.',role_checked_at:'2026-09-23',
  email:'alex.markets@jpmorgan.com',email_origin:'authorized provider',email_verification:'valid',
  email_verified_at:'2026-09-23',email_evidence_url:'https://hunter.io/',
  email_evidence_note:'Licensed provider returned the address as found and valid; not accept-all.',
  location:'New York',timezone:'America/New_York',fit:'Current desk is documented.',topic:'Equity derivatives market structure',notes:''
};

test('HITL row becomes a source-backed draft-ready target contact',()=>{
  const contact=contactFromHitlRow(row,now);
  assert.equal(contact.company,'JP Morgan');
  assert.equal(contact.linkedin,'https://www.linkedin.com/in/alex-markets');
  assert.equal(contact.identityConfirmed,true);
  assert.equal(contact.verification,'valid');
  assert.equal(contact.sources.length,2);
  assert.deepEqual(reviewReasons(contact,now),[]);
});

test('HITL import rejects guessed, catch-all, stale, unconfirmed, off-list and non-S&T rows',()=>{
  const failures=[
    [{email_origin:'inferred'},/guessed patterns/],
    [{email_verification:'catch-all'},/must be valid/],
    [{email_verified_at:'2026-08-01'},/older than 30 days/],
    [{identity_confirmed:'no'},/manually checking/],
    [{company:'Baird'},/allowlist/],
    [{title:'Wealth Management Associate'},/Sales & Trading/],
    [{linkedin:'https://linkedin.com/company/jpmorgan'},/linkedin.com\/in/]
  ] as const;
  for(const [patch,pattern] of failures)assert.throws(()=>contactFromHitlRow({...row,...patch},now),pattern);
});

test('downloadable template has the exact strict intake columns',()=>{
  const parsedHeaders=hitlTemplateCsv().trim().split(',');
  assert.deepEqual(parsedHeaders,[...HITL_HEADERS]);
  assert.deepEqual(parseCsv(hitlTemplateCsv()),[]);
});

test('balanced worksheet provides 100 research slots across every target company',()=>{
  const rows=parseCsv(hitlWorksheetCsv());
  assert.equal(rows.length,100);
  const counts=new Map<string,number>();
  for(const candidate of rows)counts.set(candidate.company,(counts.get(candidate.company)||0)+1);
  assert.equal(counts.size,15);
  assert.ok([...counts.values()].every(count=>count===6||count===7));
});

test('an official public profile can establish identity when LinkedIn is unavailable',()=>{
  const identity=validateHitlIdentity({...row,linkedin:'',role_evidence_url:'https://www.jpmorganchase.com/about/leadership'},now);
  assert.equal(identity.linkedin,'');
  assert.equal(identity.company,'JP Morgan');
});
