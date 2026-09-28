const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync('js/app.js','utf8');
const renderSeason=app.slice(app.indexOf('function renderSeasonPlanner('),
  app.indexOf('function seasonPhaseToLegacyPhase('));
const renderRaces=app.slice(app.indexOf('function renderRaces('),
  app.indexOf('function renderRaceOptions('));
const futureRaces=app.slice(app.indexOf('function futureRacesSorted('),
  app.indexOf('function getPrimaryARace('));
const seasonPlan=app.slice(app.indexOf('function buildSeasonPlan('),
  app.indexOf('function seasonBlockForDate('));

test('season planner hides empty metrics when there is no future race',()=>{
  const card={hidden:false};
  const context=vm.createContext({
    document:{getElementById:id=>id==='seasonCurrentBlock'?{}:
      id==='seasonPlannerCard'?card:null},
    buildSeasonPlan:()=>({primaryTarget:null}),
    seasonBlockForDate:()=>{throw Error('No target should stop the calculation');}
  });
  vm.runInContext(renderSeason,context);
  context.renderSeasonPlanner();
  assert.equal(card.hidden,true);
});

test('race overview explains missing goals and shows upcoming races before history',()=>{
  const list={innerHTML:''},status={textContent:''},disclosure={open:false,dataset:{}};
  const races={};
  const context=vm.createContext({
    races,document:{getElementById:id=>({raceList:list,raceOverviewStatus:status,
      raceFormDisclosure:disclosure})[id]},
    daysUntil:date=>date>='2026-09-28'?1:-1,
    futureRacesSorted:()=>Object.values(races).filter(race=>race.date>='2026-09-28'),
    safe:value=>String(value??''),formatRaceDistance:km=>`${km} km`,
    fullDate:new Intl.DateTimeFormat('nl-NL',{timeZone:'UTC'})
  });
  vm.runInContext(renderRaces,context);
  context.renderRaces();
  assert.match(status.textContent,/Nog geen wedstrijden op dit toestel/);
  assert.equal(disclosure.open,true);
  races.old={id:'old',name:'Eerdere race',date:'2026-09-20',distanceKm:10,priority:'C'};
  races.next={id:'next',name:'Komend doel',date:'2026-10-18',distanceKm:21.0975,priority:'A'};
  context.renderRaces();
  assert.match(status.textContent,/1 komende wedstrijd/);
  assert.ok(list.innerHTML.indexOf('Komend doel')<list.innerHTML.indexOf('Eerdere race'));
  assert.match(list.innerHTML,/Eerdere wedstrijden \(1\)/);
});

test('a calendar Race becomes a provisional upcoming goal without duplication',()=>{
  const races={};
  const workouts={'2026-10-18':{type:'Race',name:'Halve Marathon Amsterdam',distanceKm:21.0975,
    importedPlan:true}};
  const context=vm.createContext({races,allWorkouts:()=>workouts,calendarDayNumber:()=>1,
    daysUntil:date=>date>='2026-09-28'?20:-1});
  vm.runInContext(futureRaces,context);
  const detected=context.futureRacesSorted();
  assert.equal(detected.length,1);
  assert.equal(detected[0].name,'Halve Marathon Amsterdam');
  assert.equal(detected[0].priority,'C');
  assert.equal(detected[0].calendarSource,true);
  races.official={id:'official',date:'2026-10-18',name:'Amsterdam',priority:'A',distanceKm:21.0975};
  const after=context.futureRacesSorted();
  assert.equal(after.length,1);
  assert.equal(after[0].id,'official');
});

test('season blocks use a future calendar Race while its priority is unconfirmed',()=>{
  const race={id:'calendar-2026-10-18',date:'2026-10-18',name:'Halve Marathon Amsterdam',
    priority:'C',distanceKm:21.0975,calendarSource:true};
  const addDays=(date,days)=>{
    const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);
    return d.toISOString().slice(0,10);
  };
  const context=vm.createContext({races:{},todayDateString:()=> '2026-09-28',
    futureRacesSorted:()=>[race],addDays,signedDateGapDays:()=>20,
    raceRecoveryDays:()=>3,raceTaperDays:()=>5,
    seasonSpecificDaysForRace:()=>7,seasonBuildDaysForRace:()=>7,
    pushSeasonBlock:(blocks,phase,start,end,targetRace)=>blocks.push({
      phase,start,end,targetRace
    })});
  vm.runInContext(seasonPlan,context);
  const plan=context.buildSeasonPlan();
  assert.equal(plan.primaryTarget.name,'Halve Marathon Amsterdam');
  assert.equal(plan.provisional,true);
  assert.ok(plan.blocks.some(block=>block.phase==='race' && block.start==='2026-10-18'));
});

test('calendar races in the overview can be confirmed as a goal',()=>{
  const list={innerHTML:''},status={textContent:''},disclosure={open:false,dataset:{}};
  const race={id:'calendar-2026-10-18',date:'2026-10-18',name:'Halve Marathon Amsterdam',
    priority:'C',distanceKm:21.0975,calendarSource:true};
  const context=vm.createContext({races:{},futureRacesSorted:()=>[race],
    document:{getElementById:id=>({raceList:list,raceOverviewStatus:status,
      raceFormDisclosure:disclosure})[id]},daysUntil:()=>20,
    safe:value=>String(value??''),formatRaceDistance:km=>`${km} km`,
    fullDate:new Intl.DateTimeFormat('nl-NL',{timeZone:'UTC'})});
  vm.runInContext(renderRaces,context);
  context.renderRaces();
  assert.match(status.textContent,/uit je trainingskalender/);
  assert.match(list.innerHTML,/Kies als doel/);
  assert.doesNotMatch(list.innerHTML,/Verwijder/);
  assert.equal(disclosure.open,false);
});
