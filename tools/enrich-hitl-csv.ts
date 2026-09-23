import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {csv,parseCsv} from '../lib/safety.ts';
import {contactFromHitlRow,HITL_HEADERS,validateHitlIdentity} from '../lib/hitl-intake.ts';
import {enrichHunterFoundEmail} from '../lib/hunter-enrichment.ts';

const [inputArg,outputArg]=process.argv.slice(2);
if(!inputArg||!outputArg)throw Error('Usage: pnpm hitl:enrich -- input.csv output.csv');
if(resolve(inputArg)===resolve(outputArg))throw Error('Output must differ from input so the reviewed source file is preserved.');
const apiKey=process.env.HUNTER_API_KEY;
if(!apiKey)throw Error('Set HUNTER_API_KEY in the current shell. The key is never written to output.');
const rows=parseCsv(await readFile(resolve(inputArg),'utf8')) as Record<string,string>[];
if(!rows.length||rows.length>100)throw Error('Input must contain 1 to 100 reviewed rows.');

const accepted:Record<string,string>[]=[],rejected:Record<string,string>[]=[],companyCounts=new Map<string,number>();
const seenLinkedin=new Set<string>(),seenEmails=new Set<string>();
for(let index=0;index<rows.length;index++){
  try{
    const identity=validateHitlIdentity(rows[index]);
    if(seenLinkedin.has(identity.linkedin))throw Error('Duplicate LinkedIn identity within this input file.');
    seenLinkedin.add(identity.linkedin);
    if((companyCounts.get(identity.company)||0)>=5)throw Error('Balanced 75-person pool already has five accepted contacts for this company.');
    const enriched=await enrichHunterFoundEmail(rows[index],apiKey);
    const contact=contactFromHitlRow(enriched); // final fail-closed schema check before writing
    if(seenEmails.has(contact.email))throw Error('Duplicate email identity within this input file.');
    seenEmails.add(contact.email);
    accepted.push(Object.fromEntries(HITL_HEADERS.map(header=>[header,enriched[header]||''])));
    companyCounts.set(identity.company,(companyCounts.get(identity.company)||0)+1);
    process.stdout.write(`Accepted row ${index+2}: ${identity.company} (${companyCounts.get(identity.company)}/5)\n`);
  }catch(error){
    rejected.push({...rows[index],rejection_reason:(error as Error).message});
    process.stdout.write(`Rejected row ${index+2}: ${(error as Error).message}\n`);
  }
  if(index<rows.length-1)await new Promise(resolveDelay=>setTimeout(resolveDelay,2500));
}
await writeFile(resolve(outputArg),csv(accepted),'utf8');
await writeFile(resolve(outputArg.replace(/\.csv$/i,'')+'-rejected.csv'),csv(rejected),'utf8');
process.stdout.write(`Complete: ${accepted.length} verified, ${rejected.length} rejected, ${Math.max(0,75-accepted.length)} short of the 75-contact session target.\n`);
for(const company of ['Evercore','Wells Fargo','Deutsche Bank','Citi','Nomura','HSBC','Morgan Stanley','Bank of America','BlackRock','JP Morgan','Goldman Sachs','UBS','Barclays','Fidelity','Balyasny'])process.stdout.write(`${company}: ${companyCounts.get(company)||0}/5\n`);
