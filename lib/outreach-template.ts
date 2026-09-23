import type {Contact, Settings} from './types.ts';
import {isSalesAndTrading} from './targeting.ts';

export function personalizedTemplate(c:Contact,s:Settings){
  if(!isSalesAndTrading(c))throw Error('Only Sales & Trading contacts are eligible for new outreach.');
  const sales=/\bsales\b/i.test(c.title),trading=/\b(trading|trader)\b/i.test(c.title);
  const desk=c.desk||(sales&&!trading?'sales':trading&&!sales?'trading':'');
  if(!desk||!c.productGroup?.trim()||!c.deskEvidence?.trim()||!c.sources.length)throw Error('Confirm the sales/trading desk, product group, and supporting evidence before drafting.');
  const fields:Record<string,string>={firstName:c.name.split(' ')[0],desk,productGroup:c.productGroup.trim(),company:c.company,title:c.title,deskParagraph:desk==='sales'?s.salesParagraph||'':s.tradingParagraph||'',signature:s.signature||s.name};
  if(!fields.deskParagraph)throw Error('Add the desk-specific paragraph in Settings first.');
  const body=(s.emailTemplate||'').replace(/\{\{(\w+)\}\}/g,(_,key:string)=>{if(!(key in fields))throw Error('Unknown template field: '+key);return fields[key];});
  if(!body.trim()||/[\[\]{}<>]/.test(body))throw Error('Resolve all template placeholders before drafting.');
  return {subject:`Northwestern student interested in ${c.productGroup} ${desk}`,body};
}
