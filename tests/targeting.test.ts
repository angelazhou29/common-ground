import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalCompany,contactLevel,isSalesAndTrading,prioritizeContacts} from '../lib/targeting.ts';

const role = (title: string, industry = '') => ({title, industry});

test('institutional sales and trading is recognized while off-scope roles are rejected', () => {
  for (const title of ['Sales & Trading Analyst', 'Equity Sales Associate', 'Fixed Income Sales', 'FX Trader', 'Global Markets Associate', 'Derivatives Structurer']) assert.equal(isSalesAndTrading(role(title)), true, title);
  for (const title of ['Wealth Management Advisor', 'Retail Sales Manager', 'Trading Software Engineer', 'Trading Operations Analyst', 'Global Markets Risk Analyst', 'Trading Technology Associate', 'Sales & Trading Recruitment', 'Salesforce Analyst', 'Investment Banking Associate']) assert.equal(isSalesAndTrading(role(title, 'Finance')), false, title);
  assert.equal(isSalesAndTrading(role('Vice President', 'Sales and Trading')), true);
  assert.equal(isSalesAndTrading(role('Vice President', 'Finance')), false);
});

test('ordering does not manufacture candidates to fill a quota', () => {
  const contacts = [role('Wealth Advisor'), role('FX Trader'), role('Investment Banking Analyst'), role('Equity Sales Associate')];
  const ordered = prioritizeContacts(contacts);
  assert.deepEqual(ordered.map(c => c.title), ['FX Trader', 'Equity Sales Associate', 'Wealth Advisor', 'Investment Banking Analyst']);
  assert.equal(ordered.length, contacts.length);
  assert.equal(contacts[0].title, 'Wealth Advisor');
  assert.deepEqual(prioritizeContacts([]), []);
});

test('level is conservatively derived from recorded title', () => {
  assert.equal(contactLevel(role('Summer Sales & Trading Analyst')), 'Intern');
  assert.equal(contactLevel(role('Managing Director, Rates')), 'Managing Director');
  assert.equal(contactLevel(role('Assistant Vice President, FX Sales')), 'Assistant Vice President');
  assert.equal(contactLevel(role('Senior Equity Research Analyst')), 'Analyst');
  assert.equal(contactLevel(role('Senior Associate, Institutional Sales')), 'Senior Associate');
  assert.equal(contactLevel({...role('Trader'), level:'Vice President'}), 'Not established');
  assert.equal(contactLevel(role('')), 'Not established');
});

test('known bank aliases share a company bucket without fuzzy-merging unrelated firms',()=>{
  for(const name of ['UBS','UBS AG','UBS Financial Services, Inc.','UBS Securities LLC'])assert.equal(canonicalCompany(name),'ubs');
  for(const name of ['JPMorgan','J.P. Morgan','JP Morgan','JPMorgan Chase & Co.'])assert.equal(canonicalCompany(name),'jpmorgan');
  for(const name of ['BofA','BofA Securities','Bank America','Bank of America Corporation'])assert.equal(canonicalCompany(name),'bank of america');
  assert.equal(canonicalCompany('Bank of America Securities'),'bank of america');
  assert.equal(canonicalCompany('The Goldman Sachs Group'),'goldman sachs');
  assert.equal(canonicalCompany('Barclays Bank'),'barclays');
  assert.notEqual(canonicalCompany('UBS Partner Advisory'),canonicalCompany('UBS'));
  assert.notEqual(canonicalCompany('Morgan Stanley'),canonicalCompany('J.P. Morgan'));
  for(const name of ['', 'N/A', 'Unknown employer', 'Undisclosed company 2', 'Company 42'])assert.equal(canonicalCompany(name),'__unknown_company__');
});

test('S&T contacts rotate companies before their backlog and retain every original record',()=>{
  const contacts=[
    {...role('FX Trader'),company:'UBS',id:'ubs-old'},
    {...role('Equity Sales Analyst'),company:'UBS Financial Services',id:'ubs-two'},
    {...role('FX Trader'),company:'J.P. Morgan',id:'jp-new',discoveredAt:'2026-09-23T10:00:00Z'},
    {...role('Research Analyst'),company:'Goldman Sachs',id:'offscope-new',discoveredAt:'2026-09-23T12:00:00Z'},
    {...role('FX Trader'),company:'BofA',id:'bofa'},
    {...role('Research Analyst'),company:'UBS',id:'offscope-ubs'},
    {...role('Research Analyst'),company:'UBS Financial Services',id:'offscope-ubs-two'},
  ];
  const ordered=prioritizeContacts(contacts);
  assert.deepEqual(ordered.map(c=>c.id),['jp-new','ubs-old','bofa','ubs-two','offscope-new','offscope-ubs','offscope-ubs-two']);
  assert.equal(contacts[0].id,'ubs-old');assert.equal(new Set(ordered.map(c=>c.id)).size,contacts.length);
});
