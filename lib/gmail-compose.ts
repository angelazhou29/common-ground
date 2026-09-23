import type {Contact,Message} from './types.ts';
export function gmailComposeUrl(c:Contact,m:Message,sender:string){
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))throw Error('A published business email is required.');
 if(c.excluded||c.outreachLocked||c.synthetic||!c.identityConfirmed)throw Error('Review this contact and lifetime history before opening Gmail.');
 if(['invalid','catch-all'].includes(c.verification))throw Error('This address needs further verification.');
 if(!['published','authorized provider'].includes(c.emailOrigin)||!c.sources.length)throw Error('A supported email source is required.');
 if(!['draft','waiting_approval','held'].includes(m.state)||m.sentAt||m.gmailPreparedAt)throw Error('This email has already been prepared or sent. Check Gmail Drafts or Sent; another handoff is blocked.');
 if(!m.subject.trim()||!m.body.trim()||/[\[\]{}<>]/.test(m.body))throw Error('Resolve empty content or placeholders first.');
 const u=new URL('https://mail.google.com/mail/');
 u.search=new URLSearchParams({authuser:sender,view:'cm',fs:'1',to:c.email,su:m.subject,body:m.body}).toString();
 return u.href;
}
