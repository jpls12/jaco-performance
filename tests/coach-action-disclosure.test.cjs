const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

test('coach action opens its detailed result before applying a day or week change',async()=>{
  const source=fs.readFileSync('js/fully-adaptive-coach.js','utf8');
  const fn=source.slice(source.indexOf('async function applyFullyAdaptiveCoachPriority()'));
  for(const kind of ['today','week']){
    const calls=[];
    const context=vm.createContext({
      latestFullyAdaptiveCoachState:{primaryAction:{kind}},
      document:{getElementById:id=>id==='coachTechnical'?{setAttribute:(name,value)=>calls.push(['open',name,value])}:{className:'',textContent:''}},
      applyTodayRecommendation:()=>calls.push(['today']),
      applyAdaptiveWeekReplan:()=>calls.push(['week'])
    });
    vm.runInContext(fn,context);
    await context.applyFullyAdaptiveCoachPriority();
    assert.deepEqual(calls.map(c=>c[0]),['open',kind]);
  }
});
