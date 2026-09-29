const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('js/app.js','utf8');
const renderer=source.slice(source.indexOf('function renderMonth(){'),source.indexOf('function renderSelected(){'));

test('calendar month exposes a clear summary and accessible day states',()=>{
  const grid={innerHTML:''},title={textContent:''},summary={textContent:''};
  const workouts={
    '2026-09-29':{name:'Tempoloop',type:'Run'},
    '2026-09-30':{name:'Wedstrijd',type:'Race'}
  };
  const context=vm.createContext({
    document:{getElementById:id=>({calendarGrid:grid,monthTitle:title,calendarMonthSummary:summary})[id]},
    monthFmt:new Intl.DateTimeFormat('nl-NL',{month:'long',year:'numeric'}),
    fullDate:new Intl.DateTimeFormat('nl-NL',{weekday:'long',day:'numeric',month:'long',year:'numeric'}),
    visibleMonth:new Date(2026,8,1),selectedDate:'2026-09-29',
    todayDateString:()=> '2026-09-29',allWorkouts:()=>workouts,
    workoutState:(date,workout)=>workout.type==='Race'?'race':'done',
    workoutUploadIsCurrent:()=>false,ymd:date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,
    safe:text=>text,escapeHtmlAttribute:text=>text
  });
  vm.runInContext(renderer,context);
  context.renderMonth();
  assert.equal(summary.textContent,'2 trainingen · 1 voltooid · 1 wedstrijd');
  assert.match(grid.innerHTML,/is-done/);
  assert.match(grid.innerHTML,/is-race/);
  assert.match(grid.innerHTML,/aria-pressed="true"/);
  assert.match(grid.innerHTML,/aria-label="dinsdag 29 september 2026 · Tempoloop · voltooid"/);
});
