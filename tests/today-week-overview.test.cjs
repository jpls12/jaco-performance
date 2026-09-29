const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('js/app.js','utf8');
const renderer=source.slice(source.indexOf('function renderTodayWeekOverview()'),
  source.indexOf('function dailyTrainingIcon('));
const keys=['mon','tue','wed','thu','fri','sat','sun'];
const names=['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag'];
const addDays=(date,n)=>{const value=new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate()+n);return value.toISOString().slice(0,10);};

function setup(today,start,workouts={},saved=true){
  const root={innerHTML:''};
  const summary={textContent:''};
  const title={textContent:''};
  const toggle={textContent:'',state:'false',
    getAttribute(name){return name==='aria-expanded'?this.state:null;},
    setAttribute(name,value){if(name==='aria-expanded') this.state=value;}};
  const fields={todayWeekOverviewDays:root,todayWeekOverviewSummary:summary,
    todayWeekOverviewTitle:title,toggleTodayWeekOverview:toggle};
  const context=vm.createContext({
    document:{getElementById:id=>fields[id]},DAY_KEYS:keys,DAY_NAMES:names,
    todayWeekStartDate:()=>start,todayDateString:()=>today,allWorkouts:()=>workouts,
    weeklyAvailabilityComplete:()=>saved,weekdayIndexFromDate:date=>(new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7,
    addDays,availabilityForDate:()=>({available:true,maxMinutes:60}),
    workoutWasCompleted:()=>false,estimatedWorkoutMinutes:()=>90,
    safe:text=>text,escapeHtmlAttribute:text=>text
  });
  vm.runInContext(renderer,context);
  return{context,root,summary,title,toggle};
}

test('the current week initially shows today and up to two next days',()=>{
  const {context,root,toggle,summary}=setup('2026-09-29','2026-09-28',{
    '2026-09-29':{name:'Tempo',type:'Run'}
  });
  context.renderTodayWeekOverview();
  assert.equal((root.innerHTML.match(/class="today-week-overview-day/g)||[]).length,7);
  assert.equal((root.innerHTML.match(/hidden\s+onclick/g)||[]).length,4);
  assert.match(root.innerHTML,/Tijdconflict/);
  assert.match(summary.textContent,/1 tijdconflict/);
  context.toggleTodayWeekOverview();
  assert.equal(toggle.state,'true');
  assert.doesNotMatch(root.innerHTML,/hidden\s+onclick/);
});

test('Sunday previews the next week and does not report conflicts without saved availability',()=>{
  const {context,root,title,summary}=setup('2026-10-04','2026-10-05',{
    '2026-10-05':{name:'Easy',type:'Run'}
  },false);
  context.renderTodayWeekOverview();
  assert.equal(title.textContent,'Volgende week');
  assert.match(root.innerHTML,/2026-10-05/);
  assert.doesNotMatch(root.innerHTML,/Tijdconflict/);
  assert.match(summary.textContent,/Tijd nog invullen/);
});
