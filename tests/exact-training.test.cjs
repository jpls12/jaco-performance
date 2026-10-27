const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('js/app.js','utf8');
const ctx=vm.createContext({parseDateFromText:()=> '2026-10-27'});
vm.runInContext(app.slice(app.indexOf('function paceToSeconds('),app.indexOf('function secondsToPace('))+app.slice(app.indexOf('function normalizedWorkoutText('),app.indexOf('function renderExactRunDraft(')),ctx);
const input=['3 km rustig inlopen op 5:15–5:45/km',...Array(4).fill(['20 seconden ontspannen versnellen','40 seconden rustig dribbelen']).flat(),...Array(3).fill('1 km op 3:52/km'),'3 minuten rustig dribbelen',...Array(3).fill('1 km op 3:50/km'),'3 minuten rustig dribbelen',...Array(3).fill('1 km op 3:48/km'),'2 km rustig uitlopen op 5:20–6:00/km'].join('\n');
test('complete Bruggenloop workout preserves all 21 steps and export order',()=>{
 const w=ctx.parseMultiBlockRun(input), b=w.structuredBlocks;
 assert.equal(b.length,21);
 assert.equal(b[0].pace,'5:15-5:45/km');
 assert.equal(b[20].pace,'5:20-6:00/km');
 assert.equal(b[12].seconds,180);assert.equal(b[16].seconds,180);
 assert.equal(b.filter(x=>x.kind==='stride').length,4);
 assert.equal(b.filter(x=>x.kind==='recovery').length,6);
 assert.equal(b.filter(x=>x.kind==='pace').length,9);
 assert.equal(w.durationMinutes,72);
 assert.equal(w.intervalsDescription.split('\n').filter(x=>x.startsWith('- ')).length,21);
 assert.match(w.intervalsDescription,/Warmup\n- 3km 5:15-5:45\/km Pace/);
 assert.equal(w.intervalsDescription.split('- 180s Z1 Pace').length-1,2);
 assert.deepEqual(JSON.parse(JSON.stringify(b)),JSON.parse(JSON.stringify(w.editorData.structuredBlocks)));
});
test('legacy grouped strides, floats and cooldown remain supported',()=>{
 const w=ctx.parseMultiBlockRun('3 km inlopen, 4 x 20 sec strides, 3 km op 3:52/km, 1 km float op 5:15/km, 3 km op 3:52/km, 2-3 km uitlopen');
 assert.equal(w.structuredBlocks.length,6);
 assert.equal(w.structuredBlocks[1].kind,'strides');
 assert.equal(w.structuredBlocks[5].deviceKm,2);
});
