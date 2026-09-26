const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(){
  const storage={};
  const context=vm.createContext({
    document:{addEventListener(){}},
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
  assert.equal(JSON.stringify(context.supportSettings()),JSON.stringify({enabled:false,strength:[2],mobility:[]}));
});
test('backup rejects malformed routines and accepts a saved session',()=>{
  const {context,availability,settings}=setup();
  const routine=context.supportSessionsForDate('2026-09-30',settings,{},[],availability)[0].routine;
  assert.doesNotThrow(()=>context.validateSupportBackup('jp_support_done_v1',{'2026-09-30:strength':{done:true,routine}}));
  assert.throws(()=>context.validateSupportBackup('jp_support_done_v1',{'2026-09-30:strength':{done:true,routine:{...routine,exercises:[null]}}}));
  assert.throws(()=>context.validateSupportBackup('jp_support_settings_v1',{enabled:true,strength:[99],mobility:[]}));
});
