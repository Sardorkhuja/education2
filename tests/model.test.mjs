import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
const html=await readFile(new URL('../src/Education.html',import.meta.url),'utf8');
const model=html.split('// ---- model.js ----')[1].split('// ---- seed.js ----')[0];
const ctx=vm.createContext({structuredClone,crypto:webcrypto,Intl,Date});
vm.runInContext(model+'; globalThis.api={courseGrade,hasGrade,validateDue,validateEntity,overdue,inMonth,dueOn,occurrences,weekStart,shiftMonth};',ctx);
const m=ctx.api;
const c={id:'course-1',futureGrade:8};
const parts=[{id:'midterm',courseId:c.id,weight:30,grade:8,status:'graded'},{id:'final',courseId:c.id,weight:70,grade:null,status:'planned'}];
test('Weighted results separate current average and secured points',()=>{
 const g=m.courseGrade(c,parts);assert.equal(g.current,8);assert.equal(g.secured,2.4);assert.equal(g.remainingWeight,70);assert.equal(g.projected,8);assert.equal(g.final,null);
});
test('Missing grade differs from a genuine zero',()=>{
 assert.equal(m.hasGrade(null),false);assert.equal(m.hasGrade(0),true);
 assert.equal(m.courseGrade(c,[{...parts[0],grade:0},parts[1]]).current,0);
});
test('Incomplete assessment weights hide the projected result',()=>{
 const g=m.courseGrade(c,[parts[0]]);assert.equal(g.valid,false);assert.equal(g.projected,null);
});
test('Final result only appears when all weighted grades exist',()=>{
 const g=m.courseGrade(c,[parts[0],{...parts[1],grade:10,status:'graded'}]);assert.equal(g.final,9.4);
});
test('Linked tasks do not count an assessment twice',()=>{
 const g=m.courseGrade(c,parts,[{id:'task',courseId:c.id,componentId:'midterm',grade:10}]);assert.equal(g.secured,2.4);
});
test('Incomplete activity groups keep their partial average separate',()=>{
 const p={...parts[0],aggregation:'average',expectedCount:2,grade:null};
 const g=m.courseGrade(c,[p,parts[1]],[{id:'t1',courseId:c.id,componentId:p.id,grade:9}]);assert.equal(g.parts[0].partialGrade,9);assert.equal(g.parts[0].effectiveGrade,null);
});
test('Unconfirmed deadlines never become overdue automatically',()=>{
 assert.equal(m.overdue({status:'planned',due:{precision:'day',value:'2026-09-01',confirmed:false}},'2026-09-21'),false);
});
test('Month-only dates do not invent a specific day',()=>{
 const d={precision:'month',value:'2026-12',confirmed:true};assert.equal(m.inMonth(d,'2026-12'),true);assert.equal(m.dueOn(d,'2026-12-01'),false);assert.equal(m.overdue({status:'planned',due:d},'2027-01-01'),false);
});
test('Cross-month date ranges appear in both months',()=>{
 const d={precision:'range',value:'2026-10-29',end:'2026-11-03'};assert.equal(m.inMonth(d,'2026-10'),true);assert.equal(m.inMonth(d,'2026-11'),true);
});
test('Invalid dates and reversed date ranges are rejected',()=>{
 assert.throws(()=>m.validateDue({precision:'day',value:'2026-02-30'}));assert.throws(()=>m.validateDue({precision:'range',value:'2026-10-03',end:'2026-10-01'}));
});
test('Grades outside 0-10 are rejected',()=>{
 assert.throws(()=>m.validateEntity('course',{id:'c',name:'Course',officialGrade:11}));
});
test('Recurring class exception does not change the rest of the series',()=>{
 const s={id:'session',startDate:'2026-09-01',endDate:'2026-10-30',days:[1],interval:1,time:'09:00',exceptions:{'2026-09-14':{cancelled:true}}};
 const dates=Array.from(m.occurrences(s,'2026-09-07','2026-09-21'),x=>x.date);assert.deepEqual(dates,['2026-09-07','2026-09-21']);
});
test('Week and month navigation crosses a year boundary correctly',()=>{
 assert.equal(m.weekStart('2027-01-01'),'2026-12-28');assert.equal(m.shiftMonth('2026-12',1),'2027-01');
});
