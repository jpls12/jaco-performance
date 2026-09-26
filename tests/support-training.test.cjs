const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(){
  const storage={};
  const context=vm.createContext({
    document:{addEventListener(){},getElementById(){return null;}},
    todayDateString:()=>"2026-09-26",
    calendarDayDifference:(a,b)=>Math.round((Date.parse(a+"T12:00:00Z")-Date.parse(b+"T12:00:00Z"))/86400000),
    finiteNumberOrNull:v=>v===null||v===undefined||v===""?null:Number.isFinite(Number(v))?Number(v):null,
    loadObject:key=>storage[key]||{},
    DAY_KEYS:['mon','tue','wed','thu','fri','sat','sun'],
    calendarDayNumber:date=>/^\d{4}-\d{2}-\d{2}$/.test(date)?1:null,
    addDays:(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);},
    workoutDurationEstimate:(type,km)=>km*5.2
  });
  vm.runInContext(fs.readFileSync('js/support-training.js','utf8'),context);
  const availability=Object.fromEntries(context.DAY_KEYS.map(k=>[k,{available:true,maxMinutes:90}]));
  return {context,storage,availability,settings:{enabled:true,strength:[2],mobility:[2]}};
}
test('supplementary sessions coexist with a run without mutating it',()=>{
  const {context,availability,settings}=setup();
  const workouts={'2026-09-30':{type:'Run',durationMinutes:40}};
  const before=JSON.stringify(workouts);
  const sessions=context.supportSessionsForDate('2026-09-30',settings,workouts,[],availability);
  assert.equal(sessions.length,2);
  assert.ok(sessions.every(s=>!s.reason));
  assert.equal(JSON.stringify(workouts),before);
});
test('time budget includes both supplementary sessions',()=>{
  const {context,availability,settings}=setup();
  availability.wed.maxMinutes=65;
  const sessions=context.supportSessionsForDate('2026-09-30',settings,{'2026-09-30':{type:'Run',durationMinutes:40}},[],availability);
  assert.equal(sessions[0].reason,'');
  assert.match(sessions[1].reason,/Onvoldoende tijd/);
});
test('race day suppresses both sessions; nearby race suppresses strength',()=>{
  const {context,availability,settings}=setup();
  assert.ok(context.supportSessionsForDate('2026-09-30',settings,{},[{date:'2026-09-30'}],availability).every(s=>s.reason));
  const nearby=context.supportSessionsForDate('2026-09-30',settings,{},[{date:'2026-10-02'}],availability);
  assert.match(nearby[0].reason,/wedstrijd/);
  assert.equal(nearby[1].reason,'');
});
test('unavailable day and tomorrow long run are protected',()=>{
  const {context,availability,settings}=setup();
  availability.wed.available=false;
  assert.ok(context.supportSessionsForDate('2026-09-30',settings,{},[],availability).every(s=>s.reason));
  availability.wed.available=true;
  assert.match(context.supportSessionsForDate('2026-09-30',settings,{'2026-10-01':{planType:'long'}},[],availability)[0].reason,/Morgen/);
});
test('completed snapshot remains visible after disabling recurrence',()=>{
  const {context,storage,availability,settings}=setup();
  storage.jp_support_done_v1={'2026-09-30:strength':{done:true,routine:{name:'Saved',minutes:22,exercises:[]}}};
  settings.enabled=false;
  const sessions=context.supportSessionsForDate('2026-09-30',settings,{},[],availability);
  assert.equal(sessions.length,1);
  assert.equal(sessions[0].routine.name,'Saved');
  assert.equal(sessions[0].done,true);
});
test('settings normalize invalid days and honor disabled mode',()=>{
  const {context,storage}=setup();
  storage.jp_support_settings_v1={enabled:false,strength:[2,2,-1,'3',9],mobility:[]};
  assert.equal(JSON.stringify(context.supportSettings()),JSON.stringify({enabled:false,strength:[2],mobility:[],level:"standard",autoPlace:true}));
});
test('backup rejects malformed routines and accepts a saved session',()=>{
  const {context,availability,settings}=setup();
  const routine=context.supportSessionsForDate('2026-09-30',settings,{},[],availability)[0].routine;
  assert.doesNotThrow(()=>context.validateSupportBackup('jp_support_done_v1',{'2026-09-30:strength':{done:true,routine}}));
  assert.throws(()=>context.validateSupportBackup('jp_support_done_v1',{'2026-09-30:strength':{done:true,routine:{...routine,exercises:[null]}}}));
  assert.throws(()=>context.validateSupportBackup('jp_support_settings_v1',{enabled:true,strength:[99],mobility:[]}));
});

test('auto placement is deterministic, respects budget and never duplicates a kind',()=>{
  const {context,storage,availability}=setup();
  storage.jp_support_settings_v1={enabled:true,strength:[2,6],mobility:[1,4,5],autoPlace:true};
  availability.wed.available=false;
  Object.assign(context,{allWorkouts:()=>({}),races:{},defaultAvailability:()=>availability,getProfile:()=>({})});
  const plan=context.supportWeekPlan('2026-09-30');
  assert.equal(JSON.stringify(plan),JSON.stringify(context.supportWeekPlan('2026-09-30')));
  const sessions=Object.values(plan).flat().filter(s=>!s.reason);
  assert.equal(sessions.filter(s=>s.kind==='strength').length,2);
  assert.equal(sessions.filter(s=>s.kind==='mobility').length,3);
  assert.ok(sessions.some(s=>s.movedFrom==='2026-09-30'));
  for(const daily of Object.values(plan)) assert.equal(new Set(daily.map(s=>s.kind)).size,daily.length);
});
test('explicit skip is not moved and past missed sessions are not caught up',()=>{
  const {context,storage,availability}=setup();
  storage.jp_support_skip_v1={'2026-09-30:strength':{}};
  Object.assign(context,{allWorkouts:()=>({}),races:{},defaultAvailability:()=>availability,getProfile:()=>({})});
  const plan=context.supportWeekPlan('2026-09-30');
  assert.match(plan['2026-09-30'][0].reason,/jou overgeslagen/);
  assert.ok(!Object.values(plan).flat().some(s=>s.movedFrom==='2026-09-30'));
  availability.wed.available=false;
  assert.ok(!Object.values(context.supportWeekPlan('2026-09-23')).flat().some(s=>s.movedFrom==='2026-09-23'));
});
test('adjacent completed strength is protected across a week boundary',()=>{
  const {context,storage,availability}=setup();
  const settings={enabled:true,strength:[0],mobility:[]};
  storage.jp_support_done_v1={'2026-09-27:strength':{done:true,routine:context.supportRoutine('strength',settings,'2026-09-27')}};
  assert.match(context.supportSessionsForDate('2026-09-28',settings,{},[],availability)[0].reason,/één dag/);
});
test('missing feedback remains null; invalid duration and RPE are rejected',()=>{
  const {context}=setup();
  const f=context.supportFeedback('12','','','','partial');
  assert.equal(f.actualMinutes,12);assert.equal(f.rpe,null);assert.equal(f.pain,null);assert.equal(f.completion,'partial');
  assert.throws(()=>context.supportFeedback('',5,0,''));
  assert.throws(()=>context.supportFeedback(12,11,0,''));
  assert.throws(()=>context.supportFeedback(12,5,4,''));
});
test('load uses measured minutes only and excludes future entries',()=>{
  const {context,storage}=setup();
  const routine=context.supportRoutine('strength',{},'2026-09-26');
  storage.jp_support_done_v1={
    '2026-09-26:strength':{done:true,routine,actualMinutes:12,rpe:5},
    '2026-09-25:mobility':{done:true,routine},
    '2026-09-27:strength':{done:true,routine,actualMinutes:100,rpe:10,pain:3}
  };
  const sum=context.supportLoadSummary();
  assert.equal(sum.count,2);assert.equal(sum.minutes,12);assert.equal(sum.load,60);assert.equal(sum.measuredCount,1);assert.equal(sum.recentPain,false);
  assert.equal(context.supportCompletedEntries()[1].workout.durationMinutes,null);
});
test('backup rejects string-valued feedback and empty exercise snapshots',()=>{
  const {context}=setup();const routine=context.supportRoutine('strength',{},'2026-09-26');
  const check=extra=>context.validateSupportBackup('jp_support_done_v1',{'2026-09-26:strength':{done:true,routine,...extra}});
  assert.throws(()=>check({actualMinutes:'12',rpe:5}));
  assert.throws(()=>check({rpe:'<img src=x>'}));
  assert.throws(()=>check({pain:7}));
  assert.throws(()=>check({routine:{...routine,exercises:[]}}));
  assert.doesNotThrow(()=>check({actualMinutes:12,rpe:null,pain:null,completion:'partial'}));
});
test('timer uses wall clock and pause freezes elapsed time and rest',()=>{
  const {context}=setup();let now=10000;
  context.Date={now:()=>now};context.clearInterval=()=>{};context.sessionStorage={setItem(){}};
  vm.runInContext('supportPlayer={elapsedMs:2000,resumedAt:10000,restUntil:55000};',context);
  now=15000;assert.equal(context.supportElapsedMs(),7000);
  context.pauseSupportPlayer();now=50000;assert.equal(context.supportElapsedMs(),7000);
  assert.equal(vm.runInContext('supportPlayer.restRemaining',context),40000);
});

test('today shows a compact empty state and restores the full session card when planned',()=>{
  const {context,storage,availability}=setup();
  const states=[];
  const nodes={
    supportToday:{innerHTML:''},supportCalendar:{innerHTML:''},
    supportTodayCard:{classList:{toggle:(name,enabled)=>states.push([name,enabled])}}
  };
  context.document.getElementById=id=>nodes[id]||null;
  Object.assign(context,{selectedDate:'2026-09-27',allWorkouts:()=>({}),races:{},defaultAvailability:()=>availability,getProfile:()=>({})});
  storage.jp_support_settings_v1={enabled:false,strength:[5],mobility:[]};
  context.renderSupportTraining();
  assert.match(nodes.supportToday.innerHTML,/Geen aanvullende sessie vandaag/);
  assert.match(nodes.supportToday.innerHTML,/Weekplanning/);
  assert.deepEqual(states,[['is-empty',true]]);
  storage.jp_support_settings_v1.enabled=true;
  context.renderSupportTraining();
  assert.match(nodes.supportToday.innerHTML,/Start begeleide sessie/);
  assert.deepEqual(states.at(-1),['is-empty',false]);
});
