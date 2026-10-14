const ACTIVITY_SYNC_KEY="jp_intervals_activity_sync_v1";
const ACTIVITY_MATCH_ASSIGNMENTS_KEY="jp_activity_plan_matches_v1";
const ACTIVITY_MATCH_WINDOW_DAYS=3;

let activitySyncCache=loadObject(ACTIVITY_SYNC_KEY);
let syncedActivities=
  isPlainBackupObject(activitySyncCache?.activities)
    ?activitySyncCache.activities
    :{};
let activitySyncMeta=
  isPlainBackupObject(activitySyncCache?.meta)
    ?activitySyncCache.meta
    :{};
let activityPlanAssignments=loadObject(ACTIVITY_MATCH_ASSIGNMENTS_KEY);
if(!isPlainBackupObject(activityPlanAssignments)){
  activityPlanAssignments={};
}

function saveActivitySyncCache(){
  activitySyncCache={
    activities:syncedActivities,
    meta:activitySyncMeta
  };
  saveObject(ACTIVITY_SYNC_KEY,activitySyncCache);
}

function syncedSportFamily(type){
  const value=String(type||"").toLowerCase();

  if(value.includes("run") || value.includes("trail")) return "run";
  if(
    value.includes("ride") ||
    value.includes("bike") ||
    value.includes("cycle") ||
    value.includes("cycling")
  ) return "ride";
  if(value.includes("swim")) return "swim";
  if(value.includes("yoga") || value.includes("mobility") || value.includes("stretch")) return "mobility";
  if(
    value.includes("strength") ||
    value.includes("weight") ||
    value.includes("core")
  ) return "strength";

  return "other";
}

function workoutSportFamilyForSync(workout){
  const type=String(workout?.type||"").toLowerCase();

  if(type==="run") return "run";
  if(type==="ride") return "ride";
  if(type==="swim") return "swim";
  if(type==="mobility") return "mobility";
  if(["strength","core"].includes(type)) return "strength";
  return "other";
}

function normalizeSyncedActivity(activity){
  if(!activity || typeof activity!=="object") return null;
  const date=String(activity.date||activity.startDateLocal||"").slice(0,10);
  if(calendarDayNumber(date)===null) return null;
  const id=String(activity.id||"").trim();
  if(!id) return null;
  return{
    id,
    date,
    name:String(activity.name||"Training"),
    type:String(activity.type||""),
    startDateLocal:String(activity.startDateLocal||""),
    source:String(activity.source||"intervals"),
    externalId:activity.externalId==null?null:String(activity.externalId),
    distanceKm:finiteNumberOrNull(activity.distanceKm),
    durationMinutes:finiteNumberOrNull(activity.durationMinutes),
    elapsedMinutes:finiteNumberOrNull(activity.elapsedMinutes),
    paceSecondsPerKm:finiteNumberOrNull(activity.paceSecondsPerKm),
    elevationM:finiteNumberOrNull(activity.elevationM),
    averageSpeed:finiteNumberOrNull(activity.averageSpeed),
    averageHeartRate:finiteNumberOrNull(activity.averageHeartRate),
    maxHeartRate:finiteNumberOrNull(activity.maxHeartRate),
    averageWatts:finiteNumberOrNull(activity.averageWatts),
    weightedAverageWatts:finiteNumberOrNull(activity.weightedAverageWatts),
    maxWatts:finiteNumberOrNull(activity.maxWatts),
    averageCadence:finiteNumberOrNull(activity.averageCadence),
    trainingLoad:finiteNumberOrNull(activity.trainingLoad),
    intensity:finiteNumberOrNull(activity.intensity),
    perceivedExertion:finiteNumberOrNull(activity.perceivedExertion),
    intervalCount:finiteNumberOrNull(activity.intervalCount),
    hasGps:typeof activity.hasGps==="boolean"?activity.hasGps:null
  };
}

// Conservative cross-source identity: never merge on calendar date or title alone.
function sameRecordedActivity(a,b){
  if(a.id===b.id) return true;
  if(syncedSportFamily(a.type)!==syncedSportFamily(b.type)) return false;
  if(a.externalId && a.externalId===b.externalId) return true;
  if(!a.source || !b.source || a.source===b.source) return false;
  if(!/T\d{2}:\d{2}:\d{2}/.test(a.startDateLocal||"") ||
    !/T\d{2}:\d{2}:\d{2}/.test(b.startDateLocal||"")) return false;
  const gap=Math.abs(Date.parse(a.startDateLocal)-Date.parse(b.startDateLocal));
  if(!Number.isFinite(gap) || gap>10000) return false;
  const close=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&x>0&&y>0&&Math.abs(x-y)/Math.max(x,y)<=.02;
  return close(a.durationMinutes,b.durationMinutes) && close(a.distanceKm,b.distanceKm);
}

function mergeActivityImports(incoming){
  // A bounded provider response is not proof of deletion. Preserve historical facts.
  const next={};
  const existing=Object.values(syncedActivities).sort((a,b)=>
    Number(activityPlanAssignments[b.id]?.source==="manual")-Number(activityPlanAssignments[a.id]?.source==="manual")||a.id.localeCompare(b.id));
  let linksChanged=false,reviewsChanged=false;
  for(const activity of [...existing,...[...incoming].sort((a,b)=>a.id.localeCompare(b.id))]){
    const canonical=Object.values(next).find(item=>item.id===activity.id ||
      item.aliases?.includes(activity.id) || sameRecordedActivity(item,activity));
    if(!canonical){next[activity.id]=activity;continue;}
    const raw=({...activity});
    delete raw.sourceRecords;delete raw.aliases;
    const original={...canonical};delete original.sourceRecords;delete original.aliases;
    const variants={...(canonical.sourceRecords||{[canonical.id]:original}),[activity.id]:raw};
    if(activity.id!==canonical.id){
      if(activityPlanAssignments[activity.id]){
        if(!activityPlanAssignments[canonical.id]) activityPlanAssignments[canonical.id]={...activityPlanAssignments[activity.id],activityId:canonical.id};
        delete activityPlanAssignments[activity.id];linksChanged=true;
      }
      if(typeof activityReviews!=="undefined"&&activityReviews[activity.id]){
        if(!activityReviews[canonical.id]) activityReviews[canonical.id]={...activityReviews[activity.id],activityId:canonical.id};
        delete activityReviews[activity.id];reviewsChanged=true;
      }
    }
    const merged={...canonical};
    for(const [key,value] of Object.entries(activity)){
      if(value!==null && value!==undefined && value!=="" &&
        (canonical.id===activity.id || merged[key]==null)) merged[key]=value;
    }
    merged.id=canonical.id;
    merged.aliases=[...new Set([...(canonical.aliases||[]),activity.id])].filter(id=>id!==canonical.id).sort();
    merged.sourceRecords=variants;
    next[canonical.id]=merged;
  }
  if(linksChanged) saveActivityPlanAssignments();
  if(reviewsChanged) saveObject("jp_activity_reviews_v1",activityReviews);
  return next;
}

function syncedActivitiesForDate(date){
  return Object.values(syncedActivities)
    .filter(activity=>activity?.date===date)
    .sort((a,b)=>
      (finiteNumberOrNull(b.durationMinutes)||0)-
      (finiteNumberOrNull(a.durationMinutes)||0)
    );
}

function saveActivityPlanAssignments(){
  saveObject(ACTIVITY_MATCH_ASSIGNMENTS_KEY,activityPlanAssignments);
}

function activityReviewForSync(activityId){
  if(typeof activityReviews==="undefined" || !activityReviews) return null;
  return activityReviews[activityId]||null;
}

function activityPaceSeconds(activity){
  const direct=finiteNumberOrNull(activity?.paceSecondsPerKm);
  if(direct!==null && direct>0) return direct;
  const km=finiteNumberOrNull(activity?.distanceKm);
  const minutes=finiteNumberOrNull(activity?.durationMinutes);
  return km!==null && km>0 && minutes!==null && minutes>0
    ?minutes*60/km
    :null;
}

function activityEffortClass(activity){
  if(!activity) return "unknown";
  const review=activityReviewForSync(activity.id);
  const rpe=finiteNumberOrNull(review?.sessionRpe) ??
    finiteNumberOrNull(activity.perceivedExertion);
  if(rpe!==null){
    if(rpe>=8) return "hard";
    if(rpe<=4) return "easy";
    return "moderate";
  }
  let intensity=finiteNumberOrNull(activity.intensity);
  if(intensity!==null && intensity>2) intensity/=100;
  if(intensity!==null){
    if(intensity>=.88) return "hard";
    if(intensity<=.72) return "easy";
  }
  const hr=finiteNumberOrNull(activity.averageHeartRate);
  const sportProfile=typeof calibrationSportProfile==="function"?calibrationSportProfile(activity,getProfile()):getProfile();
  const maxHr=finiteNumberOrNull(sportProfile?.maxHr);
  if(hr!==null && maxHr!==null && maxHr>0){
    const ratio=hr/maxHr;
    if(ratio>=.86) return "hard";
    if(ratio<=.74) return "easy";
  }
  const load=finiteNumberOrNull(activity.trainingLoad);
  const minutes=finiteNumberOrNull(activity.durationMinutes);
  if(load!==null && minutes!==null && minutes>=20){
    const perHour=load/(minutes/60);
    if(perHour>=90) return "hard";
    if(perHour<=50) return "easy";
  }
  return "unknown";
}

function workoutEffortClass(workout){
  if(!workout) return "unknown";
  const rpe=finiteNumberOrNull(String(workout.rpe||"").split("/")[0]);
  const type=String(workout.planType||workout.type||"").toLowerCase();
  if(isHardWorkout(workout) || (rpe!==null && rpe>=7)) return "hard";
  if(["recovery","easy","mobility","core","strength"].includes(type) &&
    (rpe===null || rpe<=4)) return "easy";
  if(isLongWorkout(workout)) return "moderate";
  if(rpe!==null && rpe<=4) return "easy";
  return "moderate";
}

function plannedIntervalCountForSync(workout){
  const text=[
    ...(Array.isArray(workout?.displaySteps)?workout.displaySteps:[]),
    String(workout?.intervalsDescription||"")
  ].join("\n");
  const matches=[...text.matchAll(/(\d+)\s*[×x]\s*(?:\d+(?:[.,]\d+)?\s*(?:m|km|min|sec|s))/gi)]
    .map(match=>Number(match[1]))
    .filter(value=>Number.isInteger(value)&&value>1&&value<=100);
  return matches.length?Math.max(...matches):null;
}

function activityKnownIntervalCount(activity){
  const direct=finiteNumberOrNull(activity?.intervalCount);
  if(direct!==null && direct>0) return direct;
  if(typeof resultIntervals!=="undefined" && resultIntervals?.get){
    const intervals=resultIntervals.get(activity?.id);
    if(Array.isArray(intervals) && intervals.length) return intervals.length;
  }
  return null;
}

function activityNameOverlapScore(activity,workout){
  const tokens=value=>String(value||"").toLowerCase()
    .replace(/[^a-z0-9à-ÿ]+/g," ")
    .split(/\s+/)
    .filter(token=>token.length>=3 &&
      !["training","run","morning","evening"].includes(token));
  const actual=new Set(tokens(activity?.name));
  const planned=new Set(tokens(workout?.name));
  if(!actual.size || !planned.size) return 0;
  const overlap=[...actual].filter(token=>planned.has(token)).length;
  return Math.min(8,overlap*3);
}

function workoutMatchKey(date,workout){
  return `${date}|${workoutCompletionIdentity(workout)}`;
}

function assignmentWorkoutSnapshot(date,workout){
  return{
    date,
    identity:workoutCompletionIdentity(workout),
    name:String(workout?.name||"Training"),
    type:String(workout?.type||""),
    planType:String(workout?.planType||""),
    distanceKm:finiteNumberOrNull(workout?.distanceKm),
    durationMinutes:finiteNumberOrNull(workout?.durationMinutes),
    rpe:String(workout?.rpe||""),
    replanOriginDate:workout?.replanOriginDate||null,
    displaySteps:Array.isArray(workout?.displaySteps)
      ?workout.displaySteps.slice(0,12)
      :[]
  };
}

function assignmentForActivity(activityId){
  const assignment=activityPlanAssignments[activityId];
  return isPlainBackupObject(assignment)?assignment:null;
}

function assignmentCurrentWorkout(assignment){
  if(!assignment?.workoutDate) return null;
  const workout=allWorkouts()[assignment.workoutDate]||null;
  if(!workout || ["Rest","Race"].includes(workout.type)) return null;
  return workoutCompletionIdentity(workout)===assignment.workoutIdentity
    ?workout
    :null;
}

function assignmentForWorkout(date,workout){
  if(!workout) return null;
  const identity=workoutCompletionIdentity(workout);
  return Object.values(activityPlanAssignments).find(assignment=>
    assignment &&
    assignment.status!=="extra" &&
    assignment.workoutDate===date &&
    assignment.workoutIdentity===identity &&
    syncedActivities[assignment.activityId]
  )||null;
}

function plannedTargetPaceSecondsForSync(workout){
  const text=[
    ...(Array.isArray(workout?.displaySteps)?workout.displaySteps:[]),
    String(workout?.intervalsDescription||"")
  ].join("\n");

  const values=[];
  for(const match of text.matchAll(
    /(\d):(\d{2})\s*[–-]\s*(\d):(\d{2})\s*\/?\s*km/gi
  )){
    const low=Number(match[1])*60+Number(match[2]);
    const high=Number(match[3])*60+Number(match[4]);
    if(Number.isFinite(low)&&Number.isFinite(high)){
      values.push((low+high)/2);
    }
  }
  for(const match of text.matchAll(/(?:@|pace\s*)\s*(\d):(\d{2})\s*\/?\s*km/gi)){
    const value=Number(match[1])*60+Number(match[2]);
    if(Number.isFinite(value)) values.push(value);
  }

  if(!values.length) return null;
  values.sort((a,b)=>a-b);

  if(isHardWorkout(workout)) return values[0];

  const middle=Math.floor(values.length/2);
  return values.length%2
    ?values[middle]
    :(values[middle-1]+values[middle])/2;
}

function plannedTargetPowerForSync(workout){
  for(const key of ["targetWatts","powerWatts","watts"]){
    const value=finiteNumberOrNull(workout?.[key]);
    if(value!==null && value>0) return value;
  }

  const text=[
    ...(Array.isArray(workout?.displaySteps)?workout.displaySteps:[]),
    String(workout?.intervalsDescription||"")
  ].join("\n");

  const values=[...text.matchAll(/(\d{2,4})\s*(?:W|watt)\b/gi)]
    .map(match=>Number(match[1]))
    .filter(value=>Number.isFinite(value)&&value>=50&&value<=1000)
    .sort((a,b)=>a-b);

  if(!values.length) return null;
  if(isHardWorkout(workout)) return values[values.length-1];

  const middle=Math.floor(values.length/2);
  return values.length%2
    ?values[middle]
    :(values[middle-1]+values[middle])/2;
}

function activityMatchScore(activity,workout,plannedDate=activity?.date){
  if(!activity || !workout) return -Infinity;
  const family=syncedSportFamily(activity.type);
  const plannedFamily=workoutSportFamilyForSync(workout);
  if(plannedFamily==="other" || family!==plannedFamily) return -Infinity;
  const signedDelta=calendarDayDifference(plannedDate,activity.date);
  const dayDelta=signedDelta===null?99:Math.abs(signedDelta);
  if(dayDelta>ACTIVITY_MATCH_WINDOW_DAYS) return -Infinity;
  let score=80;
  score+=[42,34,22,10][dayDelta]||0;
  const plannedDistance=finiteNumberOrNull(workout.distanceKm);
  const actualDistance=finiteNumberOrNull(activity.distanceKm);
  if(plannedDistance!==null && plannedDistance>0 && actualDistance!==null){
    const delta=Math.abs(actualDistance-plannedDistance)/plannedDistance;
    score+=Math.max(0,45-Math.min(45,delta*75));
  }
  const plannedMinutes=finiteNumberOrNull(workout.durationMinutes);
  const actualMinutes=finiteNumberOrNull(activity.durationMinutes);
  if(plannedMinutes!==null && plannedMinutes>0 && actualMinutes!==null){
    const delta=Math.abs(actualMinutes-plannedMinutes)/plannedMinutes;
    score+=Math.max(0,30-Math.min(30,delta*55));
  }
  const plannedEffort=workoutEffortClass(workout);
  const actualEffort=activityEffortClass(activity);
  if(plannedEffort!=="unknown" && actualEffort!=="unknown"){
    if(plannedEffort===actualEffort) score+=20;
    else if(
      (plannedEffort==="hard" && actualEffort==="easy") ||
      (plannedEffort==="easy" && actualEffort==="hard")
    ) score-=18;
    else score+=5;
  }
  const plannedIntervals=plannedIntervalCountForSync(workout);
  const actualIntervals=activityKnownIntervalCount(activity);
  if(plannedIntervals!==null && actualIntervals!==null){
    const delta=Math.abs(actualIntervals-plannedIntervals);
    score+=Math.max(0,12-Math.min(12,delta*3));
  }
  if(isLongWorkout(workout) &&
    actualDistance!==null && plannedDistance!==null &&
    actualDistance>=plannedDistance*.82){
    score+=8;
  }

  const plannedPace=plannedTargetPaceSecondsForSync(workout);
  const actualPace=activityPaceSeconds(activity);
  if(
    syncedSportFamily(activity.type)==="run" &&
    plannedPace!==null &&
    actualPace!==null &&
    plannedPace>0
  ){
    const paceDelta=Math.abs(actualPace-plannedPace)/plannedPace;
    score+=Math.max(0,15-Math.min(15,paceDelta*75));
  }

  const plannedPower=plannedTargetPowerForSync(workout);
  const actualPower=
    finiteNumberOrNull(activity.weightedAverageWatts) ??
    finiteNumberOrNull(activity.averageWatts);
  if(plannedPower!==null && actualPower!==null && plannedPower>0){
    const powerDelta=Math.abs(actualPower-plannedPower)/plannedPower;
    score+=Math.max(0,15-Math.min(15,powerDelta*60));
  }

  score+=activityNameOverlapScore(activity,workout);
  return Math.round(score*10)/10;
}

function executionVolumeRatio(workout,activity){
  if(!workout || !activity) return null;
  const plannedDistance=finiteNumberOrNull(workout.distanceKm);
  const actualDistance=finiteNumberOrNull(activity.distanceKm);
  if(plannedDistance!==null && plannedDistance>0 && actualDistance!==null){
    return actualDistance/plannedDistance;
  }
  const plannedMinutes=finiteNumberOrNull(workout.durationMinutes);
  const actualMinutes=finiteNumberOrNull(activity.durationMinutes);
  if(plannedMinutes!==null && plannedMinutes>0 && actualMinutes!==null){
    return actualMinutes/plannedMinutes;
  }
  return null;
}

function classifyExecutionStatus(activity,workout){
  const reported=activityReviewForSync(activity.id)?.completion;
  if(["partial","replaced"].includes(reported)) return reported;
  const ratio=executionVolumeRatio(workout,activity);
  const plannedEffort=workoutEffortClass(workout);
  const actualEffort=activityEffortClass(activity);
  const strongMismatch=
    (plannedEffort==="hard" && actualEffort==="easy") ||
    (plannedEffort==="easy" && actualEffort==="hard");
  if(strongMismatch && (ratio===null || ratio>=.55)) return"replaced";
  if(ratio!==null && ratio<.80) return"partial";
  if(ratio!==null && ratio>1.75 && strongMismatch) return"replaced";
  return"complete";
}

function executionStatusLabel(status){
  return({
    complete:"Volledig uitgevoerd",
    partial:"Gedeeltelijk uitgevoerd",
    replaced:"Vervangen door andere training",
    skipped:"Overgeslagen",
    extra:"Extra gedaan",
    review:"Controleren",
    protected:"Race beschermd",
    manual:"Handmatig voltooid",
    unmatched:"Nog niet gekoppeld"
  })[status]||status;
}

function plannedSyncWorkouts(){
  const today=todayDateString();
  return Object.entries(allWorkouts())
    .filter(([date,workout])=>{
      if(!workout || ["Rest","Race"].includes(workout.type)) return false;
      const delta=calendarDayDifference(date,today);
      return delta!==null && delta>=-60 && delta<=ACTIVITY_MATCH_WINDOW_DAYS;
    })
    .map(([date,workout])=>({
      date,workout,key:workoutMatchKey(date,workout)
    }));
}

function activityPlanCandidates(activity,{excludeWorkoutKeys=new Set()}={}){
  return plannedSyncWorkouts()
    .filter(item=>
      !excludeWorkoutKeys.has(item.key) &&
      Math.abs(calendarDayDifference(item.date,activity.date)??99)<=ACTIVITY_MATCH_WINDOW_DAYS &&
      workoutSportFamilyForSync(item.workout)===syncedSportFamily(activity.type)
    )
    .map(item=>{
      const score=activityMatchScore(activity,item.workout,item.date);
      return{
        ...item,
        score,
        ratio:executionVolumeRatio(item.workout,activity),
        dayDelta:calendarDayDifference(item.date,activity.date),
        executionStatus:classifyExecutionStatus(activity,item.workout)
      };
    })
    .filter(item=>Number.isFinite(item.score))
    .sort((a,b)=>b.score-a.score);
}

function shouldAutoAssignActivity(activity,candidates){
  const best=candidates[0]||null;
  const second=candidates[1]||null;
  if(!best) return false;
  if(workoutEffortClass(best.workout)==="hard" && activityEffortClass(activity)==="unknown") return false;
  const gap=second?best.score-second.score:null;
  const absDays=Math.abs(best.dayDelta??99);
  if(best.ratio===null || best.score<145) return false;
  if(gap!==null && gap<14) return false;
  if(absDays>2 || best.ratio<.45 || best.ratio>2.0) return false;
  if(best.executionStatus==="partial"){
    return absDays<=1 && best.score>=165 && (gap===null || gap>=18);
  }
  if(best.executionStatus==="replaced"){
    return absDays===0 && best.score>=160 && (gap===null || gap>=18);
  }
  return true;
}

function makeActivityAssignment(activity,candidate,{source="auto",status=null,reason=""}={}){
  const workout=candidate?.workout||null;
  const workoutDate=candidate?.date||null;
  const executionStatus=status || (
    workout?classifyExecutionStatus(activity,workout):"extra"
  );
  return{
    activityId:activity.id,
    activityDate:activity.date,
    workoutDate,
    workoutIdentity:workout?workoutCompletionIdentity(workout):null,
    workoutSnapshot:workout?assignmentWorkoutSnapshot(workoutDate,workout):null,
    status:executionStatus,
    source,
    confidence:source==="manual"?"bevestigd":!candidate?"geen koppeling":candidate.score>=180?"hoog":"redelijk",
    score:finiteNumberOrNull(candidate?.score),
    scoreGap:finiteNumberOrNull(candidate?.scoreGap),
    ratio:workout?executionVolumeRatio(workout,activity):null,
    dayDelta:workoutDate?calendarDayDifference(workoutDate,activity.date):null,
    reason,
    updatedAt:new Date().toISOString()
  };
}

function cleanActivityPlanAssignments(){
  const next={};
  const used=new Set();
  let changed=false;
  // Imported backups may contain duplicate links. Preserve explicit choices first.
  const entries=Object.entries(activityPlanAssignments).sort((a,b)=>
    Number(b[1]?.source==="manual")-Number(a[1]?.source==="manual") || a[0].localeCompare(b[0]));
  for(const [activityId,assignment] of entries){
    const activity=syncedActivities[activityId];
    if(!activity || !isPlainBackupObject(assignment)){
      changed=true;
      continue;
    }
    if(!["complete","partial","replaced","extra"].includes(assignment.status)){
      changed=true;
      continue;
    }
    const key=`${assignment.workoutDate}|${assignment.workoutIdentity}`;
    if(assignment.status!=="extra" && used.has(key)){
      changed=true;
      continue;
    }
    if(assignment.status!=="extra") used.add(key);
    const workout=assignmentCurrentWorkout(assignment)||assignment.workoutSnapshot;
    const status=workout && assignment.status!=="extra"
      ?classifyExecutionStatus(activity,workout):assignment.status;
    const ratio=workout && assignment.status!=="extra"
      ?executionVolumeRatio(workout,activity):assignment.ratio;
    const updated=assignment.activityDate!==activity.date ||
      assignment.status!==status || assignment.ratio!==ratio;
    if(updated) changed=true;
    next[activityId]={
      ...assignment,
      activityId,
      activityDate:activity.date,
      status,ratio,
      ...(updated?{updatedAt:new Date().toISOString()}: {})
    };
  }
  if(changed){
    activityPlanAssignments=next;
    saveActivityPlanAssignments();
  }
  return changed;
}

function rebuildActivityPlanAssignments(){
  const cleaned=cleanActivityPlanAssignments();
  const next={...activityPlanAssignments};
  const usedWorkoutKeys=new Set();
  Object.values(next).forEach(assignment=>{
    if(!assignment || assignment.status==="extra" ||
      !assignment.workoutDate || !assignment.workoutIdentity) return;
    usedWorkoutKeys.add(`${assignment.workoutDate}|${assignment.workoutIdentity}`);
  });
  const unassigned=Object.values(syncedActivities)
    .filter(activity=>!next[activity.id])
    .map(activity=>{
      const candidates=activityPlanCandidates(activity,{
        excludeWorkoutKeys:usedWorkoutKeys
      });
      const best=candidates[0]?.score||0;
      const gap=candidates[1]
        ?best-candidates[1].score
        :best;
      return{activity,best,gap};
    })
    .sort((a,b)=>
      b.best-a.best ||
      b.gap-a.gap ||
      String(a.activity.startDateLocal||a.activity.date)
        .localeCompare(String(b.activity.startDateLocal||b.activity.date))
    );

  for(const item of unassigned){
    const activity=item.activity;
    const candidates=activityPlanCandidates(activity,{excludeWorkoutKeys:usedWorkoutKeys});
    if(shouldAutoAssignActivity(activity,candidates)){
      const best=candidates[0];
      const second=candidates[1]||null;
      const candidate={...best,scoreGap:second?best.score-second.score:null};
      next[activity.id]=makeActivityAssignment(activity,candidate,{
        source:"auto",
        reason:best.dayDelta===0
          ?"Automatisch gekoppeld op sport, omvang en intensiteit."
          :`Automatisch gekoppeld ondanks ${Math.abs(best.dayDelta)} dag verschil op basis van sport, omvang en intensiteit.`
      });
      usedWorkoutKeys.add(best.key);
      continue;
    }
    if(!candidates.length || (candidates[0]?.score||0)<110){
      next[activity.id]=makeActivityAssignment(activity,null,{
        source:"auto",
        status:"extra",
        reason:"Geen voldoende vergelijkbare geplande training gevonden."
      });
    }
  }
  const before=JSON.stringify(activityPlanAssignments);
  activityPlanAssignments=next;
  if(JSON.stringify(next)!==before){
    saveActivityPlanAssignments();
    return true;
  }
  return cleaned;
}

function refreshActivityAssignmentFromReview(activityId){
  const activity=syncedActivities[activityId];
  if(!activity) return false;

  const assignment=assignmentForActivity(activityId);
  if(!assignment){
    return rebuildActivityPlanAssignments();
  }

  if(assignment.status==="extra" && assignment.source==="auto"){
    delete activityPlanAssignments[activityId];
    const changed=rebuildActivityPlanAssignments();
    reconcileSyncedCompletions({
      oldest:activitySyncMeta.oldest,
      newest:activitySyncMeta.newest
    });
    return changed;
  }

  if(assignment.status==="extra") return false;

  const workout=assignmentCurrentWorkout(assignment) ||
    assignment.workoutSnapshot;
  if(!workout) return false;

  const nextStatus=classifyExecutionStatus(activity,workout);
  const nextRatio=executionVolumeRatio(workout,activity);
  const changed=
    assignment.status!==nextStatus ||
    assignment.ratio!==nextRatio;

  if(changed){
    activityPlanAssignments[activityId]={
      ...assignment,
      status:nextStatus,
      ratio:nextRatio,
      reason:assignment.source==="manual"
        ?assignment.reason
        :"Koppeling opnieuw beoordeeld met de opgeslagen trainingsbeoordeling.",
      updatedAt:new Date().toISOString()
    };
    saveActivityPlanAssignments();
    reconcileSyncedCompletions({
      oldest:activitySyncMeta.oldest,
      newest:activitySyncMeta.newest
    });
  }

  return changed;
}

function activityMatchCandidates(date,workout){
  if(!workout || ["Rest","Race"].includes(workout.type)) return [];
  return Object.values(syncedActivities)
    .filter(activity=>
      Math.abs(calendarDayDifference(date,activity.date)??99)<=ACTIVITY_MATCH_WINDOW_DAYS &&
      syncedSportFamily(activity.type)===workoutSportFamilyForSync(workout)
    )
    .map(activity=>({
      activity,
      score:activityMatchScore(activity,workout,date),
      ratio:executionVolumeRatio(workout,activity),
      dayDelta:calendarDayDifference(date,activity.date),
      assigned:assignmentForActivity(activity.id)
    }))
    .filter(item=>Number.isFinite(item.score))
    .sort((a,b)=>b.score-a.score);
}

function assessActivityMatch(date,workout){
  if(!workout){
    return{status:"unmatched",reason:"Geen geplande training.",activity:null,
      ratio:null,score:null,scoreGap:null,candidates:[]};
  }
  if(workout.type==="Race"){
    return{status:"protected",reason:"Wedstrijden blijven handmatig beschermd.",
      activity:null,ratio:null,score:null,scoreGap:null,candidates:[]};
  }
  if(workout.type==="Rest"){
    return{status:"unmatched",reason:"Rustdagen worden niet gekoppeld.",
      activity:null,ratio:null,score:null,scoreGap:null,candidates:[]};
  }
  const assignment=assignmentForWorkout(date,workout);
  if(assignment){
    const activity=syncedActivities[assignment.activityId]||null;
    return{
      status:assignment.status,
      reason:assignment.reason || (
        assignment.dayDelta
          ?`Uitgevoerd op ${activity?.date||assignment.activityDate} in plaats van ${date}.`
          :"Betrouwbaar aan deze geplande training gekoppeld."
      ),
      activity,
      ratio:assignment.ratio,
      score:assignment.score,
      scoreGap:assignment.scoreGap,
      candidates:[],
      assignment
    };
  }
  const candidates=activityMatchCandidates(date,workout)
    .filter(item=>!item.assigned);
  const best=candidates[0]||null;
  const second=candidates[1]||null;
  if(best && best.score>=115){
    return{
      status:"review",
      reason:second && best.score-second.score<14
        ?"Meerdere trainingen of activiteiten passen bijna even goed."
        :`Mogelijke koppeling met activiteit van ${best.activity.date}; bevestiging is veiliger.`,
      activity:best.activity,
      ratio:best.ratio,
      score:best.score,
      scoreGap:second?best.score-second.score:null,
      candidates
    };
  }
  const age=calendarDayDifference(todayDateString(),date);
  const covered=Boolean(
    activitySyncMeta?.fetchedAt &&
    activitySyncMeta?.oldest &&
    activitySyncMeta?.newest &&
    date>=activitySyncMeta.oldest &&
    date<=activitySyncMeta.newest
  );
  if(age!==null && age>=1 && covered){
    return{status:"unmatched",
      reason:"Nog geen activiteit ontvangen; vertraagde synchronisatie blijft mogelijk. Niet als overgeslagen gemarkeerd.",
      activity:null,ratio:null,score:null,scoreGap:null,candidates:[]};
  }
  return{status:"unmatched",
    reason:"Nog geen betrouwbare uitgevoerde activiteit gekoppeld.",
    activity:null,ratio:null,score:null,scoreGap:null,candidates:[]};
}

function primarySyncedActivityForWorkout(date,workout){
  return assessActivityMatch(date,workout).activity;
}

function trainingExecutionForDate(date,workout=allWorkouts()[date]||null){
  const assessment=assessActivityMatch(date,workout);
  const matched=["complete","partial","replaced"].includes(assessment.status);
  return{
    date,workout,actual:assessment.activity,ratio:assessment.ratio,
    matched,processed:matched,executionStatus:assessment.status,
    status:assessment.status,reason:assessment.reason,
    score:assessment.score,scoreGap:assessment.scoreGap,
    assignment:assessment.assignment||null
  };
}

function completedEntryRunDistanceKm(item){
  const execution=trainingExecutionForDate(item.date,item.workout);
  const marker=doneWorkouts[item.date];
  const trusted=
    execution.matched ||
    (
      marker?.source==="intervals" &&
      marker.activityId &&
      marker.activityId===execution.actual?.id
    );
  if(trusted){
    const syncedDistance=finiteNumberOrNull(execution.actual?.distanceKm);
    if(syncedDistance!==null) return syncedDistance;
  }
  return finiteNumberOrNull(item.workout?.distanceKm) || 0;
}

function activityStressSignal(activity){
  const review=activityReviewForSync(activity.id);
  const effort=activityEffortClass(activity);
  const load=finiteNumberOrNull(activity.trainingLoad);
  const rpe=finiteNumberOrNull(review?.sessionRpe) ??
    finiteNumberOrNull(activity.perceivedExertion);
  const energy=finiteNumberOrNull(review?.energy);
  const complaint=finiteNumberOrNull(review?.complaintSeverity);
  if(complaint!==null && complaint>=2){
    return{level:"elevated",reason:"duidelijke klachten na de activiteit"};
  }
  if(rpe!==null && rpe>=9 && energy!==null && energy<=2){
    return{level:"elevated",reason:`RPE ${Math.round(rpe)} met lage energie`};
  }
  if(load!==null && load>=180){
    return{level:"elevated",reason:`hoge trainingsbelasting (${Math.round(load)})`};
  }
  if(effort==="hard" && load!==null && load>=130){
    return{level:"attention",reason:`zware activiteit met load ${Math.round(load)}`};
  }
  if(rpe!==null && rpe>=8){
    return{level:"attention",reason:`RPE ${Math.round(rpe)}`};
  }
  return{level:"stable",reason:""};
}

function syncedLoadEntriesBetween(minDaysAgo,maxDaysAgo){
  return Object.values(syncedActivities)
    .filter(activity=>{
      if(syncedSportFamily(activity?.type)!=="run") return false;
      const age=calendarDayDifference(todayDateString(),activity.date);
      return age!==null && age>=minDaysAgo && age<=maxDaysAgo;
    })
    .map(activity=>{
      const review=activityReviewForSync(activity.id);
      const effort=activityEffortClass(activity);
      const rpe=finiteNumberOrNull(review?.sessionRpe) ??
        finiteNumberOrNull(activity.perceivedExertion);
      return{
        date:activity.date,
        sourceActivityId:activity.id,
        actualActivity:activity,
        workout:{
          date:activity.date,
          type:"Run",
          planType:effort==="hard"?"quality":effort==="easy"?"easy":"run",
          name:activity.name||"Uitgevoerde run",
          distanceKm:finiteNumberOrNull(activity.distanceKm),
          durationMinutes:finiteNumberOrNull(activity.durationMinutes),
          rpe:rpe===null?"":`${Math.round(rpe)}/10`,
          status:"done",
          actualActivityId:activity.id
        }
      };
    });
}

function mergeSyncedLoadEntries(plannedEntries,minDaysAgo,maxDaysAgo){
  const actual=syncedLoadEntriesBetween(minDaysAgo,maxDaysAgo);
  if(!actual.length) return plannedEntries;

  const actualIds=new Set(actual.map(item=>item.sourceActivityId));
  const planned=(plannedEntries||[]).filter(item=>{
    if(!item?.workout) return false;
    if(typeof trainingExecutionForDate!=="function") return true;
    const execution=trainingExecutionForDate(item.date,item.workout);
    return !execution?.actual?.id || !actualIds.has(execution.actual.id);
  });

  return planned.concat(actual).sort((a,b)=>a.date.localeCompare(b.date));
}

function buildAdaptiveExecutionFeedback(){
  if(!activitySyncMeta?.fetchedAt){
    return{level:"unknown",
      text:"Nog geen uitgevoerde trainingen gesynchroniseerd.",
      execution:null,recentActivities:[]};
  }
  const recent=Object.values(syncedActivities)
    .filter(activity=>{
      const age=calendarDayDifference(todayDateString(),activity.date);
      return age!==null && age>=0 && age<=3;
    })
    .sort((a,b)=>String(b.startDateLocal||b.date)
      .localeCompare(String(a.startDateLocal||a.date)));
  if(!recent.length){
    return{level:"unknown",text:"Geen activiteit in de laatste vier dagen gevonden.",
      execution:null,recentActivities:[]};
  }
  let level="stable";
  let text="De recente uitgevoerde belasting past bij de planning.";
  let chosen=null;
  const rank={unknown:0,stable:1,attention:2,elevated:3};
  const signals=[];
  for(const activity of recent){
    const assignment=assignmentForActivity(activity.id);
    const stress=activityStressSignal(activity);
    let candidateLevel=stress.level;
    let candidateText=stress.reason;
    const status=assignment?.status||"extra";
    const ratio=finiteNumberOrNull(assignment?.ratio);
    if(status==="extra"){
      if(activityEffortClass(activity)==="hard"){
        candidateLevel=rank[candidateLevel]>=rank.attention?candidateLevel:"attention";
        candidateText=candidateText || `extra zware activiteit op ${activity.date}`;
      }
    }else if(status==="partial"){
      candidateLevel=rank[candidateLevel]>=rank.attention?candidateLevel:"attention";
      candidateText=`${assignment.workoutSnapshot?.name||"Training"} is gedeeltelijk uitgevoerd; gemist volume wordt niet automatisch ingehaald.`;
    }else if(status==="replaced"){
      candidateLevel=activityEffortClass(activity)==="hard"?"elevated":"attention";
      candidateText=`${assignment.workoutSnapshot?.name||"Geplande training"} is vervangen door ${activity.name}.`;
    }else if(status==="complete" && ratio!==null && ratio>=1.35){
      const snapshot=assignment.workoutSnapshot||{};
      const wasStress=["hard","moderate"].includes(workoutEffortClass(snapshot));
      candidateLevel=wasStress?"elevated":"attention";
      candidateText=`${snapshot.name||"Training"} had ${Math.round((ratio-1)*100)}% meer volume dan gepland.`;
    }
    if(candidateText){
      signals.push({level:candidateLevel,text:candidateText,activity,assignment});
    }
    if(rank[candidateLevel]>rank[level]){
      level=candidateLevel;
      text=candidateText || text;
      chosen={activity,assignment};
    }
  }
  const recentLoad=recent
    .filter(activity=>(calendarDayDifference(todayDateString(),activity.date)??99)<=2)
    .map(activity=>finiteNumberOrNull(activity.trainingLoad))
    .filter(value=>value!==null)
    .reduce((sum,value)=>sum+value,0);
  // RPE-minutes are kept separate from provider load: they are different units.
  const perceivedLoad=recent.reduce((sum,activity)=>{
    if((calendarDayDifference(todayDateString(),activity.date)??99)>2) return sum;
    const rpe=finiteNumberOrNull(activityReviewForSync(activity.id)?.sessionRpe) ??
      finiteNumberOrNull(activity.perceivedExertion);
    const minutes=finiteNumberOrNull(activity.durationMinutes);
    return rpe!==null && rpe>=1 && rpe<=10 && minutes!==null && minutes>0
      ?sum+rpe*minutes:sum;
  },0);
  if(perceivedLoad>=1800 && rank[level]<rank.elevated){
    level="elevated";
    text=`Gecombineerde belasting van alle sporten: ${Math.round(perceivedLoad)} RPE-minuten in drie kalenderdagen. Extra herstelruimte aanbevolen.`;
  }else if(perceivedLoad>=1200 && rank[level]<rank.attention){
    level="attention";
    text=`Gecombineerde belasting van alle sporten: ${Math.round(perceivedLoad)} RPE-minuten in drie kalenderdagen. Geen extra intensiteit toevoegen.`;
  }
  if(recentLoad>=260 && rank[level]<rank.elevated){
    level="elevated";
    text=`De bekende trainingsbelasting van de laatste 72 uur is ${Math.round(recentLoad)}. De volgende zware prikkel krijgt extra herstelruimte.`;
  }else if(recentLoad>=190 && rank[level]<rank.attention){
    level="attention";
    text=`De bekende trainingsbelasting van de laatste 72 uur is ${Math.round(recentLoad)}. Bouw geen extra intensiteit in.`;
  }
  if(typeof latestTrainingQualityFeedback==="function"){
    for(const activity of recent){
      const quality=latestTrainingQualityFeedback(activity.id);
      if(!quality || quality.level==="unknown") continue;

      signals.push({
        level:quality.level,
        text:quality.text,
        activity,
        assignment:assignmentForActivity(activity.id)
      });

      if(quality.level==="elevated"){
        level="elevated";
        text=quality.text;
        chosen={activity,assignment:assignmentForActivity(activity.id)};
      }else if(quality.level==="attention" && rank[level]<rank.attention){
        level="attention";
        text=quality.text;
        chosen={activity,assignment:assignmentForActivity(activity.id)};
      }
      break;
    }
  }

  if(level==="stable"){
    const latest=recent[0];
    const assignment=assignmentForActivity(latest.id);
    text=assignment?.status==="complete"
      ?`Laatste training (${latest.name}) is volledig verwerkt en past bij de planning.`
      :assignment?.status==="extra"
        ?`Laatste activiteit (${latest.name}) is als extra training verwerkt.`
        :"Recente activiteiten geven geen extra belastingssignaal.";
    chosen={activity:latest,assignment};
  }
  const execution=chosen?.assignment?.workoutDate
    ?trainingExecutionForDate(
        chosen.assignment.workoutDate,
        assignmentCurrentWorkout(chosen.assignment) ||
          chosen.assignment.workoutSnapshot
      )
    :null;
  return{level,text,execution,recentActivities:recent,signals,recentLoad,perceivedLoad};
}

function setIntervalsCompletionMarker(date,workout,activity,executionStatus="complete"){
  doneWorkouts[date]={
    source:"intervals",activityId:activity.id,activityDate:activity.date,
    executionStatus,done:true,identity:workoutCompletionIdentity(workout),
    name:String(workout?.name||""),type:String(workout?.type||""),
    markedAt:new Date().toISOString()
  };
}

function reconcileSyncedCompletions({oldest=null,newest=null}={}){
  let changed=false;
  const workouts=allWorkouts();
  Object.entries(workouts).forEach(([date,workout])=>{
    if(!workout || ["Rest","Race"].includes(workout.type)) return;
    const age=calendarDayDifference(todayDateString(),date);
    if(age===null || age<-ACTIVITY_MATCH_WINDOW_DAYS) return;
    const inCoverage=
      (!oldest || date>=addDays(oldest,-ACTIVITY_MATCH_WINDOW_DAYS)) &&
      (!newest || date<=addDays(newest,ACTIVITY_MATCH_WINDOW_DAYS));
    if(!inCoverage) return;
    const execution=trainingExecutionForDate(date,workout);
    const actual=execution.actual;
    const marker=doneWorkouts[date];
    if(execution.matched && actual){
      const needsUpdate=
        !marker ||
        (
          marker?.source==="intervals" &&
          (
            marker.identity!==workoutCompletionIdentity(workout) ||
            marker.activityId!==actual.id ||
            marker.executionStatus!==execution.executionStatus
          )
        );
      if(needsUpdate && (!marker || marker?.source==="intervals")){
        setIntervalsCompletionMarker(date,workout,actual,execution.executionStatus);
        changed=true;
      }
    }else if(marker?.source==="intervals"){
      delete doneWorkouts[date];
      changed=true;
    }
  });
  if(changed) saveObject(DONE_KEY,doneWorkouts);
  return changed;
}

function formatActivityPace(activity){
  if(syncedSportFamily(activity?.type)!=="run") return null;
  const pace=activityPaceSeconds(activity);
  if(pace===null || pace<=0 || pace>3600) return null;
  const rounded=Math.round(pace);
  return `${Math.floor(rounded/60)}:${String(rounded%60).padStart(2,"0")}/km`;
}

function formatSyncedActivitySummary(activity){
  if(!activity) return "Geen passende activiteit";
  const parts=[activity.name];
  const distance=finiteNumberOrNull(activity.distanceKm);
  if(distance!==null && distance>0){
    parts.push(`${distance.toFixed(distance>=10?1:2)} km`);
  }
  const minutes=finiteNumberOrNull(activity.durationMinutes);
  if(minutes!==null) parts.push(`${Math.round(minutes)} min`);
  const pace=formatActivityPace(activity);
  if(pace) parts.push(pace);
  const hr=finiteNumberOrNull(activity.averageHeartRate);
  if(hr!==null) parts.push(`${Math.round(hr)} bpm`);
  const watts=finiteNumberOrNull(activity.weightedAverageWatts) ??
    finiteNumberOrNull(activity.averageWatts);
  if(watts!==null) parts.push(`${Math.round(watts)} W`);
  const load=finiteNumberOrNull(activity.trainingLoad);
  if(load!==null) parts.push(`load ${Math.round(load)}`);

  let intensity=finiteNumberOrNull(activity.intensity);
  if(intensity!==null){
    if(intensity<=2) intensity*=100;
    parts.push(`int. ${Math.round(intensity)}%`);
  }

  return parts.join(" · ");
}

function bestProtectedRaceActivity(date,workout){
  const all=syncedActivitiesForDate(date);
  if(!all.length) return null;

  const runLike=all.filter(activity=>
    syncedSportFamily(activity.type)==="run"
  );
  const pool=runLike.length?runLike:all;
  const plannedDistance=finiteNumberOrNull(workout?.distanceKm);

  return [...pool]
    .map(activity=>{
      const distance=finiteNumberOrNull(activity.distanceKm);
      const minutes=finiteNumberOrNull(activity.durationMinutes);
      let distanceDelta=Infinity;

      if(
        plannedDistance!==null &&
        plannedDistance>0 &&
        distance!==null &&
        distance>0
      ){
        distanceDelta=Math.abs(distance-plannedDistance)/plannedDistance;
      }

      return{
        activity,
        distanceDelta,
        distance:distance||0,
        minutes:minutes||0
      };
    })
    .sort((a,b)=>{
      if(a.distanceDelta!==b.distanceDelta){
        return a.distanceDelta-b.distanceDelta;
      }
      if(a.distance!==b.distance){
        return b.distance-a.distance;
      }
      return b.minutes-a.minutes;
    })[0]?.activity || null;
}

function unresolvedActivityMatchQueue(){
  const usedWorkoutKeys=new Set(
    Object.values(activityPlanAssignments)
      .filter(assignment=>
        assignment &&
        assignment.status!=="extra" &&
        assignment.workoutDate &&
        assignment.workoutIdentity
      )
      .map(assignment=>`${assignment.workoutDate}|${assignment.workoutIdentity}`)
  );
  return Object.values(syncedActivities)
    .filter(activity=>!assignmentForActivity(activity.id))
    .map(activity=>{
      const candidates=activityPlanCandidates(activity,{excludeWorkoutKeys:usedWorkoutKeys})
        .slice(0,4);
      const best=candidates[0]||null;
      const second=candidates[1]||null;
      if(!best || best.score<110) return null;
      return{
        activity,
        candidates,
        reason:second && best.score-second.score<14
          ?"Meerdere geplande trainingen passen bijna even goed."
          :best.ratio===null
            ?"Afstand of duur ontbreekt; kies zelf welke training dit was."
            :best.executionStatus==="partial"
              ?"De activiteit lijkt korter dan de geplande training."
              :best.executionStatus==="replaced"
                ?"De activiteit wijkt inhoudelijk af van de geplande training."
                :`Mogelijke training van ${best.date}; bevestig de koppeling.`
      };
    })
    .filter(Boolean)
    .sort((a,b)=>String(b.activity.startDateLocal||b.activity.date)
      .localeCompare(String(a.activity.startDateLocal||a.activity.date)));
}

function renderActivityMatchReview(){
  const panel=document.getElementById("activityMatchReview");
  const select=document.getElementById("activityMatchChoice");
  const title=document.getElementById("activityMatchReviewTitle");
  const meta=document.getElementById("activityMatchReviewMeta");
  const count=document.getElementById("activityMatchReviewCount");
  if(!panel || !select || !title || !meta || !count) return;
  const queue=unresolvedActivityMatchQueue();
  const item=queue[0]||null;
  panel.hidden=!item;
  count.textContent=item?`${queue.length} te controleren`:"0 te controleren";
  if(!item){
    select.innerHTML="";
    delete panel.dataset.activityId;
    return;
  }
  title.textContent=`Welke training was “${item.activity.name}”?`;
  meta.textContent=
    `${item.activity.date} · ${formatSyncedActivitySummary(item.activity)} · ${item.reason}`;
  select.innerHTML=[
    ...item.candidates.map(candidate=>
      `<option value="${safe(candidate.key)}">${safe(candidate.date)} · ${safe(candidate.workout.name)} · ${executionStatusLabel(candidate.executionStatus)}</option>`
    ),
    '<option value="extra">Dit was een extra training</option>'
  ].join("");
  panel.dataset.activityId=item.activity.id;
}

function saveActivityMatchChoice(){
  const panel=document.getElementById("activityMatchReview");
  const select=document.getElementById("activityMatchChoice");
  const status=document.getElementById("activitySyncStatus");
  const activityId=panel?.dataset.activityId;
  const activity=syncedActivities[activityId];
  if(!activity || !select) return;
  const queueItem=unresolvedActivityMatchQueue()
    .find(item=>item.activity.id===activityId);
  if(!queueItem){
    renderActivityMatchReview();
    return;
  }
  if(select.value==="extra"){
    activityPlanAssignments[activity.id]=makeActivityAssignment(
      activity,null,{
        source:"manual",
        status:"extra",
        reason:"Door gebruiker gemarkeerd als extra training."
      }
    );
  }else{
    const candidate=queueItem.candidates.find(item=>item.key===select.value);
    if(!candidate){renderActivityMatchReview();return;}
    const existing=Object.values(activityPlanAssignments).find(assignment=>
      assignment &&
      assignment.status!=="extra" &&
      assignment.workoutDate===candidate.date &&
      assignment.workoutIdentity===workoutCompletionIdentity(candidate.workout)
    );
    if(existing && existing.activityId!==activity.id){
      if(existing.source==="manual"){
        if(status){
          status.className="status error";
          status.textContent=
            "Deze geplande training is al handmatig aan een andere activiteit gekoppeld.";
        }
        return;
      }
      delete activityPlanAssignments[existing.activityId];
    }
    const second=queueItem.candidates
      .filter(item=>item!==candidate)
      .sort((a,b)=>b.score-a.score)[0]||null;
    activityPlanAssignments[activity.id]=makeActivityAssignment(
      activity,
      {...candidate,scoreGap:second?candidate.score-second.score:null},
      {
        source:"manual",
        reason:candidate.dayDelta
          ?`Handmatig gekoppeld: uitgevoerd op ${activity.date}, gepland op ${candidate.date}.`
          :"Handmatig aan de geplande training gekoppeld."
      }
    );
  }
  saveActivityPlanAssignments();
  reconcileSyncedCompletions({
    oldest:activitySyncMeta.oldest,
    newest:activitySyncMeta.newest
  });
  if(typeof reconcileManualCompletionReviews==="function"){
    reconcileManualCompletionReviews();
  }
  resetGeneratedPlannerPreviews();
  renderActivitySyncStatus();
  renderMonth();
  renderSelected();
  renderSaved();
  refreshDerivedCoachViews();
  if(status){
    status.className="status ok";
    status.textContent=
      "Koppeling opgeslagen. De resterende planning is opnieuw berekend.";
  }
}

function buildActivitySyncDiagnostics(days=21){
  const workouts=allWorkouts();
  const rows=[];
  const consumedActivityIds=new Set(Object.keys(activityPlanAssignments));
  Object.entries(workouts)
    .map(([date,workout])=>({
      date,workout,age:calendarDayDifference(todayDateString(),date)
    }))
    .filter(item=>
      item.workout &&
      item.workout.type!=="Rest" &&
      item.age!==null &&
      item.age>=-ACTIVITY_MATCH_WINDOW_DAYS &&
      item.age<=days
    )
    .sort((a,b)=>b.date.localeCompare(a.date))
    .forEach(item=>{
      if(item.workout.type==="Race"){
        const raceActivity=bestProtectedRaceActivity(item.date,item.workout);
        if(raceActivity) consumedActivityIds.add(raceActivity.id);
        rows.push({
          date:item.date,workout:item.workout,status:"protected",
          reason:raceActivity
            ?"Wedstrijdactiviteit herkend; voltooiing blijft bewust handmatig beschermd."
            :"Wedstrijd beschermd; geen passende activiteit gevonden.",
          activity:raceActivity,
          ratio:raceActivity?executionVolumeRatio(item.workout,raceActivity):null
        });
        return;
      }
      const assessment=assessActivityMatch(item.date,item.workout);
      let status=assessment.status;
      let reason=assessment.reason;
      const marker=doneWorkouts[item.date];
      if(
        !["complete","partial","replaced"].includes(status) &&
        marker &&
        marker.source!=="intervals" &&
        completionMarkerMatches(marker,item.workout)
      ){
        status="manual";
        reason=assessment.activity
          ?"Handmatig voltooid; automatische koppeling was bewust te onzeker."
          :"Handmatig voltooid; geen betrouwbare Intervals.icu-match gevonden.";
      }
      if(assessment.activity) consumedActivityIds.add(assessment.activity.id);
      rows.push({
        date:item.date,workout:item.workout,status,reason,
        activity:assessment.activity,ratio:assessment.ratio,
        scoreGap:assessment.scoreGap
      });
    });
  const queue=unresolvedActivityMatchQueue();
  const pendingReviewIds=new Set(queue.map(item=>item.activity.id));
  const extras=Object.values(syncedActivities)
    .filter(activity=>{
      const age=calendarDayDifference(todayDateString(),activity.date);
      const assignment=assignmentForActivity(activity.id);
      return(
        age!==null &&
        age>=0 &&
        age<=days &&
        !pendingReviewIds.has(activity.id) &&
        (
          assignment?.status==="extra" ||
          !consumedActivityIds.has(activity.id)
        )
      );
    })
    .sort((a,b)=>String(b.startDateLocal||b.date)
      .localeCompare(String(a.startDateLocal||a.date)));
  const counts={
    complete:rows.filter(row=>row.status==="complete").length,
    partial:rows.filter(row=>row.status==="partial").length,
    replaced:rows.filter(row=>row.status==="replaced").length,
    skipped:rows.filter(row=>row.status==="skipped").length,
    review:queue.length,
    unmatched:rows.filter(row=>row.status==="unmatched").length,
    manual:rows.filter(row=>row.status==="manual").length,
    protected:rows.filter(row=>row.status==="protected").length,
    extras:extras.length
  };
  return{days,rows,extras,counts,pendingReviewIds};
}

function diagnosticStatusMeta(status){
  if(status==="complete") return{cls:"good",icon:"✓",label:"Volledig uitgevoerd"};
  if(status==="partial") return{cls:"warn",icon:"½",label:"Gedeeltelijk uitgevoerd"};
  if(status==="replaced") return{cls:"warn",icon:"↔",label:"Vervangen"};
  if(status==="skipped") return{cls:"warn",icon:"–",label:"Overgeslagen"};
  if(status==="review") return{cls:"warn",icon:"!",label:"Controleren"};
  if(status==="manual") return{cls:"good",icon:"✓",label:"Handmatig voltooid"};
  if(status==="protected") return{cls:"good",icon:"🏁",label:"Race beschermd"};
  return{cls:"warn",icon:"?",label:"Nog niet gekoppeld"};
}

function renderActivitySyncDiagnostics(){
  const summary=document.getElementById("activitySyncCalibrationSummary");
  const list=document.getElementById("activitySyncDiagnostics");
  const api=document.getElementById("activitySyncApiCoverage");
  if(!summary || !list || !api) return;
  const diagnostics=buildActivitySyncDiagnostics(21);
  const {counts}=diagnostics;
  summary.textContent=
    `${counts.complete} volledig · ${counts.partial} deels · ${counts.replaced} vervangen · `+
    `${counts.skipped} overgeslagen · ${counts.review} controleren · ${counts.extras} extra`;
  const raw=finiteNumberOrNull(activitySyncMeta?.rawCount);
  const normalized=finiteNumberOrNull(activitySyncMeta?.normalizedCount);
  const dropped=finiteNumberOrNull(activitySyncMeta?.droppedCount);
  const coverage=activitySyncMeta?.metricsCoverage||{};
  const typeCounts=activitySyncMeta?.typeCounts||{};
  const typeText=Object.entries(typeCounts)
    .sort((a,b)=>b[1]-a[1])
    .map(([type,count])=>`${type} ${count}`)
    .join(" · ");
  const coverageParts=[
    ["afstand",coverage.distanceKm],
    ["duur",coverage.durationMinutes],
    ["tempo",coverage.paceSecondsPerKm],
    ["HR",coverage.averageHeartRate],
    ["load",coverage.trainingLoad],
    ["vermogen",coverage.weightedAverageWatts]
  ]
    .filter(([,value])=>finiteNumberOrNull(value)!==null)
    .map(([label,value])=>`${label} ${value}/${normalized??"—"}`);
  const apiRows=[];
  if(raw!==null){
    let text=`API: ${raw} ontvangen · ${normalized??"—"} bruikbaar`;
    if(dropped) text+=` · ${dropped} overgeslagen`;
    apiRows.push(text);
  }else{
    apiRows.push("API-validatie verschijnt na de volgende sync.");
  }
  if(typeText) apiRows.push(`Sporttypen: ${typeText}`);
  if(coverageParts.length) apiRows.push(`Meetdekking: ${coverageParts.join(" · ")}`);
  apiRows.push(
    "Matching gebruikt sport, datumvenster, afstand/duur, intensiteit en beschikbare trainingsopbouw."
  );
  api.innerHTML=apiRows.map(text=>`<div>${safe(text)}</div>`).join("");
  const rowHtml=diagnostics.rows.slice(0,12).map(row=>{
    const meta=diagnosticStatusMeta(row.status);
    const actual=row.activity
      ?formatSyncedActivitySummary(row.activity)
      :"Geen passende activiteit";
    const ratio=row.ratio===null
      ?""
      :` · ${Math.round(row.ratio*100)}% van gepland`;
    const dateShift=row.activity && row.activity.date!==row.date
      ?` · uitgevoerd ${row.activity.date}`
      :"";
    return `
      <div class="reason-item">
        <div class="reason-icon ${meta.cls}">${meta.icon}</div>
        <div>
          <strong>${safe(row.date)} · ${safe(meta.label)}</strong>
          <div>${safe(row.workout?.name||"Training")}</div>
          <small>${safe(actual)}${safe(ratio)}${safe(dateShift)} · ${safe(row.reason)}</small>
        </div>
      </div>
    `;
  });
  const extraHtml=diagnostics.extras.slice(0,5).map(activity=>`
    <div class="reason-item">
      <div class="reason-icon warn">+</div>
      <div>
        <strong>${safe(activity.date)} · Extra gedaan</strong>
        <div>${safe(formatSyncedActivitySummary(activity))}</div>
        <small>Deze activiteit telt mee in je belasting, maar is niet aan een geplande training gekoppeld.</small>
      </div>
    </div>
  `);
  list.innerHTML=[...rowHtml,...extraHtml].join("") ||
    '<div class="reason-item"><div class="reason-icon warn">…</div><div>Nog geen recente syncdata om te kalibreren.</div></div>';
  renderActivityMatchReview();
}

function buildActivitySyncDiagnosticText(){
  const diagnostics=buildActivitySyncDiagnostics(21);
  const lines=[
    "Jaco Performance 11.4 · Adaptive Execution diagnose",
    `Laatste sync: ${activitySyncMeta?.fetchedAt||"nog niet"}`,
    `Bereik: ${activitySyncMeta?.oldest||"—"} t/m ${activitySyncMeta?.newest||"—"}`,
    `API ontvangen/bruikbaar/overgeslagen: ${activitySyncMeta?.rawCount??"—"}/${activitySyncMeta?.normalizedCount??"—"}/${activitySyncMeta?.droppedCount??"—"}`,
    `Uitvoering: ${diagnostics.counts.complete} volledig, ${diagnostics.counts.partial} gedeeltelijk, ${diagnostics.counts.replaced} vervangen, ${diagnostics.counts.skipped} overgeslagen, ${diagnostics.counts.review} controleren, ${diagnostics.counts.extras} extra`,
    ""
  ];
  diagnostics.rows.slice(0,14).forEach(row=>{
    lines.push(
      `${row.date} | ${row.status} | ${row.workout?.name||"Training"} | `+
      `${row.activity?formatSyncedActivitySummary(row.activity):"geen activiteit"} | `+
      `${row.ratio===null?"ratio —":`ratio ${Math.round(row.ratio*100)}%`} | ${row.reason}`
    );
  });
  diagnostics.extras.slice(0,8).forEach(activity=>{
    lines.push(`${activity.date} | extra | ${formatSyncedActivitySummary(activity)}`);
  });
  return lines.join("\n");
}

async function copyActivitySyncDiagnostics(){
  const status=document.getElementById("activitySyncStatus");
  try{
    if(!navigator.clipboard?.writeText){
      throw new Error("klembord is niet beschikbaar in deze browser");
    }

    await navigator.clipboard.writeText(buildActivitySyncDiagnosticText());
    if(status){
      status.className="status ok";
      status.textContent="Syncdiagnose gekopieerd. Je kunt deze hier plakken voor verdere kalibratie.";
    }
  }catch(error){
    if(status){
      status.className="status error";
      status.textContent=`Kopiëren van syncdiagnose mislukt: ${error.message}`;
    }
  }
}

function renderActivitySyncStatus(){
  const quality=document.getElementById("activitySyncQuality");
  const summary=document.getElementById("todayExecutionSummary");
  if(!quality || !summary) return;
  const count=Object.keys(syncedActivities).length;
  if(activitySyncMeta?.fetchedAt){
    const stamp=new Date(activitySyncMeta.fetchedAt);
    quality.textContent=Number.isNaN(stamp.getTime())
      ?`${count} activiteiten`
      :`Bijgewerkt ${stamp.toLocaleDateString("nl-NL",{day:"2-digit",month:"2-digit"})} ${stamp.toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"})}`;
  }else{
    quality.textContent=count
      ?`${count} lokaal opgeslagen`
      :"Nog niet gesynchroniseerd";
  }
  const today=todayDateString();
  const workout=currentTodayWorkout();
  const execution=trainingExecutionForDate(today,workout);
  const feedback=buildAdaptiveExecutionFeedback();
  const rows=[];
  if(workout && !["Rest","Race"].includes(workout.type)){
    if(execution.matched){
      rows.push(
        `${executionStatusLabel(execution.executionStatus)}: ${formatSyncedActivitySummary(execution.actual)}`+
        (execution.actual?.date!==today?` · uitgevoerd ${execution.actual.date}`:"")
      );
    }else if(execution.status==="review" && execution.actual){
      rows.push(
        `Kandidaat gevonden, maar controle nodig: ${formatSyncedActivitySummary(execution.actual)} · ${execution.reason}`
      );
    }else{
      rows.push(`Vandaag gepland: ${workout.name} · nog geen betrouwbare koppeling gevonden`);
    }
  }else if(workout?.type==="Race"){
    const raceActivities=syncedActivitiesForDate(today);
    rows.push(
      raceActivities.length
        ?`Wedstrijddag: ${raceActivities.length} activiteit(en) gevonden; race-voltooiing blijft beschermd.`
        :`Wedstrijddag: ${workout.name}`
    );
  }else{
    rows.push("Vandaag staat geen koppelbare hoofdtraining in de kalender.");
  }
  rows.push(`Adaptieve feedback: ${feedback.text}`);
  if(activitySyncMeta?.oldest && activitySyncMeta?.newest){
    rows.push(`Syncbereik: ${activitySyncMeta.oldest} t/m ${activitySyncMeta.newest}.`);
  }
  summary.innerHTML=rows.map(text=>`<div>${safe(text)}</div>`).join("");
  renderActivitySyncDiagnostics();
  if(typeof renderActivityResults==="function") renderActivityResults();
}

let activitySyncInFlight=null;
function syncCompletedActivities(options={}){
  // Concurrent refreshes must not overwrite a newer cache with an older response.
  if(activitySyncInFlight) return activitySyncInFlight;
  activitySyncInFlight=performCompletedActivitySync(options)
    .finally(()=>{activitySyncInFlight=null;});
  return activitySyncInFlight;
}

async function performCompletedActivitySync({silent=false,render=true}={}){
  const status=document.getElementById("activitySyncStatus");
  if(typeof navigator!=="undefined" && navigator.onLine===false){
    if(status && !silent){
      status.className="status";
      status.textContent=
        "Offline · eerder gesynchroniseerde trainingen blijven beschikbaar.";
    }
    renderActivitySyncStatus();
    return{ok:false,error:new Error("Offline")};
  }
  if(status && !silent){
    status.className="status";
    status.textContent=
      "Uitgevoerde trainingen worden opgehaald en opnieuw gekoppeld…";
  }
  try{
    const response=await fetchWithAppPin("/api/intervals-activities");
    const data=await response.json();
    if(!response.ok){
      throw new Error(
        data.error || "Uitgevoerde trainingen konden niet worden geladen."
      );
    }
    const oldest=String(data.oldest||"");
    const newest=String(data.newest||"");
    if(!Array.isArray(data.activities) || calendarDayNumber(oldest)===null ||
      calendarDayNumber(newest)===null || oldest>newest){
      throw new Error("Onvolledig synchronisatieantwoord; bestaande trainingen zijn behouden.");
    }
    const normalized=data.activities.map(normalizeSyncedActivity);
    if(normalized.some(activity=>!activity)){
      throw new Error("Ongeldige activiteit ontvangen; bestaande trainingen zijn behouden.");
    }
    syncedActivities=mergeActivityImports(normalized);
    activitySyncMeta={
      fetchedAt:data.fetchedAt || new Date().toISOString(),
      oldest:data.oldest || null,
      newest:data.newest || null,
      count:Array.isArray(data.activities)?data.activities.length:0,
      rawCount:finiteNumberOrNull(data.rawCount),
      normalizedCount:finiteNumberOrNull(data.normalizedCount),
      droppedCount:finiteNumberOrNull(data.droppedCount),
      typeCounts:isPlainBackupObject(data.typeCounts)?data.typeCounts:{},
      metricsCoverage:isPlainBackupObject(data.metricsCoverage)
        ?data.metricsCoverage:{}
    };
    saveActivitySyncCache();
    const assignmentsChanged=rebuildActivityPlanAssignments();
    const completionChanged=reconcileSyncedCompletions({
      oldest:activitySyncMeta.oldest,
      newest:activitySyncMeta.newest
    });
    if(typeof reconcileManualCompletionReviews==="function"){
      reconcileManualCompletionReviews();
    }
    if(typeof syncTrainingQualityLatest==="function"){
      await syncTrainingQualityLatest({silent:true,render:false});
    }
    renderActivitySyncStatus();
    if(render){
      if(completionChanged || assignmentsChanged){
        renderMonth();
        renderSelected();
        renderSaved();
      }
      resetGeneratedPlannerPreviews();
      refreshDerivedCoachViews();
    }
    if(status && !silent){
      const diagnostics=buildActivitySyncDiagnostics(21);
      status.className=diagnostics.counts.review?"status":"status ok";
      status.textContent=
        `${activitySyncMeta.count} activiteit(en) geladen · `+
        `${diagnostics.counts.complete} volledig · `+
        `${diagnostics.counts.partial} deels · `+
        `${diagnostics.counts.replaced} vervangen · `+
        `${diagnostics.counts.skipped} overgeslagen · `+
        `${diagnostics.counts.review} controleren · `+
        `${diagnostics.counts.extras} extra.`;
    }
    return{ok:true,data,assignmentsChanged,completionChanged};
  }catch(error){
    if(status && !silent){
      status.className="status error";
      status.textContent=`Training Sync mislukt: ${error.message}`;
    }
    renderActivitySyncStatus();
    return{ok:false,error};
  }
}
