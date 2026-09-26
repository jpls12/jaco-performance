const FULLY_ADAPTIVE_COACH_KEY="jp_fully_adaptive_coach_v1";

let fullyAdaptiveCoachCache=loadObject(FULLY_ADAPTIVE_COACH_KEY);
if(!isPlainBackupObject(fullyAdaptiveCoachCache)){
  fullyAdaptiveCoachCache={
    current:null,
    previous:null
  };
}

let latestFullyAdaptiveCoachState=null;

function fullyAdaptiveCoachSyncAgeHours(){
  if(!activitySyncMeta?.fetchedAt) return null;
  const stamp=new Date(activitySyncMeta.fetchedAt);
  if(Number.isNaN(stamp.getTime())) return null;
  return (Date.now()-stamp.getTime())/3600000;
}

function fullyAdaptiveCoachConfidence({
  readiness,
  load,
  performance,
  quality,
  qualityCandidate
}){
  let score=0;
  const notes=[];

  if(readiness?.sufficientData){
    score+=25;
  }else{
    notes.push("hersteldata beperkt");
  }

  if(load?.level && load.level!=="unknown"){
    score+=20;
  }else{
    notes.push("belastingsbasis beperkt");
  }

  const syncAge=fullyAdaptiveCoachSyncAgeHours();
  if(syncAge!==null && syncAge>=0 && syncAge<=30){
    score+=20;
  }else{
    notes.push("Training Sync niet recent");
  }

  const modelScore=finiteNumberOrNull(
    performance?.overallConfidence
  );
  if(modelScore!==null){
    score+=Math.round(
      Math.max(0,Math.min(20,modelScore*.20))
    );
  }else{
    notes.push("prestatiemodel beperkt");
  }

  if(quality){
    const qualityConfidence=finiteNumberOrNull(
      quality.confidence?.score
    );
    score+=qualityConfidence===null
      ?8
      :Math.round(Math.max(5,Math.min(15,qualityConfidence*.15)));
  }else if(!qualityCandidate){
    // Geen recente sleuteltraining is geen fout.
    score+=10;
  }else{
    notes.push("sleuteltraining nog niet geanalyseerd");
  }

  score=Math.max(0,Math.min(100,score));

  const label=
    score>=85
      ?"Hoog"
      :score>=68
        ?"Goed"
        :score>=50
          ?"Redelijk"
          :"Beperkt";

  return{
    score,
    label,
    notes,
    text:notes.length
      ?`${label} vertrouwen; aandacht voor ${notes.join(", ")}.`
      :`${label} vertrouwen op basis van actuele herstel-, sync-, kwaliteits- en prestatiedata.`
  };
}

function fullyAdaptiveCoachGoal(race,performance){
  if(!race){
    return{
      race:null,
      label:"Geen doelwedstrijd",
      detail:"Voeg een wedstrijd toe om doelontwikkeling te volgen.",
      predictionSeconds:null,
      targetSeconds:null,
      gapSeconds:null,
      state:"neutral"
    };
  }

  const prediction=
    typeof performanceModelPredictionForDistance==="function"
      ?performanceModelPredictionForDistance(
        Number(race.distanceKm||0)
      )
      :null;

  const predicted=finiteNumberOrNull(prediction?.seconds);
  const target=parseTimeToSeconds(race.targetTime);
  const days=daysUntil(race.date);

  if(predicted===null){
    return{
      race,
      label:`${race.name} · ${days} d`,
      detail:"Nog onvoldoende prestatiebewijs voor een actuele prognose.",
      predictionSeconds:null,
      targetSeconds:target,
      gapSeconds:null,
      state:"neutral"
    };
  }

  if(target===null){
    return{
      race,
      label:`${race.name} · ${days} d`,
      detail:`Actuele prognose ${formatRaceTime(predicted)} · ${prediction.confidence}.`,
      predictionSeconds:predicted,
      targetSeconds:null,
      gapSeconds:null,
      state:"neutral"
    };
  }

  const gap=predicted-target;
  const ratio=gap/target;

  if(ratio<=-.005){
    return{
      race,
      label:`${race.name} · ${days} d`,
      detail:`Model ${formatRaceTime(predicted)} versus doel ${race.targetTime}: momenteel sneller dan doel.`,
      predictionSeconds:predicted,
      targetSeconds:target,
      gapSeconds:gap,
      state:"ahead"
    };
  }

  if(Math.abs(ratio)<=.01){
    return{
      race,
      label:`${race.name} · ${days} d`,
      detail:`Model ${formatRaceTime(predicted)} versus doel ${race.targetTime}: doel ligt binnen de modelmarge.`,
      predictionSeconds:predicted,
      targetSeconds:target,
      gapSeconds:gap,
      state:"close"
    };
  }

  return{
    race,
    label:`${race.name} · ${days} d`,
    detail:`Model ${formatRaceTime(predicted)} versus doel ${race.targetTime}: nog ${fullyAdaptiveCoachGapText(gap)} te overbruggen.`,
    predictionSeconds:predicted,
    targetSeconds:target,
    gapSeconds:gap,
    state:"gap"
  };
}

function fullyAdaptiveCoachGapText(seconds){
  const value=Math.abs(Math.round(Number(seconds)||0));
  const hours=Math.floor(value/3600);
  const minutes=Math.floor((value%3600)/60);
  const secs=value%60;

  if(hours){
    return `${hours}:${String(minutes).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
  }

  return `${minutes}:${String(secs).padStart(2,"0")}`;
}

function fullyAdaptiveCoachPriority({
  dailyDecision,
  recommendation,
  week,
  qualityFeedback
}){
  if(dailyDecision?.state==="race"){
    return{
      level:"race",
      cls:"race",
      label:"RACE",
      headline:dailyDecision.title,
      summary:"Wedstrijddag is leidend; automatische kalenderaanpassingen blijven geblokkeerd."
    };
  }

  if(dailyDecision?.state==="recover"){
    return{
      level:"recover",
      cls:"recover",
      label:"HERSTEL",
      headline:dailyDecision.title,
      summary:"Herstel heeft voorrang op extra trainingsbelasting."
    };
  }

  if(
    dailyDecision?.state==="adjust" ||
    ["replace","rest","new"].includes(recommendation?.kind)
  ){
    return{
      level:"adjust",
      cls:"adjust",
      label:"AANPASSEN",
      headline:dailyDecision?.title||"Training aanpassen",
      summary:"De coach adviseert een concrete wijziging voor vandaag."
    };
  }

  if(
    week?.stress?.level==="elevated" &&
    week?.changes?.length
  ){
    return{
      level:"week",
      cls:"adjust",
      label:"WEEK AANPASSEN",
      headline:"De rest van de week vraagt herschikking",
      summary:"Belasting en weekstructuur geven samen aanleiding tot een toekomstige kalenderwijziging."
    };
  }

  if(week?.changes?.length){
    return{
      level:"week",
      cls:"control",
      label:"WEEK BIJSTUREN",
      headline:"De week kan veiliger of slimmer worden verdeeld",
      summary:"Er staan toekomstige aanpassingen klaar, maar vandaag hoeft niet per se te veranderen."
    };
  }

  if(
    dailyDecision?.state==="control" ||
    ["attention","elevated"].includes(qualityFeedback?.level)
  ){
    return{
      level:"control",
      cls:"control",
      label:"GECONTROLEERD",
      headline:dailyDecision?.title||"Vandaag gecontroleerd trainen",
      summary:"De planning kan blijven staan, maar extra intensiteit of extra volume is niet nodig."
    };
  }

  return{
    level:"execute",
    cls:"execute",
    label:"OP SCHEMA",
    headline:dailyDecision?.title||"Voer de training uit zoals gepland",
    summary:"Herstel, uitvoering en weekstructuur geven geen reden voor een aanpassing."
  };
}

function fullyAdaptiveCoachPrimaryAction({
  dailyDecision,
  recommendation,
  week,
  qualityCandidate,
  quality
}){
  if(
    dailyDecision?.state!=="race" &&
    ["replace","rest","new"].includes(recommendation?.kind) &&
    recommendation?.workout
  ){
    return{
      kind:"today",
      label:"Pas vandaag aan",
      text:"Gebruik de bestaande veilige dagcoachactie."
    };
  }

  if(week?.changes?.length){
    return{
      kind:"week",
      label:`Pas ${week.changes.length} weekwijziging${week.changes.length===1?"":"en"} toe`,
      text:"Wedstrijden blijven beschermd en je bevestigt de wijziging nog één keer."
    };
  }

  if(
    qualityCandidate &&
    (
      !quality ||
      quality.activityId!==qualityCandidate.execution.actual.id
    )
  ){
    return{
      kind:"quality",
      label:"Analyseer sleuteltraining",
      text:"Haal de blokdetails van de recentste sleuteltraining op."
    };
  }

  return{
    kind:"none",
    label:"Geen wijziging nodig",
    text:"De huidige planning kan blijven staan."
  };
}

function fullyAdaptiveCoachSignalRows({
  readiness,
  load,
  execution,
  quality,
  week,
  performance,
  goal
}){
  const rows=[];

  rows.push({
    key:"recovery",
    state:
      readiness?.level==="good"
        ?"good"
        :readiness?.level==="low"
          ?"bad"
          :"warn",
    label:"Herstel",
    value:readiness?.sufficientData
      ?`${readiness.score}/100 · ${readiness.level}`
      :"Onvoldoende data"
  });

  rows.push({
    key:"load",
    state:
      load?.level==="stable"
        ?"good"
        :load?.level==="elevated"
          ?"bad"
          :"warn",
    label:"Belasting",
    value:load?.level==="stable"
      ?"Stabiel"
      :load?.level==="attention"
        ?"Aandacht"
        :load?.level==="elevated"
          ?"Verhoogd"
          :"Onvoldoende data"
  });

  rows.push({
    key:"execution",
    state:
      execution?.level==="stable"
        ?"good"
        :execution?.level==="elevated"
          ?"bad"
          :"warn",
    label:"Uitvoering",
    value:execution?.level==="unknown"
      ?"Nog geen recente koppeling"
      :execution.text
  });

  rows.push({
    key:"quality",
    state:
      !quality
        ?"warn"
        :quality.score===null
          ?"warn"
          :quality.score>=80
            ?"good"
            :quality.score<68
              ?"bad"
              :"warn",
    label:"Trainingskwaliteit",
    value:quality
      ?quality.score===null
        ?`${quality.workoutName} · onvoldoende intervaldata`
        :`${quality.workoutName} · ${quality.score}/100`
      :"Nog geen recente analyse"
  });

  rows.push({
    key:"week",
    state:week?.changes?.length?"warn":"good",
    label:"Week",
    value:week?.changes?.length
      ?`${week.changes.length} voorgestelde wijziging${week.changes.length===1?"":"en"}`
      :"Geen wijziging nodig"
  });

  rows.push({
    key:"performance",
    state:
      goal?.state==="ahead" || goal?.state==="close"
        ?"good"
        :goal?.state==="gap"
          ?"warn"
          :Number(performance?.overallConfidence||0)>=55
            ?"good"
            :"warn",
    label:"Doelontwikkeling",
    value:goal?.detail||
      `Modelvertrouwen ${performance?.overallConfidence||0}/100`
  });

  return rows;
}

function buildFullyAdaptiveCoachState(){
  const snapshot=getWellnessSnapshot();
  const readiness=determineReadiness(snapshot);
  const load=buildLoadMonitor();
  const race=getRaceFocus();
  const phase=classifyRacePhase(race);
  const availability=todayAvailabilityInfo();
  const existing=currentTodayWorkout();
  const execution=buildAdaptiveExecutionFeedback();

  const recommendation=
    pendingTodayAdvice ||
    createTodayRecommendation(
      readiness,
      race,
      phase,
      availability,
      existing,
      execution
    );

  const dailyDecision=buildDailyDecision({
    readiness,
    race,
    phase,
    availability,
    existing,
    recommendation,
    executionFeedback:execution,
    loadMonitor:load
  });

  const week=
    pendingWeekReplan ||
    buildAdaptiveWeekReplan();

  const storedQuality=latestTrainingQualityResult();
  const qualityCandidate=
    typeof qualityRecentCandidate==="function"
      ?qualityRecentCandidate()
      :null;
  const candidateActivityId=
    qualityCandidate?.execution?.actual?.id||null;
  const quality=
    candidateActivityId &&
    storedQuality?.activityId!==candidateActivityId
      ?null
      :storedQuality;
  const qualityFeedback=
    typeof latestTrainingQualityFeedback==="function"
      ?latestTrainingQualityFeedback(candidateActivityId)
      :{level:"unknown",text:"Geen kwaliteitsfeedback."};

  const performance=buildPerformanceModel();
  const goal=fullyAdaptiveCoachGoal(race,performance);
  const confidence=fullyAdaptiveCoachConfidence({
    readiness,
    load,
    performance,
    quality,
    qualityCandidate
  });

  const priority=fullyAdaptiveCoachPriority({
    dailyDecision,
    recommendation,
    week,
    qualityFeedback
  });

  const primaryAction=fullyAdaptiveCoachPrimaryAction({
    dailyDecision,
    recommendation,
    week,
    qualityCandidate,
    quality
  });

  const signals=fullyAdaptiveCoachSignalRows({
    readiness,
    load,
    execution,
    quality,
    week,
    performance,
    goal
  });

  return{
    createdAt:new Date().toISOString(),
    date:todayDateString(),
    readiness,
    load,
    race,
    phase,
    availability,
    existing,
    execution,
    recommendation,
    dailyDecision,
    week,
    quality,
    qualityFeedback,
    performance,
    goal,
    confidence,
    priority,
    primaryAction,
    signals
  };
}

function compactFullyAdaptiveCoachState(state){
  return{
    date:state.date,
    priority:state.priority.level,
    decisionState:state.dailyDecision?.state||null,
    readinessLevel:state.readiness?.level||null,
    readinessScore:finiteNumberOrNull(state.readiness?.score),
    loadLevel:state.load?.level||null,
    executionLevel:state.execution?.level||null,
    qualityActivityId:state.quality?.activityId||null,
    qualityScore:finiteNumberOrNull(state.quality?.score),
    weekChanges:Number(state.week?.changes?.length||0),
    raceId:state.race?.id||null,
    raceDate:state.race?.date||null,
    predictionSeconds:finiteNumberOrNull(state.goal?.predictionSeconds),
    targetSeconds:finiteNumberOrNull(state.goal?.targetSeconds),
    coachConfidence:Number(state.confidence?.score||0)
  };
}

function fullyAdaptiveCoachSignature(snapshot){
  return JSON.stringify(snapshot);
}

function trackFullyAdaptiveCoachState(state){
  const snapshot=compactFullyAdaptiveCoachState(state);
  const signature=fullyAdaptiveCoachSignature(snapshot);
  const nowIso=new Date().toISOString();
  const current=fullyAdaptiveCoachCache.current;

  if(!current){
    fullyAdaptiveCoachCache.current={
      signature,
      snapshot,
      recordedAt:nowIso
    };
    fullyAdaptiveCoachCache.previous=null;
    saveObject(FULLY_ADAPTIVE_COACH_KEY,fullyAdaptiveCoachCache);
    return fullyAdaptiveCoachCache;
  }

  if(current.signature===signature){
    return fullyAdaptiveCoachCache;
  }

  const currentAgeMs=
    Date.now()-new Date(current.recordedAt||0).getTime();
  const sameRefreshTransaction=
    fullyAdaptiveCoachCache.previous &&
    Number.isFinite(currentAgeMs) &&
    currentAgeMs>=0 &&
    currentAgeMs<90000;

  if(!sameRefreshTransaction){
    fullyAdaptiveCoachCache.previous=current;
  }

  fullyAdaptiveCoachCache.current={
    signature,
    snapshot,
    recordedAt:nowIso
  };

  saveObject(FULLY_ADAPTIVE_COACH_KEY,fullyAdaptiveCoachCache);
  return fullyAdaptiveCoachCache;
}

function fullyAdaptiveCoachChanges(previous,current){
  if(!current) return[];

  if(!previous){
    return[
      "Coachbaseline aangemaakt. Vanaf de volgende sync zie je hier welke signalen echt veranderd zijn."
    ];
  }

  const changes=[];

  if(previous.decisionState!==current.decisionState){
    changes.push(
      `Dagstatus veranderde van ${previous.decisionState||"onbekend"} naar ${current.decisionState||"onbekend"}.`
    );
  }

  const readinessBefore=finiteNumberOrNull(previous.readinessScore);
  const readinessNow=finiteNumberOrNull(current.readinessScore);
  if(
    readinessBefore!==null &&
    readinessNow!==null &&
    Math.abs(readinessNow-readinessBefore)>=5
  ){
    const delta=Math.round(readinessNow-readinessBefore);
    changes.push(
      `Herstelscore ${delta>0?"+":""}${delta} punten naar ${Math.round(readinessNow)}/100.`
    );
  }else if(previous.readinessLevel!==current.readinessLevel){
    changes.push(
      `Herstelniveau veranderde van ${previous.readinessLevel||"onbekend"} naar ${current.readinessLevel||"onbekend"}.`
    );
  }

  if(previous.loadLevel!==current.loadLevel){
    changes.push(
      `Belastingsstatus veranderde van ${previous.loadLevel||"onbekend"} naar ${current.loadLevel||"onbekend"}.`
    );
  }

  if(previous.qualityActivityId!==current.qualityActivityId){
    if(current.qualityActivityId){
      changes.push(
        current.qualityScore===null
          ?"Nieuwe sleuteltraining geanalyseerd, maar intervaldata was onvoldoende voor een score."
          :`Nieuwe sleuteltraining geanalyseerd: ${Math.round(current.qualityScore)}/100.`
      );
    }
  }else{
    const before=finiteNumberOrNull(previous.qualityScore);
    const now=finiteNumberOrNull(current.qualityScore);
    if(
      before!==null &&
      now!==null &&
      Math.abs(now-before)>=5
    ){
      changes.push(
        `Trainingskwaliteit veranderde van ${Math.round(before)} naar ${Math.round(now)}/100.`
      );
    }
  }

  if(previous.weekChanges!==current.weekChanges){
    changes.push(
      `Weekvoorstel: ${current.weekChanges} toekomstige wijziging${current.weekChanges===1?"":"en"} in plaats van ${previous.weekChanges}.`
    );
  }

  const predictionBefore=finiteNumberOrNull(previous.predictionSeconds);
  const predictionNow=finiteNumberOrNull(current.predictionSeconds);
  if(
    predictionBefore!==null &&
    predictionNow!==null &&
    Math.abs(predictionNow-predictionBefore)>=15
  ){
    const delta=predictionNow-predictionBefore;
    changes.push(
      `Doelprognose werd ${fullyAdaptiveCoachGapText(delta)} ${delta<0?"sneller":"langzamer"}.`
    );
  }

  if(previous.raceId!==current.raceId||previous.raceDate!==current.raceDate){
    changes.push("De actieve wedstrijdfocus is gewijzigd.");
  }

  return changes.length
    ?changes.slice(0,5)
    :["Geen betekenisvolle verandering sinds de vorige coachstaat."];
}

function fullyAdaptiveCoachUpdatedLabel(recordedAt){
  if(!recordedAt) return"Nog niet bijgewerkt";
  const date=new Date(recordedAt);
  if(Number.isNaN(date.getTime())) return"Bijgewerkt";
  return `Bijgewerkt ${date.toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"})}`;
}

function renderFullyAdaptiveCoach(){
  const root=document.getElementById("fullyAdaptiveCoachCard");
  if(!root) return null;

  const state=buildFullyAdaptiveCoachState();
  latestFullyAdaptiveCoachState=state;

  const history=trackFullyAdaptiveCoachState(state);
  const changes=fullyAdaptiveCoachChanges(
    history.previous?.snapshot||null,
    history.current?.snapshot||null
  );

  root.className=`fully-adaptive-coach-card ${state.priority.cls}`;

  const badge=document.getElementById("fullyAdaptiveCoachState");
  badge.className=`fully-adaptive-coach-state ${state.priority.cls}`;
  badge.textContent=state.priority.label;

  document.getElementById("fullyAdaptiveCoachHeadline").textContent=
    state.priority.headline;
  document.getElementById("fullyAdaptiveCoachSummary").textContent=
    state.priority.summary;

  document.getElementById("fullyAdaptiveCoachConfidence").textContent=
    `${state.confidence.label} · ${state.confidence.score}/100`;
  document.getElementById("fullyAdaptiveCoachConfidenceText").textContent=
    state.confidence.text;

  document.getElementById("fullyAdaptiveToday").innerHTML=`
    <strong>${safe(state.dailyDecision.title)}</strong>
    <span>${safe(state.dailyDecision.effort)}</span>
  `;

  document.getElementById("fullyAdaptiveWeek").innerHTML=`
    <strong>${state.week.changes.length
      ?`${state.week.changes.length} wijziging${state.week.changes.length===1?"":"en"}`
      :"Week staat goed"}</strong>
    <span>${safe(state.week.stress?.level||"onbekend")}</span>
  `;

  document.getElementById("fullyAdaptiveGoal").innerHTML=`
    <strong>${safe(state.goal.label)}</strong>
    <span>${safe(state.goal.detail)}</span>
  `;

  document.getElementById("fullyAdaptiveSignals").innerHTML=
    state.signals.map(signal=>`
      <div class="fully-adaptive-signal ${signal.state}">
        <span>${safe(signal.label)}</span>
        <strong>${safe(signal.value)}</strong>
      </div>
    `).join("");

  document.getElementById("fullyAdaptiveChanges").innerHTML=
    changes.map(change=>`
      <div class="fully-adaptive-change">
        <span>↺</span>
        <div>${safe(change)}</div>
      </div>
    `).join("");

  const action=document.getElementById("fullyAdaptivePrimaryAction");
  action.disabled=state.primaryAction.kind==="none";
  action.textContent=state.primaryAction.label;
  action.dataset.action=state.primaryAction.kind;

  document.getElementById("fullyAdaptiveActionText").textContent=
    state.primaryAction.text;
  document.getElementById("fullyAdaptiveUpdated").textContent=
    fullyAdaptiveCoachUpdatedLabel(history.current?.recordedAt);

  return state;
}

async function refreshFullyAdaptiveCoach(){
  const status=document.getElementById("fullyAdaptiveCoachStatus");
  if(status){
    status.className="status";
    status.textContent="Herstel, uitvoering, kwaliteit en prestatiemodel worden vernieuwd…";
  }

  const wellness=await loadWellnessDashboard();
  const activity=await syncCompletedActivities({
    silent:true,
    render:false
  });

  refreshDerivedCoachViews();

  if(status){
    if(wellness.ok&&activity.ok){
      status.className="status ok";
      status.textContent="Volledige coachstaat is bijgewerkt.";
    }else if(wellness.ok||activity.ok){
      status.className="status";
      status.textContent="Coachstaat deels bijgewerkt; één databron kon niet worden vernieuwd.";
    }else{
      status.className="status error";
      status.textContent="Actuele coachdata kon niet worden vernieuwd; lokale planning blijft beschikbaar.";
    }
  }

  return{
    ok:Boolean(wellness.ok||activity.ok),
    wellness,
    activity
  };
}

async function applyFullyAdaptiveCoachPriority(){
  const state=latestFullyAdaptiveCoachState||renderFullyAdaptiveCoach();
  if(!state) return;

  const status=document.getElementById("fullyAdaptiveCoachStatus");
  const action=state.primaryAction.kind;

  if(action==="today"){
    document.getElementById("coachTechnical")?.setAttribute("open","");
    applyTodayRecommendation();
    return;
  }

  if(action==="week"){
    document.getElementById("coachTechnical")?.setAttribute("open","");
    applyAdaptiveWeekReplan();
    return;
  }

  if(action==="quality"){
    if(status){
      status.className="status";
      status.textContent="Sleuteltraining wordt opnieuw geanalyseerd…";
    }

    const result=await syncTrainingQualityLatest({
      force:true,
      silent:false,
      render:true
    });
    refreshDerivedCoachViews();

    if(status&&result.ok){
      status.className="status ok";
      status.textContent="Trainingskwaliteit is bijgewerkt en opnieuw meegewogen door de coach.";
    }
    return;
  }

  if(status){
    status.className="status ok";
    status.textContent="Geen kalenderwijziging nodig.";
  }
}
