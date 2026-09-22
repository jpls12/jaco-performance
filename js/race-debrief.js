const RACE_DEBRIEF_KEY="jp_race_debrief_v1";
let raceDebriefs=loadObject(RACE_DEBRIEF_KEY);
if(!isPlainBackupObject(raceDebriefs)){
  raceDebriefs={};
}

function saveRaceDebriefs(){
  saveObject(RACE_DEBRIEF_KEY,raceDebriefs);
}

function raceDebriefPastRaces(){
  const today=todayDateString();
  return Object.values(races||{})
    .filter(race=>race?.date && race.date<=today)
    .sort((a,b)=>b.date.localeCompare(a.date));
}

function raceDebriefDistanceRatio(activity,race){
  const actual=finiteNumberOrNull(activity?.distanceKm);
  const planned=finiteNumberOrNull(race?.distanceKm);
  if(actual===null||planned===null||actual<=0||planned<=0){
    return null;
  }
  return actual/planned;
}

function raceDebriefActivityCandidates(race){
  if(!race?.date) return[];

  return syncedActivitiesForDate(race.date)
    .filter(activity=>
      syncedSportFamily(activity.type)==="run"
    )
    .map(activity=>{
      const ratio=raceDebriefDistanceRatio(activity,race);
      const actualDistance=finiteNumberOrNull(activity.distanceKm);
      const raceDistance=finiteNumberOrNull(race.distanceKm);
      const elapsed=finiteNumberOrNull(activity.elapsedMinutes);
      const moving=finiteNumberOrNull(activity.durationMinutes);

      let score=0;
      if(ratio!==null){
        score+=Math.max(
          0,
          100-Math.abs(1-ratio)*250
        );
      }
      if(actualDistance!==null&&raceDistance!==null){
        score+=Math.max(
          0,
          25-Math.abs(actualDistance-raceDistance)*4
        );
      }
      if(elapsed!==null||moving!==null){
        score+=10;
      }

      return{activity,ratio,score};
    })
    .filter(item=>
      item.ratio!==null &&
      item.ratio>=.82 &&
      item.ratio<=1.18
    )
    .sort((a,b)=>b.score-a.score);
}

function raceDebriefMatch(race){
  const candidates=raceDebriefActivityCandidates(race);
  const best=candidates[0]||null;
  const second=candidates[1]||null;

  if(!best){
    return{
      status:"unmatched",
      activity:null,
      confidence:"Geen",
      reason:"Geen hardloopactiviteit op racedag met passende afstand gevonden.",
      candidates
    };
  }

  const scoreGap=
    second
      ?best.score-second.score
      :null;

  if(scoreGap!==null&&scoreGap<12){
    return{
      status:"review",
      activity:best.activity,
      confidence:"Controleren",
      reason:"Meerdere activiteiten op racedag passen bijna even goed.",
      candidates
    };
  }

  const deviation=Math.abs(1-best.ratio);
  const confidence=
    deviation<=.035
      ?"Hoog"
      :deviation<=.08
        ?"Goed"
        :"Redelijk";

  return{
    status:"matched",
    activity:best.activity,
    confidence,
    reason:
      deviation<=.035
        ?"Racedatum en afstand passen zeer sterk."
        :"Racedatum en afstand passen voldoende.",
    candidates
  };
}

function raceDebriefActualSeconds(activity){
  const elapsed=finiteNumberOrNull(activity?.elapsedMinutes);
  const moving=finiteNumberOrNull(activity?.durationMinutes);

  if(elapsed!==null&&moving!==null&&moving>0){
    const ratio=elapsed/moving;
    if(ratio<=1.04){
      return{
        seconds:elapsed*60,
        source:"verstreken tijd"
      };
    }
  }

  if(moving!==null){
    return{
      seconds:moving*60,
      source:"bewegende tijd"
    };
  }

  if(elapsed!==null){
    return{
      seconds:elapsed*60,
      source:"verstreken tijd"
    };
  }

  return{
    seconds:null,
    source:"geen tijd"
  };
}

function raceDebriefSavedBaseline(race){
  const saved=raceSimulations?.[race?.id]||null;
  const strategySeconds=finiteNumberOrNull(
    saved?.strategy?.reference?.seconds
  );

  if(strategySeconds!==null){
    return{
      seconds:strategySeconds,
      source:"Bewaard raceplan",
      createdAt:saved.createdAt||null
    };
  }

  const target=parseTimeToSeconds(race?.targetTime);
  if(target){
    return{
      seconds:target,
      source:"Ingestelde streeftijd",
      createdAt:null
    };
  }

  return{
    seconds:null,
    source:"Geen pre-race referentie bewaard",
    createdAt:null
  };
}

function raceDebriefDeltaText(actual,baseline){
  if(actual===null||baseline===null) return"—";

  const delta=Math.round(actual-baseline);
  const abs=Math.abs(delta);
  const time=raceDebriefGapText(abs);

  if(Math.abs(delta)<=3){
    return"vrijwel exact op referentie";
  }

  return delta<0
    ?`${time} sneller`
    :`${time} langzamer`;
}

function raceDebriefGapText(seconds){
  const value=Math.abs(Math.round(Number(seconds)||0));
  const hours=Math.floor(value/3600);
  const minutes=Math.floor((value%3600)/60);
  const secs=value%60;

  if(hours){
    return `${hours}:${String(minutes).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
  }

  return `${minutes}:${String(secs).padStart(2,"0")}`;
}

function raceDebriefStored(raceId){
  const item=raceDebriefs?.[raceId];
  return isPlainBackupObject(item)?item:null;
}

function raceDebriefEvidenceBoost(activityId){
  if(!activityId) return null;

  const entry=Object.values(raceDebriefs||{}).find(item=>
    item?.verified &&
    String(item.activityId||"")===String(activityId)
  );

  if(!entry) return null;

  return{
    verified:true,
    weightBase:1.58,
    confidence:"Bevestigde race",
    raceId:entry.raceId,
    verifiedAt:entry.verifiedAt||entry.updatedAt||null
  };
}

function raceDebriefModelSnapshot(){
  if(typeof buildPerformanceModel!=="function") return null;

  const model=buildPerformanceModel();
  return{
    capturedAt:new Date().toISOString(),
    predictions:Object.fromEntries(
      model.predictions.map(item=>[
        item.key,
        finiteNumberOrNull(item.prediction?.seconds)
      ])
    ),
    confidence:model.overallConfidence
  };
}

function raceDebriefCalibrationChanges(before,after){
  if(!before?.predictions||!after?.predictions) return[];

  const labels={
    "5k":"5 km",
    "10k":"10 km",
    hm:"HM",
    marathon:"Marathon"
  };

  const changes=[];

  Object.keys(labels).forEach(key=>{
    const a=finiteNumberOrNull(before.predictions[key]);
    const b=finiteNumberOrNull(after.predictions[key]);
    if(a===null||b===null) return;

    const delta=Math.round(b-a);
    if(Math.abs(delta)<2) return;

    changes.push({
      key,
      label:labels[key],
      before:a,
      after:b,
      delta
    });
  });

  return changes;
}

function raceDebriefReadForm(){
  return{
    rpe:finiteNumberOrNull(
      document.getElementById("raceDebriefRpe")?.value
    ),
    fuelExecution:String(
      document.getElementById("raceDebriefFuel")?.value||""
    ),
    stomach:String(
      document.getElementById("raceDebriefStomach")?.value||""
    ),
    notes:String(
      document.getElementById("raceDebriefNotes")?.value||""
    ).trim()
  };
}

function raceDebriefFillForm(stored){
  const set=(id,value)=>{
    const element=document.getElementById(id);
    if(!element) return;
    element.value=value===null||value===undefined?"":String(value);
  };

  set("raceDebriefRpe",stored?.rpe??"");
  set("raceDebriefFuel",stored?.fuelExecution??"");
  set("raceDebriefStomach",stored?.stomach??"");
  set("raceDebriefNotes",stored?.notes??"");
}

function renderRaceDebriefOptions(){
  const select=document.getElementById("raceDebriefSelect");
  if(!select) return;

  const previous=select.value;
  const past=raceDebriefPastRaces();

  select.innerHTML=past.length
    ?past.map(race=>`
      <option value="${safe(race.id)}">
        ${safe(race.name)} — ${safe(race.date)}
      </option>
    `).join("")
    :'<option value="">Nog geen afgelopen wedstrijd</option>';

  if(previous&&races[previous]&&races[previous].date<=todayDateString()){
    select.value=previous;
  }

  renderRaceDebrief();
}

function renderRaceDebrief(){
  const select=document.getElementById("raceDebriefSelect");
  if(!select) return null;

  const race=races[select.value]||null;
  const status=document.getElementById("raceDebriefStatus");

  if(!race){
    document.getElementById("raceDebriefMatch").textContent="—";
    document.getElementById("raceDebriefActual").textContent="—";
    document.getElementById("raceDebriefVsPlan").textContent="—";
    document.getElementById("raceDebriefHr").textContent="—";
    document.getElementById("raceDebriefLoad").textContent="—";
    document.getElementById("raceDebriefModelImpact").textContent=
      "Nog geen wedstrijd om te beoordelen.";
    document.getElementById("saveRaceDebrief").disabled=true;
    raceDebriefFillForm(null);
    return null;
  }

  const match=raceDebriefMatch(race);
  const activity=match.activity;
  const actual=raceDebriefActualSeconds(activity);
  const baseline=raceDebriefSavedBaseline(race);
  const stored=raceDebriefStored(race.id);

  document.getElementById("raceDebriefMatch").textContent=
    match.status==="matched"
      ?`${match.confidence} · ${activity.name}`
      :match.status==="review"
        ?`Controleren · ${activity?.name||"activiteit"}`
        :"Niet gekoppeld";

  document.getElementById("raceDebriefActual").textContent=
    actual.seconds!==null
      ?`${formatRaceTime(actual.seconds)} · ${actual.source}`
      :"—";

  document.getElementById("raceDebriefVsPlan").textContent=
    actual.seconds!==null&&baseline.seconds!==null
      ?`${raceDebriefDeltaText(actual.seconds,baseline.seconds)} · ${baseline.source}`
      :baseline.source;

  document.getElementById("raceDebriefHr").textContent=
    finiteNumberOrNull(activity?.averageHeartRate)!==null
      ?`${Math.round(activity.averageHeartRate)} bpm gem. · ${Math.round(activity.maxHeartRate||0)||"—"} max`
      :"—";

  document.getElementById("raceDebriefLoad").textContent=
    finiteNumberOrNull(activity?.trainingLoad)!==null
      ?String(Math.round(activity.trainingLoad))
      :"—";

  const pace=
    actual.seconds!==null &&
    finiteNumberOrNull(activity?.distanceKm)!==null &&
    activity.distanceKm>0
      ?actual.seconds/activity.distanceKm
      :null;

  document.getElementById("raceDebriefPace").textContent=
    pace!==null
      ?`${formatPace(pace)}/km · GPS ${activity.distanceKm.toFixed(2)} km`
      :"—";

  raceDebriefFillForm(stored);

  if(stored?.verified){
    status.className="status ok";
    status.textContent=
      `Race bevestigd op ${new Date(stored.verifiedAt||stored.updatedAt).toLocaleString("nl-NL")}.`;
  }else{
    status.className="status";
    status.textContent=match.reason;
  }

  const impact=document.getElementById("raceDebriefModelImpact");
  if(stored?.verified){
    const changes=stored.calibrationChanges||[];
    impact.textContent=changes.length
      ?changes.map(change=>
        `${change.label}: ${formatRaceTime(change.before)} → ${formatRaceTime(change.after)}`
      ).join(" · ")
      :"Bevestigde race telt nu zwaarder als prestatiebewijs; huidige modelmediaan veranderde hierdoor niet materieel.";
  }else{
    impact.textContent=
      "Na bevestigen telt dezelfde raceactiviteit zwaarder als bewijs in het Performance Model, zonder dubbel bewijs toe te voegen.";
  }

  document.getElementById("saveRaceDebrief").disabled=
    !activity || !actual.seconds;

  return{
    race,
    match,
    activity,
    actual,
    baseline,
    stored
  };
}

function saveRaceDebrief(){
  const view=renderRaceDebrief();
  if(!view?.race||!view.activity||!view.actual.seconds) return;

  const form=raceDebriefReadForm();
  const before=raceDebriefModelSnapshot();
  const now=new Date().toISOString();

  raceDebriefs[view.race.id]={
    raceId:view.race.id,
    raceName:view.race.name,
    raceDate:view.race.date,
    raceDistanceKm:finiteNumberOrNull(view.race.distanceKm),
    activityId:view.activity.id,
    activityDistanceKm:finiteNumberOrNull(view.activity.distanceKm),
    actualSeconds:view.actual.seconds,
    actualTimeSource:view.actual.source,
    baselineSeconds:view.baseline.seconds,
    baselineSource:view.baseline.source,
    averageHeartRate:finiteNumberOrNull(view.activity.averageHeartRate),
    maxHeartRate:finiteNumberOrNull(view.activity.maxHeartRate),
    trainingLoad:finiteNumberOrNull(view.activity.trainingLoad),
    rpe:form.rpe,
    fuelExecution:form.fuelExecution,
    stomach:form.stomach,
    notes:form.notes,
    verified:true,
    verifiedAt:raceDebriefs[view.race.id]?.verifiedAt||now,
    updatedAt:now,
    calibrationBefore:before
  };

  saveRaceDebriefs();

  const after=raceDebriefModelSnapshot();
  raceDebriefs[view.race.id].calibrationAfter=after;
  raceDebriefs[view.race.id].calibrationChanges=
    raceDebriefCalibrationChanges(before,after);
  saveRaceDebriefs();

  if(typeof renderPerformanceModel==="function"){
    renderPerformanceModel();
  }
  if(typeof renderRaceCalendarOptimizer==="function"){
    renderRaceCalendarOptimizer();
  }
  if(typeof refreshDerivedCoachViews==="function"){
    refreshDerivedCoachViews();
  }

  renderRaceDebrief();
}

async function refreshRaceDebriefData(){
  const status=document.getElementById("raceDebriefStatus");
  if(status){
    status.className="status";
    status.textContent="Training Sync wordt vernieuwd…";
  }

  const result=await syncCompletedActivities({
    silent:true,
    render:false
  });

  renderRaceDebrief();

  if(status&&!result.ok){
    status.className="status error";
    status.textContent=
      "Training Sync kon niet worden vernieuwd; bestaande lokale data blijft beschikbaar.";
  }

  return result;
}
