import test from 'node:test';
import assert from 'node:assert/strict';
import {contactLevel,isSalesAndTrading,prioritizeContacts} from '../lib/targeting.ts';

const role = (title: string, industry = '') => ({title, industry});

test('institutional sales and trading outrank fallback financial roles', () => {
  for (const title of ['Sales & Trading Analyst', 'Equity Sales Associate', 'Fixed Income Sales', 'FX Trader', 'Global Markets Associate', 'Derivatives Structurer']) assert.equal(isSalesAndTrading(role(title)), true, title);
  for (const title of ['Wealth Management Advisor', 'Retail Sales Manager', 'Trading Software Engineer', 'Trading Operations Analyst', 'Global Markets Risk Analyst', 'Trading Technology Associate', 'Sales & Trading Recruitment', 'Salesforce Analyst', 'Investment Banking Associate']) assert.equal(isSalesAndTrading(role(title, 'Finance')), false, title);
  assert.equal(isSalesAndTrading(role('Vice President', 'Sales and Trading')), true);
  assert.equal(isSalesAndTrading(role('Vice President', 'Finance')), false);
});

test('fallback list is stable and does not manufacture candidates to fill a quota', () => {
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
