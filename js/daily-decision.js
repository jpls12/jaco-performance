function decisionRpeValue(workout){
  const raw=String(workout?.rpe||"").split("/")[0];
  const value=Number(raw);
  return Number.isFinite(value)&&value>0?value:null;
}

function decisionEffortLabel(workout){
  if(!workout) return "Geen training";

  if(workout.type==="Race") return "RPE 9–10";
  if(workout.type==="Rest") return "Herstel";
  if(workout.type==="Mobility") return "RPE 1–2";

  const rpe=decisionRpeValue(workout);
  if(rpe!==null) return `RPE ${rpe}/10`;

  if(isHardWorkout(workout)) return "RPE 7–8";
  if(isLongWorkout(workout)) return "RPE 4–6";
  return "RPE 2–4";
}

function decisionConfidence(readiness,loadMonitor){
  let points=0;
  const reasons=[];

  if(readiness?.sufficientData){
    points++;
  }else{
    reasons.push("hersteldata beperkt");
  }

  if(loadMonitor?.level && loadMonitor.level!=="unknown"){
    points++;
  }else{
    reasons.push("belastingsbasis beperkt");
  }

  if(activitySyncMeta?.fetchedAt){
    const fetched=new Date(activitySyncMeta.fetchedAt);
    const ageHours=Number.isNaN(fetched.getTime())
      ?null
      :(Date.now()-fetched.getTime())/3600000;

    if(ageHours!==null && ageHours>=0 && ageHours<=30){
      points++;
    }else{
      reasons.push("Training Sync niet recent");
    }
  }else{
    reasons.push("Training Sync ontbreekt");
  }

  if(currentTodayWorkout() || todayAvailabilityInfo().available){
    points++;
  }

  if(points>=4){
    return{
      level:"high",
      label:"Hoog",
      text:"Herstel, belasting, sync en planning zijn voldoende actueel."
    };
  }

  if(points===3){
    return{
      level:"medium",
      label:"Middel",
      text:reasons.length
        ?`Goed bruikbaar, met aandacht voor ${reasons.join(", ")}.`
        :"Voldoende signalen voor een bruikbare dagbeslissing."
    };
  }

  return{
    level:"limited",
    label:"Beperkt",
    text:reasons.length
      ?`Conservatief advies door ${reasons.join(", ")}.`
      :"Te weinig actuele signalen voor sterke automatische sturing."
  };
}

function decisionStateMeta(state){
  const map={
    execute:{label:"UITVOEREN",icon:"✓",cls:"execute"},
    control:{label:"GECONTROLEERD",icon:"≈",cls:"control"},
    adjust:{label:"AANPASSEN",icon:"↻",cls:"adjust"},
    recover:{label:"HERSTELLEN",icon:"↓",cls:"recover"},
    race:{label:"RACE",icon:"🏁",cls:"race"}
  };
  return map[state]||map.control;
}

function decisionChangeLabel(recommendation,existing){
  if(existing?.type==="Race") return "Beschermd";
  if(!recommendation) return "Geen";
  if(recommendation.kind==="replace") return "Aanpassen";
  if(recommendation.kind==="rest") return existing?"Aanpassen":"Herstel";
  if(recommendation.kind==="new") return "Nieuw plan";
  return "Geen";
}

function buildDailyDecision({
  readiness,
  race,
  phase,
  availability,
  existing,
  recommendation,
  executionFeedback,
  loadMonitor
}){
  const targetWorkout=recommendation?.workout || existing || null;
  const confidence=decisionConfidence(readiness,loadMonitor);

  let state="execute";
  let title=targetWorkout
    ?`Doe vandaag: ${targetWorkout.name}`
    :"Geen training toevoegen";
  let action=recommendation?.text ||
    "Volg de bestaande planning en gebruik je gevoel als laatste controle.";

  if(existing?.type==="Race"){
    state="race";
    title=`Wedstrijddag: ${existing.name}`;
    action="Voer de wedstrijd uit zoals gepland. Training Sync verandert de wedstrijdstatus niet automatisch.";
  }else if(recommendation?.kind==="rest"){
    state="recover";
    title=targetWorkout
      ?`Herstelprioriteit: ${targetWorkout.name}`
      :"Herstel heeft vandaag prioriteit";
  }else if(recommendation?.kind==="replace"){
    const recoveryReplacement=
      String(targetWorkout?.planType||"").toLowerCase()==="recovery" ||
      targetWorkout?.type==="Mobility" ||
      (
        decisionRpeValue(targetWorkout)!==null &&
        decisionRpeValue(targetWorkout)<=3
      );

    state=recoveryReplacement?"recover":"adjust";
    title=targetWorkout
      ?recoveryReplacement
        ?`Herstelprioriteit: ${targetWorkout.name}`
        :`Pas vandaag aan naar: ${targetWorkout.name}`
      :"Pas de training van vandaag aan";
  }else if(
    readiness?.level==="low" ||
    readiness?.level==="moderate" ||
    readiness?.level==="unknown" ||
    loadMonitor?.level==="elevated" ||
    loadMonitor?.level==="attention" ||
    loadMonitor?.level==="unknown" ||
    executionFeedback?.level==="elevated" ||
    executionFeedback?.level==="attention" ||
    confidence.level==="limited"
  ){
    state="control";
    title=targetWorkout
      ?`Gecontroleerd uitvoeren: ${targetWorkout.name}`
      :"Vandaag conservatief beslissen";
  }

  const reasons=[];

  if(readiness?.sufficientData){
    reasons.push(
      readiness.level==="good"
        ?`Herstel goed (${readiness.score}/100).`
        :readiness.level==="moderate"
          ?`Herstel middelmatig (${readiness.score}/100).`
          :`Herstel laag (${readiness.score}/100).`
    );
  }else{
    reasons.push("Hersteldata is onvoldoende voor opschalen van belasting.");
  }

  if(loadMonitor?.level==="elevated"){
    reasons.push("Belastbaarheidsmonitor staat verhoogd.");
  }else if(loadMonitor?.level==="attention"){
    reasons.push("Belastbaarheidsmonitor vraagt gecontroleerde uitvoering.");
  }else if(loadMonitor?.level==="stable"){
    reasons.push("Belastingssignalen zijn stabiel.");
  }

  if(executionFeedback?.level==="elevated"){
    reasons.push(`Vorige uitvoering: ${executionFeedback.text}`);
  }else if(executionFeedback?.level==="attention"){
    reasons.push(`Training Sync: ${executionFeedback.text}`);
  }else if(executionFeedback?.level==="stable"){
    reasons.push("Laatste betrouwbaar gekoppelde training past bij de planning.");
  }

  if(race){
    const days=daysUntil(race.date);
    reasons.push(
      days===0
        ?`${race.name} is vandaag.`
        :`${race.name} over ${days} dagen · ${phaseLabel(phase.phase)}.`
    );
  }

  if(!availability?.available && existing?.type!=="Race"){
    reasons.push("Terugkerende beschikbaarheid staat vandaag op niet beschikbaar.");
  }

  return{
    state,
    title,
    action,
    targetWorkout,
    effort:decisionEffortLabel(targetWorkout),
    confidence,
    change:decisionChangeLabel(recommendation,existing),
    reasons:reasons.slice(0,4)
  };
}

function decisionDayLabel(date){
  const d=new Date(date+"T12:00:00");
  return new Intl.DateTimeFormat("nl-NL",{
    weekday:"short",
    day:"numeric",
    month:"short"
  }).format(d);
}

function buildDecisionHorizon(days=3){
  const workouts=allWorkouts();
  const today=todayDateString();
  const rows=[];

  for(let offset=1;offset<=days;offset++){
    const date=addDays(today,offset);
    const workout=workouts[date]||null;
    rows.push({
      date,
      label:decisionDayLabel(date),
      workout,
      text:workout
        ?workout.name
        :"Nog geen training gepland",
      effort:workout
        ?decisionEffortLabel(workout)
        :"—"
    });
  }

  return rows;
}

function renderDailyDecisionEngine(context){
  const root=document.getElementById("dailyDecisionCard");
  if(!root) return null;

  const decision=buildDailyDecision(context);
  const meta=decisionStateMeta(decision.state);
  const horizon=buildDecisionHorizon(3);

  root.className=`daily-decision-card ${meta.cls}`;

  const state=document.getElementById("dailyDecisionState");
  if(state){
    state.className=`daily-decision-state ${meta.cls}`;
    state.textContent=`${meta.icon} ${meta.label}`;
  }

  document.getElementById("dailyDecisionTitle").textContent=
    decision.title;
  document.getElementById("dailyDecisionAction").textContent=
    decision.action;
  document.getElementById("dailyDecisionEffort").textContent=
    decision.effort;
  document.getElementById("dailyDecisionConfidence").textContent=
    decision.confidence.label;
  document.getElementById("dailyDecisionChange").textContent=
    decision.change;
  document.getElementById("dailyDecisionConfidenceText").textContent=
    decision.confidence.text;

  document.getElementById("dailyDecisionReasons").innerHTML=
    decision.reasons.map(reason=>`
      <div class="daily-decision-reason">
        <span>•</span>
        <div>${safe(reason)}</div>
      </div>
    `).join("");

  const tomorrow=horizon[0];
  document.getElementById("dailyDecisionTomorrow").innerHTML=`
    <strong>${safe(tomorrow.label)}</strong>
    <span>${safe(tomorrow.text)}</span>
    <small>${safe(tomorrow.effort)}</small>
  `;

  document.getElementById("dailyDecisionHorizon").innerHTML=
    horizon.map(row=>`
      <div class="daily-horizon-row">
        <strong>${safe(row.label)}</strong>
        <span>${safe(row.text)}</span>
        <small>${safe(row.effort)}</small>
      </div>
    `).join("");

  return decision;
}
