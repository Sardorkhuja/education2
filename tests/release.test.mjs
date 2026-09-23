import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const badBuild=(variables)=>spawnSync(process.execPath,['scripts/build.mjs'],{cwd:root,encoding:'utf8',env:{...process.env,VERCEL:'1',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',...variables}});
const project='https://abcdefghijklmnopqrst.supabase.co';
test('Production builds reject missing cloud configuration',()=>{
 const p=badBuild({});assert.notEqual(p.status,0);assert.match(p.stderr,/Cloud configuration is required/);
});
test('Build refuses a secret key',()=>{
 const p=badBuild({SUPABASE_URL:project,SUPABASE_PUBLISHABLE_KEY:'sb_secret_NOT_A_REAL_KEY'});assert.notEqual(p.status,0);assert.match(p.stderr,/must never be bundled/);
});
test('Build refuses legacy service-role keys',()=>{
 const token='eyJhbGciOiJub25lIn0.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.TEST';
 const p=badBuild({SUPABASE_URL:project,SUPABASE_PUBLISHABLE_KEY:token});assert.notEqual(p.status,0);
});
test('Build refuses non-project URLs',()=>{
 const p=badBuild({SUPABASE_URL:'http://localhost:1234',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_TEST'});assert.notEqual(p.status,0);assert.match(p.stderr,/HTTPS project URL/);
});
const sw=await readFile(new URL('../src/service-worker.js',import.meta.url),'utf8');
function harness(){
 const handlers={};let skips=0;let claimed=0;
 const ctx=vm.createContext({URL,Request,Response,caches:{keys:async()=>[],delete:async()=>{},open:async()=>({addAll:async()=>{},match:async()=>new Response('offline shell')})},fetch:async()=>{throw new Error('Offline');},self:{registration:{scope:'https://education.test/'},location:{origin:'https://education.test'},clients:{claim:async()=>{claimed++;}},skipWaiting:async()=>{skips++;},addEventListener:(k,v)=>{handlers[k]=v;}}});
 vm.runInContext(sw.replace('__BUILD_ID__','test').replace('__PRECACHE__',JSON.stringify(['./index.html'])),ctx);
 return{handlers,get skips(){return skips;},get claimed(){return claimed;}};
}
test('Service worker does not intercept cloud requests',()=>{
 const h=harness();let handled=false;h.handlers.fetch({request:{url:project+'/rest/v1/education_records',method:'GET',mode:'cors'},respondWith:()=>{handled=true;}});assert.equal(handled,false);
});
test('Service worker serves its installed shell when offline',async()=>{
 const h=harness();let response;h.handlers.fetch({request:{url:'https://education.test/',method:'GET',mode:'navigate'},respondWith:p=>{response=p;}});assert.equal(await (await response).text(),'offline shell');
});
test('An installed update waits for an explicit activation message',async()=>{
 const h=harness();let job;h.handlers.install({waitUntil:p=>{job=p;}});await job;assert.equal(h.skips,0);h.handlers.message({data:{type:'SKIP_WAITING'},waitUntil:p=>{job=p;}});await job;assert.equal(h.skips,1);
});
