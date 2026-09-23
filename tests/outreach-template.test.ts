import test from 'node:test';
import assert from 'node:assert/strict';
import {personalizedTemplate} from '../lib/outreach-template.ts';
import {reviewQueue} from '../lib/review-queue.ts';
import {defaults,type Contact,type Message} from '../lib/types.ts';

const contact:Contact={id:'person',name:'Fixture Person',title:'Equity Sales Analyst',company:'Fixture Markets',industry:'Sales & Trading',location:'Chicago',email:'fixture@example.com',linkedin:'',timezone:'America/Chicago',status:'Ready for review',verification:'unknown',verifiedAt:'',emailOrigin:'published',identityConfirmed:true,fit:'Published role',topic:'Equity sales',notes:'',sources:[{url:'https://example.com/team',note:'Equity sales desk',retrievedAt:'2026-09-23'}],desk:'sales',productGroup:'equities',deskEvidence:'The official team page identifies the equity sales desk.'};
const settings={...defaults,emailTemplate:'Hi {{firstName}},\n{{desk}} at {{company}} in {{productGroup}} as {{title}}.\n{{deskParagraph}}\n{{signature}}',salesParagraph:'Client relationships and tailored trade ideas.',tradingParagraph:'Two-way prices and post-trade workflow.',signature:'Fixture Sender'};
const message:Message={id:'draft',contactId:'person',state:'waiting_approval',subject:'Hello',body:'Draft',scheduledAt:'',sequence:0};

test('owner template uses the evidenced sales or trading paragraph and exact recipient facts',()=>{
  const sales=personalizedTemplate(contact,settings);
  assert.match(sales.body,/Hi Fixture/);assert.match(sales.body,/Client relationships/);assert.doesNotMatch(sales.body,/Two-way/);
  const trading=personalizedTemplate({...contact,title:'Rates Trader',desk:'trading',productGroup:'rates'},settings);
  assert.match(trading.body,/Two-way/);assert.doesNotMatch(trading.body,/Client relationships/);
});
test('template never invents missing products, ambiguous desks, or accepts other roles',()=>{
  for(const c of [{...contact,productGroup:''},{...contact,deskEvidence:''},{...contact,desk:undefined,title:'Sales & Trading Analyst'},{...contact,title:'Wealth Strategy Associate'}])assert.throws(()=>personalizedTemplate(c,settings));
  assert.throws(()=>personalizedTemplate(contact,{...settings,emailTemplate:'Hi {{unrecognized}}'}));
});
test('Review and approval share the same S&T-only pending records; history stays intact',()=>{
  const wealth={...contact,id:'wealth',title:'Wealth Strategy Associate',industry:'Wealth management'};
  const contacts=[contact,wealth,{...contact,id:'locked',outreachLocked:true},{...contact,id:'excluded',excluded:true}];
  const messages=[message,{...message,id:'wealth-mail',contactId:'wealth'},{...message,id:'opened',gmailPreparedAt:'2026-09-23'},{...message,id:'sent',sentAt:'2026-09-23'},{...message,id:'cancelled',state:'cancelled'},{...message,id:'locked-mail',contactId:'locked'},{...message,id:'excluded-mail',contactId:'excluded'}];
  const queue=reviewQueue(contacts,messages);
  assert.deepEqual(queue.map(row=>row.contact.id),['person']);assert.deepEqual(queue.map(row=>row.message.id),['draft']);
  assert.equal(messages.length,7);assert.equal(contacts.length,4);
  assert.equal(reviewQueue(contacts,messages.map(m=>({...m,gmailPreparedAt:'2026-09-23'}))).length,0);
});
