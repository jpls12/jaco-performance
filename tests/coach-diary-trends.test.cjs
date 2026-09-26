const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync('js/app.js','utf8');
const helperCode=app.slice(app.indexOf('function finiteNumberOrNull('),app.indexOf('function coachDiaryEntries('));
const trendCode=app.slice(app.indexOf('function renderDiaryTrends('),app.indexOf('function renderCoachDiary('));
const escapeCode=app.slice(app.indexOf('function escapeHtmlAttribute('),app.indexOf('function ymd('));

function setup(){
  const box={innerHTML:''};
  const context=vm.createContext({document:{getElementById:id=>id==='diaryTrends'?box:null}});
  vm.runInContext(helperCode+escapeCode+trendCode,context);
  return {context,box};
}

test('trend uses recorded dates only and distinguishes missing feedback from zero complaints',()=>{
  const {context,box}=setup();
  context.renderDiaryTrends([
    {date:'2026-09-26',entry:{sessionRpe:7,energy:3,complaintSeverity:0}},
    {date:'2026-09-24',entry:{sessionRpe:null,energy:2,complaintSeverity:null}},
    {date:'2026-09-20',entry:{sessionRpe:5,energy:4,complaintSeverity:1}}
  ]);
  const html=box.innerHTML;
  assert.ok(html.indexOf('20/9')<html.indexOf('24/9'));
  assert.ok(html.indexOf('24/9')<html.indexOf('26/9'));
  assert.match(html,/Zwaarte\. 20\/9: 5 van 10; 24\/9: geen meting; 26\/9: 7 van 10/);
  assert.match(html,/Klachten\. 20\/9: 1 van 3; 24\/9: geen meting; 26\/9: geen klachten/);
  assert.match(html,/diary-trend-cell is-missing/);
  assert.match(html,/diary-trend-cell is-zero/);
  assert.doesNotMatch(html,/24\/9: 0/);
});

test('trend has an honest empty state and limits display to seven check-ins',()=>{
  const {context,box}=setup();
  context.renderDiaryTrends([]);
  assert.match(box.innerHTML,/Nog geen check-ins/);
  const entries=Array.from({length:9},(_,i)=>({date:`2026-09-${String(26-i).padStart(2,'0')}`,entry:{sessionRpe:5,energy:3,complaintSeverity:0}}));
  context.renderDiaryTrends(entries);
  assert.doesNotMatch(box.innerHTML,/18\/9/);
  assert.doesNotMatch(box.innerHTML,/19\/9/);
  assert.match(box.innerHTML,/20\/9/);
});
