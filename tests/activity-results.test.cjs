const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

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
    const elements=Object.fromEntries(Object.entries({...scores,note:''})
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

test('manual day check-in is never overwritten by activity review',()=>{
  const {diary,status,submit}=resultsContext();
  diary['2026-09-26']={sessionRpe:7,note:'Eigen beoordeling'};
  submit('i1',{sessionRpe:9,legs:5,energy:1,enjoyment:1,complaintSeverity:3});
  assert.equal(diary['2026-09-26'].sessionRpe,7);
  assert.match(status.textContent,/handmatige dagcheck-in/);
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
  assert.throws(()=>context.validateKnownBackupContents('jp_activity_reviews_v1',{
    i1:{...valid.i1,energy:'2'}
  }),/ongeldige gegevens/);
  assert.match(app,/DIARY_KEY,\s*"jp_activity_reviews_v1"/);
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
