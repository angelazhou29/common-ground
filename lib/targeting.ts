import type { Contact } from './types';

type Role = Pick<Contact, 'title' | 'industry'> & Partial<Pick<Contact, 'roleFamily' | 'level'>>;

export const TARGET_COMPANIES = [
  {key:'evercore',label:'Evercore'},
  {key:'wells fargo',label:'Wells Fargo'},
  {key:'deutsche bank',label:'Deutsche Bank'},
  {key:'citi',label:'Citi'},
  {key:'nomura',label:'Nomura'},
  {key:'hsbc',label:'HSBC'},
  {key:'morgan stanley',label:'Morgan Stanley'},
  {key:'bank of america',label:'Bank of America'},
  {key:'blackrock',label:'BlackRock'},
  {key:'jpmorgan',label:'JPMorgan'},
  {key:'goldman sachs',label:'Goldman Sachs'},
  {key:'ubs',label:'UBS'},
  {key:'barclays',label:'Barclays'},
  {key:'fidelity',label:'Fidelity'},
  {key:'balyasny',label:'Balyasny'},
] as const;
export const TARGET_COMPANY_LABELS=TARGET_COMPANIES.map(company=>company.label);

/** Classify the actual role, never the person's name, notes, or search query. */
export function isSalesAndTrading(contact: Role): boolean {
  const title = (contact.title || '').toLowerCase();
  const context = `${contact.industry || ''} ${contact.roleFamily || ''}`.toLowerCase();
  if (/\b(wealth|private bank(?:er|ing)?|financial advis[eo]r|retail|software|engineer(?:ing)?|developer|technology|recruit(?:er|ing|ment)?|human resources|salesforce|operations|compliance|risk|research|middle office|back office|investment banking)\b/.test(title)) return false;
  if (/\b(sales\s*(?:&|and|\/)\s*trading|s\s*&\s*t|trader|trading|market maker|market making|structur(?:er|ing)|global markets|capital markets sales)\b/.test(title)) return true;
  const sales = /\b(sales|salesperson|salespeople)\b/.test(title);
  const products = /\b(institutional|equity|equities|fixed[ -]income|fx|foreign exchange|credit|rates|derivatives|securities|commodit(?:y|ies)|futures|bonds?)\b/;
  if (sales && products.test(`${title} ${context}`)) return true;
  // Generic seniority titles need a specifically documented S&T function.
  return /\b(sales\s*(?:&|and|\/)\s*trading|s\s*&\s*t)\b/.test(context)
    && /\b(analyst|associate|vice president|vp|director|head|partner)\b/.test(title);
}

/** Conservative employer buckets; ambiguous or missing employers share one bucket. */
export function canonicalCompany(value?: string): string {
  let name = (value || '').normalize('NFKC').toLowerCase().replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  if (!name || /^(?:unknown|undisclosed|unavailable|confidential|not (?:known|provided|specified|established)|n a|na|none|tbd|company)(?:\s.*)?$/.test(name)) return '__unknown_company__';
  // Strip legal suffixes only; do not merge unrelated firms on fuzzy name overlap.
  let previous='';
  while(name!==previous){previous=name;name=name.replace(/\s+(?:and co|incorporated|inc|corporation|corp|limited|ltd|llc|llp|plc|ag|s a|sa|n a|co)$/,'').trim();}
  if (/^ubs(?: (?:group|financial services|securities|investment bank|global markets))?$/.test(name)) return 'ubs';
  if (/^(?:jpmorgan|j p morgan|jp morgan)(?: chase| securities)?$/.test(name)) return 'jpmorgan';
  if (/^(?:bofa(?: securities)?|bank (?:of )?america(?: securities| merrill lynch)?)$/.test(name)) return 'bank of america';
  if (/^evercore(?: isi)?$/.test(name)) return 'evercore';
  if (/^wells fargo(?: securities| bank| and company)?$/.test(name)) return 'wells fargo';
  if (/^deutsche bank(?: securities)?$/.test(name)) return 'deutsche bank';
  if (/^(?:citi|citigroup|citibank|citigroup global markets)$/.test(name)) return 'citi';
  if (/^nomura(?: securities| holdings| securities international)?$/.test(name)) return 'nomura';
  if (/^hsbc(?: securities| bank| holdings)?$/.test(name)) return 'hsbc';
  if (/^morgan stanley(?: and co)?$/.test(name)) return 'morgan stanley';
  if (/^blackrock$/.test(name)) return 'blackrock';
  if (/^(?:the )?goldman sachs(?: group)?$/.test(name)) return 'goldman sachs';
  if (/^barclays(?: bank| capital)?$/.test(name)) return 'barclays';
  if (/^fidelity(?: investments| management and research)?$/.test(name)) return 'fidelity';
  if (/^(?:balyasny|balyasny asset management|bam)$/.test(name)) return 'balyasny';
  return name || '__unknown_company__';
}

const TARGET_KEYS=new Set<string>(TARGET_COMPANIES.map(company=>company.key));
export function isAllowedTargetCompany(value?:string):boolean{return TARGET_KEYS.has(canonicalCompany(value));}

/** Exactly five firms receive four slots and ten receive three: 50 total/day. */
export function dailyCompanyQuotas(day:string):Record<string,number>{
  const index=Math.floor(Date.parse(day+'T00:00:00Z')/86400000);
  const start=((index%TARGET_COMPANIES.length)+TARGET_COMPANIES.length)%TARGET_COMPANIES.length;
  return Object.fromEntries(TARGET_COMPANIES.map((company,position)=>[company.key,((position-start+TARGET_COMPANIES.length)%TARGET_COMPANIES.length)<5?4:3]));
}

export function isEligibleTargetContact(contact:Role&{company?:string}):boolean{return isAllowedTargetCompany(contact.company)&&isSalesAndTrading(contact);}

type PrioritizedRole = Role & Partial<Pick<Contact,'company'|'discoveredAt'|'discoveryDate'>>;

/** S&T stays first; each tier shows one person per company before its backlog. */
export function prioritizeContacts<T extends PrioritizedRole>(contacts: readonly T[]): T[] {
  const ordered:T[]=[];
  for(const primary of [true,false]){
    const tier=contacts.filter(c=>isSalesAndTrading(c)===primary).sort((a,b)=>{
      const age=(c:T)=>{const time=Date.parse(c.discoveredAt||c.discoveryDate||'');return Number.isFinite(time)?time:0;};
      return age(b)-age(a);
    });
    const companies=new Map<string,T[]>();
    for(const contact of tier){const key=canonicalCompany(contact.company);const bucket=companies.get(key)||[];bucket.push(contact);companies.set(key,bucket);}
    const queues=[...companies.values()];
    for(let index=0;queues.some(queue=>index<queue.length);index++)for(const queue of queues)if(queue[index])ordered.push(queue[index]);
  }
  return ordered;
}

/** Seniority is an interpretation of a recorded title, not independent verification. */
export function contactLevel(contact: Pick<Contact, 'title'> & Partial<Pick<Contact, 'level'>>): string {
  const title = (contact.title || '').trim();
  if (/\b(intern|internship|summer\b.*\b(?:analyst|associate))\b/i.test(title)) return 'Intern';
  if (/\b(managing director|MD)\b/.test(title) || /\bmanaging director\b/i.test(title)) return 'Managing Director';
  if (/\b(senior vice president|SVP|executive vice president|EVP)\b/i.test(title)) return 'Senior / Executive Vice President';
  if (/\b(assistant vice president|AVP)\b/i.test(title)) return 'Assistant Vice President';
  if (/\b(vice president|VP)\b/i.test(title)) return 'Vice President';
  if (/\bexecutive director\b/i.test(title)) return 'Executive Director';
  if (/\bdirector\b/i.test(title)) return 'Director';
  if (/\b(head|chief|partner)\b/i.test(title)) return 'Head / Leadership';
  if (/\bsenior associate\b/i.test(title)) return 'Senior Associate';
  if (/\bassociate\b/i.test(title)) return 'Associate';
  if (/\bsenior analyst\b/i.test(title)) return 'Senior Analyst';
  if (/\banalyst\b/i.test(title)) return 'Analyst';
  if (/\b(manager|lead)\b/i.test(title)) return 'Manager / Lead';
  // Do not infer seniority from a bare "Trader" or years of experience.
  return 'Not established';
}
