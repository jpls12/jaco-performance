const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('js/performance-model.js','utf8');
const baseline={id:'profile-10',kind:'profile',trusted:true,distance:10,
  seconds:2400,date:null,ageDays:null,source:'10 km PR',weightBase:1};
const training={id:'training-10',kind:'training',trusted:false,distance:10,
  seconds:2550,date:'2026-09-28',ageDays:1,source:'Recente training',weightBase:.35};

test('a recent intense training nudges an existing race estimate without treating it as a race',()=>{
  let evidence=[baseline];
  const ctx=vm.createContext({
    finiteNumberOrNull:n=>Number.isFinite(Number(n))?Number(n):null,
    riegelPrediction:(seconds,sourceDistance,target)=>seconds*(target/sourceDistance)**1.06
  });
  vm.runInContext(source,ctx);
  ctx.performanceModelEvidence=()=>evidence;
  const original=ctx.performanceModelPredictionForDistance(10);
  evidence=[baseline,training];
  const updated=ctx.performanceModelPredictionForDistance(10);
  assert.ok(updated.seconds>original.seconds);
  assert.ok(updated.seconds<=original.seconds*1.012);
  assert.equal(updated.confidence,original.confidence);
  assert.equal(updated.trainingSignal.evidence.date,'2026-09-28');
  evidence=[baseline,{...training,ageDays:50}];
  assert.equal(ctx.performanceModelPredictionForDistance(10).seconds,original.seconds);
});
