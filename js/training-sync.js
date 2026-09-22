const ACTIVITY_SYNC_KEY="jp_intervals_activity_sync_v1";

let activitySyncCache=loadObject(ACTIVITY_SYNC_KEY);
let syncedActivities=
  isPlainBackupObject(activitySyncCache?.activities)
    ?activitySyncCache.activities
    :{};
let activitySyncMeta=
  isPlainBackupObject(activitySyncCache?.meta)
    ?activitySyncCache.meta
    :{};

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

function activityMatchCandidates(date,workout){
  if(!workout || ["Rest","Race"].includes(workout.type)) return [];

  return syncedActivitiesForDate(date)
    .map(activity=>({
      activity,
      score:activityMatchScore(activity,workout),
      ratio:executionVolumeRatio(workout,activity)
    }))
    .filter(item=>Number.isFinite(item.score))
    .sort((a,b)=>b.score-a.score);
}

function assessActivityMatch(date,workout){
  if(!workout){
    return{
      status:"unmatched",
      reason:"Geen geplande training.",
      activity:null,
      ratio:null,
      score:null,
      scoreGap:null,
      candidates:[]
    };
  }

  if(workout.type==="Race"){
    return{
      status:"protected",
      reason:"Wedstrijden blijven handmatig beschermd.",
      activity:null,
      ratio:null,
      score:null,
      scoreGap:null,
      candidates:[]
    };
  }

  if(workout.type==="Rest"){
    return{
      status:"unmatched",
      reason:"Rustdagen worden niet automatisch gekoppeld.",
      activity:null,
      ratio:null,
      score:null,
      scoreGap:null,
      candidates:[]
    };
  }

  const candidates=activityMatchCandidates(date,workout);
  const best=candidates[0]||null;
  const second=candidates[1]||null;

  if(!best){
    return{
      status:"unmatched",
      reason:"Geen activiteit met hetzelfde sporttype gevonden.",
      activity:null,
      ratio:null,
      score:null,
      scoreGap:null,
      candidates
    };
  }

  const ratio=best.ratio;
  const scoreGap=
    second && Number.isFinite(second.score)
      ?best.score-second.score
      :null;

  if(ratio===null){
    return{
      status:"review",
      reason:"Afstand/duur ontbreekt; sporttype alleen is onvoldoende voor automatisch afvinken.",
      activity:best.activity,
      ratio,
      score:best.score,
      scoreGap,
      candidates
    };
  }

  if(ratio<0.70){
    return{
      status:"review",
      reason:`Uitgevoerd volume is slechts ${Math.round(ratio*100)}% van gepland.`,
      activity:best.activity,
      ratio,
      score:best.score,
      scoreGap,
      candidates
    };
  }

  if(ratio>1.60){
    return{
      status:"review",
      reason:`Uitgevoerd volume is ${Math.round(ratio*100)}% van gepland; dit wijkt te sterk af voor automatisch koppelen.`,
      activity:best.activity,
      ratio,
      score:best.score,
      scoreGap,
      candidates
    };
  }

  if(second && scoreGap!==null && scoreGap<8){
    return{
      status:"review",
      reason:"Meerdere activiteiten op dezelfde dag passen bijna even goed; handmatige controle is veiliger.",
      activity:best.activity,
      ratio,
      score:best.score,
      scoreGap,
      candidates
    };
  }

  return{
    status:"auto",
    reason:
      ratio>=0.85 && ratio<=1.20
        ?"Sterke overeenkomst tussen gepland en uitgevoerd."
        :"Sporttype en volume passen voldoende voor automatische koppeling.",
    activity:best.activity,
    ratio,
    score:best.score,
    scoreGap,
    candidates
  };
}

function primarySyncedActivityForWorkout(date,workout){
  return assessActivityMatch(date,workout).activity;
}

function trainingExecutionForDate(date,workout=allWorkouts()[date]||null){
  const assessment=assessActivityMatch(date,workout);
  return{
    date,
    workout,
    actual:assessment.activity,
    ratio:assessment.ratio,
    matched:assessment.status==="auto",
    status:assessment.status,
    reason:assessment.reason,
    score:assessment.score,
    scoreGap:assessment.scoreGap
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
    .filter(item=>item.execution.matched);

  if(!executed.length){
    return{
      level:"unknown",
      text:"Geen recente, betrouwbaar gekoppelde training gevonden.",
      execution:null
    };
  }

  const latest=executed[0];
  const ratio=latest.execution.ratio;
  const load=finiteNumberOrNull(latest.execution.actual?.trainingLoad);
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

  if(typeof latestTrainingQualityFeedback==="function"){
    const quality=latestTrainingQualityFeedback(
      latest.execution.actual?.id||null
    );

    if(quality?.level==="elevated"){
      level="elevated";
      text=quality.text;
    }else if(quality?.level==="attention" && level==="stable"){
      level="attention";
      text=quality.text;
    }
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

    const assessment=assessActivityMatch(date,workout);
    const actual=assessment.activity;
    const confidentMatch=assessment.status==="auto";
    const marker=doneWorkouts[date];

    if(confidentMatch){
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

function buildActivitySyncDiagnostics(days=21){
  const workouts=allWorkouts();
  const rows=[];
  const consumedActivityIds=new Set();

  Object.entries(workouts)
    .map(([date,workout])=>({
      date,
      workout,
      age:calendarDayDifference(todayDateString(),date)
    }))
    .filter(item=>
      item.workout &&
      item.workout.type!=="Rest" &&
      item.age!==null &&
      item.age>=1 &&
      item.age<=days
    )
    .sort((a,b)=>b.date.localeCompare(a.date))
    .forEach(item=>{
      if(item.workout.type==="Race"){
        const raceActivity=bestProtectedRaceActivity(
          item.date,
          item.workout
        );

        if(raceActivity){
          consumedActivityIds.add(raceActivity.id);
        }

        rows.push({
          date:item.date,
          workout:item.workout,
          status:"protected",
          reason:raceActivity
            ?"Wedstrijdactiviteit herkend; voltooiing blijft bewust handmatig beschermd."
            :"Wedstrijd beschermd; geen passende activiteit gevonden.",
          activity:raceActivity,
          ratio:raceActivity
            ?executionVolumeRatio(item.workout,raceActivity)
            :null
        });
        return;
      }

      const assessment=assessActivityMatch(item.date,item.workout);
      if(assessment.activity){
        consumedActivityIds.add(assessment.activity.id);
      }

      let status=assessment.status;
      let reason=assessment.reason;
      const marker=doneWorkouts[item.date];

      if(
        status!=="auto" &&
        marker &&
        marker.source!=="intervals" &&
        completionMarkerMatches(marker,item.workout)
      ){
        status="manual";
        reason=assessment.activity
          ?"Handmatig voltooid; automatische koppeling was bewust te onzeker."
          :"Handmatig voltooid; geen betrouwbare Intervals.icu-match gevonden.";
      }

      rows.push({
        date:item.date,
        workout:item.workout,
        status,
        reason,
        activity:assessment.activity,
        ratio:assessment.ratio,
        scoreGap:assessment.scoreGap
      });
    });

  const extras=Object.values(syncedActivities)
    .filter(activity=>{
      const age=calendarDayDifference(todayDateString(),activity.date);
      return(
        age!==null &&
        age>=1 &&
        age<=days &&
        !consumedActivityIds.has(activity.id)
      );
    })
    .sort((a,b)=>
      String(b.startDateLocal||b.date)
        .localeCompare(String(a.startDateLocal||a.date))
    );

  const counts={
    auto:rows.filter(row=>row.status==="auto").length,
    review:rows.filter(row=>row.status==="review").length,
    unmatched:rows.filter(row=>row.status==="unmatched").length,
    manual:rows.filter(row=>row.status==="manual").length,
    protected:rows.filter(row=>row.status==="protected").length,
    extras:extras.length
  };

  return{days,rows,extras,counts};
}

function diagnosticStatusMeta(status){
  if(status==="auto"){
    return{cls:"good",icon:"✓",label:"Automatisch gekoppeld"};
  }
  if(status==="review"){
    return{cls:"warn",icon:"!",label:"Controleren"};
  }
  if(status==="manual"){
    return{cls:"good",icon:"✓",label:"Handmatig voltooid"};
  }
  if(status==="protected"){
    return{cls:"good",icon:"🏁",label:"Race beschermd"};
  }
  return{cls:"warn",icon:"?",label:"Niet gekoppeld"};
}

function renderActivitySyncDiagnostics(){
  const summary=document.getElementById("activitySyncCalibrationSummary");
  const list=document.getElementById("activitySyncDiagnostics");
  const api=document.getElementById("activitySyncApiCoverage");
  if(!summary || !list || !api) return;

  const diagnostics=buildActivitySyncDiagnostics(21);
  const {counts}=diagnostics;

  summary.textContent=
    `${counts.auto} auto · ${counts.review} controleren · ${counts.unmatched} open`+
    (counts.manual?` · ${counts.manual} handmatig`:"");

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
  if(coverageParts.length){
    apiRows.push(`Meetdekking: ${coverageParts.join(" · ")}`);
  }

  api.innerHTML=apiRows
    .map(text=>`<div>${safe(text)}</div>`)
    .join("");

  const rowHtml=diagnostics.rows.slice(0,10).map(row=>{
    const meta=diagnosticStatusMeta(row.status);
    const actual=row.activity
      ?formatSyncedActivitySummary(row.activity)
      :"Geen passende activiteit";
    const ratio=row.ratio===null
      ?""
      :` · ${Math.round(row.ratio*100)}% van gepland`;

    return `
      <div class="reason-item">
        <div class="reason-icon ${meta.cls}">${meta.icon}</div>
        <div>
          <strong>${safe(row.date)} · ${safe(meta.label)}</strong>
          <div>${safe(row.workout?.name||"Training")}</div>
          <small>${safe(actual)}${safe(ratio)} · ${safe(row.reason)}</small>
        </div>
      </div>
    `;
  });

  const extraHtml=diagnostics.extras.slice(0,5).map(activity=>`
    <div class="reason-item">
      <div class="reason-icon warn">+</div>
      <div>
        <strong>${safe(activity.date)} · Extra activiteit</strong>
        <div>${safe(formatSyncedActivitySummary(activity))}</div>
        <small>Niet gebruikt voor een geplande training; dit kan een warming-up, extra sessie of ongeplande training zijn.</small>
      </div>
    </div>
  `);

  list.innerHTML=[...rowHtml,...extraHtml].join("") ||
    '<div class="reason-item"><div class="reason-icon warn">…</div><div>Nog geen recente syncdata om te kalibreren.</div></div>';
}

function buildActivitySyncDiagnosticText(){
  const diagnostics=buildActivitySyncDiagnostics(21);
  const lines=[
    "Jaco Performance 9.2.1 · Training Sync diagnose",
    `Laatste sync: ${activitySyncMeta?.fetchedAt||"nog niet"}`,
    `Bereik: ${activitySyncMeta?.oldest||"—"} t/m ${activitySyncMeta?.newest||"—"}`,
    `API ontvangen/bruikbaar/overgeslagen: ${activitySyncMeta?.rawCount??"—"}/${activitySyncMeta?.normalizedCount??"—"}/${activitySyncMeta?.droppedCount??"—"}`,
    `Kalibratie: ${diagnostics.counts.auto} automatisch, ${diagnostics.counts.review} controleren, ${diagnostics.counts.unmatched} niet gekoppeld, ${diagnostics.counts.manual} handmatig, ${diagnostics.counts.protected} races beschermd, ${diagnostics.counts.extras} extra activiteiten`,
    ""
  ];

  diagnostics.rows.slice(0,12).forEach(row=>{
    lines.push(
      `${row.date} | ${row.status} | ${row.workout?.name||"Training"} | `+
      `${row.activity?formatSyncedActivitySummary(row.activity):"geen activiteit"} | `+
      `${row.ratio===null?"ratio —":`ratio ${Math.round(row.ratio*100)}%`} | ${row.reason}`
    );
  });

  diagnostics.extras.slice(0,8).forEach(activity=>{
    lines.push(
      `${activity.date} | extra | ${formatSyncedActivitySummary(activity)}`
    );
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
      rows.push(`Vandaag uitgevoerd: ${formatSyncedActivitySummary(execution.actual)}`);
    }else if(execution.status==="review" && execution.actual){
      rows.push(
        `Vandaag kandidaat gevonden, maar controle nodig: ${formatSyncedActivitySummary(execution.actual)} · ${execution.reason}`
      );
    }else{
      rows.push(`Vandaag gepland: ${workout.name} · nog geen betrouwbare koppeling gevonden`);
    }
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

  renderActivitySyncDiagnostics();
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
      count:Array.isArray(data.activities)?data.activities.length:0,
      rawCount:finiteNumberOrNull(data.rawCount),
      normalizedCount:finiteNumberOrNull(data.normalizedCount),
      droppedCount:finiteNumberOrNull(data.droppedCount),
      typeCounts:isPlainBackupObject(data.typeCounts)?data.typeCounts:{},
      metricsCoverage:isPlainBackupObject(data.metricsCoverage)?data.metricsCoverage:{}
    };

    saveActivitySyncCache();

    const completionChanged=reconcileSyncedCompletions({
      oldest:activitySyncMeta.oldest,
      newest:activitySyncMeta.newest
    });

    if(typeof syncTrainingQualityLatest==="function"){
      await syncTrainingQualityLatest({
        silent:true,
        render:false
      });
    }

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
      const diagnostics=buildActivitySyncDiagnostics(21);
      status.className=diagnostics.counts.review?"status":"status ok";
      status.textContent=
        `${activitySyncMeta.count} activiteit(en) geladen · `+
        `${diagnostics.counts.auto} automatisch gekoppeld · `+
        `${diagnostics.counts.review} controleren · `+
        `${diagnostics.counts.extras} extra.`;
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
