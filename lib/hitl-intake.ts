import {canonicalCompany} from './company-scope.ts';
import {canonicalLinkedin,normalizedEmail,safeUrl} from './safety.ts';
import {isSalesAndTrading} from './targeting.ts';
import type {Contact,Source} from './types.ts';

export const HITL_HEADERS=[
  'name','title','company','linkedin','identity_confirmed','desk','product_group',
  'role_evidence_url','role_evidence_note','role_checked_at','email','email_origin',
  'email_verification','email_verified_at','email_evidence_url','email_evidence_note',
  'location','timezone','fit','topic','notes'
] as const;

type Row=Record<string,unknown>;
export type HitlIdentity={name:string;title:string;company:string;linkedin:string;desk:'sales'|'trading';productGroup:string;roleUrl:string;roleNote:string;roleCheckedAt:string};

function text(row:Row,key:string,max=3000){return String(row[key]??'').trim().slice(0,max);}
function required(row:Row,key:string,label:string,max=3000){const value=text(row,key,max);if(!value)throw Error(`${label} is required.`);return value;}
function date(row:Row,key:string,label:string,now:number,maxAgeDays:number){
  const value=required(row,key,label,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error(`${label} must use YYYY-MM-DD.`);
  const parsed=Date.parse(value+'T23:59:59.999Z');
  if(!Number.isFinite(parsed)||parsed>now+86400000)throw Error(`${label} is invalid or in the future.`);
  if(now-parsed>maxAgeDays*86400000)throw Error(`${label} is older than ${maxAgeDays} days; re-check it before import.`);
  return value;
}
function url(row:Row,key:string,label:string){const value=safeUrl(required(row,key,label,2000));if(!value)throw Error(`${label} must be a public HTTPS URL.`);return value;}
function source(urlValue:string,note:string,retrievedAt:string):Source{return {url:urlValue,note,retrievedAt};}

export function validateHitlIdentity(row:Row,now=Date.now()):HitlIdentity {
  const name=required(row,'name','Full name',200);
  const title=required(row,'title','Current title',300);
  const company=canonicalCompany(required(row,'company','Company',300));
  if(!company)throw Error('Company is outside the 15-company allowlist.');
  const linkedin=canonicalLinkedin(required(row,'linkedin','Direct LinkedIn profile',2000));
  if(!linkedin)throw Error('Direct LinkedIn profile must be a linkedin.com/in/... URL.');
  if(!/^(?:yes|true|1)$/i.test(text(row,'identity_confirmed',10)))throw Error('Set identity_confirmed to yes only after manually checking the profile.');
  const desk=text(row,'desk',20).toLowerCase();
  if(!['sales','trading'].includes(desk))throw Error('Desk must be sales or trading.');
  const productGroup=required(row,'product_group','Product group',200);
  const roleUrl=url(row,'role_evidence_url','Role evidence URL');
  const roleNote=required(row,'role_evidence_note','Role evidence note');
  const roleCheckedAt=date(row,'role_checked_at','Role check date',now,30);
  if(!isSalesAndTrading({title,industry:'Sales & Trading'}))throw Error('Title and evidence do not document a Sales & Trading role.');
  return {name,title,company,linkedin,desk:desk as 'sales'|'trading',productGroup,roleUrl,roleNote,roleCheckedAt};
}

/**
 * Convert one human-reviewed research row into a draft-eligible contact.
 * The importer never derives a person, job, desk, or email address. Every
 * identity and mailbox assertion must arrive with recent source evidence.
 */
export function contactFromHitlRow(row:Row,now=Date.now()):Contact {
  const identity=validateHitlIdentity(row,now);

  const email=normalizedEmail(required(row,'email','Corporate email',320));
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Corporate email is invalid.');
  const emailOrigin=text(row,'email_origin',40).toLowerCase();
  if(!['published','authorized provider'].includes(emailOrigin))throw Error('Email origin must be published or authorized provider; guessed patterns are rejected.');
  if(text(row,'email_verification',30).toLowerCase()!=='valid')throw Error('Email verification must be valid; unknown, inferred, and catch-all addresses are rejected.');
  const emailVerifiedAt=date(row,'email_verified_at','Email verification date',now,30);
  const emailUrl=url(row,'email_evidence_url','Email evidence URL');
  const emailNote=required(row,'email_evidence_note','Email evidence note');

  const contact:Contact={
    id:'',name:identity.name,title:identity.title,company:identity.company,email,linkedin:identity.linkedin,alternateEmails:[],
    industry:'Sales & Trading',location:text(row,'location',300),timezone:text(row,'timezone',100),
    status:'Ready for review',verification:'valid',verifiedAt:emailVerifiedAt,
    emailOrigin:emailOrigin as Contact['emailOrigin'],identityConfirmed:true,
    fit:text(row,'fit'),topic:text(row,'topic',1000),notes:text(row,'notes',10000),
    desk:identity.desk,productGroup:identity.productGroup,
    deskEvidence:identity.roleNote,
    sources:[source(identity.roleUrl,identity.roleNote,identity.roleCheckedAt),source(emailUrl,emailNote,emailVerifiedAt)],
    excluded:false,synthetic:false
  };
  if(!isSalesAndTrading(contact))throw Error('Title and evidence do not document a Sales & Trading role.');
  return contact;
}

export function hitlTemplateCsv(){return HITL_HEADERS.join(',')+'\r\n';}
