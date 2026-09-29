const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('js/adaptive-week-replanner.js','utf8');
const logic=source.slice(source.indexOf('function replanSavedAvailabilityWeek('),
  source.indexOf('function weekReplanRescheduleMissedQuality('));
const addDays=(date,n)=>{
  const d=new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate()+n);
  return d.toISOString().slice(0,10);
};
const gap=(a,b)=>Math.abs((Date.parse(a)-Date.parse(b))/86400000);

function setup({minutes,workouts,today='2026-09-29',uploaded={}}){
  let proposal=null;
  const context=vm.createContext({
    autoWeekReplanReady:true,autoWeekReplanEnabled:()=>true,
    todayDateString:()=>today,addDays,allWorkouts:()=>workouts,
    weekReplanDateList:(from,to)=>{const dates=[];for(let d=from;d<=to;d=addDays(d,1)) dates.push(d);return dates;},
    weekReplanClone:(w,date)=>w?{...w,date}:null,
    weekReplanIsDone:()=>false,uploadedWorkouts:uploaded,
    weekReplanFitsAvailability:(w,date)=>Number.isFinite(minutes[date]) &&
      minutes[date]>=w.durationMinutes,
    weekReplanIsStressWorkout:w=>['quality','long'].includes(w?.planType),
    weekReplanProtection:()=>({protected:false}),dateGapDays:gap,
    weekReplanAvailability:date=>({preference:date==='2026-10-04'?'herstel':'kwaliteit'}),
    weekReplanRestWorkout:date=>({date,type:'Rest',name:'Rust'}),
    weekReplanWorkoutSignature:w=>w?`${w.type}:${w.name}`:'empty',
    applyAutomaticWeekReplan:p=>{proposal=p;return true;}
  });
  vm.runInContext(logic,context);
  return{run:()=>context.replanSavedAvailabilityWeek('2026-09-28'),proposal:()=>proposal};
}

test('a blocked Saturday moves sessions around and keeps quality days separated',()=>{
  const workouts={
    '2026-09-30':{type:'Rest',name:'Rust'},
    '2026-10-01':{type:'Run',name:'Intervallen',planType:'quality',durationMinutes:46},
    '2026-10-02':{type:'Run',name:'Easy',planType:'easy',durationMinutes:41},
    '2026-10-03':{type:'Run',name:'HM specifiek',planType:'quality',durationMinutes:51},
    '2026-10-04':{type:'Run',name:'Herstel',planType:'recovery',durationMinutes:44}
  };
  const minutes={'2026-09-30':105,'2026-10-01':115,'2026-10-02':70,
    '2026-10-03':0,'2026-10-04':60};
  const fixture=setup({minutes,workouts});
  assert.equal(fixture.run().applied,true);
  const plan=fixture.proposal();
  assert.equal(plan.schedule['2026-10-03'].type,'Rest');
  const sessions=Object.entries(plan.schedule).filter(([,w])=>w?.type==='Run');
  assert.deepEqual(sessions.map(([,w])=>w.name).sort(),
    ['Easy','HM specifiek','Herstel','Intervallen'].sort());
  assert.ok(sessions.every(([date,w])=>w.durationMinutes<=minutes[date]));
  const hard=sessions.filter(([,w])=>w.planType==='quality').map(([date])=>date);
  assert.ok(gap(...hard)>=2);
});

test('never moves an already uploaded workout or sacrifices a session without room',()=>{
  const workouts={
    '2026-10-01':{type:'Run',name:'Intervals',planType:'quality',durationMinutes:55},
    '2026-10-03':{type:'Run',name:'Long',planType:'long',durationMinutes:80}
  };
  const minutes={'2026-10-01':70,'2026-10-02':90,'2026-10-03':0,'2026-10-04':0};
  const fixture=setup({minutes,workouts,uploaded:{'2026-10-01':true}});
  assert.equal(fixture.run().applied,false);
  assert.equal(fixture.proposal(),null);
});
