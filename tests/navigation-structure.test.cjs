const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

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
