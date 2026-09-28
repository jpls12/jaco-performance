const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync('js/app.js','utf8');
const weekly=app.slice(app.indexOf('const WEEKLY_PLAN_UNDO_KEY='),
  app.indexOf('function defaultAvailability('))+
  app.slice(app.indexOf('function weeklyAvailabilityStart('),
  app.indexOf('function availabilityPreferenceOptions('));
const availableDays=app.slice(app.indexOf('function availableDaysForPlanner('),
  app.indexOf('function workoutDurationEstimate('));
const keys=['mon','tue','wed','thu','fri','sat','sun'];
const addDays=(date,n)=>{const d=new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const mondayOf=date=>addDays(date,-((new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7));
const weekdayIndexFromDate=date=>(new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7;

function contextFor(profile={}){
  const context=vm.createContext({
    DAY_KEYS:keys,DAY_NAMES:['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag'],
    addDays,mondayOf,weekdayIndexFromDate,todayDateString:()=> '2026-09-28',
    getProfile:()=>profile,
    defaultAvailability:()=>Object.fromEntries(keys.map(key=>[key,{
      available:true,maxMinutes:75,preference:'rustig',daypart:'avond',priority:'should'
    }]))
  });
  vm.runInContext(weekly+availableDays,context);
  return context;
}

test('a week override applies only to its dates and keeps the recurring pattern intact',()=>{
  const profile={weeklyAvailability:{'2026-10-05':{
    mon:0,tue:120,wed:30,thu:0,fri:60,sat:180,sun:0
  }}};
  const ctx=contextFor(profile);
  assert.equal(ctx.weeklyAvailabilityStart('2026-10-04'),'2026-10-05');
  assert.equal(ctx.weeklyAvailabilityStart('2026-10-05'),'2026-10-05');
  assert.equal(ctx.availabilityForDate('2026-10-05').available,false);
  assert.equal(ctx.availabilityForDate('2026-10-06').maxMinutes,120);
  assert.equal(ctx.availabilityForDate('2026-10-12').maxMinutes,75);
  assert.deepEqual(Array.from(ctx.availableDaysForPlanner('2026-10-05'),d=>d.key),
    ['tue','fri','sat']);
  assert.equal(ctx.availabilityForDate('2026-10-07').maxMinutes,30);
});

test('a positive weekly slot makes a normally blocked day available',()=>{
  const ctx=contextFor({availability:{mon:{available:false,maxMinutes:0,preference:'rust'}},
    weeklyAvailability:{'2026-10-05':{mon:90}}});
  const monday=ctx.availabilityForDate('2026-10-05');
  assert.equal(monday.available,true);
  assert.equal(monday.preference,'rustig');
  assert.equal(monday.maxMinutes,90);
});

test('copying the prior week fills the sliders and marks changes as unsaved',()=>{
  const previous={mon:0,tue:60,wed:30,thu:90,fri:0,sat:150,sun:45};
  const ctx=contextFor({weeklyAvailability:{'2026-09-28':previous}});
  const inputs=Object.fromEntries(keys.map(key=>[`weekly-minutes-${key}`,
    {value:'75',nextElementSibling:{textContent:''}}]));
  const status={textContent:'',className:''};
  const root={dataset:{week:'2026-10-05',initial:JSON.stringify(keys.map(()=>75))}};
  ctx.document={getElementById:id=>({weeklyAvailabilityDate:{value:'2026-10-05'},
    weeklyAvailabilityDays:root,weeklyAvailabilityStatus:status,...inputs})[id]};
  ctx.copyPreviousAvailability();
  assert.equal(inputs['weekly-minutes-mon'].nextElementSibling.textContent,'Rust');
  assert.equal(inputs['weekly-minutes-sat'].value,150);
  assert.equal(ctx.weeklyAvailabilityDirty(),true);
  assert.match(status.textContent,/nog niet opgeslagen/);
});

test('a cancelled week change restores the selected date with unsaved edits',()=>{
  const ctx=contextFor({});
  const field={value:'2026-10-12'},root={dataset:{week:'2026-10-05',initial:JSON.stringify(keys.map(()=>60))}};
  const inputs=Object.fromEntries(keys.map(key=>[`weekly-minutes-${key}`,{value:'60'}]));
  inputs['weekly-minutes-wed'].value='90';
  ctx.document={getElementById:id=>({weeklyAvailabilityDate:field,
    weeklyAvailabilityDays:root,...inputs})[id]};
  ctx.window={confirm:()=>false};
  assert.equal(ctx.confirmWeeklyAvailabilityWeekChange(),false);
  assert.equal(field.value,'2026-10-05');
});

test('the in-app reminder clears after saving the relevant week',()=>{
  const profile={weeklyAvailability:{}};
  const banner={hidden:true},badge={hidden:true},label={textContent:''};
  const ctx=contextFor(profile);
  ctx.document={getElementById:id=>({weeklyAvailabilityPrompt:banner,
    weeklyAvailabilityBadge:badge,weeklyAvailabilityPromptText:label})[id]};
  ctx.renderWeeklyAvailabilityPrompt();
  assert.equal(banner.hidden,false);
  assert.equal(badge.hidden,false);
  assert.match(label.textContent,/2026-09-28/);
  profile.weeklyAvailability['2026-09-28']=Object.fromEntries(keys.map(key=>[key,60]));
  ctx.renderWeeklyAvailabilityPrompt();
  assert.equal(banner.hidden,true);
  assert.equal(badge.hidden,true);
});

test('saving seven days persists the week and refreshes the coach',()=>{
  let profile={availability:{},weeklyAvailability:{'2026-09-28':{mon:45}}};
  let persisted=null,refreshes=0;
  const fields=Object.fromEntries(keys.map((key,index)=>[
    `weekly-minutes-${key}`,{value:String(index*30)}
  ]));
  const status={className:'',textContent:''};
  const ctx=contextFor(profile);
  Object.assign(ctx,{
    getProfile:()=>profile,
    document:{getElementById:id=>id==='weeklyAvailabilityDate'?{value:'2026-10-05'}:
      id==='weeklyAvailabilityStatus'?status:fields[id]},
    saveObject:(key,value)=>{assert.equal(key,'jp_profile_v1');persisted=value;profile=value;},
    PROFILE_KEY:'jp_profile_v1',resetGeneratedPlannerPreviews:()=>{},
    renderWeeklyAvailabilityEditor:()=>{},renderWeeklyAvailabilityPrompt:()=>{},
    renderPlanningPreview:()=>{},renderFullSeasonSchedulePreview:()=>{},
    refreshDerivedCoachViews:()=>{refreshes++;},nextMonday:()=> '2026-10-05',
    autoWeekReplanEnabled:()=>true
  });
  vm.runInContext('let profile={};',ctx);
  ctx.saveWeeklyAvailability({preventDefault(){}});
  assert.equal(persisted.weeklyAvailability['2026-10-05'].thu,90);
  assert.equal(persisted.weeklyAvailability['2026-09-28'].mon,45);
  assert.equal(refreshes,1);
  assert.match(status.textContent,/Week opgeslagen/);
});

test('a new week adds only fitting sessions and protects race days',()=>{
  let profile={availability:{}};
  const stored=[],status={className:'',textContent:''};
  const fields=Object.fromEntries(keys.map(key=>[`weekly-minutes-${key}`,{value:'90'}]));
  fields['weekly-minutes-sat'].value='150';
  const ctx=contextFor(profile);
  Object.assign(ctx,{
    getProfile:()=>profile,
    document:{getElementById:id=>id==='weeklyAvailabilityDate'?{value:'2026-10-05'}:
      id==='weeklyAvailabilityStatus'?status:fields[id]},
    saveObject:(key,value)=>{stored.push(key);if(key==='jp_profile_v1') profile=value;},
    PROFILE_KEY:'jp_profile_v1',STORAGE_KEY:'jp_custom_workouts_v1',
    resetGeneratedPlannerPreviews:()=>{},renderWeeklyAvailabilityEditor:()=>{},
    renderWeeklyAvailabilityPrompt:()=>{},renderPlanningPreview:()=>{},
    renderFullSeasonSchedulePreview:()=>{},refreshDerivedCoachViews:()=>{},
    refreshAfterCalendarMutation:()=>{},nextMonday:()=> '2026-10-05',
    autoWeekReplanEnabled:()=>true,
    allWorkouts:()=>({'2026-10-09':{type:'Race',name:'Wedstrijd'}}),
    weekPlanningContext:()=>({start:'2026-10-05'}),
    racesInRange:()=>[{date:'2026-10-09'}],seasonBlockForWeek:()=>null,
    buildLoadMonitor:()=>({level:'attention'}),
    createUnscheduledAiWeek:context=>{assert.equal(context.seasonLoadFactor,.9);return {};},
    assignAiWeekToAvailability:()=>({workouts:[
      {date:'2026-10-06',type:'Run',durationMinutes:70},
      {date:'2026-10-09',type:'Run',durationMinutes:60},
      {date:'2026-10-10',type:'Run',durationMinutes:175}
    ]}),
    estimatedWorkoutMinutes:workout=>workout.durationMinutes
  });
  vm.runInContext('let profile={}; let autoWeekReplanReady=true; let customWorkouts={};',ctx);
  ctx.saveWeeklyAvailability({preventDefault(){}});
  assert.deepEqual(stored,['jp_profile_v1','jp_weekly_plan_undo_v1','jp_custom_workouts_v1']);
  assert.match(status.textContent,/1 trainingen/);
  assert.match(status.textContent,/1 sessie\(s\) pasten niet/);
  assert.equal(vm.runInContext('Object.keys(customWorkouts).join(",")',ctx),'2026-10-06');
});

test('automatic planning respects the coach switch',()=>{
  let profile={};
  const status={className:'',textContent:''};
  const fields=Object.fromEntries(keys.map(key=>[`weekly-minutes-${key}`,{value:'90'}]));
  const ctx=contextFor(profile);
  Object.assign(ctx,{
    getProfile:()=>profile,
    document:{getElementById:id=>id==='weeklyAvailabilityDate'?{value:'2026-10-05'}:
      id==='weeklyAvailabilityStatus'?status:fields[id]},
    saveObject:(key,value)=>{if(key==='profile') profile=value;},PROFILE_KEY:'profile',
    resetGeneratedPlannerPreviews:()=>{},renderWeeklyAvailabilityEditor:()=>{},
    renderWeeklyAvailabilityPrompt:()=>{},renderPlanningPreview:()=>{},
    renderFullSeasonSchedulePreview:()=>{},refreshDerivedCoachViews:()=>{},
    nextMonday:()=> '2026-10-05',autoWeekReplanEnabled:()=>false,
    allWorkouts:()=>({})
  });
  vm.runInContext('let profile={}; let autoWeekReplanReady=true;',ctx);
  ctx.saveWeeklyAvailability({preventDefault(){}});
  assert.match(status.textContent,/Automatisch aanpassen staat uit/);
});

test('week overview marks a session that exceeds the saved time',()=>{
  const ctx=contextFor({weeklyAvailability:{'2026-10-05':{
    mon:0,tue:45,wed:0,thu:0,fri:0,sat:0,sun:0
  }}});
  ctx.allWorkouts=()=>({'2026-10-06':{name:'Duurloop',type:'Run',durationMinutes:70}});
  ctx.estimatedWorkoutMinutes=workout=>workout.durationMinutes;
  const rows=ctx.weeklyPlanRows('2026-10-05');
  assert.equal(rows[1].state,'tijdconflict');
  assert.equal(rows[1].availableMinutes,45);
  assert.equal(rows[0].state,'geen training');
});

test('undo removes only untouched generated sessions and pauses automatic changes',()=>{
  const data=new Map();
  const workout={name:'Rustige duurloop',type:'Run',date:'2026-10-06'};
  data.set('jp_weekly_plan_undo_v1',JSON.stringify({changes:[{date:'2026-10-06',workout}]}));
  const ctx=contextFor({});
  const custom={'2026-10-06':{...workout}};
  const undoStatus={textContent:''},button={hidden:true};
  Object.assign(ctx,{
    localStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),
      removeItem:key=>data.delete(key)},
    document:{getElementById:id=>({undoWeeklyPlan:button,weeklyPlanUndoStatus:undoStatus})[id]},
    allWorkouts:()=>custom,doneWorkouts:{},uploadedWorkouts:{},
    saveObject:()=>{},STORAGE_KEY:'workouts',AUTO_WEEK_REPLAN_KEY:'auto',
    refreshAfterCalendarMutation:()=>{},renderWeeklyPlanSummary:()=>{}
  });
  vm.runInContext('let customWorkouts={"2026-10-06":{name:"Rustige duurloop",type:"Run",date:"2026-10-06"}};',ctx);
  ctx.allWorkouts=()=>vm.runInContext('customWorkouts',ctx);
  ctx.undoWeeklyPlan();
  assert.equal(vm.runInContext('customWorkouts["2026-10-06"]',ctx),undefined);
  assert.equal(data.get('auto'),'off');
  assert.equal(data.has('jp_weekly_plan_undo_v1'),false);
});

test('undo refuses to remove an edited session',()=>{
  const workout={name:'Rustige duurloop',type:'Run',date:'2026-10-06'};
  const data=new Map([['jp_weekly_plan_undo_v1',JSON.stringify({changes:[{date:'2026-10-06',workout}]})]]);
  const status={textContent:''};
  const ctx=contextFor({});
  Object.assign(ctx,{
    localStorage:{getItem:key=>data.get(key)||null,removeItem:key=>data.delete(key)},
    document:{getElementById:id=>({undoWeeklyPlan:{hidden:false},weeklyPlanUndoStatus:status})[id]},
    doneWorkouts:{},uploadedWorkouts:{},allWorkouts:()=>vm.runInContext('customWorkouts',ctx)
  });
  vm.runInContext('let customWorkouts={"2026-10-06":{name:"Aangepaste training",type:"Run",date:"2026-10-06"}};',ctx);
  ctx.undoWeeklyPlan();
  assert.match(status.textContent,/Terugzetten gestopt/);
  assert.equal(data.has('jp_weekly_plan_undo_v1'),true);
});
