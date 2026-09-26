const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync('js/app.js','utf8');
const week=fs.readFileSync('js/adaptive-week-replanner.js','utf8');
const numberCode=app.slice(app.indexOf('function finiteNumberOrNull('),app.indexOf('function coachDiaryEntries('));
const signalCode=app.slice(app.indexOf('function latestDiaryRecoverySignal('),app.indexOf('function buildDiaryContext('));
const recommendationCode=app.slice(app.indexOf('function createTodayRecommendation('),app.indexOf('function todayWeekStartDate('));
const days=(a,b)=>Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000);
const addDays=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};

function signal(entries,today='2026-09-26'){
  const context=vm.createContext({calendarDayDifference:days});
  vm.runInContext(numberCode+signalCode,context);
  return context.latestDiaryRecoverySignal(entries,today);
}

test('recent diary uses combined feedback; planned hard effort alone stays stable',()=>{
  const ordinary=signal({'2026-09-25':{sessionRpe:9,legs:2,energy:4,complaintSeverity:0}});
  assert.equal(ordinary.level,'stable');
  const heavy=signal({'2026-09-25':{sessionRpe:9,legs:4,energy:2,complaintSeverity:0}});
  assert.equal(heavy.level,'elevated');
  assert.equal(heavy.complaint,false);
  assert.equal(signal({'2026-09-25':{sessionRpe:8,legs:4,energy:3,complaintSeverity:0}}).level,'attention');
  const complaint=signal({'2026-09-26':{sessionRpe:5,legs:2,energy:4,complaintSeverity:2}});
  assert.equal(complaint.level,'elevated');
  assert.equal(complaint.complaint,true);
  assert.equal(signal({'2026-09-23':{sessionRpe:9,legs:5,energy:1,complaintSeverity:3}}).level,'unknown');
  assert.equal(signal({'2026-09-27':{sessionRpe:9,legs:5,energy:1,complaintSeverity:3}}).level,'unknown');
});

test('day advice preserves a finished workout and race; complaint proposes rest otherwise',()=>{
  let completed=false;
  const context=vm.createContext({
    todayDateString:()=> '2026-09-26',
    workoutWasCompleted:()=>completed,
    latestDiaryRecoverySignal:()=>({level:'elevated',complaint:true,reason:'duidelijke klachten'}),
    buildLoadMonitor:()=>({level:'stable'}),
    seasonBlockForDate:()=>null,
    isHardWorkout:()=>true,
    isLongWorkout:()=>false
  });
  vm.runInContext(recommendationCode,context);
  const args=[{level:'good'},null,{phase:'build'},{available:true,maxMinutes:60},null,{level:'stable'}];
  assert.equal(context.createTodayRecommendation(...args).workout.type,'Rest');
  const run={type:'Run',name:'Intervals',displaySteps:[]};
  completed=true;
  assert.equal(context.createTodayRecommendation(...args.slice(0,4),run,args[5]).kind,'keep');
  assert.equal(context.createTodayRecommendation(...args.slice(0,4),{...run,type:'Race'},args[5]).kind,'keep');
});

function weekContext(diary,options={}){
  const today=options.today||'2026-09-24';
  const workouts=options.workouts||{
    '2026-09-25':{date:'2026-09-25',type:'Run',planType:'quality',name:'Intervals',distanceKm:10,rpe:'8/10'},
    '2026-09-26':{date:'2026-09-26',type:'Run',planType:'easy',name:'Rustig 8 km',distanceKm:8,rpe:'3/10'},
    '2026-09-27':{date:'2026-09-27',type:'Race',name:'Wedstrijd',distanceKm:10}
  };
  const context=vm.createContext({
    todayDateString:()=>today,
    mondayOf:date=>addDays(date,-((new Date(date+'T12:00:00Z').getUTCDay()+6)%7)),addDays,
    allWorkouts:()=>workouts,doneWorkouts:options.doneWorkouts||{},races:options.races||{},
    completionMarkerMatches:()=>false,trainingExecutionForDate:()=>({matched:false}),
    calendarDayDifference:days,dateGapDays:(a,b)=>Math.abs(days(a,b)),signedDateGapDays:days,
    determineReadiness:()=>options.readiness||({level:'unknown',sufficientData:false}),getWellnessSnapshot:()=>({}),
    buildLoadMonitor:()=>({level:'stable'}),buildAdaptiveExecutionFeedback:()=>({level:'unknown'}),
    getRaceFocus:()=>options.focusRace||null,getPrimaryARace:()=>options.primaryGoal||null,
    classifyRacePhase:()=>({phase:'general'}),
    latestDiaryRecoverySignal:()=>diary,
    getProfile:()=>({availability:options.availability||{},z2Hr:140}),
    defaultAvailability:()=>Object.fromEntries(['mon','tue','wed','thu','fri','sat','sun'].map(key=>[key,{available:true,maxMinutes:90}])),
    DAY_KEYS:['mon','tue','wed','thu','fri','sat','sun'],
    weekdayIndexFromDate:date=>(new Date(date+'T12:00:00Z').getUTCDay()+6)%7,
    fitsTime:()=>true,isHardWorkout:w=>w?.planType==='quality',isLongWorkout:()=>false,
    finiteNumberOrNull:v=>v==null||v===''?null:Number(v),
    raceTaperDays:race=>race.priority==='C'?0:7,raceRecoveryDays:()=>2,
    document:{getElementById:()=>({className:'',textContent:''})},
    confirm:()=>{throw Error('Stale proposal must not ask for confirmation');},
    saveObject:()=>{throw Error('Stale proposal must not write');}
  });
  vm.runInContext(week,context);
  return {context,proposal:context.buildAdaptiveWeekReplan()};
}

test('week proposal replaces next quality with rest for complaints and preserves race',()=>{
  const {proposal}=weekContext({level:'elevated',complaint:true,reason:'duidelijke klachten'});
  assert.equal(proposal.stress.level,'elevated');
  assert.equal(proposal.schedule['2026-09-25'].type,'Rest');
  assert.equal(proposal.schedule['2026-09-27'].type,'Race');
  assert.equal(proposal.changes.length,1);
  assert.equal(proposal.changes[0].date,'2026-09-25');
  assert.equal(weekContext({level:'stable',complaint:false,reason:''}).proposal.changes.length,0);
});

test('changed feedback invalidates a previously shown week proposal before applying',()=>{
  const {context}=weekContext({level:'elevated',complaint:true,reason:'duidelijke klachten'});
  const status={className:'',textContent:''};
  context.document.getElementById=()=>status;
  context.latestDiaryRecoverySignal=()=>({level:'stable',complaint:false,reason:''});
  vm.runInContext('renderAdaptiveWeekReplanner=()=>{}',context);
  context.applyAdaptiveWeekReplan();
  assert.match(status.textContent,/veranderd door nieuwe gegevens/);
});

test('Sunday check-in adjusts Monday across the week boundary and preserves the goal race',()=>{
  const goal={name:'Halve marathon Amsterdam',date:'2026-10-18',priority:'A'};
  const focus={name:'Testwedstrijd',date:'2026-10-03',priority:'C'};
  const workouts={
    '2026-09-28':{type:'Run',planType:'quality',name:'Drempel',distanceKm:12,rpe:'8/10'},
    '2026-09-29':{type:'Run',planType:'easy',name:'Easy',distanceKm:8,rpe:'3/10'},
    '2026-10-03':{type:'Race',name:'Testwedstrijd',distanceKm:5}
  };
  const {proposal}=weekContext({level:'elevated',complaint:true,reason:'duidelijke klachten'},
    {today:'2026-09-27',workouts,focusRace:focus,primaryGoal:goal});
  assert.equal(proposal.bounds.weekEnd,'2026-09-27');
  assert.equal(proposal.bounds.end,'2026-10-04');
  assert.equal(proposal.schedule['2026-09-28'].type,'Rest');
  assert.equal(proposal.schedule['2026-10-03'].type,'Race');
  assert.equal(proposal.focusRace.name,focus.name);
  assert.equal(proposal.primaryGoal.name,goal.name);
});

test('Saturday quality keeps Sunday and Monday from becoming back-to-back stress',()=>{
  const workouts={
    '2026-09-26':{type:'Run',planType:'quality',name:'Zware zaterdag',distanceKm:13},
    '2026-09-27':{type:'Run',planType:'quality',name:'Zware zondag',distanceKm:10},
    '2026-09-28':{type:'Run',planType:'easy',name:'Rustig maandag',distanceKm:7}
  };
  const {proposal}=weekContext({level:'stable',complaint:false,reason:''},
    {today:'2026-09-26',workouts});
  assert.notEqual(proposal.schedule['2026-09-27'].planType,'quality');
  assert.equal(proposal.schedule['2026-09-28'].planType,'quality');
});

test('availability may move an easy run from Sunday to Monday without inventing load',()=>{
  const workouts={
    '2026-09-27':{type:'Run',planType:'easy',name:'Easy zondag',distanceKm:8},
    '2026-09-28':{type:'Rest',planType:'rest',name:'Rust maandag'}
  };
  const {proposal}=weekContext({level:'stable',complaint:false,reason:''},{
    today:'2026-09-26',workouts,
    availability:{sun:{available:false,maxMinutes:0}}
  });
  assert.equal(proposal.schedule['2026-09-27'].type,'Rest');
  assert.equal(proposal.schedule['2026-09-28'].name,'Easy zondag');
});

test('missed quality does not cross into the new week; nearby race remains protected',()=>{
  const missed={
    '2026-09-26':{type:'Run',planType:'quality',name:'Gemist interval',distanceKm:10},
    '2026-09-28':{type:'Run',planType:'easy',name:'Easy maandag',distanceKm:8}
  };
  const {proposal}=weekContext({level:'stable',complaint:false,reason:''},{
    today:'2026-09-27',workouts:missed,
    readiness:{level:'good',sufficientData:true,score:85}
  });
  assert.equal(proposal.schedule['2026-09-28'].name,'Easy maandag');
  assert.equal(proposal.changes.length,0);

  const raceWorkouts={
    '2026-10-02':{type:'Run',planType:'quality',name:'Vrijdag hard',distanceKm:10},
    '2026-10-03':{type:'Race',name:'C-race',distanceKm:5}
  };
  const raceProposal=weekContext({level:'stable',complaint:false,reason:''},{
    today:'2026-09-27',workouts:raceWorkouts
  }).proposal;
  assert.equal(raceProposal.schedule['2026-10-02'].planType,'recovery');
  assert.equal(raceProposal.schedule['2026-10-03'].type,'Race');
});

test('empty rolling horizon is identified as missing planning',()=>{
  const {context,proposal}=weekContext({level:'unknown',complaint:false,reason:''},{
    today:'2026-09-27',workouts:{}
  });
  assert.equal(proposal.changes.length,0);
  assert.equal(context.weekReplanStatusMeta(proposal).label,'Nog geen planning');
});
