import {readFile,readdir,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out=path.join(root,'public');
const html=await readFile(path.join(out,'index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g))await access(path.join(out,match[1]));
for(const file of await readdir(path.join(out,'assets'))){
 if(file.endsWith('.js'))execFileSync(process.execPath,['--check',path.join(out,'assets',file)]);
}
execFileSync(process.execPath,['--check',path.join(out,'sw.js')]);
if(/<script(?![^>]*\bsrc=)/.test(html))throw new Error('Unexpected inline script; the deployed CSP blocks it.');
const manifest=JSON.parse(await readFile(path.join(out,'manifest.webmanifest'),'utf8'));
for(const icon of manifest.icons)await access(path.join(out,icon.src));
if(manifest.display!=='standalone')throw new Error('PWA display mode is not standalone.');
const files=await readdir(out);
if(files.some(f=>/sql|\.env|backup/i.test(f)))throw new Error('Private or deployment files found in public/.');
console.log('Release checks passed: JavaScript syntax, static references, manifest icons, CSP-compatible scripts and publish directory.');
