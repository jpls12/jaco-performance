const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync('js/app.js','utf8');
const renderSeason=app.slice(app.indexOf('function renderSeasonPlanner('),
  app.indexOf('function seasonPhaseToLegacyPhase('));
const renderRaces=app.slice(app.indexOf('function renderRaces('),
  app.indexOf('function renderRaceOptions('));

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
