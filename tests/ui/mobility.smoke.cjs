// Run: NODE_PATH=<directory containing jsdom> node tests/ui/mobility.smoke.cjs
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(html,{url:'https://jaco.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});const w=dom.window;
w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLCanvasElement.prototype.getContext=()=>null;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
w.confirm=()=>true;w.prompt=()=>null;w.fetch=async(url)=>({ok:url==='/api/workouts',status:url==='/api/workouts'?200:503,json:async()=>url==='/api/workouts'?{workouts:{}}:{error:'Test offline'}});
const scripts=[...html.matchAll(/<script src="\/([^?]+)\?/g)].map(m=>m[1]);
w.eval(scripts.map(f=>fs.readFileSync(f,'utf8')).join('\n')+`\nwindow.mobTest={
 seed(){const date=todayDateString();customWorkouts={};serverWorkouts={};races={};profile.availability=Object.fromEntries(DAY_KEYS.map(k=>[k,{available:true,maxMinutes:90,preference:'rustig'}]));profile.weeklyAvailability={};saveObject(SUPPORT_SETTINGS_KEY,{enabled:false,strength:[],mobility:[],autoPlace:false});},
 tick(seconds){mobilityActive.startedAt=Date.now()-seconds*1000;mobilityTick();},
 state:()=>mobilityActive,
 before:()=>JSON.stringify({customWorkouts,races}),
 backup:()=>validateBackupPayload(buildLocalBackupPayload())
};`);
const wait=()=>new Promise(r=>setTimeout(r,40));
(async()=>{
 await wait();w.mobTest.seed();const d=w.document,today=w.todayDateString(),before=w.mobTest.before();
 w.openMobilityLibrary();assert.equal(d.querySelector('.view.active').id,'library');assert.equal(d.querySelectorAll('.mob-routine').length,8);assert.equal(d.querySelectorAll('.mob-exercise').length,19);
 assert.equal(d.querySelectorAll('#mobilityLibrary iframe').length,0);
 w.mobilityPlanDialog('ankles');const form=d.querySelector('#mobPlanForm');form.elements.minutes.value='5';form.dispatchEvent(new w.Event('submit',{cancelable:true}));
 assert.equal(d.querySelector('#mobilityDialog').open,false);assert.ok(w.currentSupportSessions(today).some(s=>s.kind==='mobility'&&!s.reason));
 w.switchView('today');w.renderSupportTraining();const start=[...d.querySelectorAll('#supportToday button')].find(b=>b.textContent==='Start begeleide sessie');assert.ok(start);start.click();
 assert.equal(d.querySelector('#mobilityDialog').open,true);assert.match(d.querySelector('.mob-phase').textContent,/links/);
 d.querySelector('#mobPause').click();w.mobTest.tick(11);assert.equal(w.mobTest.state().routine.steps[w.mobTest.state().index].phase,'work');
 d.querySelector('#mobPause').click();assert.equal(w.mobTest.state().running,false);
 w.mobilityReplace();d.querySelector('#mobReplacement').value='ankle-pump';w.mobilityReplace('ankle-pump');assert.match(d.querySelector('#mobilityTitle').textContent,/Enkel buigen/);
 d.querySelector('#mobPause').click();w.mobTest.tick(11);w.mobTest.tick(31);assert.equal(w.mobTest.state().records.at(-1).side,'links');
 w.mobilityAdvance();assert.match(d.querySelector('.mob-phase').textContent,/rechts/);
 w.mobilitySkipExercise();w.mobilityCloseDialog();assert.equal(d.querySelector('#mobilityResume').hidden,false);w.mobilityResume();assert.equal(d.querySelector('#mobilityDialog').open,true);
 w.mobilityFinish();const feedback=d.querySelector('#mobFeedbackForm');feedback.elements.feedback.value='hard';feedback.dispatchEvent(new w.Event('submit',{cancelable:true}));
 const log=JSON.parse(w.localStorage.getItem('jp_support_done_v1'))[today+':mobility'];assert.equal(log.completion,'partial');assert.equal(log.mobility.feedback,'hard');assert.equal(w.mobTest.before(),before);
 assert.doesNotThrow(()=>w.mobTest.backup());
 w.mobilityViewLog(today);assert.match(d.querySelector('#mobilityDialog').textContent,/Te zwaar/);w.mobilityCloseDialog();assert.match(d.querySelector('#mobilityHistory').textContent,/1 dagen/);
 w.openMobilityLibrary();const media=d.querySelector('[data-exercise="cat-cow"]');
 Object.defineProperty(w.navigator,'onLine',{configurable:true,value:false});media.querySelector('button').click();assert.match(media.querySelector('.mob-media-status').textContent,/offline/);assert.equal(media.querySelectorAll('iframe').length,0);
 Object.defineProperty(w.navigator,'onLine',{configurable:true,value:true});media.querySelector('button').click();const iframe=media.querySelector('iframe');assert.ok(iframe);assert.match(iframe.src,/autoplay=0/);iframe.dispatchEvent(new w.Event('error'));assert.match(media.querySelector('.mob-media-status').textContent,/niet beschikbaar/);assert.match(media.closest('.mob-exercise').textContent,/Zet handen onder schouders/);
 assert.equal(d.querySelectorAll('[id]').length,new Set([...d.querySelectorAll('[id]')].map(x=>x.id)).size);
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: 19 exercises, 8 routines, plan/start from Today, left/right, pause/resume, replace/skip, partial save, feedback, history, data preservation, lazy media, offline/error fallback, unique IDs.');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
