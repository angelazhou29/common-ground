import {allowedCompany} from './company-scope.ts';
import type {Contact,Message} from './types.ts';
import {isSalesAndTrading} from './targeting.ts';

/** Both Review and Waiting for approval consume these exact same rows. */
export function reviewQueue(contacts:Contact[],messages:Message[]){
  const people=new Map(contacts.filter(c=>!c.excluded&&!c.outreachLocked&&isSalesAndTrading(c)&&allowedCompany(c.company)).map(c=>[c.id,c]));
  return messages.filter(m=>people.has(m.contactId)&&['draft','waiting_approval','held'].includes(m.state)&&!m.gmailPreparedAt&&!m.sentAt)
    .map(message=>({contact:people.get(message.contactId)!,message}));
}
