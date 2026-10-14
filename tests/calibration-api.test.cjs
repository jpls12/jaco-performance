const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup({failStreams=false}={}){
 const requests=[];
 const c=vm.createContext({Buffer,AbortController,setTimeout,clearTimeout,process:{env:{INTERVALS_API_KEY:'test',JACO_APP_PIN:'pin'}},authorizedAppRequest:req=>req.headers?.pin==='pin',fetch:async url=>{requests.push(url);if(url.includes('/streams'))return {ok:!failStreams,status:403,json:async()=>[{type:'time',data:[0,1,2]},{type:'heartrate',data:[140,null,142]},{type:'velocity_smooth',data:[3,3,3]}]};return {ok:true,text:async()=>JSON.stringify({type:'Run',icu_intervals:[{start_time:0,end_time:100,average_heartrate:140}]})};}});
 vm.runInContext(fs.readFileSync('api/intervals-activity-detail.js','utf8').replace(/^import .*;\n/gm,'').replace('export default async function handler','async function handler'),c);
 async function call(streams='1',pin='pin'){const res={status(c){this.code=c;},setHeader(){},end(b){this.body=JSON.parse(b);}};await c.handler({method:'GET',headers:{pin},query:{activityId:'i123',streams}},res);return res;}
 return {call,requests};
}
test('streams require authentication and are fetched only for calibration',async()=>{const f=setup();assert.equal((await f.call('1','wrong')).code,401);assert.equal(f.requests.length,0);const regular=await f.call('');assert.equal(regular.body.samples,null);assert.equal(f.requests.length,1);const cal=await f.call();assert.equal(cal.body.samples[1].hr,null);assert.equal(cal.body.samples[0].speed,3);assert.equal(cal.body.samples[0].cadence,null);assert.equal(f.requests.length,3);});
test('upstream streams unavailable is explicit and ordinary lap detail still works',async()=>{const r=await setup({failStreams:true}).call();assert.equal(r.code,200);assert.equal(r.body.samples,null);assert.match(r.body.streamError,/403/);assert.equal(r.body.intervals.length,1);});
