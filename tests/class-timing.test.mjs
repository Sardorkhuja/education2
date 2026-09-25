import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { classTimingDetails, classTimingHTML, applyClassTiming } from '../scripts/class-timing.mjs';
import { applyPresentation } from '../scripts/presentation.mjs';
const text = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
const [source, css, runtime] = await Promise.all(['src/Education.html', 'src/presentation.css', 'src/presentation.js'].map(text));
const output = applyPresentation(source, css, runtime);
const context = vm.createContext({
  courseById: () => ({name:'Test course'}), modeData: () => ({icon:'video', label:'Online'}),
  colorOf: () => 'color-blue', icon: () => '', e: s => String(s ?? '')
});
const originalRenderer = source.match(/^function renderCalendarEvent.*$/m)[0];
const renderer = output.match(/^function renderCalendarEvent.*$/m)[0];
vm.runInContext(`${classTimingDetails.toString()}\n${classTimingHTML.toString()}\n${renderer}`, context);
const example = {id:'class-1',courseId:'course-1',time:'10:26',endTime:'11:56',date:'2026-09-24'};

test('Class timing calculates minutes and displays compact hours/minutes', () => {
  assert.deepEqual(classTimingDetails(example), {start:'10:26',end:'11:56',minutes:90,duration:'1h 30m',spoken:'1 hour 30 minutes'});
  assert.equal(classTimingDetails({time:'09:00',endTime:'09:45'}).duration, '45m');
  assert.equal(classTimingDetails({time:'09:00',endTime:'10:00'}).duration, '1h');
  assert.equal(classTimingDetails({time:'09:00',endTime:'11:00'}).spoken, '2 hours');
  assert.equal(classTimingDetails({time:'09:00',endTime:'09:01'}).spoken, '1 minute');
});
test('Unknown or invalid times never invent a duration or an overnight class', () => {
  for (const data of [{time:'10:26'}, {endTime:'11:56'}, {}, {time:'10:26',endTime:'10:26'},
    {time:'23:30',endTime:'00:30'}, {time:'25:00',endTime:'26:00'}, {time:'09:65',endTime:'11:00'},
    {time:'9:00',endTime:'11:00'}, {time:900,endTime:'11:00'}]) {
    assert.equal(classTimingDetails(data).minutes, null);
    assert.doesNotMatch(classTimingHTML(data), /class-duration/);
  }
  assert.match(classTimingHTML({time:'10:26'}), />10:26<\/time>/);
  assert.match(classTimingHTML({}), /Time to confirm/);
  assert.match(classTimingHTML({endTime:'11:56'}), /Ends <time/);
});
test('Week cards render the time range first and duration beneath it', () => {
  const html = context.renderCalendarEvent(example);
  assert.match(html, /datetime="10:26"/);
  assert.match(html, /datetime="11:56"/);
  assert.match(html, /class-duration/);
  assert.match(html, /1h 30m/);
  assert.match(html, /Duration: 1 hour 30 minutes/);
  assert.match(html, /data-action="occurrence"/);
  assert.match(html, /data-date="2026-09-24"/);
  assert.match(output, /\.calendar-event \.class-timing \{[\s\S]*?flex-direction:column/);
  assert.match(output, /\.class-duration \{[\s\S]*?margin-inline-start:0/);
});
test('Day/iPhone agenda gives start and end equal emphasis and keeps duration smaller', () => {
  const html = classTimingHTML(example, true);
  assert.match(html, /class="agenda-time"/);
  assert.match(html, /class="agenda-time-start"/);
  assert.match(html, /class="agenda-time-end"/);
  assert.match(html, /class="agenda-duration"/);
  assert.match(html, /datetime="11:56"/);
  assert.match(html, /1h 30m/);
  assert.match(output, /\.agenda-time \.agenda-time-start,[\s\S]*?font-size:inherit/);
  assert.match(output, /\.agenda-time \.agenda-duration \{[\s\S]*?font-size:10px/);
  assert.match(output, /item.category==='class'\?classTimingHTML\(item,true\)/);
});
test('Deadline cards retain their exact previous markup and never get class duration', () => {
  const before = vm.createContext({courseById:context.courseById, modeData:context.modeData,
    colorOf:context.colorOf, icon:context.icon, e:context.e});
  vm.runInContext(originalRenderer, before);
  for (const confirmed of [true, false]) {
    const item = {...example,title:'Test deadline',due:{time:'12:00',confirmed}};
    assert.equal(context.renderCalendarEvent(item,true), before.renderCalendarEvent(item,true));
  }
});
test('Individual occurrence edits update duration, with other dates and records untouched', () => {
  const model = source.split('// ---- model.js ----')[1].split('// ---- seed.js ----')[0];
  const ctx = vm.createContext({Intl,Date,structuredClone});
  vm.runInContext(model,ctx);
  const session = {...example,startDate:'2026-09-01',endDate:'2026-10-01',days:[4],interval:1,
    exceptions:{'2026-09-24':{time:'10:30',endTime:'12:30'}}};
  const original = JSON.stringify(session);
  const occurrences = ctx.occurrences(session,'2026-09-17','2026-09-24');
  assert.equal(classTimingDetails(occurrences[0]).duration, '1h 30m');
  assert.equal(classTimingDetails(occurrences[1]).duration, '2h');
  assert.equal(JSON.stringify(session), original);
});
test('Time strings cannot inject HTML and storage/auth code is unchanged', () => {
  const bad = classTimingHTML({time:'<img src=x onerror=alert(1)>',endTime:'11:56'});
  assert.doesNotMatch(bad, /<img|onerror/);
  const dataLayer = s => s.split('// ---- storage.js ----')[1].split('// ---- ui.js ----')[0];
  assert.equal(dataLayer(output), dataLayer(source));
  assert.match(output, /const APP_VERSION = '1.1.3'/);
});
test('The build fails safely if a future renderer changes the timing anchor', () => {
  assert.throws(() => applyClassTiming(source.replace('function renderCalendarEvent(', 'function renamedRenderer(')), /Class timing anchor/);
});
