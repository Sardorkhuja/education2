import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyPresentation} from '../scripts/presentation.mjs';
const text = name => readFile(new URL('../'+name,import.meta.url),'utf8');
const [source,css,js] = await Promise.all(['src/Education.html','src/presentation.css','src/presentation.js'].map(text));
const output = applyPresentation(source,css,js);
test('Release excludes all course preset data, UI and automatic onboarding import',()=>{
  assert.doesNotMatch(output,/COURSE_TEMPLATES|instantiateTemplates|openTemplates|data-action="templates"|Spanish Language A1|Microeconomics/);
  assert.match(output,/Create my workspace/);
});
test('New workspaces use dark appearance; dark canvas and browser chrome are pure black',()=>{
  assert.match(output,/theme:'dark'/);
  assert.match(output,/<html lang="en" data-theme="dark">/);
  assert.match(output,/--bg: #000000/);
  assert.match(output,/dark\?'#000000'/);
});
test('Motion opt-out is available in-app and respects the system setting',()=>{
  assert.match(output,/data-action="toggle-motion"/);
  assert.match(js,/systemReduce.matches \|\| !!profile\(\).reducedMotion/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test('Data, authentication and sync modules are byte-identical to the existing release',()=>{
  const layer = html => html.split('// ---- storage.js ----')[1].split('// ---- ui.js ----')[0];
  assert.equal(layer(output),layer(source));
  assert.doesNotMatch(js,/store\.(put|putMany|remove|load|import)|localStorage|indexedDB|fetch\(/);
});
test('Every normal render path goes through the interruptible presentation layer',()=>{
  const render = output.split('function renderApp(force=false)')[1].split('function introHTML()')[0];
  assert.equal((render.match(/uiMotion.render\(/g)||[]).length,4);
  assert.doesNotMatch(render,/root.innerHTML=/);
  assert.match(output,/uiMotion.closeSheet\(dialog\);dialog.close\(\)/);
});
test('Unknown source changes fail closed instead of applying an incomplete release',()=>{
  assert.throws(()=>applyPresentation(source.replace('renderApp(true);openTemplates();','renderApp(true); customImport();'),css,js),/Presentation anchor/);
});
