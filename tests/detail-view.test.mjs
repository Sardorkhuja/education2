import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyPresentation} from '../scripts/presentation.mjs';
import {openItemDetails, openOccurrence, applyDetailViews} from '../scripts/detail-view.mjs';

const text = name => readFile(new URL('../'+name,import.meta.url),'utf8');
const [source,css,js] = await Promise.all(['src/Education.html','src/presentation.css','src/presentation.js'].map(text));
const output = applyPresentation(source,css,js);

test('Opening schedule entries and item titles is read-only by default',()=>{
  assert.match(output,/case 'view-item':openItemDetails\(id\);break;/);
  assert.match(output,/case 'occurrence':openOccurrence\(id,button\.dataset\.date\);break;/);
  assert.match(output,/case 'edit-occurrence':editOccurrence\(id,button\.dataset\.date\);break;/);
  assert.match(output,/data-action="view-item"/);
  assert.match(output,/data-action="\$\{isDeadline\?'view-item':'occurrence'\}"/);
});

test('Explicit edit controls still open editors',()=>{
  assert.match(output,/case 'edit-item':openItem\(id\);break;/);
  assert.match(output,/function editOccurrence\(id,date\)/);
  assert.match(output,/data-action="edit-occurrence"/);
  assert.match(output,/Edit series/);
  assert.match(output,/iconButton\('edit','Edit '\+item\.title,'edit-item'/);
});

test('Read-only detail helpers never write workspace data',()=>{
  for (const fn of [openItemDetails,openOccurrence]) {
    const code=fn.toString();
    assert.doesNotMatch(code,/store\.(put|putMany|remove|restoreItem|import)\s*\(/);
    assert.match(code,/openModal\(/);
  }
});

test('Search and graded status checks open details instead of editors',()=>{
  assert.match(output,/if\(r\.data\.status==='graded'\)\{openItemDetails\(id\);return;\}/);
  assert.match(output,/if\(itemKind\(id\)==='course'\)chooseView\('course',id\);else openItemDetails\(id\);break;/);
});

test('Read-only views have structured details and an explicit Edit action',()=>{
  assert.match(output,/class="detail-view/);
  assert.match(output,/class="detail-list"/);
  assert.match(output,/class="secondary detail-edit-button"/);
  assert.match(output,/class="detail-note"/);
  assert.match(output,/--bg: #000000/);
});

test('Injected application script remains syntactically valid',()=>{
  const script=output.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(()=>new Function(script));
});

test('Detail transform fails closed if expected open actions drift',()=>{
  assert.throws(()=>applyDetailViews(source.replace('data-action="edit-item"','data-action="changed-item"')),/Expected six direct item-open actions/);
});
