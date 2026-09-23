import {request} from 'node:https';
import {lookup} from 'node:dns/promises';

export const DISCOVERY_AGENT = 'CommonGroundResearchBot';
const NEVER_FETCH = ['linkedin.com','facebook.com','instagram.com','x.com','twitter.com','google.com','bing.com'];
export function allowedSource(raw:string,hosts:readonly string[]):URL|null {
  try {
    const url=new URL(raw),host=url.hostname.toLowerCase();
    if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||!hosts.includes(host))return null;
    if(NEVER_FETCH.some(x=>host===x||host.endsWith('.'+x))||!/[a-z]/.test(host)||host==='localhost'||host.endsWith('.local'))return null;
    if(/\/(login|signin|sign-in|auth|account)(\/|$)/i.test(url.pathname))return null;
    url.hash='';return url;
  }catch{return null;}
}
export function publicIpv4(address:string):boolean {
  const p=address.split('.').map(Number);
  if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
  const [a,b,c]=p;
  return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===88&&c===99))||(a===198&&(b===18||b===19||b===51&&c===100))||(a===203&&b===0&&c===113));
}
export type RobotsPolicy={allowed:boolean;delayMs:number};
export function robotsPolicy(text:string,path:string):RobotsPolicy {
  type Group={agents:string[];rules:{allow:boolean;path:string}[];delay:number};
  const groups:Group[]=[];let group:Group|null=null,hasRules=false;
  for(const line of text.split(/\r?\n/)){
    const match=line.replace(/#.*$/,'').trim().match(/^([^:]+):\s*(.*)$/);if(!match)continue;
    const key=match[1].trim().toLowerCase(),value=match[2].trim();
    if(key==='user-agent'){
      if(!group||hasRules){group={agents:[],rules:[],delay:1100};groups.push(group);hasRules=false;}
      group.agents.push(value.toLowerCase());
    }else if(group){
      if(key==='allow'||key==='disallow'){hasRules=true;if(value)group.rules.push({allow:key==='allow',path:value});}
      if(key==='crawl-delay'){hasRules=true;const n=Number(value);if(Number.isFinite(n)&&n>=0)group.delay=Math.max(1100,n*1000);}
    }
  }
  const specific=groups.filter(g=>g.agents.some(a=>a!=='*'&&DISCOVERY_AGENT.toLowerCase().includes(a)));
  const selected=specific.length?specific:groups.filter(g=>g.agents.includes('*'));
  const rules=selected.flatMap(g=>g.rules).filter(r=>{
    const end=r.path.endsWith('$');const plain=end?r.path.slice(0,-1):r.path;
    const escaped=plain.split('*').map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');
    try{return new RegExp('^'+escaped+(end?'$':'')).test(path);}catch{return false;}
  }).sort((a,b)=>b.path.replace(/[*$]/g,'').length-a.path.replace(/[*$]/g,'').length||Number(b.allow)-Number(a.allow));
  return {allowed:rules[0]?.allow??true,delayMs:Math.max(1100,...selected.map(g=>g.delay))};
}

export type PageResponse={status:number;contentType:string;body:string};
// DNS is checked and pinned to the exact IPv4 address used by the TLS socket.
// Redirects are never followed, including redirects to another allowlisted site.
export async function publicPage(url:URL,agent:string):Promise<PageResponse> {
  const addresses=await lookup(url.hostname,{all:true});
  const ipv4=addresses.filter(a=>a.family===4);
  if(!ipv4.length||ipv4.some(a=>!publicIpv4(a.address)))throw Error('Source DNS is not a public IPv4 destination');
  return new Promise((resolve,reject)=>{
    const req=request(url,{
      method:'GET',headers:{'User-Agent':agent,'Accept':'text/html,text/plain;q=0.9','Accept-Encoding':'identity'},
      lookup:((_host:unknown,options:unknown,done:(error:Error|null,address:string|{address:string;family:number}[],family?:number)=>void)=>{
        if((options as {all?:boolean}).all)done(null,[{address:ipv4[0].address,family:4}]);
        else done(null,ipv4[0].address,4);
      }) as never,
    },res=>{
      const chunks:Buffer[]=[];let size=0;
      res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>600_000){res.destroy(Error('Source page exceeds 600 KB'));return;}chunks.push(chunk);});
      res.on('error',error=>{clearTimeout(hardTimeout);reject(error);});
      res.on('end',()=>{clearTimeout(hardTimeout);resolve({status:res.statusCode||0,contentType:String(res.headers['content-type']||''),body:Buffer.concat(chunks).toString('utf8')});});
    });
    req.setTimeout(8000,()=>req.destroy(Error('Source request timed out')));
    const hardTimeout=setTimeout(()=>req.destroy(Error('Source request exceeded its total time limit')),8000);
    req.on('error',error=>{clearTimeout(hardTimeout);reject(error);});req.end();
  });
}
export class PublicSourceReader {
  private robots=new Map<string,string>();
  private stopped=new Set<string>();
  private next=new Map<string,number>();
  private hosts:string[];
  private agent:string;
  private spend:()=>Promise<void>;
  private fetchPage:typeof publicPage;
  constructor(hosts:string[],agent:string,spend:()=>Promise<void>,fetchPage=publicPage){this.hosts=hosts;this.agent=agent;this.spend=spend;this.fetchPage=fetchPage;}
  async read(raw:string):Promise<string> {
    const url=allowedSource(raw,this.hosts);if(!url)throw Error('Source domain is not approved');
    if(this.stopped.has(url.hostname))throw Error('Source stopped after refusal or rate limit');
    if(!this.robots.has(url.hostname)){
      await this.spend();const response=await this.fetchPage(new URL('/robots.txt',url),this.agent);
      this.next.set(url.hostname,Date.now());
      if(response.status===404)this.robots.set(url.hostname,'');
      else if(response.status===200&&/text\/(plain|html)/i.test(response.contentType))this.robots.set(url.hostname,response.body);
      else {this.stopped.add(url.hostname);throw Error('robots.txt permission could not be established');}
    }
    const policy=robotsPolicy(this.robots.get(url.hostname)!,url.pathname+url.search);
    if(!policy.allowed)throw Error('robots.txt disallows this source');
    if(policy.delayMs>30_000)throw Error('Source crawl delay exceeds this bounded job');
    // robots.txt itself was a request to this source; respect its declared delay
    // before the very first biography request too.
    const remaining=(this.next.get(url.hostname)||0)+policy.delayMs-Date.now();
    if(remaining>0)await new Promise(r=>setTimeout(r,remaining));
    await this.spend();
    this.next.set(url.hostname,Date.now());
    const response=await this.fetchPage(url,this.agent);
    if([401,403,429].includes(response.status))this.stopped.add(url.hostname);
    if(response.status!==200)throw Error('Source refused, redirected, or unavailable');
    if(!/text\/html/i.test(response.contentType))throw Error('Only public HTML biographies are supported');
    if(/captcha|verify you are human|unusual traffic|access denied/i.test(response.body.slice(0,10000))){this.stopped.add(url.hostname);throw Error('Source bot challenge; no bypass attempted');}
    return response.body;
  }
}
