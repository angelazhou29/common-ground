import test from 'node:test';
import assert from 'node:assert/strict';
import {enrichHunterFoundEmail} from '../lib/hunter-enrichment.ts';

const row={name:'Alex Markets',title:'Equity Derivatives Trader',company:'JPMorgan',linkedin:'https://www.linkedin.com/in/alex-markets',identity_confirmed:'yes',desk:'trading',product_group:'Equity derivatives',role_evidence_url:'https://www.linkedin.com/in/alex-markets',role_evidence_note:'Current role checked manually.',role_checked_at:'2026-09-23'};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});

test('found-only enrichment accepts a current valid non-catch-all company address',async()=>{
  const calls:string[]=[];
  const fetcher:typeof fetch=async input=>{const url=String(input);calls.push(url);return calls.length===1?response({data:{email:'alex@jpmorgan.com',domain:'jpmorgan.com',source_type:'found',accept_all:false,sources:[{uri:'https://example.com/alex'}],verification:{status:'valid'}}}):response({data:{status:'valid',result:'deliverable'}})};
  const enriched=await enrichHunterFoundEmail(row,'secret',fetcher,Date.parse('2026-09-23T16:00:00Z'));
  assert.equal(enriched.email,'alex@jpmorgan.com');
  assert.equal(enriched.email_origin,'authorized provider');
  assert.equal(enriched.email_verification,'valid');
  assert.match(calls[0],/email-finder\/found/);
  assert.match(calls[1],/email-verifier/);
  assert.doesNotMatch(calls.join(' '),/secret/);
});

test('enrichment rejects inferred, accept-all, invalid and wrong-company results',async()=>{
  const cases=[
    {email:'alex@jpmorgan.com',source_type:'inferred',accept_all:false},
    {email:'alex@jpmorgan.com',source_type:'found',accept_all:true},
    {email:'alex@unrelated.com',source_type:'found',accept_all:false}
  ];
  for(const data of cases){const fetcher:typeof fetch=async()=>response({data});await assert.rejects(()=>enrichHunterFoundEmail(row,'secret',fetcher,Date.parse('2026-09-23T16:00:00Z')));}
  let count=0;const invalid:typeof fetch=async()=>++count===1?response({data:{email:'alex@jpmorgan.com',source_type:'found',accept_all:false}}):response({data:{status:'accept_all'}});
  await assert.rejects(()=>enrichHunterFoundEmail(row,'secret',invalid,Date.parse('2026-09-23T16:00:00Z')),/not valid/);
});
