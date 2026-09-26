const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(){
  const requests=[];
  const context=vm.createContext({WORKOUTS:{},process:{env:{INTERVALS_API_KEY:'test-only',JACO_APP_PIN:'test-pin'}},Buffer,AbortController,setTimeout,clearTimeout,
    fetch:async(url,options)=>{requests.push({url,event:JSON.parse(options.body)[0]});return {ok:true,text:async()=>JSON.stringify([{id:123}])};}});
  const source=fs.readFileSync('api/upload-workout.js','utf8').replace(/^import .*;\n/,'').replace('export default async function handler','async function handler');
  vm.runInContext(source,context);
  async function upload(type,supportKind,pin='test-pin'){
    const res={status(code){this.code=code;},setHeader(){},end(body){this.body=JSON.parse(body);}};
    await context.handler({method:'POST',headers:{'x-jaco-pin':pin},body:{customWorkout:{date:'2026-09-26',name:'Test',type,supportKind,intervalsDescription:'- Exercise: 10 repeats'}}},res);
    return res;
  }
  return {upload,requests};
}
test('main, strength and mobility exports have separate stable IDs',async()=>{
  const {upload,requests}=setup();
  for(const [type,kind] of [['Run',undefined],['Strength','strength'],['Mobility','mobility'],['Strength','strength']]) assert.equal((await upload(type,kind)).code,200);
  assert.deepEqual(requests.map(r=>r.event.external_id),['jaco-performance-2026-09-26','jaco-performance-2026-09-26-support-strength','jaco-performance-2026-09-26-support-mobility','jaco-performance-2026-09-26-support-strength']);
  assert.deepEqual(requests.map(r=>r.event.type),['Run','WeightTraining','Yoga','WeightTraining']);
  assert.ok(requests.every(r=>r.url.endsWith('upsert=true')));
});
test('wrong PIN and mismatched supplementary identity never reach Intervals',async()=>{
  const {upload,requests}=setup();
  assert.equal((await upload('Strength','strength','wrong')).code,401);
  assert.equal((await upload('Run','strength')).code,400);
  assert.equal((await upload('Mobility','strength')).code,400);
  assert.equal(requests.length,0);
});
