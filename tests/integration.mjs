import assert from 'node:assert/strict';
const base='http://localhost:5173';
const anon=await fetch(base+'/api/workspace');assert.equal(anon.status,401);
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=login.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');assert.ok(cookie);
async function get(){const r=await fetch(base+'/api/workspace',{headers:{cookie}});assert.equal(r.status,200);return r.json()}
async function post(action,payload={},status=200){const r=await fetch(base+'/api/workspace',{method:'POST',headers:{cookie,origin:base,'Content-Type':'application/json'},body:JSON.stringify({action,payload})});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d}
const token=Date.now();const name='QA Contact '+token;const email=`qa-${token}@example.com`;
await post('saveContact',{name,email,company:'Test Only',notes:'Disposable local integration test'});
let data=await get();let c=data.contacts.find(x=>x.email===email);assert.ok(c);assert.equal(c.identityConfirmed,false);
await post('saveContact',{name,email},400);
await post('saveContact',{name,email:`different-${token}@example.com`});
await post('saveContact',{...c,company:'New Company'});data=await get();assert.equal(data.contacts.find(x=>x.id===c.id).company,'New Company');
await post('saveContact',{...c,company:'Stale edit'},400);
const forged=await fetch(base+'/api/workspace',{method:'POST',headers:{cookie,origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({action:'pause'})});assert.equal(forged.status,403);
await post('pause');assert.equal((await get()).settings.paused,true);
await post('exclude',{id:c.id});await post('saveContact',{name,email},400);
await post('delete',{id:c.id});data=await get();assert.equal(data.contacts.find(x=>x.id===c.id).name,'Deleted contact');
for(const t of data.contacts.filter(x=>x.name===name))await post('delete',{id:t.id});
const exp=await fetch(base+'/api/workspace?export=backup',{headers:{cookie}});assert.equal(exp.status,200);assert.equal((await exp.json()).schemaVersion,1);
console.log('PASS: unauthorized access, authenticated persistence, duplicate identity, same-name distinction, job change, stale edit, CSRF, pause, suppression across deletion, JSON export.');
