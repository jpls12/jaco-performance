const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(){
 const storage={},nodes={mobilityResume:{hidden:true},mobPause:{textContent:''}},workouts={};let now=100000;
 class Clock extends Date{static now(){return now;}}
 const ctx=vm.createContext({Date:Clock,console,setInterval:()=>1,clearInterval(){},setTimeout(){},navigator:{},window:{},
 document:{visibilityState:'visible',addEventListener(){},getElementById:id=>nodes[id]||null,querySelectorAll:()=>[]},
 localStorage:{setItem:(k,v)=>storage[k]=JSON.parse(v),getItem:k=>storage[k]?JSON.stringify(storage[k]):null,removeItem:k=>delete storage[k]},
 loadObject:k=>storage[k]||{},saveObject:(k,v)=>storage[k]=structuredClone(v),todayDateString:()=> '2026-10-13',
 calendarDayNumber:s=>/^\d{4}-\d{2}-\d{2}$/.test(s)?Date.parse(s)/86400000:null,
 calendarDayDifference:(a,b)=>Math.round((Date.parse(a)-Date.parse(b))/86400000),
 addDays:(s,n)=>new Date(Date.parse(s)+n*86400000).toISOString().slice(0,10),
 DAY_KEYS:['mon','tue','wed','thu','fri','sat','sun'],weekdayIndexFromDate:s=>(new Date(s).getDay()+6)%7,
 allWorkouts:()=>workouts,races:{},estimatedWorkoutMinutes:w=>w.durationMinutes||20,
 finiteNumberOrNull:v=>v==null||v===''?null:Number(v),workoutDurationEstimate:()=>20,
 isHardWorkout:w=>w.rpe>=7,workoutWasCompleted:()=>false,workoutCompletionIdentity:w=>JSON.stringify(w),
 dailyRecoveryEvidence:()=>null,getProfile:()=>({})});
 const availability=Object.fromEntries(ctx.DAY_KEYS.map(k=>[k,{available:true,maxMinutes:90}]));
 ctx.defaultAvailability=()=>availability;ctx.availabilityForDate=date=>availability[ctx.DAY_KEYS[ctx.weekdayIndexFromDate(date)]];
 for(const file of ['mobility-data','mobility','support-training'])vm.runInContext(fs.readFileSync(`js/${file}.js`,'utf8'),ctx);
 ctx.mobilityNotice=()=>{};ctx.mobilityRenderPlayer=()=>{};ctx.mobilityUpdateClock=()=>{};ctx.mobilityResume=()=>{};
 storage.jp_support_settings_v1={enabled:true,strength:[],mobility:[1],autoPlace:true};
 const run=s=>vm.runInContext(s,ctx);
 return{ctx,storage,availability,workouts,run,clock:ms=>now+=ms};
}
test('19 sourced exercises, eight routines, bounded exact duration and paired sides',()=>{
 const {run,ctx}=setup();assert.equal(run('Object.keys(MOBILITY_EXERCISES).length'),19);assert.equal(run('Object.keys(MOBILITY_ROUTINES).length'),8);
 for(const id of run('Object.keys(MOBILITY_ROUTINES)'))for(const budget of [5,10,15]){
  const r=ctx.mobilityBuildRoutine(id,budget);assert.ok(r.steps.length);assert.ok(r.totalSeconds<=budget*60);assert.equal(r.totalSeconds,r.steps.reduce((n,x)=>n+x.seconds,0));
  for(const step of r.steps.filter(x=>x.phase==='work'&&x.side==='links'))assert.ok(r.steps.some(x=>x.exerciseId===step.exerciseId&&x.set===step.set&&x.side==='rechts'&&x.phase==='work'));
 }
 assert.equal(run('Object.values(MOBILITY_EXERCISES).filter(e=>e.media.id).length'),2);
 assert.ok(run('Object.values(MOBILITY_EXERCISES).every(e=>e.steps.length===3&&e.source.startsWith("https://")&&e.easier&&e.mistake)'));
});
test('equipment, favorites, avoided exercises and discomfort all affect selection',()=>{
 const {ctx,storage,run}=setup(),p=ctx.mobilityPreferences();p.equipment=[];p.avoid=['cat-cow'];p.favorites=['side-bend'];storage.jp_mobility_preferences_v1=p;
 const r=ctx.mobilityBuildRoutine('calm',10);assert.equal(r.steps[0].exerciseId,'side-bend');assert.ok(!r.steps.some(x=>['cat-cow','ankle-pump','chest-open'].includes(x.exerciseId)));
 storage.jp_support_done_v1={'2026-10-12:mobility':{completedAt:'2026-10-12T10:00:00Z',mobility:{uncomfortableIds:['side-bend']}}};
 assert.equal(run('mobilityAllowed(MOBILITY_EXERCISES["side-bend"])'),false);
 storage.jp_mobility_preferences_v1.reallow={'side-bend':'2026-10-13T10:00:00Z'};
 assert.equal(run('mobilityAllowed(MOBILITY_EXERCISES["side-bend"])'),true);
});
test('planner counts main and strength time and never moves embedded mobility',()=>{
 const {ctx,storage,availability,workouts}=setup();workouts['2026-10-13']={type:'Run',durationMinutes:60};availability.tue.maxMinutes=65;
 let s=ctx.currentSupportSessions('2026-10-13').find(s=>s.kind==='mobility');assert.ok(s.routine.minutes<=5);assert.equal(s.reason,'');
 workouts['2026-10-13'].displaySteps=['5 min mobiliteit in cooling-down'];
 const plan=ctx.supportWeekPlan('2026-10-13');assert.match(plan['2026-10-13'][0].reason,/hoofdtraining/);assert.ok(!Object.values(plan).flat().some(s=>s.movedFrom==='2026-10-13'));
});
test('blocked days move once, using fresh availability and the shared time budget',()=>{
 const {ctx,storage,availability}=setup();availability.tue.available=false;storage.jp_support_settings_v1.strength=[2];availability.wed.maxMinutes=25;
 const plan=ctx.supportWeekPlan('2026-10-13');assert.ok(Object.values(plan).flat().some(x=>x.movedFrom==='2026-10-13'));
 for(const [date,sessions] of Object.entries(plan)){const accepted=sessions.filter(s=>!s.reason);assert.equal(new Set(accepted.map(s=>s.kind)).size,accepted.length);assert.ok(accepted.reduce((n,s)=>n+s.routine.minutes,0)<=ctx.availabilityForDate(date).maxMinutes);}
 const moved=Object.values(plan).flat().find(x=>x.movedFrom==='2026-10-13');
 storage.jp_support_done_v1={[`${moved.date}:mobility`]:{done:true,routine:moved.routine,actualMinutes:moved.routine.minutes,mobility:{plannedFor:'2026-10-13'}}};
 assert.ok(!Object.values(ctx.supportWeekPlan('2026-10-13')).flat().some(x=>x.movedFrom==='2026-10-13'));
});
test('routine choice follows sport and hard feedback reduces rather than escalates',()=>{
 const {ctx,workouts,storage}=setup();for(const [sport,id] of [['Run','run'],['Ride','bike'],['Swim','swim'],['Strength','strength']]){workouts['2026-10-13']={type:sport};assert.equal(ctx.mobilityRoutineForDate('2026-10-13').id,id);}
 storage.jp_support_done_v1={'2026-10-12:mobility':{mobility:{feedback:'hard'}}};const r=ctx.mobilityRoutineForDate('2026-10-13');assert.equal(r.id,'calm');assert.ok(r.minutes<=5);
});
test('wall-clock timers freeze on pause and never infer multiple exercises after interruption',()=>{
 const {ctx,clock,run}=setup();ctx.mobilityStart('2026-10-13');ctx.mobilityTogglePause();clock(11000);ctx.mobilityTick();assert.equal(run('mobilityActive.routine.steps[mobilityActive.index].phase'),'work');
 clock(5000);ctx.mobilityPause();assert.equal(run('mobilityActive.phaseElapsed'),5);clock(60000);assert.equal(ctx.mobilityElapsed(),5);
 ctx.mobilityTogglePause();clock(90000);ctx.mobilityTick();assert.equal(run('mobilityActive.records.length'),1);assert.equal(run('mobilityActive.records[0].seconds'),30);assert.equal(run('mobilityActive.running'),false);
});
test('partial save keeps exact performed time and leaves main workout unchanged',()=>{
 const {ctx,clock,run,workouts,storage}=setup();workouts['2026-10-13']={type:'Run',durationMinutes:30,name:'Keep me'};const before=JSON.stringify(workouts);
 ctx.mobilityStart('2026-10-13');ctx.mobilityTogglePause();clock(10000);ctx.mobilityTick();clock(4000);ctx.mobilityPause();ctx.mobilitySaveSession('hard');
 const e=storage.jp_support_done_v1['2026-10-13:mobility'];assert.equal(e.completion,'partial');assert.equal(e.mobility.actualSeconds,14);assert.equal(e.actualMinutes,14/60);assert.equal(e.mobility.records[0].seconds,4);assert.equal(e.rpe,null);assert.equal(JSON.stringify(workouts),before);
 assert.doesNotThrow(()=>ctx.validateSupportBackup('jp_support_done_v1',storage.jp_support_done_v1));assert.equal(ctx.supportLoadSummary().load,null);
});
test('full bilateral session logs each side once and saves a complete snapshot',()=>{
 const {ctx,clock,run,storage}=setup();ctx.mobilityStart('2026-10-13');let guard=0;
 while(run('mobilityActive.index<mobilityActive.routine.steps.length')&&guard++<200){if(!run('mobilityActive.running'))ctx.mobilityTogglePause();clock(60000);ctx.mobilityTick();}
 ctx.mobilitySaveSession('pleasant');const e=storage.jp_support_done_v1['2026-10-13:mobility'];assert.equal(e.completion,'complete');assert.ok(e.mobility.records.some(r=>r.side==='links'));assert.ok(e.mobility.records.some(r=>r.side==='rechts'));assert.equal(new Set(e.mobility.records.map(r=>`${r.exerciseId}:${r.set}:${r.side}`)).size,e.mobility.records.length);
});
test('skipping records skipped sides; pain removes later sets and future selections',()=>{
 const {ctx,run,storage}=setup();ctx.mobilityStart('2026-10-13');const id=run('mobilityActive.routine.steps[0].exerciseId');ctx.mobilitySkipExercise(true);assert.ok(run('mobilityActive.records.every(r=>r.status==="skipped")'));assert.ok(!run('mobilityActive.routine.steps.slice(mobilityActive.index)').some(x=>x.exerciseId===id));assert.ok(storage.jp_mobility_preferences_v1.avoid.includes(id));
});
test('replacement stays in the same category, logs prior effort and starts fresh setup',()=>{
 const {ctx,run,storage,clock}=setup();storage.jp_mobility_plans_v1={'2026-10-13':{routineId:'ankles',minutes:5}};ctx.mobilityStart('2026-10-13');ctx.mobilityTogglePause();clock(10000);ctx.mobilityTick();clock(5000);ctx.mobilityReplace('ankle-pump');
 assert.equal(run('mobilityActive.routine.steps[mobilityActive.index].exerciseId'),'ankle-pump');assert.equal(run('mobilityActive.routine.steps[mobilityActive.index].phase'),'setup');assert.equal(run('mobilityActive.records[0].seconds'),5);
});
test('reload restores paused wall-clock progress and malformed backup data is rejected',()=>{
 const {ctx,run,clock,storage}=setup();ctx.mobilityStart('2026-10-13');ctx.mobilityTogglePause();clock(3000);ctx.mobilityPersist();clock(3000);run('mobilityActive=null');ctx.mobilityRestore();assert.equal(run('mobilityActive.phaseElapsed'),6);assert.equal(run('mobilityActive.running'),false);
 assert.throws(()=>ctx.validateMobilityBackup('jp_mobility_plans_v1',{'2026-10-13':{routineId:'fake',minutes:5}}));
 assert.throws(()=>ctx.validateMobilityLog({version:1,feedback:'pleasant',actualSeconds:1,uncomfortableIds:[],records:[{exerciseId:'fake'}]}));
});
