const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/app.js','utf8');
function fixture(){
  const storage={};
  const c=vm.createContext({console,Date,Set,
    todayDateString:()=> '2026-10-12',
    loadObject:k=>structuredClone(storage[k]||{}),saveObject:(k,v)=>storage[k]=structuredClone(v),
    safe:v=>String(v??''),document:{getElementById:()=>null}});
  vm.runInContext(fs.readFileSync('js/coach-state.js','utf8'),c);
  return {c,storage};
}
test('optional check never invents a score, ignores an isolated poor night, reacts to corroboration or pain',()=>{
  const {c,storage}=fixture();
  assert.equal(c.dailyRecoveryEvidence(),null);
  storage.jp_recovery_checks_v1={'2026-10-12':{sleepHours:null,energy:null,legs:null,complaintSeverity:null}};
  assert.equal(c.dailyRecoveryEvidence().level,'unknown');
  assert.equal(c.dailyRecoveryEvidence().known,0);
  assert.equal(c.dailyRecoveryEvidence().energy,null);
  storage.jp_recovery_checks_v1['2026-10-12'].sleepHours=4;
  assert.equal(c.dailyRecoveryEvidence().level,'stable');
  storage.jp_recovery_checks_v1['2026-10-12'].energy=1;
  assert.equal(c.dailyRecoveryEvidence().level,'attention');
  storage.jp_recovery_checks_v1['2026-10-12'].complaintSeverity=2;
  assert.equal(c.dailyRecoveryEvidence().complaint,true);
  assert.equal(c.dailyRecoveryEvidence('2026-10-13'),null);
});
test('no wearable data yields unknown readiness and no score',()=>{
  const {c}=fixture();
  vm.runInContext(source.slice(source.indexOf('function determineReadiness('),source.indexOf('\nfunction getRaceFocus(')),c);
  const readiness=c.determineReadiness({});
  assert.equal(readiness.score,null);
  assert.equal(readiness.sufficientData,false);
});
test('export failure persists, concurrent clicks share work, navigating does not move the receipt, retry succeeds',async()=>{
  const {c,storage}=fixture();
  const workout={name:'3 x 3 km',type:'Run',date:'2026-10-12',intervalsDescription:'- 2km Z1 Pace\n\n3x\n- 3km Z4 Pace\n- 2m Z1 Pace\n\n- 1km Z1 Pace'};
  const status={};let resolve,requests=0;
  Object.assign(c,{selectedDate:'2026-10-12',allWorkouts:()=>({'2026-10-12':workout}),
    customWorkouts:{'2026-10-12':workout},uploadedWorkouts:{},UPLOAD_KEY:'uploads',
    trainingTypeInfo:()=>({uploadable:true}),workoutUploadFingerprint:w=>w.intervalsDescription,
    workoutUploadIsCurrent:()=>false,renderMonth:()=>{},renderTodayPurpose:()=>{},
    document:{getElementById:()=>status},fetchWithAppPin:()=>{requests++;return new Promise(r=>resolve=r);}});
  vm.runInContext(source.slice(source.indexOf('const workoutExportsInFlight='),source.indexOf('\nfunction setDefaultForm')),c);
  const first=c.uploadSelected();
  await c.uploadSelected();
  assert.equal(requests,1);
  c.selectedDate='2026-10-13';
  resolve({ok:false,json:async()=>({error:'Network failed'})});
  await first;
  assert.equal(storage.jp_export_attempts_v1['2026-10-12'].state,'failed');
  assert.equal(c.uploadedWorkouts['2026-10-13'],undefined);
  assert.match(c.exportStateText('2026-10-12',workout),/Export mislukt/);
  c.selectedDate='2026-10-12';
  const retry=c.uploadSelected();
  resolve({ok:true,json:async()=>({ok:true,externalId:'jaco-performance-2026-10-12',eventId:123})});
  await retry;
  assert.equal(storage.jp_export_attempts_v1['2026-10-12'].state,'synced');
  assert.equal(c.uploadedWorkouts['2026-10-12'].eventId,123);
  assert.equal(Object.keys(c.uploadedWorkouts).length,1);
});

test('today respects a blocked day and does not replace a locked training',()=>{
  const {c}=fixture();
  Object.assign(c,{workoutWasCompleted:()=>false,fitsTime:(w,a)=>w.durationMinutes<=a.maxMinutes,
    weekReplanShortenToAvailability:()=>null,
    weekReplanRestWorkout:()=>({type:'Rest',durationMinutes:0,displaySteps:['Rust']}),
    latestDiaryRecoverySignal:()=>({level:'unknown'})});
  vm.runInContext(source.slice(source.indexOf('function createTodayRecommendation('),source.indexOf('function todayWeekStartDate(')),c);
  const workout={type:'Run',name:'Intervals',durationMinutes:60};
  const advice=c.createTodayRecommendation({},null,{}, {available:false,maxMinutes:0},workout);
  assert.equal(advice.workout.type,'Rest');
  const locked={...workout,locked:true};
  assert.equal(c.createTodayRecommendation({},null,{}, {available:false,maxMinutes:0},locked).workout,locked);
});
