const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('one visible place to review training; old check-ins stay in backup',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const bootstrap=fs.readFileSync('js/bootstrap.js','utf8');
  const results=fs.readFileSync('js/activity-results.js','utf8');
  assert.match(html,/id="activityReviewForm"|id="activityResultsCard"/);
  assert.doesNotMatch(html,/id="coachDiaryCard"|id="coachDiaryForm"|href="#coachDiaryCard"/);
  assert.doesNotMatch(bootstrap,/getElementById\("coachDiaryForm"\)/);
  assert.doesNotMatch(results,/id="openResultDiary"/);
  assert.match(html,/id="backupCurrentDiary"/);
});

test('completed-day action opens the matching unreviewed activity',()=>{
  const {context,activities,submit}=resultsContext();
  let opened=null;
  context.recentActivityResults=()=>Object.values(activities);
  context.selectActivityResult=id=>{opened=id;};
  assert.equal(context.openActivityReviewForDate('2026-09-26'),true);
  assert.equal(opened,'i1');
  submit('i1',{sessionRpe:7,energy:3});
  assert.equal(context.openActivityReviewForDate('2026-09-26'),true);
  assert.equal(opened,'i2');
  assert.equal(context.openActivityReviewForDate('2026-09-27'),false);
});

const routeCode=fs.readFileSync('api/intervals-activity-route.js','utf8')
  .replace('export function normalizeRouteStreams','function normalizeRouteStreams')
  .replace('export default async function handler','async function handler');

test('route normalizer keeps valid coordinates, caps preview size and handles missing GPS',()=>{
  const context=vm.createContext({});
  vm.runInContext(routeCode,context);
  const data=Array.from({length:2000},(_,i)=>51+i/100000);
  const lon=data.map((_,i)=>4+i/100000);
  const points=context.normalizeRouteStreams([{type:'latlng',data,data2:lon}]);
  assert.ok(points.length<=601);
  assert.equal(points[0][0],51);
  assert.equal(points.at(-1)[1],lon.at(-1));
  assert.equal(context.normalizeRouteStreams([{type:'heartrate',data:[150]}]).length,0);
  assert.equal(context.normalizeRouteStreams([{type:'latlng',data:[99],data2:[4]}]).length,0);
  assert.equal(context.normalizeRouteStreams({type:'latlng',data:[51],data2:[4]}).length,1);
});

test('route endpoint rejects unauthorized and malformed IDs before upstream access',async()=>{
  let fetches=0;
  const context=vm.createContext({
    process:{env:{INTERVALS_API_KEY:'secret',JACO_APP_PIN:'1234'}},
    Buffer,AbortController,setTimeout,clearTimeout,
    fetch:()=>{fetches++;throw Error('should not fetch');}
  });
  vm.runInContext(routeCode,context);
  function response(){
    return{statusCode:null,headers:{},status(code){this.statusCode=code;return this;},
      setHeader(key,value){this.headers[key]=value;},
      end(body){this.body=JSON.parse(body);return this;}};
  }
  const denied=response();
  await context.handler({method:'GET',headers:{},query:{activityId:'i123'}},denied);
  assert.equal(denied.statusCode,401);
  const invalid=response();
  await context.handler({method:'GET',headers:{'x-jaco-pin':'1234'},
    query:{activityId:'../bad'}},invalid);
  assert.equal(invalid.statusCode,400);
  assert.equal(fetches,0);
});

test('route endpoint returns bounded coordinates only and no-store response',async()=>{
  let requested='';
  const context=vm.createContext({
    process:{env:{INTERVALS_API_KEY:'secret',JACO_APP_PIN:'1234'}},
    Buffer,AbortController,setTimeout,clearTimeout,
    fetch:async url=>{
      requested=url;
      return{ok:true,json:async()=>[{type:'latlng',data:[51.9,52],data2:[4.5,4.6]}]};
    }
  });
  vm.runInContext(routeCode,context);
  const res={headers:{},status(code){this.code=code;return this;},
    setHeader(key,value){this.headers[key]=value;},
    end(body){this.body=JSON.parse(body);return this;}};
  await context.handler({method:'GET',headers:{'x-jaco-pin':'1234'},
    query:{activityId:'i987'}},res);
  assert.equal(res.code,200);
  assert.equal(res.headers['Cache-Control'],'no-store');
  assert.equal(res.body.points.length,2);
  assert.match(requested,/activity\/i987\/streams\.json\?types=latlng/);
  assert.equal(JSON.stringify(res.body).includes('secret'),false);
});

function resultsContext(){
  const activities={
    i1:{id:'i1',date:'2026-09-26',startDateLocal:'2026-09-26T08:00:00',
      name:'Easy',type:'Run',distanceKm:8,durationMinutes:40},
    i2:{id:'i2',date:'2026-09-26',startDateLocal:'2026-09-26T15:00:00',
      name:'Intervals',type:'Run',distanceKm:10,durationMinutes:46}
  };
  const diary={};
  const store={};
  const status={className:'',textContent:''};
  const context=vm.createContext({
    loadObject:()=>({}),syncedActivities:activities,coachDiary:diary,
    DIARY_KEY:'diary',saveObject:(key,value)=>{store[key]=JSON.parse(JSON.stringify(value));},
    diaryWorkoutForDate:()=>({distanceKm:10,durationMinutes:46}),
    finiteNumberOrNull:value=>value==null?null:Number(value),
    safe:value=>String(value??'').replace(/[<>]/g,''),
    resetGeneratedPlannerPreviews:()=>{},renderFullSeasonSchedulePreview:()=>{},
    refreshDerivedCoachViews:()=>{},renderCoachDiary:()=>{},todayDateString:()=> '2026-09-26',
    document:{getElementById:id=>id==='activityReviewStatus'?status:
      id==='diaryDate'?{value:'2026-09-26'}:null}
  });
  vm.runInContext(fs.readFileSync('js/activity-results.js','utf8'),context);
  const submit=(id,scores)=>{
    const elements=Object.fromEntries(Object.entries({legs:'',enjoyment:'',
      complaintSeverity:'',...scores,note:''})
      .map(([key,value])=>[key,{value:String(value),focus(){}}]));
    context.saveActivityReview({preventDefault(){},target:{
      dataset:{activityId:id},elements
    }});
  };
  context.renderActivityResults=()=>{};
  return{context,activities,diary,store,status,submit};
}

test('separate activity reviews give the day coach conservative combined feedback',()=>{
  const {diary,store,submit}=resultsContext();
  submit('i1',{sessionRpe:3,legs:2,energy:5,enjoyment:5,complaintSeverity:0});
  submit('i2',{sessionRpe:9,legs:4,energy:2,enjoyment:3,complaintSeverity:2});
  assert.equal(Object.keys(store.jp_activity_reviews_v1).length,2);
  assert.equal(diary['2026-09-26'].sessionRpe,9);
  assert.equal(diary['2026-09-26'].energy,2);
  assert.equal(diary['2026-09-26'].complaintSeverity,2);
  assert.equal(diary['2026-09-26'].workoutName,'Intervals');
});

test('quick review needs only RPE and feeling, leaving optional signals unknown',()=>{
  const {context,diary,store,submit,activities}=resultsContext();
  submit('i1',{sessionRpe:8,energy:2});
  const review=store.jp_activity_reviews_v1.i1;
  assert.equal(review.sessionRpe,8);
  assert.equal(review.energy,2);
  assert.equal(review.legs,null);
  assert.equal(review.complaintSeverity,null);
  assert.equal(diary['2026-09-26'].legs,null);
  assert.equal(diary['2026-09-26'].complaintSeverity,null);
  assert.equal(context.activityReviewInsight(activities.i1,review).tone,'attention');
  submit('i2',{sessionRpe:3,energy:5,complaintSeverity:0});
  assert.equal(diary['2026-09-26'].complaintSeverity,0);
  assert.equal(diary['2026-09-26'].energy,2);
});

test('old manual day check-in is preserved while a new review updates advice',()=>{
  const {context,diary,status,submit}=resultsContext();
  diary['2026-09-26']={sessionRpe:7,note:'Eigen beoordeling'};
  submit('i1',{sessionRpe:9,legs:5,energy:1,enjoyment:1,complaintSeverity:3});
  assert.equal(diary['2026-09-26'].sessionRpe,7);
  assert.match(status.textContent,/coachadvies is opnieuw berekend/);
  const app=fs.readFileSync('js/app.js','utf8');
  const recovery=app.slice(app.indexOf('function effectiveCoachDiary('),
    app.indexOf('function buildDiaryContext('));
  context.diaryNumber=value=>value==null?null:Number(value);
  context.calendarDayDifference=(today,date)=>
    Math.round((Date.parse(today)-Date.parse(date))/86400000);
  vm.runInContext(recovery,context);
  const signal=context.latestDiaryRecoverySignal(undefined,'2026-09-26');
  assert.equal(signal.level,'elevated');
  assert.equal(signal.complaint,true);
});

test('deleting one of two ratings keeps the remaining daily signal',()=>{
  const {context,diary,submit}=resultsContext();
  submit('i1',{sessionRpe:3,legs:2,energy:5,enjoyment:5,complaintSeverity:0});
  submit('i2',{sessionRpe:9,legs:4,energy:2,enjoyment:3,complaintSeverity:2});
  context.confirm=()=>true;
  vm.runInContext('selectedResultId="i2"',context);
  context.deleteActivityReview();
  assert.equal(diary['2026-09-26'].sessionRpe,3);
  assert.equal(diary['2026-09-26'].energy,5);
  vm.runInContext('selectedResultId="i1"',context);
  context.deleteActivityReview();
  assert.equal(diary['2026-09-26'],undefined);
});

test('backup validates per-activity scores and IDs',()=>{
  const app=fs.readFileSync('js/app.js','utf8');
  const code=app.slice(app.indexOf('function validateKnownBackupContents('),
    app.indexOf('function validateBackupPayload('));
  const context=vm.createContext({
    isPlainBackupObject:value=>Boolean(value && typeof value==='object' && !Array.isArray(value)),
    calendarDayNumber:date=>/^\d{4}-\d{2}-\d{2}$/.test(date)?1:null
  });
  vm.runInContext(code,context);
  const valid={i1:{activityId:'i1',date:'2026-09-26',sessionRpe:8,legs:3,
    energy:2,enjoyment:4,complaintSeverity:0,note:''}};
  assert.doesNotThrow(()=>context.validateKnownBackupContents('jp_activity_reviews_v1',valid));
  assert.doesNotThrow(()=>context.validateKnownBackupContents('jp_activity_reviews_v1',{
    i1:{...valid.i1,legs:null,enjoyment:null,complaintSeverity:null}
  }));
  assert.throws(()=>context.validateKnownBackupContents('jp_activity_reviews_v1',{
    i1:{...valid.i1,energy:'2'}
  }),/ongeldige gegevens/);
  assert.match(app,/DIARY_KEY,\s*"jp_activity_reviews_v1"/);
});

test('review form offers a slider, five feelings and optional details',()=>{
  const code=fs.readFileSync('js/activity-results.js','utf8');
  assert.match(code,/type="range" min="1" max="10"/);
  assert.match(code,/name="energy" value="\$\{value\}"/);
  assert.match(code,/Extra details \(optioneel\)/);
});

test('review comes before optional route and detailed metrics',()=>{
  const code=fs.readFileSync('js/activity-results.js','utf8');
  const render=code.slice(code.indexOf('function renderActivityResultDetail('),
    code.indexOf('function renderActivityIntervalRows('));
  assert.ok(render.indexOf('<form id="activityReviewForm"')<render.indexOf('<details id="activityResultMore"'));
  assert.ok(render.indexOf('<details id="activityResultMore"')<render.indexOf('id="activityRoutePreview"'));
  assert.match(render,/if\(event\.target\.open\) loadActivityRoute\(activity\)/);
});

test('heart rate suggests a starting RPE without treating it as a saved rating',()=>{
  const {context}=resultsContext();
  const profile={maxHr:185,z2Hr:145};
  const suggest=heartRate=>context.suggestedActivityRpe({averageHeartRate:heartRate},profile);
  assert.equal(suggest(120),2);
  assert.equal(suggest(140),4);
  assert.equal(suggest(153),5);
  assert.equal(suggest(161),6);
  assert.equal(suggest(169),7);
  assert.equal(suggest(177),8);
  assert.equal(suggest(180),9);
  assert.equal(suggest(null),null);
  assert.equal(suggest(240),null);
  assert.equal(context.suggestedActivityRpe({averageHeartRate:160},{maxHr:150,z2Hr:145}),null);
  const code=fs.readFileSync('js/activity-results.js','utf8');
  assert.match(code,/review\.sessionRpe\?\?hrSuggestion\?\?5/);
  assert.match(code,/Pas aan op hoe zwaar het echt voelde/);
});

test('route preview uses a bounded map with attribution and no map without GPS',()=>{
  const {context}=resultsContext();
  const map=context.activityRouteSvg([[51.9,4.5],[51.901,4.505],[51.905,4.51]]);
  assert.match(map,/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png/);
  assert.match(map,/OpenStreetMap-bijdragers/);
  assert.match(map,/activity-route-start/);
  assert.ok((map.match(/tile\.openstreetmap\.org/g)||[]).length<=9);
  assert.equal(context.activityRouteSvg([]),'');
  assert.equal(context.activityRouteSvg([[0,-179],[0,179]]),'');
});

test('planned comparison only uses a reliably matched activity',()=>{
  const {context,activities}=resultsContext();
  context.allWorkouts=()=>({'2026-09-26':{type:'Run',name:'Geplande duurloop',distanceKm:8,durationMinutes:40}});
  context.trainingExecutionForDate=()=>({actual:{id:'i1'},matched:true});
  const matched=context.activityResultPlanComparison(activities.i1);
  assert.equal(matched.name,'Geplande duurloop');
  assert.match(matched.distance,/Volgens plan/);
  assert.equal(context.activityResultPlanComparison(activities.i2),null);
  context.trainingExecutionForDate=()=>({actual:{id:'i1'},matched:false});
  assert.equal(context.activityResultPlanComparison(activities.i1),null);
});

test('interval preview shows rounded pace and omits tiny fragments',()=>{
  const {context}=resultsContext();
  const html=context.renderActivityIntervalRows([
    {type:'WORK',distanceKm:1,paceSecondsPerKm:299.7,averageHeartRate:160},
    {type:'REST',distanceKm:.01,movingSeconds:5}
  ]);
  assert.match(html,/5:00/);
  assert.doesNotMatch(html,/REST/);
});

test('review insight distinguishes high RPE from a combined recovery signal',()=>{
  const {context,activities,diary,submit}=resultsContext();
  const base={sessionRpe:9,legs:2,energy:4,complaintSeverity:0};
  assert.equal(context.activityReviewInsight(activities.i1,base).tone,'attention');
  assert.match(context.activityReviewInsight(activities.i1,base).explanation,/overige daggegevens/);
  const heavy={...base,legs:4,energy:2};
  assert.equal(context.activityReviewInsight(activities.i1,heavy).tone,'caution');
  assert.equal(context.activityReviewInsight(activities.i1,{...base,complaintSeverity:2}).tone,'caution');
  diary['2026-09-26']={sessionRpe:5,note:'handmatig'};
  assert.match(context.activityReviewInsight(activities.i1,base).coach,/telt mee voor het coachadvies/);
  assert.equal(context.activityReviewInsight(activities.i1,null).title,'Nog niet beoordeeld');
});

test('unreviewed filter preserves separate activities on the same date',()=>{
  const {context,activities,submit}=resultsContext();
  context.syncedSportFamily=type=>type==='Run'?'run':'other';
  const rows=Object.values(activities);
  assert.equal(context.filterActivityResults(rows,'unreviewed').length,2);
  submit('i1',{sessionRpe:5,legs:2,energy:4,enjoyment:4,complaintSeverity:0});
  const open=context.filterActivityResults(rows,'unreviewed');
  assert.equal(open.length,1);
  assert.equal(open[0].id,'i2');
  assert.equal(context.filterActivityResults(rows,'run').length,2);
});

test('quick action opens the newest unreviewed activity, then the next one',()=>{
  const {context,submit}=resultsContext();
  let opened='',scrolled=0;
  context.calendarDayDifference=()=>0;
  context.selectActivityResult=id=>{opened=id;};
  context.document={getElementById:id=>id==='activityReviewForm'
    ?{scrollIntoView(){scrolled++;}}:null};
  context.openNextActivityReview();
  assert.equal(opened,'i2');
  assert.equal(scrolled,1);
  submit('i2',{sessionRpe:5,energy:4});
  context.openNextActivityReview();
  assert.equal(opened,'i1');
});

test('seven-day report keeps measured volume separate from missing data',()=>{
  const {context}=resultsContext();
  const addDays=(date,n)=>{
    const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);
    return d.toISOString().slice(0,10);
  };
  context.addDays=addDays;
  context.syncedSportFamily=type=>type==='Run'?'run':'ride';
  const activities=[
    {id:'a',date:'2026-09-25',type:'Run',distanceKm:10,durationMinutes:50,trainingLoad:70},
    {id:'b',date:'2026-09-26',type:'Run',distanceKm:null,durationMinutes:35,trainingLoad:null},
    {id:'c',date:'2026-09-26',type:'Ride',distanceKm:40,durationMinutes:90,trainingLoad:80},
    {id:'old',date:'2026-09-19',type:'Run',distanceKm:30,durationMinutes:180}
  ];
  const reviews={a:{sessionRpe:6,complaintSeverity:0},b:{sessionRpe:8,complaintSeverity:2}};
  const report=context.activityWeekSummary(activities,reviews,'2026-09-26',{
    fetchedAt:'2026-09-26T12:00:00Z',oldest:'2026-09-20',newest:'2026-09-26'
  });
  assert.equal(report.activities,3);
  assert.equal(report.runKm,10);
  assert.equal(report.runDistanceCount,1);
  assert.equal(report.minutes,175);
  assert.equal(report.load,150);
  assert.equal(report.loadCount,2);
  assert.equal(report.rated,2);
  assert.equal(report.complaints,1);
  assert.equal(report.covered,true);
  assert.equal(report.days.at(-1).missing,true);
});

test('stale sync coverage does not label unknown days as rest',()=>{
  const {context}=resultsContext();
  context.addDays=(date,n)=>{
    const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);
    return d.toISOString().slice(0,10);
  };
  context.syncedSportFamily=()=> 'run';
  const report=context.activityWeekSummary([],{},'2026-09-26',{
    fetchedAt:'2026-09-24T12:00:00Z',oldest:'2026-09-18',newest:'2026-09-24'
  });
  assert.equal(report.covered,false);
  assert.equal(report.days.at(-1).covered,false);
});

test('result panels use the existing dark theme contrast',()=>{
  const css=fs.readFileSync('css/app.css','utf8');
  assert.match(css,/\.activity-results-card\{[^}]*background:var\(--panel\)/);
  assert.match(css,/\.activity-result-insight\{[^}]*background:#172b3b;color:var\(--text\)/);
});
