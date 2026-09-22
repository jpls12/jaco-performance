const RACE_DAY_STATE_KEY="jp_race_day_v1";
let raceDayState=loadObject(RACE_DAY_STATE_KEY);
if(!isPlainBackupObject(raceDayState)){
  raceDayState={checklists:{},sessions:{}};
}
if(!isPlainBackupObject(raceDayState.checklists)){
  raceDayState.checklists={};
}
if(!isPlainBackupObject(raceDayState.sessions)){
  raceDayState.sessions={};
}
let raceDayTicker=null;

function saveRaceDayState(){
  saveObject(RACE_DAY_STATE_KEY,raceDayState);
}

function raceDayRaceId(race){
  return String(race?.id||`${race?.date||"race"}-${race?.distanceKm||""}`);
}

function raceDayChecklistItems(strategy){
  if(!strategy?.race) return[];

  const race=strategy.race;
  const fuel=strategy.personalFuel;
  const gels=fuel?.gelSchedule?.length||0;
  const sodiumCaps=fuel?.capsuleEquivalent;

  const items=[
    {
      key:"bib",
      label:"Startnummer / chip bevestigd",
      detail:"Controleer bevestiging, chip en eventuele bagageprocedure."
    },
    {
      key:"shoes",
      label:"Wedstrijdschoenen + sokken klaar",
      detail:"Gebruik alleen materiaal dat al in training is getest."
    },
    {
      key:"watch",
      label:"Horloge geladen + racescherm klaar",
      detail:"GPS vooraf laten vinden; gebruik 10.2-tempo/HR als referentie."
    },
    {
      key:"meal",
      label:"Pre-race maaltijd volgens vaste routine",
      detail:"Geen nieuwe producten of ongebruikelijke porties op racedag."
    },
    {
      key:"warmup",
      label:"Warming-up / activatie gepland",
      detail:
        Number(race.distanceKm)<=10.5
          ?"Volledige warming-up met enkele korte strides."
          :"Rustige activatie; geen onnodige energie verspillen."
    }
  ];

  if(gels>0){
    items.push({
      key:"gels",
      label:`${gels} gel${gels===1?"":"s"} meegenomen`,
      detail:`Gepland rond minuut ${fuel.gelSchedule.map(item=>item.minute).join(", ")}.`
    });
  }else{
    items.push({
      key:"fuel",
      label:"Racevoeding gecontroleerd",
      detail:strategy.fuel?.timing||"Geen specifieke gelplanning."
    });
  }

  if(fuel?.stationSchedule?.length){
    items.push({
      key:"drink",
      label:"Drankpostplan gecontroleerd",
      detail:`Ongeveer ${fuel.mlPerStation||"—"} ml per geplande post.`
    });
  }else{
    items.push({
      key:"drink",
      label:"Drinkstrategie gecontroleerd",
      detail:strategy.hydration?.fluid||"Drink naar dorst."
    });
  }

  if(
    fuel?.sodiumMgPerHour!==null &&
    fuel?.sodiumMgPerHour!==undefined
  ){
    items.push({
      key:"sodium",
      label:"Natriumplan klaar",
      detail:
        sodiumCaps!==null&&sodiumCaps!==undefined
          ?`${Math.round(fuel.sodiumMgPerHour)} mg/uur · equivalent circa ${sodiumCaps} capsule${sodiumCaps===1?"":"s"}.`
          :`${Math.round(fuel.sodiumMgPerHour)} mg/uur.`
    });
  }

  items.push({
    key:"start",
    label:"Startdiscipline bevestigd",
    detail:`Open volgens 10.2 rond ${strategy.segments?.[0]?.paceText||"de geplande startpace"}; geen tijd terugpakken in de eerste fase.`
  });

  return items;
}

function raceDayChecklistState(strategy){
  const id=raceDayRaceId(strategy?.race);
  const checklist=raceDayState.checklists[id];
  return isPlainBackupObject(checklist)?checklist:{};
}

function raceDayChecklistProgress(strategy){
  const items=raceDayChecklistItems(strategy);
  if(!items.length) return{done:0,total:0,percent:0};
  const state=raceDayChecklistState(strategy);
  const done=items.filter(item=>Boolean(state[item.key])).length;
  return{
    done,
    total:items.length,
    percent:Math.round(done/items.length*100)
  };
}

function handleRaceDayChecklistChange(event){
  const input=event?.target;
  if(!input?.dataset?.raceChecklistKey) return;
  if(!activeRaceSimulation?.strategy) return;

  const strategy=activeRaceSimulation.strategy;
  const id=raceDayRaceId(strategy.race);
  const current=isPlainBackupObject(raceDayState.checklists[id])
    ?raceDayState.checklists[id]
    :{};

  current[input.dataset.raceChecklistKey]=Boolean(input.checked);
  raceDayState.checklists[id]=current;
  saveRaceDayState();

  renderRaceDayChecklist(strategy);
  renderRaceDaySummaryCard(strategy);
}

function resetRaceDayChecklist(){
  if(!activeRaceSimulation?.strategy) return;
  const strategy=activeRaceSimulation.strategy;
  const id=raceDayRaceId(strategy.race);

  if(!confirm("Racechecklist voor deze wedstrijd opnieuw leegmaken?")){
    return;
  }

  raceDayState.checklists[id]={};
  saveRaceDayState();
  renderRaceDayChecklist(strategy);
  renderRaceDaySummaryCard(strategy);
}

function renderRaceDayChecklist(strategy){
  const target=document.getElementById("raceDayChecklist");
  if(!target) return;

  if(!strategy?.race){
    target.innerHTML='<p class="help">Selecteer eerst een wedstrijd.</p>';
    return;
  }

  const state=raceDayChecklistState(strategy);
  const items=raceDayChecklistItems(strategy);

  target.innerHTML=items.map(item=>`
    <label class="race-day-check-item ${state[item.key]?"done":""}">
      <input
        type="checkbox"
        data-race-checklist-key="${safe(item.key)}"
        ${state[item.key]?"checked":""}
      >
      <span>
        <strong>${safe(item.label)}</strong>
        <small>${safe(item.detail)}</small>
      </span>
    </label>
  `).join("");
}

function raceDaySession(strategy){
  const id=raceDayRaceId(strategy?.race);
  const session=raceDayState.sessions[id];
  return isPlainBackupObject(session)?session:null;
}

function raceDaySessionElapsedSeconds(strategy,nowMs=Date.now()){
  const session=raceDaySession(strategy);
  if(!session?.startedAt) return 0;

  const start=new Date(session.startedAt).getTime();
  if(!Number.isFinite(start)) return 0;

  const stop=session.finishedAt
    ?new Date(session.finishedAt).getTime()
    :nowMs;

  if(!Number.isFinite(stop)||stop<start) return 0;
  return Math.max(0,(stop-start)/1000);
}

function raceDayFormatClock(totalSeconds){
  const seconds=Math.max(0,Math.floor(Number(totalSeconds)||0));
  const hours=Math.floor(seconds/3600);
  const minutes=Math.floor((seconds%3600)/60);
  const secs=seconds%60;
  return `${hours?String(hours).padStart(2,"0")+":":""}${String(minutes).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
}

function raceDaySegmentTimeline(strategy){
  let cursor=0;
  return (strategy?.segments||[]).map(segment=>{
    const startSeconds=cursor;
    const endSeconds=cursor+Number(segment.segmentSeconds||0);
    cursor=endSeconds;
    return{
      ...segment,
      startSeconds,
      endSeconds
    };
  });
}

function raceDayPlannedDistance(strategy,elapsedSeconds){
  const timeline=raceDaySegmentTimeline(strategy);
  if(!timeline.length) return null;

  let distance=0;

  for(const segment of timeline){
    if(elapsedSeconds>=segment.endSeconds){
      distance+=Number(segment.distance||0);
      continue;
    }

    if(elapsedSeconds<=segment.startSeconds){
      break;
    }

    const inside=elapsedSeconds-segment.startSeconds;
    const pace=finiteNumberOrNull(segment.paceSeconds);
    if(pace!==null&&pace>0){
      distance+=Math.min(
        Number(segment.distance||0),
        inside/pace
      );
    }
    break;
  }

  return Math.min(
    Number(strategy.race?.distanceKm||distance),
    distance
  );
}

function raceDayCurrentSegment(strategy,elapsedSeconds){
  const timeline=raceDaySegmentTimeline(strategy);
  if(!timeline.length) return null;
  return timeline.find(item=>
    elapsedSeconds>=item.startSeconds &&
    elapsedSeconds<item.endSeconds
  ) || timeline[timeline.length-1];
}

function raceDayUpcomingFuel(strategy,elapsedSeconds){
  const plan=strategy?.personalFuel;
  if(!plan) return{gel:null,drink:null};

  const elapsedMinutes=elapsedSeconds/60;
  const gel=(plan.gelSchedule||[]).find(item=>
    Number(item.minute)>=elapsedMinutes-.25
  )||null;

  const drink=(plan.stationSchedule||[]).find(item=>
    Number(item.minute)>=elapsedMinutes-.25
  )||null;

  return{gel,drink};
}

function raceDayUpcomingDecision(strategy,elapsedSeconds){
  const timeline=raceDaySegmentTimeline(strategy);
  const elapsedMinutes=elapsedSeconds/60;

  for(const segment of timeline){
    const minute=segment.endSeconds/60;
    if(minute>=elapsedMinutes-.25){
      return{
        minute:Math.round(minute),
        label:segment.label,
        text:segment.decision
      };
    }
  }

  return null;
}

function buildRaceDayLiveState(strategy,elapsedSeconds){
  if(!strategy?.race){
    return{
      elapsedSeconds:0,
      plannedDistanceKm:null,
      segment:null,
      nextGel:null,
      nextDrink:null,
      nextDecision:null,
      complete:false
    };
  }

  const expectedSeconds=finiteNumberOrNull(
    strategy.reference?.seconds
  );
  const complete=
    expectedSeconds!==null &&
    elapsedSeconds>=expectedSeconds;

  const fuel=raceDayUpcomingFuel(strategy,elapsedSeconds);

  return{
    elapsedSeconds,
    plannedDistanceKm:raceDayPlannedDistance(
      strategy,
      elapsedSeconds
    ),
    segment:raceDayCurrentSegment(
      strategy,
      elapsedSeconds
    ),
    nextGel:fuel.gel,
    nextDrink:fuel.drink,
    nextDecision:raceDayUpcomingDecision(
      strategy,
      elapsedSeconds
    ),
    complete
  };
}

function raceDayWhenText(minute,elapsedSeconds){
  if(minute===null||minute===undefined) return"—";
  const remaining=Math.round(
    Number(minute)-elapsedSeconds/60
  );

  if(remaining<=0) return"nu";
  return `over ${remaining} min`;
}

function raceDayModeLabel(strategy){
  const days=daysUntil(strategy?.race?.date);
  if(days===0) return"RACEDAG";
  if(days===1) return"MORGEN";
  if(days>1) return`PREVIEW · ${days} D`;
  if(days<0) return"AFGELOPEN";
  return"PREVIEW";
}

function renderRaceDaySummaryCard(strategy){
  const root=document.getElementById("raceDaySummaryCard");
  if(!root) return null;

  if(!strategy?.race){
    document.getElementById("raceDaySummaryRace").textContent="Geen wedstrijd";
    document.getElementById("raceDaySummaryMode").textContent="PREVIEW";
    document.getElementById("raceDayChecklistProgress").textContent="—";
    document.getElementById("raceDayOpeningPace").textContent="—";
    document.getElementById("raceDayFuelQuick").textContent="—";
    document.getElementById("openRaceDayMode").disabled=true;
    document.getElementById("resetRaceDayChecklist").disabled=true;
    renderRaceDayChecklist(null);
    return null;
  }

  const progress=raceDayChecklistProgress(strategy);
  const fuel=strategy.personalFuel;

  document.getElementById("raceDaySummaryRace").textContent=
    `${strategy.race.name} · ${strategy.race.distanceKm} km`;
  document.getElementById("raceDaySummaryMode").textContent=
    raceDayModeLabel(strategy);
  document.getElementById("raceDayChecklistProgress").textContent=
    `${progress.done}/${progress.total} · ${progress.percent}%`;
  document.getElementById("raceDayOpeningPace").textContent=
    strategy.segments?.[0]?.paceText||"—";

  document.getElementById("raceDayFuelQuick").textContent=
    fuel?.gelSchedule?.length
      ?`${fuel.gelSchedule.length} gels · eerste min ${fuel.gelSchedule[0].minute}`
      :strategy.fuel?.gramsPerHour
        ?`${strategy.fuel.gramsPerHour} g/uur`
        :"Geen racegels";

  document.getElementById("openRaceDayMode").disabled=false;
  document.getElementById("resetRaceDayChecklist").disabled=false;

  renderRaceDayChecklist(strategy);
  return progress;
}

function openRaceDayMode(){
  if(!activeRaceSimulation?.strategy) return;

  const overlay=document.getElementById("raceDayOverlay");
  if(!overlay) return;

  overlay.hidden=false;
  overlay.setAttribute("aria-hidden","false");
  document.body.classList.add("race-day-mode-open");

  renderRaceDayLiveMode();

  if(raceDayTicker){
    clearInterval(raceDayTicker);
  }

  raceDayTicker=setInterval(()=>{
    renderRaceDayLiveMode();
  },1000);
}

function closeRaceDayMode(){
  const overlay=document.getElementById("raceDayOverlay");
  if(!overlay) return;

  overlay.hidden=true;
  overlay.setAttribute("aria-hidden","true");
  document.body.classList.remove("race-day-mode-open");

  if(raceDayTicker){
    clearInterval(raceDayTicker);
    raceDayTicker=null;
  }
}

function startRaceDayClock(){
  if(!activeRaceSimulation?.strategy) return;

  const strategy=activeRaceSimulation.strategy;
  const id=raceDayRaceId(strategy.race);

  const existing=raceDaySession(strategy);
  if(existing?.startedAt){
    return;
  }

  const days=daysUntil(strategy.race.date);
  if(
    days!==0 &&
    !confirm(
      days>0
        ?`Deze wedstrijd is pas over ${days} dag${days===1?"":"en"}. Raceklok toch starten voor een test?`
        :"Deze wedstrijddatum is al voorbij. Raceklok toch starten?"
    )
  ){
    return;
  }

  raceDayState.sessions[id]={
    startedAt:new Date().toISOString(),
    finishedAt:null
  };
  saveRaceDayState();
  renderRaceDayLiveMode();
}

function finishRaceDayClock(){
  if(!activeRaceSimulation?.strategy) return;
  const strategy=activeRaceSimulation.strategy;
  const id=raceDayRaceId(strategy.race);
  const session=raceDaySession(strategy);

  if(!session?.startedAt||session.finishedAt) return;

  session.finishedAt=new Date().toISOString();
  raceDayState.sessions[id]=session;
  saveRaceDayState();
  renderRaceDayLiveMode();
}

function resetRaceDayClock(){
  if(!activeRaceSimulation?.strategy) return;

  if(!confirm("Raceklok voor deze wedstrijd resetten?")){
    return;
  }

  const id=raceDayRaceId(activeRaceSimulation.strategy.race);
  delete raceDayState.sessions[id];
  saveRaceDayState();
  renderRaceDayLiveMode();
}

function renderRaceDayLiveMode(){
  const strategy=activeRaceSimulation?.strategy;
  const overlay=document.getElementById("raceDayOverlay");
  if(!overlay||overlay.hidden) return null;

  if(!strategy?.race){
    closeRaceDayMode();
    return null;
  }

  const elapsed=raceDaySessionElapsedSeconds(strategy);
  const live=buildRaceDayLiveState(strategy,elapsed);
  const session=raceDaySession(strategy);
  const started=Boolean(session?.startedAt);
  const finished=Boolean(session?.finishedAt);

  document.getElementById("raceDayLiveRaceName").textContent=
    strategy.race.name;
  document.getElementById("raceDayLiveStatus").textContent=
    finished
      ?"AFGEROND"
      :started
        ?"LIVE REFERENTIE"
        :raceDayModeLabel(strategy);
  document.getElementById("raceDayLiveClock").textContent=
    raceDayFormatClock(elapsed);

  document.getElementById("raceDayLiveDistance").textContent=
    live.plannedDistanceKm===null
      ?"—"
      :`${live.plannedDistanceKm.toFixed(1)} km`;
  document.getElementById("raceDayLiveDistanceNote").textContent=
    "geplande positie · geen GPS";

  document.getElementById("raceDayLivePhase").textContent=
    live.segment?.label||"—";
  document.getElementById("raceDayLivePace").textContent=
    live.segment?.paceText||"—";
  document.getElementById("raceDayLiveHr").textContent=
    live.segment?.hrText||"HR op gevoel";

  document.getElementById("raceDayNextGel").textContent=
    live.nextGel
      ?`Gel ${live.nextGel.index} · min ${live.nextGel.minute}`
      :"Geen volgende gel";
  document.getElementById("raceDayNextGelWhen").textContent=
    live.nextGel
      ?raceDayWhenText(live.nextGel.minute,elapsed)
      :"—";

  document.getElementById("raceDayNextDrink").textContent=
    live.nextDrink
      ?`${live.nextDrink.km} km · ${live.nextDrink.ml??"—"} ml`
      :"Geen volgende drinkpost";
  document.getElementById("raceDayNextDrinkWhen").textContent=
    live.nextDrink?.minute!==null&&
    live.nextDrink?.minute!==undefined
      ?raceDayWhenText(live.nextDrink.minute,elapsed)
      :"—";

  document.getElementById("raceDayNextDecision").textContent=
    live.nextDecision?.label||"Finish";
  document.getElementById("raceDayNextDecisionText").textContent=
    live.nextDecision?.text||
    "Plan afgerond; beoordeel alleen nog op gevoel.";
  document.getElementById("raceDayNextDecisionWhen").textContent=
    live.nextDecision
      ?raceDayWhenText(live.nextDecision.minute,elapsed)
      :"—";

  const startButton=document.getElementById("startRaceDayClock");
  const finishButton=document.getElementById("finishRaceDayClock");
  startButton.disabled=started;
  startButton.textContent=
    started&&!finished
      ?"Raceklok loopt"
      :finished
        ?"Reset voor nieuwe start"
        :"Start raceklok";

  finishButton.disabled=!started||finished;

  return live;
}
