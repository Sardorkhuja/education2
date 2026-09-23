/** No network calls or database operations. Only the public/ directory is deployable. */
import { readFile, writeFile, mkdir, rm, readdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyPresentation } from './presentation.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const original=await readFile(path.join(root,'src/Education.html'),'utf8');
const styles=await readFile(path.join(root,'src/presentation.css'),'utf8');
const runtime=await readFile(path.join(root,'src/presentation.js'),'utf8');
const source=applyPresentation(original,styles,runtime);
const worker=await readFile(path.join(root,'src/service-worker.js'),'utf8');
const url=(process.env.SUPABASE_URL||'').trim().replace(/\/$/,'');
const key=(process.env.SUPABASE_PUBLISHABLE_KEY||'').trim();
if(Boolean(url)!==Boolean(key))throw new Error('Set both SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.');
if(process.env.VERCEL&&!url)throw new Error('Cloud configuration is required on Vercel. Add the two public Supabase environment variables, then redeploy.');
if(url&&!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url))throw new Error('Use the HTTPS project URL shown in your Supabase dashboard, not a database connection string.');
if(key){
  let allowed=key.startsWith('sb_publishable_')&&/^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if(key.startsWith('eyJ')){
    try{allowed=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8')).role==='anon';}catch{}
  }
  if(!allowed)throw new Error('Only a Supabase publishable key or legacy anon key is allowed. Secret/service_role keys must never be bundled.');
}
const hash=createHash('sha256').update(source).update(worker).update(url).update(key);
hash.update(await readFile(fileURLToPath(import.meta.url)));
hash.update(await readFile(path.join(root,'vercel.json')));
for(const file of (await readdir(path.join(root,'assets'))).sort())hash.update(await readFile(path.join(root,'assets',file)));
const version=hash.digest('hex').slice(0,16);
const output=path.join(root,'public');
await rm(output,{recursive:true,force:true});
await mkdir(path.join(output,'assets'),{recursive:true});
await mkdir(path.join(output,'icons'),{recursive:true});
const css=source.match(/<style>([\s\S]*?)<\/style>/)?.[1];
const app=source.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
if(!css||!app)throw new Error('The Education source is missing its styles or application script.');
const config={singleFile:false,build:version,supabaseUrl:url,supabasePublishableKey:key};
const configFile=`assets/config-${version}.js`;
const appFile=`assets/app-${version}.js`;
const styleFile=`assets/style-${version}.css`;
let html=source.replace(/<style>[\s\S]*?<\/style>/,`<link rel="stylesheet" href="./${styleFile}">`)
 .replace('<script>globalThis.EDUCATION_CONFIG={singleFile:true};</script>',`<script src="./${configFile}"></script>`)
 .replace(/<script type="module">[\s\S]*?<\/script>/,`<script type="module" src="./${appFile}"></script>`)
 .replace(/<link rel="icon"[^>]+>/,'<link rel="icon" type="image/svg+xml" href="./icons/icon.svg">')
 .replace('</head>','  <link rel="manifest" href="./manifest.webmanifest">\n  <link rel="apple-touch-icon" sizes="180x180" href="./icons/icon-180.png">\n</head>');
if(html.includes('singleFile:true'))throw new Error('Single-file mode was not replaced.');
await writeFile(path.join(output,'index.html'),html);
await writeFile(path.join(output,styleFile),css);
await writeFile(path.join(output,appFile),app);
await writeFile(path.join(output,configFile),`globalThis.EDUCATION_CONFIG=Object.freeze(${JSON.stringify(config)});\n`);
for(const file of await readdir(path.join(root,'assets')))await copyFile(path.join(root,'assets',file),path.join(output,'icons',file));
await writeFile(path.join(output,'manifest.webmanifest'),JSON.stringify({id:'/',name:'Education',short_name:'Education',description:'Classes, deadlines and grades. One thoughtful space for university life.',lang:'en',start_url:'/',scope:'/',display:'standalone',background_color:'#000000',theme_color:'#000000',icons:[{src:'./icons/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any maskable'},{src:'./icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]},null,2)+'\n');
const precache=['./index.html','./manifest.webmanifest','./icons/icon.svg','./icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png',`./${configFile}`,`./${appFile}`,`./${styleFile}`];
await writeFile(path.join(output,'sw.js'),worker.replace('__BUILD_ID__',version).replace('__PRECACHE__',JSON.stringify(precache)));
console.log(`Education ${version}: ${url?'cloud configuration included':'local-only test build'}. Output: public/.`);
