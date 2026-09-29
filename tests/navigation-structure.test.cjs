const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
function view(id,next){
  return html.slice(html.indexOf(`<section id="${id}" class="view`),
    next?html.indexOf(`<section id="${next}" class="view`):html.indexOf('</main>'));
}

test('daily actions, progress analysis and week tools live under their own navigation buttons',()=>{
  const today=view('today','dashboard');
  const progress=view('dashboard','calendar');
  const planning=view('planning','library');
  for(const id of ['activityResultsCard','coachChatInput','generateAiTraining'])
    assert.match(today,new RegExp(`id="${id}"`));
  for(const id of ['loadMonitorBadge','performanceTrendChart',
    'coachIntelligenceSignals','performanceModelPredictions'])
    assert.match(progress,new RegExp(`id="${id}"`));
  for(const id of ['weeklyAvailabilityDays','smartWeekPlan',
    'adaptiveBlockPlannerCard','adaptiveWeekPlan','coachHorizon'])
    assert.match(planning,new RegExp(`id="${id}"`));
  assert.doesNotMatch(today,/id="performanceTrendChart"|id="smartWeekPlan"/);
  assert.doesNotMatch(progress,/id="weekPlan"/);
  assert.match(html,/data-menu-view="dashboard"[\s\S]*?<strong>Voortgang<\/strong>/);
});

test('rearranging views keeps every element id unique',()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(ids).size,ids.length);
});

test('race shortcuts and profile sections lead to the intended controls',()=>{
  const races=view('races','planning');
  const profile=view('profile');
  for(const id of ['raceSimulationTool','raceSeasonScheduleTool','raceDebriefTool']){
    assert.match(races,new RegExp(`data-race-tool="${id}"`));
    assert.match(races,new RegExp(`id="${id}"`));
  }
  for(const id of ['profileBasics','profileFuel','profileBackup']){
    assert.match(profile,new RegExp(`href="#${id}"`));
    assert.match(profile,new RegExp(`id="${id}"`));
  }
  assert.match(profile,/<details id="profileBackup"[\s\S]*?id="backupImportPanel"/);
});

test('a race shortcut opens its panel and brings the summary into focus',()=>{
  const app=fs.readFileSync('js/app.js','utf8');
  const code=app.slice(app.indexOf('function openRaceTool('),app.indexOf('function raceCardEstimate('));
  let scrolled=false,focused=false;
  const panel={open:false,scrollIntoView:()=>{scrolled=true;},
    querySelector:()=>({focus:()=>{focused=true;}})};
  const context=vm.createContext({document:{getElementById:id=>id==='raceSimulationTool'?panel:null}});
  vm.runInContext(code,context);
  context.openRaceTool('raceSimulationTool');
  assert.equal(panel.open,true);
  assert.equal(scrolled,true);
  assert.equal(focused,true);
  context.openRaceTool('raceFormDisclosure');
  assert.equal(panel.open,true);
});
