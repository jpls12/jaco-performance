const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),errors=[];
const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(html,{url:'https://jaco.test/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
w.localStorage.setItem('jaco_auto_week_replan_v1','off');
w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){};
w.HTMLCanvasElement.prototype.getContext=()=>null;w.confirm=()=>true;w.prompt=()=>null;
w.fetch=async(url)=>({ok:url==='/api/workouts',status:url==='/api/workouts'?200:503,json:async()=>url==='/api/workouts'?{workouts:{}}:{error:'Fixture: offline'}});
const files=[...html.matchAll(/<script src="\/([^?]+)\?/g)].map(m=>m[1]);
w.eval(files.map(f=>fs.readFileSync(f,'utf8')).join('\n')+`\nwindow.rollingTest={
 seed(){customWorkouts={};serverWorkouts={};doneWorkouts={};uploadedWorkouts={};races={};syncedActivities={};activityPlanAssignments={};
 profile={...getProfile(),availability:Object.fromEntries(DAY_KEYS.map(k=>[k,{available:true,maxMinutes:90,preference:'rustig',priority:'should'}])),weeklyAvailability:{}};
 saveObject(STORAGE_KEY,customWorkouts);saveObject(DONE_KEY,doneWorkouts);saveObject(UPLOAD_KEY,uploadedWorkouts);
 saveObject(ROLLING_SETTINGS_KEY,{mode:'triathlon',runDays:3,rideDays:2,swimDays:1});
 localStorage.removeItem(ROLLING_COACH_KEY);localStorage.setItem(AUTO_WEEK_REPLAN_KEY,'on');autoWeekReplanReady=true;refreshDerivedCoachViews();},
 snapshot:()=>JSON.stringify(customWorkouts),plan:()=>allWorkouts(),
 todaySeed(){const d=todayDateString();customWorkouts[d]={date:d,name:'Today easy',type:'Run',planType:'easy',durationMinutes:40,distanceKm:7,rpe:'3/10'};saveObject(STORAGE_KEY,customWorkouts);refreshAfterCalendarMutation();},
 today:()=>todayDateString(),state:()=>loadObject(ROLLING_COACH_KEY),
 lock(){customWorkouts[todayDateString()].locked=true;saveObject(STORAGE_KEY,customWorkouts);},
 paused:()=>!autoWeekReplanEnabled()
};`);
const tick=()=>new Promise(r=>setTimeout(r,50));
(async()=>{
 await tick();w.rollingTest.seed();await tick();
 assert.ok(Object.values(w.rollingTest.plan()).some(s=>s.type==='Run'));
 assert.ok(Object.values(w.rollingTest.plan()).some(s=>s.type==='Ride'));
 assert.ok(Object.values(w.rollingTest.plan()).some(s=>s.type==='Swim'));
 assert.equal(w.rollingTest.state().forecast.length,3);
 assert.doesNotMatch(w.document.querySelector('#rollingCoachStatus').textContent,/niet bijgewerkt/);
 const first=w.rollingTest.snapshot();w.refreshDerivedCoachViews();await tick();assert.equal(w.rollingTest.snapshot(),first);
 w.rollingTest.todaySeed();await tick();w.rollingCoachQuickFeedback('pain');await tick();
 assert.equal(w.rollingTest.plan()[w.rollingTest.today()].type,'Rest');
 assert.match(w.document.querySelector('#rollingCoachChanges').textContent,/Pijn|klachten|herstel/i);
 w.undoAutomaticWeekReplan();await tick();assert.equal(w.rollingTest.paused(),true);
 assert.equal(w.rollingTest.plan()[w.rollingTest.today()].name,'Today easy');
 w.rollingCoachDone();await tick();assert.equal(w.document.querySelector('#manualCompletionReview').hidden,false);
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: whole-app initialization, automatic triathlon seed, seven-day commit, flexible forecast, stable refresh, pain action, same-day undo, optional completion review; offline APIs mocked.');
 dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
