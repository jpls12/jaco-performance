const ACTIVITY_SYNC_KEY="jp_intervals_activity_sync_v1";

let activitySyncCache=loadObject(ACTIVITY_SYNC_KEY);
let syncedActivities=
  isPlainBackupObject(activitySyncCache?.activities)
    ? activitySyncCache.activities
    : {};
let activitySyncMeta=
  isPlainBackupObject(activitySyncCache?.meta)
    ? activitySyncCache.meta
    : {};

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
  if(
    value.includes("strength") ||
    value.includes("weight") ||
    value.includes("core") ||
    value.includes("yoga") ||
    value.includes("mobility")
  ) return "strength";

  return "other";
}

function workoutSportFamilyForSync(workout){
  const type=String(workout?.type||"").toLowerCase();

  if(type==="run") return "run";
  if(type==="ride") return "ride";
  if(type==="swim") return "swim";
  if(["strength","core","mobility"].includes(type)) return "strength";
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
    distanceKm:finiteNumberOrNull(activity.distanceKm),
    durationMinutes:finiteNumberOrNull(activity.durationMinutes),
    elapsedMinutes:finiteNumberOrNull(activity.elapsedMinutes),
    elevationM:finiteNumberOrNull(activity.elevationM),
    averageSpeed:finiteNumberOrNull(activity.averageSpeed),
    averageHeartRate:finiteNumberOrNull(activity.averageHeartRate),
    maxHeartRate:finiteNumberOrNull(activity.maxHeartRate),
    averageWatts:finiteNumberOrNull(activity.averageWatts),
    weightedAverageWatts:finiteNumberOrNull(activity.weightedAverageWatts),
    trainingLoad:finiteNumberOrNull(activity.trainingLoad),
    intensity:finiteNumberOrNull(activity.intensity),
    perceivedExertion:finiteNumberOrNull(activity.perceivedExertion)
  };
}

function syncedActivitiesForDate(date){
  return Object.values(syncedActivities)
    .filter(activity=>activity?.date===date)
    .sort((a,b)=>
      (finiteNumberOrNull(b.durationMinutes)||0)-
      (finiteNumberOrNull(a.durationMinutes)||0)
    );
}

function activityMatchScore(activity,workout){
  if(!activity || !workout) return -Infinity;

  const family=syncedSportFamily(activity.type);
  const plannedFamily=workoutSportFamilyForSync(workout);

  if(plannedFamily==="other" || family!==plannedFamily){
    return -Infinity;
  }

  let score=100;

  const plannedDistance=finiteNumberOrNull(workout.distanceKm);
  const actualDistance=finiteNumberOrNull(activity.distanceKm);
  if(plannedDistance!==null && plannedDistance>0 && actualDistance!==null){
    const delta=Math.abs(actualDistance-plannedDistance)/plannedDistance;
    score+=Math.max(0,35-Math.min(35,delta*35));
  }

  const plannedMinutes=finiteNumberOrNull(workout.durationMinutes);
  const actualMinutes=finiteNumberOrNull(activity.durationMinutes);
  if(plannedMinutes!==null && plannedMinutes>0 && actualMinutes!==null){
    const delta=Math.abs(actualMinutes-plannedMinutes)/plannedMinutes;
    score+=Math.max(0,20-Math.min(20,delta*20));
  }

  score+=Math.min(10,(finiteNumberOrNull(activity.durationMinutes)||0)/30);
  return score;
}

function primarySyncedActivityForWorkout(date,workout){
  if(!workout || ["Rest","Race"].includes(workout.type)) return null;

  const candidates=syncedActivitiesForDate(date)
    .map(activity=>({
      activity,
      score:activityMatchScore(activity,workout)
    }))
    .filter(item=>Number.isFinite(item.score))
    .sort((a,b)=>b.score-a.score);

  return candidates[0]?.activity || null;
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

function trainingExecutionForDate(date,workout=allWorkouts()[date]||null){
  const actual=primarySyncedActivityForWorkout(date,workout);
  return{
    date,
    workout,
    actual,
    ratio:executionVolumeRatio(workout,actual),
    matched:Boolean(actual)
  };
}

function completedEntryRunDistanceKm(item){
  const actual=trainingExecutionForDate(item.date,item.workout).actual;
  const syncedDistance=finiteNumberOrNull(actual?.distanceKm);
  if(syncedDistance!==null) return syncedDistance;
  return finiteNumberOrNull(item.workout?.distanceKm) || 0;
}

function buildAdaptiveExecutionFeedback(){
  if(!activitySyncMeta?.fetchedAt){
    return{
      level:"unknown",
      text:"Nog geen uitgevoerde trainingen gesynchroniseerd.",
      execution:null
    };
  }

  const recent=Object.entries(allWorkouts())
    .map(([date,workout])=>({
      date,
      workout,
      age:calendarDayDifference(todayDateString(),date)
    }))
    .filter(item=>
      item.workout &&
      !["Rest","Race"].includes(item.workout.type) &&
      item.age!==null &&
      item.age>=1 &&
      item.age<=4
    )
    .sort((a,b)=>b.date.localeCompare(a.date));

  const executed=recent
    .map(item=>({
      ...item,
      execution:trainingExecutionForDate(item.date,item.workout)
    }))
    .filter(item=>item.execution.actual);

  if(!executed.length){
    return{
      level:"unknown",
      text:"Geen recente geplande training met een passende Intervals.icu-activiteit gevonden.",
      execution:null
    };
  }

  const latest=executed[0];
  const ratio=latest.execution.ratio;
  const load=finiteNumberOrNull(latest.execution.actual.trainingLoad);
  let level="stable";
  let text="De laatste uitgevoerde training sluit goed aan op de planning.";

  if(
    ratio!==null &&
    ratio>=1.35 &&
    (isHardWorkout(latest.workout) || isLongWorkout(latest.workout))
  ){
    level="elevated";
    text=`${latest.workout.name} kwam uit op ${Math.round((ratio-1)*100)}% meer volume dan gepland. De coach beperkt daarom een nieuwe zware prikkel.`;
  }else if(ratio!==null && ratio>=1.25){
    level="attention";
    text=`${latest.workout.name} was ${Math.round((ratio-1)*100)}% omvangrijker dan gepland. Voeg vandaag geen extra volume toe.`;
  }else if(ratio!==null && ratio<=0.70){
    level="attention";
    text=`${latest.workout.name} bleef ${Math.round((1-ratio)*100)}% onder de geplande omvang. Haal dit volume niet automatisch in.`;
  }else if(load!==null && load>=180 && isHardWorkout(latest.workout)){
    level="attention";
    text=`De laatste zware training had een Intervals.icu-belasting van ${Math.round(load)}. Houd de volgende kwaliteit gecontroleerd.`;
  }

  return{
    level,
    text,
    execution:latest.execution
  };
}

function setIntervalsCompletionMarker(date,workout,activity){
  doneWorkouts[date]={
    source:"intervals",
    activityId:activity.id,
    activityDate:activity.date,
    done:true,
    identity:workoutCompletionIdentity(workout),
    name:String(workout?.name||""),
    type:String(workout?.type||""),
    markedAt:new Date().toISOString()
  };
}

function reconcileSyncedCompletions({oldest=null,newest=null}={}){
  let changed=false;
  const workouts=allWorkouts();

  Object.entries(workouts).forEach(([date,workout])=>{
    if(!workout || ["Rest","Race"].includes(workout.type)) return;

    const age=calendarDayDifference(todayDateString(),date);
    if(age===null || age<0) return;

    const inCoverage=
      (!oldest || date>=oldest) &&
      (!newest || date<=newest);

    if(!inCoverage) return;

    const actual=primarySyncedActivityForWorkout(date,workout);
    const marker=doneWorkouts[date];

    if(actual){
      if(
        !marker ||
        (
          marker?.source==="intervals" &&
          (
            marker.identity!==workoutCompletionIdentity(workout) ||
            marker.activityId!==actual.id
          )
        )
      ){
        if(!marker || marker?.source==="intervals"){
          setIntervalsCompletionMarker(date,workout,actual);
          changed=true;
        }
      }
    }else if(marker?.source==="intervals"){
      delete doneWorkouts[date];
      changed=true;
    }
  });

  if(changed){
    saveObject(DONE_KEY,doneWorkouts);
  }

  return changed;
}

function formatSyncedActivitySummary(activity){
  if(!activity) return "Geen passende activiteit";

  const parts=[activity.name];

  const distance=finiteNumberOrNull(activity.distanceKm);
  if(distance!==null && distance>0){
    parts.push(`${distance.toFixed(distance>=10?1:2)} km`);
  }

  const minutes=finiteNumberOrNull(activity.durationMinutes);
  if(minutes!==null){
    parts.push(`${Math.round(minutes)} min`);
  }

  const hr=finiteNumberOrNull(activity.averageHeartRate);
  if(hr!==null) parts.push(`${Math.round(hr)} bpm`);

  const load=finiteNumberOrNull(activity.trainingLoad);
  if(load!==null) parts.push(`load ${Math.round(load)}`);

  return parts.join(" · ");
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
    rows.push(
      execution.actual
        ?`Vandaag uitgevoerd: ${formatSyncedActivitySummary(execution.actual)}`
        :`Vandaag gepland: ${workout.name} · nog geen passende activiteit gevonden`
    );
  }else if(workout?.type==="Race"){
    const raceActivities=syncedActivitiesForDate(today);
    rows.push(
      raceActivities.length
        ?`Wedstrijddag: ${raceActivities.length} activiteit(en) uit Intervals.icu gevonden; race-voltooiing blijft handmatig beschermd.`
        :`Wedstrijddag: ${workout.name}`
    );
  }else{
    rows.push("Vandaag staat geen koppelbare training in de kalender.");
  }

  rows.push(`Adaptieve feedback: ${feedback.text}`);

  if(activitySyncMeta?.oldest && activitySyncMeta?.newest){
    rows.push(`Syncbereik: ${activitySyncMeta.oldest} t/m ${activitySyncMeta.newest}.`);
  }

  summary.innerHTML=rows
    .map(text=>`<div>${safe(text)}</div>`)
    .join("");
}

async function syncCompletedActivities({silent=false,render=true}={}){
  const status=document.getElementById("activitySyncStatus");

  if(typeof navigator!=="undefined" && navigator.onLine===false){
    if(status && !silent){
      status.className="status";
      status.textContent="Offline · eerder gesynchroniseerde trainingen blijven beschikbaar.";
    }
    renderActivitySyncStatus();
    return{ok:false,error:new Error("Offline")};
  }

  if(status && !silent){
    status.className="status";
    status.textContent="Uitgevoerde trainingen worden opgehaald…";
  }

  try{
    const response=await fetchWithAppPin("/api/intervals-activities");
    const data=await response.json();

    if(!response.ok){
      throw new Error(data.error || "Uitgevoerde trainingen konden niet worden geladen.");
    }

    const oldest=String(data.oldest||"");
    const newest=String(data.newest||"");
    const next={};

    Object.values(syncedActivities).forEach(activity=>{
      if(
        !activity?.date ||
        (oldest && activity.date>=oldest && (!newest || activity.date<=newest))
      ){
        return;
      }
      next[activity.id]=activity;
    });

    (Array.isArray(data.activities)?data.activities:[])
      .map(normalizeSyncedActivity)
      .filter(Boolean)
      .forEach(activity=>{
        const age=calendarDayDifference(todayDateString(),activity.date);
        if(age!==null && age>=0 && age<=120){
          next[activity.id]=activity;
        }
      });

    syncedActivities=next;
    activitySyncMeta={
      fetchedAt:data.fetchedAt || new Date().toISOString(),
      oldest:data.oldest || null,
      newest:data.newest || null,
      count:Array.isArray(data.activities)?data.activities.length:0
    };

    saveActivitySyncCache();

    const completionChanged=reconcileSyncedCompletions({
      oldest:activitySyncMeta.oldest,
      newest:activitySyncMeta.newest
    });

    renderActivitySyncStatus();

    if(render){
      if(completionChanged){
        renderMonth();
        renderSelected();
        renderSaved();
      }
      refreshDerivedCoachViews();
    }

    if(status && !silent){
      status.className="status ok";
      status.textContent=`${activitySyncMeta.count} activiteit(en) gecontroleerd en gekoppeld aan je planning.`;
    }

    return{
      ok:true,
      data,
      completionChanged
    };
  }catch(error){
    if(status && !silent){
      status.className="status error";
      status.textContent=`Training Sync mislukt: ${error.message}`;
    }

    renderActivitySyncStatus();
    return{ok:false,error};
  }
}
