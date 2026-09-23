import type { Contact } from './types';

type Role = Pick<Contact, 'title' | 'industry'> & Partial<Pick<Contact, 'roleFamily' | 'level'>>;

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

/** Rank S&T first while preserving the source order within each tier. */
export function prioritizeContacts<T extends Role>(contacts: readonly T[]): T[] {
  return [...contacts].sort((a, b) => Number(isSalesAndTrading(b)) - Number(isSalesAndTrading(a)));
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
