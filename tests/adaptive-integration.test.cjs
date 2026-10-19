const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const addDays=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const days=(a,b)=>(Date.parse(a)-Date.parse(b))/86400000;
function fixture({workouts={},activities={},minutes={},assignments={}}={}){
  const stored={jp_activity_plan_matches_v1:assignments,jp_intervals_activity_sync_v1:{activities,meta:{fetchedAt:'2026-10-12T09:00:00Z',oldest:'2026-09-01',newest:'2026-10-12'}}};
  const custom={},done={},uploaded={};
  const number=v=>v==null||v===''?null:Number.isFinite(Number(v))?Number(v):null;
  const c=vm.createContext({console,Date,Promise,navigator:{onLine:true},
    loadObject:k=>structuredClone(stored[k]||{}),saveObject:(k,v)=>{stored[k]=structuredClone(v);},
    isPlainBackupObject:v=>v!==null&&typeof v==='object'&&!Array.isArray(v),finiteNumberOrNull:number,
    calendarDayNumber:d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))?Date.parse(d)/86400000:null,
    calendarDayDifference:days,dateGapDays:(a,b)=>Math.abs(days(a,b)),signedDateGapDays:days,
    addDays,todayDateString:()=> '2026-10-12',mondayOf:()=> '2026-10-12',
    allWorkouts:()=>({...workouts,...custom}),customWorkouts:custom,doneWorkouts:done,uploadedWorkouts:uploaded,races:{},
    workoutCompletionIdentity:w=>w?.name+'|'+w?.type,completionMarkerMatches:(m,w)=>m?.identity===w?.name+'|'+w?.type,
    isHardWorkout:w=>['quality','threshold','interval'].includes(w?.planType),isLongWorkout:w=>w?.planType==='long',
    getProfile:()=>({maxHr:185,z2Hr:140}),getRaceFocus:()=>null,getPrimaryARace:()=>null,
    raceTaperDays:()=>7,raceRecoveryDays:()=>2,classifyRacePhase:()=>({phase:'build'}),
    getWellnessSnapshot:()=>({}),determineReadiness:()=>({sufficientData:true,level:'good'}),
    buildLoadMonitor:()=>({level:'stable'}),latestDiaryRecoverySignal:()=>({level:'stable'}),
    availabilityForDate:d=>({available:(minutes[d]??90)>0,maxMinutes:minutes[d]??90}),
    fitsTime:(w,d)=>(w.durationMinutes||w.distanceKm*5.5||0)<=d.maxMinutes,
    activityReviews:{},document:{getElementById:()=>null},
    localStorage:{getItem:k=>typeof stored[k]==="object"?JSON.stringify(stored[k]):stored[k]||null,setItem:(k,v)=>{stored[k]=v;},removeItem:k=>{delete stored[k];}},
    STORAGE_KEY:'workouts',DONE_KEY:'done',UPLOAD_KEY:'uploaded',
    clearWorkoutMarkersForDate:d=>{delete done[d];delete uploaded[d];},refreshAfterCalendarMutation:()=>{}
  });
  vm.runInContext(fs.readFileSync('js/training-sync.js','utf8'),c);
  vm.runInContext(fs.readFileSync('js/adaptive-week-replanner.js','utf8'),c);
  vm.runInContext('autoWeekReplanReady=true',c);
  return{c,stored,custom,done,uploaded,workouts};
}
const run=(name,planType='easy',distanceKm=10)=>({name,type:'Run',planType,distanceKm,durationMinutes:50,rpe:planType==='quality'?'8/10':'3/10'});
test('early quality execution is consumed once and repeated sync remains idempotent',()=>{
  const f=fixture({workouts:{'2026-10-13':run('3 x 3 km','quality',12)},activities:{a:{id:'a',date:'2026-10-12',type:'Run',name:'Morning run',distanceKm:12,durationMinutes:50,perceivedExertion:8}}});
  assert.equal(f.c.rebuildActivityPlanAssignments(),true);
  assert.equal(f.c.assignmentForActivity('a').workoutDate,'2026-10-13');
  const p=f.c.buildAdaptiveWeekReplan();
  assert.equal(p.schedule['2026-10-13'].type,'Rest');
  assert.equal(f.c.applyAutomaticWeekReplan(p),true);
  assert.equal(f.c.rebuildActivityPlanAssignments(),false);
  assert.equal(f.c.buildAdaptiveWeekReplan().changes.length,0);
  assert.equal(f.c.assignmentForActivity('a').status,'complete');
});
test('corrected activity volume revises status without changing its manual link',()=>{
  const f=fixture({workouts:{'2026-10-12':run('Duurloop')},activities:{a:{id:'a',date:'2026-10-12',type:'Run',name:'Run',distanceKm:10,durationMinutes:50,perceivedExertion:3}}});
  f.c.rebuildActivityPlanAssignments();
  vm.runInContext('activityPlanAssignments.a.source="manual"; syncedActivities.a.distanceKm=5; syncedActivities.a.durationMinutes=25',f.c);
  assert.equal(f.c.rebuildActivityPlanAssignments(),true);
  assert.equal(f.c.assignmentForActivity('a').status,'partial');
  assert.equal(f.c.assignmentForActivity('a').source,'manual');
  assert.equal(f.c.rebuildActivityPlanAssignments(),false);
});
test('ambiguous identical adjacent sessions require a choice',()=>{
  const f=fixture({workouts:{'2026-10-11':run('Easy A'),'2026-10-13':run('Easy B')},activities:{a:{id:'a',date:'2026-10-12',type:'Run',distanceKm:10,durationMinutes:50,perceivedExertion:3}}});
  f.c.rebuildActivityPlanAssignments();
  assert.equal(f.c.assignmentForActivity('a'),null);
  assert.equal(f.c.unresolvedActivityMatchQueue().length,1);
});
test('duplicate imported assignments preserve manual choice and never claim a session twice',()=>{
  const f=fixture({workouts:{'2026-10-12':run('Easy')},activities:{a:{id:'a',date:'2026-10-12',type:'Run',distanceKm:10,durationMinutes:50,perceivedExertion:3},b:{id:'b',date:'2026-10-12',type:'Run',distanceKm:10,durationMinutes:50,perceivedExertion:3}}});
  vm.runInContext('activityPlanAssignments.a=makeActivityAssignment(syncedActivities.a,activityPlanCandidates(syncedActivities.a)[0]); activityPlanAssignments.b={...activityPlanAssignments.a,activityId:"b",source:"manual"}',f.c);
  f.c.rebuildActivityPlanAssignments();
  assert.equal(f.c.assignmentForActivity('b').source,'manual');
  assert.notEqual(f.c.assignmentForActivity('a')?.status,'complete');
});
test('limited availability keeps quality ahead of easy and never leaves infeasible sessions',()=>{
  const minutes=Object.fromEntries(Array.from({length:7},(_,i)=>[addDays('2026-10-13',i),0]));
  minutes['2026-10-15']=60;
  const f=fixture({minutes,workouts:{'2026-10-13':run('Easy'),'2026-10-14':run('Key','quality')}});
  const p=f.c.buildAdaptiveWeekReplan();
  assert.equal(p.schedule['2026-10-15'].name,'Key');
  assert.equal(Object.values(p.schedule).filter(w=>w&&w.type==='Run').length,1);
  assert.ok(Object.entries(p.schedule).every(([d,w])=>f.c.weekReplanFitsAvailability(w,d)));
});
test('exported sessions remain unchanged without blocking safe changes on other dates',()=>{
  const f=fixture({workouts:{'2026-10-13':run('Exported'),'2026-10-14':run('Change')},minutes:{'2026-10-13':0,'2026-10-14':0}});
  f.uploaded['2026-10-13']={name:'Exported'};
  const p=f.c.buildAdaptiveWeekReplan();
  assert.equal(p.schedule['2026-10-13'].name,'Exported');
  assert.ok(p.changes.length>0);
  assert.equal(f.c.applyAutomaticWeekReplan(p),true);
  assert.ok(f.uploaded['2026-10-13']);
});
test('long cycling and combined RPE load affect the next running session',()=>{
  const f=fixture({workouts:{'2026-10-13':run('Intervals','quality')},activities:{bike:{id:'bike',date:'2026-10-12',type:'Ride',durationMinutes:180,perceivedExertion:6},swim:{id:'swim',date:'2026-10-12',type:'Swim',durationMinutes:60,perceivedExertion:5}}});
  const feedback=f.c.buildAdaptiveExecutionFeedback();
  assert.equal(feedback.perceivedLoad,1380);
  assert.equal(feedback.level,'attention');
  assert.notEqual(f.c.buildAdaptiveWeekReplan().schedule['2026-10-13'].planType,'quality');
});
test('shortened sessions export the shortened volume rather than the old recipe',()=>{
  const f=fixture({minutes:{'2026-10-13':30}});
  const shortened=f.c.weekReplanShortenToAvailability({...run('Long easy'),intervalsDescription:'- 10km Z2 Pace'},'2026-10-13');
  assert.match(shortened.intervalsDescription,/5km/);
  assert.doesNotMatch(shortened.intervalsDescription,/10km/);
  const swim=f.c.weekReplanRecoveryWorkout({type:'Swim',name:'Swim',durationMinutes:60},'2026-10-13','Load');
  assert.equal(swim.type,'Swim');assert.equal(swim.planType,'recovery');
});
test('malformed sync retains stored data and concurrent callers share one request',async()=>{
  const f=fixture({activities:{a:{id:'a',date:'2026-10-12',type:'Run'}}});
  let resolve,requests=0;
  f.c.fetchWithAppPin=()=>{requests++;return new Promise(r=>{resolve=r;});};
  f.c.renderActivitySyncStatus=()=>{};
  const first=f.c.syncCompletedActivities({silent:true});
  const second=f.c.syncCompletedActivities({silent:true});
  assert.equal(requests,1);assert.equal(first,second);
  resolve({ok:true,json:async()=>({oldest:'2026-09-01',newest:'2026-10-12'})});
  assert.equal((await first).ok,false);
  assert.equal(vm.runInContext('syncedActivities.a.id',f.c),'a');
});

test('recovery run cannot complete an interval session',()=>{
  const f=fixture({workouts:{'2026-10-12':run('3 x 3 km','quality',12)},activities:{a:{id:'a',date:'2026-10-12',type:'Run',distanceKm:12,durationMinutes:60,perceivedExertion:3}}});
  f.c.rebuildActivityPlanAssignments();
  assert.notEqual(f.c.assignmentForActivity('a')?.status,'complete');
});
test('missing intensity cannot automatically complete quality',()=>{
  const f=fixture({workouts:{'2026-10-12':run('3 x 3 km','quality',12)},activities:{a:{id:'a',date:'2026-10-12',type:'Run',distanceKm:12,durationMinutes:50}}});
  f.c.rebuildActivityPlanAssignments();
  assert.equal(f.c.assignmentForActivity('a'),null);
});
test('partial execution counts actual RPE load and is never fully completed',()=>{
  const f=fixture({workouts:{'2026-10-12':run('Duurloop')},activities:{a:{id:'a',date:'2026-10-12',type:'Run',distanceKm:6,durationMinutes:30,perceivedExertion:3}}});
  f.c.rebuildActivityPlanAssignments();
  assert.equal(f.c.assignmentForActivity('a').status,'partial');
  assert.equal(f.c.buildAdaptiveExecutionFeedback().perceivedLoad,90);
});
test('delayed synchronization is unknown, even after yesterday is covered',()=>{
  const f=fixture({workouts:{'2026-10-11':run('Yesterday')}});
  assert.equal(f.c.assessActivityMatch('2026-10-11',f.workouts['2026-10-11']).status,'unmatched');
  assert.equal(f.c.weekReplanRescheduleMissedQuality({workout:run('Missed','quality')}),null);
});
test('two providers count once, preserve source evidence and remain idempotent',()=>{
  const f=fixture();
  const a={id:'a',source:'COROS',type:'Run',date:'2026-10-12',startDateLocal:'2026-10-12T08:00:00',distanceKm:10,durationMinutes:50,perceivedExertion:4};
  const b={...a,id:'b',source:'STRAVA',startDateLocal:'2026-10-12T08:00:02'};
  f.c.incoming=[a,b];
  vm.runInContext('syncedActivities=mergeActivityImports(incoming)',f.c);
  assert.equal(vm.runInContext('Object.keys(syncedActivities).length',f.c),1);
  assert.equal(f.c.buildAdaptiveExecutionFeedback().perceivedLoad,200);
  f.c.rebuildActivityPlanAssignments();
  vm.runInContext('syncedActivities=mergeActivityImports(incoming)',f.c);
  assert.equal(f.c.rebuildActivityPlanAssignments(),false);
  assert.equal(f.c.buildAdaptiveExecutionFeedback().perceivedLoad,200);
  assert.equal(vm.runInContext('Object.keys(syncedActivities.a.sourceRecords).length',f.c),2);
  assert.equal(f.c.sameRecordedActivity(a,{...b,startDateLocal:'2026-10-12T18:00:00'}),false);
  assert.equal(f.c.sameRecordedActivity({...a,startDateLocal:''},{...b,startDateLocal:''}),false);
});
test('bounded sync does not delete a historical activity absent from the response',()=>{
  const f=fixture({activities:{a:{id:'a',type:'Run',date:'2026-10-11'}}});
  assert.equal(Object.keys(f.c.mergeActivityImports([])).length,1);
});
test('Saturday unavailable and locked race remain protected',()=>{
  const f=fixture({workouts:{'2026-10-13':{...run('Locked','quality'),locked:true},'2026-10-17':run('Saturday'),'2026-10-18':{name:'Race',type:'Race'}},minutes:{'2026-10-13':0,'2026-10-17':0}});
  const p=f.c.buildAdaptiveWeekReplan();
  assert.equal(p.schedule['2026-10-13'].name,'Locked');
  assert.equal(p.schedule['2026-10-18'].type,'Race');
  assert.notEqual(p.schedule['2026-10-17']?.type,'Run');
  assert.equal(JSON.stringify(p.schedule),JSON.stringify(f.c.buildAdaptiveWeekReplan().schedule));
});
test('reported partial completion overrides misleading full distance',()=>{
  const f=fixture({workouts:{'2026-10-12':run('Quality','quality')},activities:{a:{id:'a',type:'Run',date:'2026-10-12',distanceKm:10,durationMinutes:50,perceivedExertion:8}}});
  f.c.activityReviews={a:{completion:'partial',sessionRpe:8}};
  f.c.rebuildActivityPlanAssignments();
  assert.equal(f.c.assignmentForActivity('a').status,'partial');
});

test('undo restores the calendar and retains imported activities and change history',()=>{
  const f=fixture({workouts:{'2026-10-13':run('Easy')},minutes:{'2026-10-13':0},activities:{a:{id:'a',date:'2026-10-12',type:'Ride',durationMinutes:30}}});
  vm.runInContext(fs.readFileSync('js/coach-state.js','utf8'),f.c);
  const proposal=f.c.buildAdaptiveWeekReplan();
  assert.equal(f.c.applyAutomaticWeekReplan(proposal),true);
  assert.equal(f.stored.jp_coach_history_v1.entries.length,1);
  f.c.undoAutomaticWeekReplan();
  assert.equal(Object.keys(f.custom).length,0);
  assert.equal(f.stored.jp_coach_history_v1.entries.length,2);
  assert.equal(vm.runInContext('syncedActivities.a.id',f.c),'a');
});

test('mobility and strength do not complete each other or deduplicate across disciplines',()=>{
  const f=fixture({workouts:{'2026-10-12':{type:'Strength',name:'Kracht',durationMinutes:30,planType:'strength',rpe:'3/10'}},activities:{a:{id:'a',date:'2026-10-12',type:'Yoga',durationMinutes:30,perceivedExertion:3}}});
  assert.equal(f.c.activityPlanCandidates(f.c.normalizeSyncedActivity({id:'a',date:'2026-10-12',type:'Yoga',durationMinutes:30})).length,0);
  f.c.rebuildActivityPlanAssignments();
  assert.notEqual(f.c.assignmentForActivity('a')?.status,'complete');
  assert.equal(f.c.syncedSportFamily('Mobility'),'mobility');
  assert.equal(f.c.syncedSportFamily('WeightTraining'),'strength');
  assert.equal(f.c.sameRecordedActivity({id:'a',externalId:'same',type:'Yoga'},{id:'b',externalId:'same',type:'WeightTraining'}),false);
});


// Exercise the rolling coordinator together with the real matcher and week engine.
function rollingFixture(options={}){
  const f=fixture(options),c=f.c;
  Object.assign(c,{
    getProfile:()=>({days:4,maxHr:185,z2Hr:140}),
    mondayOf:d=>addDays(d,-((new Date(d+'T12:00:00Z').getUTCDay()+6)%7)),
    seasonBlockForWeek:()=>({label:'Opbouw',volumeFactor:1}),
    estimatedWorkoutMinutes:w=>w.durationMinutes||Number(w.distanceKm||0)*5.5,
    calibrationValue:()=>null,calibrationState:()=>({values:{run:{},ride:{},swim:{}}}),
    todayAvailabilityInfo:()=>c.availabilityForDate('2026-10-12'),
    createTodayRecommendation:()=>({kind:'keep'}),
    recordCoachChange:(kind,r)=>{(f.stored.history||=[]).push({kind,...r});},
    RECOVERY_CHECK_KEY:'recovery',SUPPORT_DONE_KEY:'supportDone',SUPPORT_SETTINGS_KEY:'supportSettings'
  });
  vm.runInContext(fs.readFileSync('js/rolling-coach.js','utf8'),c);
  return f;
}
test('rolling coach creates seven concrete days, keeps forecasts out of calendar and is idempotent',()=>{
  const f=rollingFixture();assert.equal(f.c.rollingCoachRun(),true);
  assert.ok(Object.keys(f.custom).length>0);
  assert.ok(Object.keys(f.custom).every(d=>d>='2026-10-12'&&d<='2026-10-18'));
  const before=JSON.stringify(f.custom);assert.equal(f.c.rollingCoachRun(),false);
  assert.equal(JSON.stringify(f.custom),before);
  assert.equal(f.stored.jp_rolling_coach_v1.forecast.length,3);
  assert.equal(f.stored.jp_rolling_coach_v1.reviews.length,1);
});
test('weekly catch-up records only one evaluation after opening repeatedly',()=>{
  const f=rollingFixture();f.c.rollingCoachRun();
  vm.runInContext('syncedActivities.a={id:"a",date:"2026-10-11",type:"Ride",durationMinutes:30}',f.c);
  f.c.rollingCoachRun();assert.equal(f.stored.jp_rolling_coach_v1.reviews.length,1);
  assert.equal(f.stored.history.filter(h=>h.kind==='Weekevaluatie').length,1);
});
test('rolling coach adapts today to pain and never modifies completed or locked sessions',()=>{
  const f=rollingFixture({workouts:{'2026-10-12':run('Today'),'2026-10-13':{...run('Locked','quality'),locked:true},'2026-10-14':run('Done')}});
  f.done['2026-10-14']={identity:'Done|Run'};
  f.c.latestDiaryRecoverySignal=()=>({level:'elevated',complaint:true,reason:'Pain'});
  f.c.rollingCoachRun();assert.equal(f.custom['2026-10-12'].type,'Rest');
  assert.equal(f.c.allWorkouts()['2026-10-13'].name,'Locked');assert.equal(f.c.allWorkouts()['2026-10-14'].name,'Done');
  assert.ok(f.stored.jp_rolling_coach_v1.conflicts.some(s=>s.includes('vrij')));
});
test('rolling undo includes today but refuses to overwrite newly completed work',()=>{
  const f=rollingFixture({workouts:{'2026-10-12':run('Today')},minutes:{'2026-10-12':0}});
  f.c.rollingCoachRun();assert.equal(f.custom['2026-10-12'].type,'Rest');
  f.c.undoAutomaticWeekReplan();assert.equal(f.c.allWorkouts()['2026-10-12'].name,'Today');
  assert.equal(f.c.autoWeekReplanEnabled(),false);
});
test('extra three-hour bike ride changes today running, repeated import does not add load',()=>{
  const f=rollingFixture({workouts:{'2026-10-12':run('Intervals','quality')},activities:{b:{id:'b',date:'2026-10-11',type:'Ride',durationMinutes:180,perceivedExertion:7}}});
  f.c.rollingCoachRun();assert.notEqual(f.c.allWorkouts()['2026-10-12'].planType,'quality');
  const before=JSON.stringify(f.custom);assert.equal(f.c.rollingCoachRun(),false);assert.equal(JSON.stringify(f.custom),before);
});
test('triathlon mode seeds all three disciplines within daily time and without inventing measured zones',()=>{
  const f=rollingFixture();f.stored.jp_rolling_settings_v1={mode:'triathlon',runDays:3,rideDays:2,swimDays:1};
  f.c.rollingCoachRun();const workouts=Object.values(f.custom);
  for(const type of ['Run','Ride','Swim'])assert.ok(workouts.some(w=>w.type===type),type);
  assert.ok(workouts.every(w=>f.c.weekReplanFitsAvailability(w,w.date)));
  assert.ok(workouts.every(w=>!w.zoneReference));
  assert.ok(workouts.length<=6);
});
test('structured intervals shorten repetitions and exported recipe consistently',()=>{
  const f=rollingFixture();const w=f.c.rollingCoachSession('Run','2026-10-13',50,'quality');
  const short=f.c.weekReplanShortenToAvailability(w,w.date,{available:true,maxMinutes:30});
  assert.equal(short.rollingDose.reps,2);assert.equal(short.durationMinutes,29);
  assert.match(short.name,/2 × 5/);assert.match(short.intervalsDescription,/Main set 2x/);
  assert.equal(w.rollingDose.reps,4);
});
test('configured recovery gap and taper survive rolling generation and locked conflict is explained',()=>{
  const f=rollingFixture({workouts:{'2026-10-13':run('Intervals','quality'),'2026-10-15':run('Long','long'),'2026-10-17':{...run('Locked'),locked:true}},minutes:{'2026-10-17':0}});
  f.stored.jp_rolling_settings_v1={gap:3};
  f.c.races.r={date:'2026-10-18',name:'Race',priority:'A',distanceKm:21};
  f.c.rollingCoachRun();
  assert.ok(Object.values(f.custom).every(w=>!f.c.weekReplanIsStressWorkout(w)));
  assert.equal(f.c.allWorkouts()['2026-10-17'].name,'Locked');
  assert.ok(f.stored.jp_rolling_coach_v1.conflicts.length);
});
test('growth cap is based on actual history, never on aspirational weekly volume',()=>{
  const activities={};for(let i=1;i<=21;i+=2)activities[i]={id:String(i),date:addDays('2026-10-12',-i),type:'Run',durationMinutes:30};
  const f=rollingFixture({activities});f.stored.jp_rolling_settings_v1={growth:5};
  const budget=f.c.rollingCoachHistory('2026-10-12').budgets.run;
  assert.equal(budget.known,true);assert.ok(budget.minutes<=116);
  f.c.rollingCoachRun();assert.ok(Object.values(f.custom).reduce((n,w)=>n+f.c.rollingCoachMinutes(w),0)<=budget.minutes);
});
test('changed activity re-evaluates without duplicating weekly review and stale tab never writes',()=>{
  const f=rollingFixture({activities:{a:{id:'a',date:'2026-10-11',type:'Run',durationMinutes:30}}});
  f.c.rollingCoachRun();const first=f.stored.jp_rolling_coach_v1.signature;
  vm.runInContext('syncedActivities.a.durationMinutes=90',f.c);f.c.rollingCoachRun();
  assert.notEqual(f.stored.jp_rolling_coach_v1.signature,first);
  const before=JSON.stringify(f.custom);vm.runInContext('rollingCoachStale=true;syncedActivities.a.durationMinutes=180',f.c);
  assert.equal(f.c.rollingCoachRun(),false);assert.equal(JSON.stringify(f.custom),before);
});
test('automatic off/on is a meaningful trigger and repeated queued callers coalesce',async()=>{
  const f=rollingFixture();f.stored.jaco_auto_week_replan_v1='off';f.c.rollingCoachRun();assert.equal(Object.keys(f.custom).length,0);
  f.stored.jaco_auto_week_replan_v1='on';f.c.requestRollingCoachUpdate();f.c.requestRollingCoachUpdate();await Promise.resolve();await Promise.resolve();
  assert.ok(Object.keys(f.custom).length>0);assert.equal(f.stored.jp_rolling_coach_v1.reviews.length,1);
});
