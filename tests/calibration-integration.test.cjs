const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const C=require('../js/calibration-engine.js');
function fixture(){
 const store={},workouts={},uploaded={},done={},requests=[];
 const c=vm.createContext({CalibrationEngine:C,console,Date,Set,Math,JSON,
  loadObject:k=>structuredClone(store[k]||{}),saveObject:(k,v)=>{store[k]=structuredClone(v);},
  profile:{maxHr:185,z2Hr:145},customWorkouts:workouts,uploadedWorkouts:uploaded,doneWorkouts:done,
  allWorkouts:()=>structuredClone(workouts),todayDateString:()=> '2026-10-14',
  workoutUploadFingerprint:w=>JSON.stringify([w.displaySteps,w.intervalsDescription]),
  workoutUploadIsCurrent:(d,w)=>uploaded[d]?.fingerprint===c.workoutUploadFingerprint(w),
  completionMarkerMatches:(m)=>!!m,workoutExportsInFlight:new Set(),
  STORAGE_KEY:'workouts',UPLOAD_KEY:'uploads',formatPace:n=>`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`,
  resetGeneratedPlannerPreviews(){},refreshAfterCalendarMutation(){},fillProfileForm(){},renderMonth(){},
  document:{getElementById:()=>null,addEventListener(){}},
  syncedSportFamily:t=>t==='Run'?'run':t==='Ride'?'ride':'swim',
  fetchWithAppPin:async(url,init)=>{requests.push(JSON.parse(init.body));return {ok:true,json:async()=>({ok:true,eventId:123})};}
 });
 vm.runInContext(fs.readFileSync('js/calibration.js','utf8'),c);c.renderCalibration=()=>{};
 const run=(date,extra={})=>({date,name:'Drempel',planType:'threshold',type:'Run',displaySteps:['3 km inlopen @ 5:00/km','3 x 2 km @ 4:00-4:05/km'],intervalsDescription:'- 3km 5:00/km Pace\n- 2km 4:00-4:05/km Pace',...extra});
 workouts['2026-10-10']=run('2026-10-10');workouts['2026-10-14']=run('2026-10-14');workouts['2026-10-20']=run('2026-10-20');workouts['2026-10-22']=run('2026-10-22',{locked:true});workouts['2026-10-25']=run('2026-10-25');done['2026-10-25']=true;
 let s=C.empty();s.results=[{id:'r',status:'pending',quality:'bruikbaar',candidates:[{sport:'run',metric:'thresholdPace',value:250,date:'2026-10-14',source:'Test',method:'30 min',quality:'veldschatting'}]}];store.jp_calibration_v1=s;
 return {c,store,workouts,uploaded,done,requests};
}
test('accept updates only future unfinished unlocked sessions and undo preserves later edits',()=>{const f=fixture(),before=structuredClone(f.workouts);const accepted=C.accept(f.c.calibrationState(),'r',{today:'2026-10-14'});f.c.calibrationCommit(accepted);assert.deepEqual(f.workouts['2026-10-10'],before['2026-10-10']);assert.deepEqual(f.workouts['2026-10-14'],before['2026-10-14']);assert.deepEqual(f.workouts['2026-10-22'],before['2026-10-22']);assert.deepEqual(f.workouts['2026-10-25'],before['2026-10-25']);assert.match(f.workouts['2026-10-20'].displaySteps[1],/4:08-4:15/);assert.match(f.workouts['2026-10-20'].displaySteps[0],/5:00/);assert.match(f.workouts['2026-10-20'].intervalsDescription,/- 3km 5:00/);f.c.calibrationCommit(C.undo(f.c.calibrationState(),'2026-10-14'));assert.deepEqual(f.workouts,before);});
test('undo does not overwrite a future workout edited after zone acceptance',()=>{const f=fixture();f.c.calibrationCommit(C.accept(f.c.calibrationState(),'r',{today:'2026-10-14'}));f.workouts['2026-10-20'].name='My edit';f.c.calibrationCommit(C.undo(f.c.calibrationState(),'2026-10-14'));assert.equal(f.workouts['2026-10-20'].name,'My edit');});
test('export retries use same date identity and skip unrelated stale exports',async()=>{const f=fixture();f.uploaded['2026-10-20']={fingerprint:f.c.workoutUploadFingerprint(f.workouts['2026-10-20'])};f.uploaded['2026-10-22']={fingerprint:'old unrelated'};f.c.calibrationCommit(C.accept(f.c.calibrationState(),'r',{today:'2026-10-14'}));f.c.fetchWithAppPin=async()=>{throw Error('offline');};await f.c.calibrationExportPending();assert.equal(f.store.jp_export_attempts_v1['2026-10-20'].state,'failed');assert.equal(f.c.calibrationPending().length,1);const requests=[];f.c.fetchWithAppPin=async(u,o)=>{requests.push(JSON.parse(o.body));return {ok:true,json:async()=>({ok:true,eventId:42})};};await f.c.calibrationExportPending();await f.c.calibrationExportPending();assert.equal(requests.length,1);assert.equal(requests[0].workoutDate,'2026-10-20');assert.equal(f.c.calibrationPending().length,0);assert.equal(f.uploaded['2026-10-22'].fingerprint,'old unrelated');});
test('bike value acceptance leaves all running workouts byte-identical',()=>{const f=fixture(),s=f.c.calibrationState(),before=structuredClone(f.workouts);s.results[0].candidates=[{sport:'ride',metric:'ftp',value:320,date:'2026-10-14',method:'20min field',source:'coach',quality:'field'}];f.c.calibrationCommit(C.accept(s,'r',{today:'2026-10-14'}));assert.deepEqual(f.workouts,before);});
test('sport heart rates remain independent and old activity interpretation uses old values',()=>{const f=fixture();const s=f.c.calibrationState();s.values.run.maxHr={value:185};s.values.ride.maxHr={value:175};s.history=[{date:'2026-10-14',before:{run:{maxHr:{value:180}},ride:{},swim:{}}}];f.c.calibrationSave(s);assert.equal(f.c.calibrationSportProfile({type:'Ride',date:'2026-10-15'},{maxHr:185}).maxHr,175);assert.equal(f.c.calibrationSportProfile({type:'Swim',date:'2026-10-15'},{maxHr:185}).maxHr,null);assert.equal(f.c.calibrationSportProfile({type:'Run',date:'2026-10-10'},{maxHr:185}).maxHr,180);});
