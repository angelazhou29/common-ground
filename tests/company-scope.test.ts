import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedCompany,canonicalCompany,TARGET_COMPANIES} from '../lib/company-scope.ts';
import {matchesPreferences} from '../lib/discovery.ts';
import {discoveryConfig,payloadSummary} from '../lib/discovery-job.ts';

test('all 15 approved employers and explicit aliases match; similar names do not',()=>{
 assert.equal(TARGET_COMPANIES.length,15);
 for(const name of TARGET_COMPANIES)assert.equal(allowedCompany(name),true);
 assert.equal(canonicalCompany('J.P. Morgan Securities LLC'),'JP Morgan');
 assert.equal(canonicalCompany('Balyasny Asset Management'),'Balyasny');
 for(const name of ['RBC','CIBC','Ares Management','Evercore Partners Consulting Unrelated','Citi Software','Fidelity National Financial'])assert.equal(allowedCompany(name),false);
});
test('a company mentioned in a name or role cannot satisfy the employer filter',()=>{
 const p={name:'Wells Fargo Example',title:'Sales to Wells Fargo',company:'Unrelated Firm',email:'test@example.com',linkedin:'',location:'Chicago',url:'https://example.com'};
 assert.equal(matchesPreferences(p,{targets:'Wells Fargo',regions:'Chicago'}),false);
 assert.equal(matchesPreferences({...p,company:'Wells Fargo Securities'},{targets:'Wells Fargo',regions:'Chicago'}),true);
});
test('daily research target is 75, bounded without pretending a shortfall is filled',()=>{
 assert.equal(discoveryConfig({}).dailyCap,75);
 assert.equal(discoveryConfig({DISCOVERY_DAILY_CAP:'999'}).dailyCap,75);
 assert.equal(payloadSummary({accepted:12,target:75}).shortfall,63);
});
