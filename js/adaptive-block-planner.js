let pendingAdaptiveBlockPlan=null;

function adaptiveBlockUnknownReadiness(){
  return{
    level:"unknown",
    score:null,
    sufficientData:false,
    reasons:["Toekomstig herstel wordt niet voorspeld."]
  };
}

function adaptiveBlockNeutralDiary(){
  return{level:"stable",score:null,reasons:[]};
}

function adaptiveBlockMicrocycleFactor(index,seasonBlock,weekRaces){
  const phase=seasonBlock?.phase||null;
  const hasPriorityRace=(weekRaces||[]).some(race=>
    ["A","B"].includes(String(race.priority||"C").toUpperCase())
  );

  if(
    hasPriorityRace ||
    ["taper","race","recovery"].includes(phase)
  ){
    return 1;
  }

  return [0.96,1,1.04,0.90][index]||1;
}

function adaptiveBlockContextForWeek(start,index,base){
  const end=addDays(start,6);
  const seasonBlock=seasonBlockForWeek(start);
  const weekRaces=racesInRange(start,end);
  const race=
    seasonBlock?.targetRace ||
    weekRaces.find(r=>String(r.priority||"C").toUpperCase()==="A") ||
    base.race ||
    null;

  return{
    profile:base.profile,
    availability:base.availability,
    readiness:index===0
      ?base.readiness
      :adaptiveBlockUnknownReadiness(),
    race,
    phase:seasonPhaseToLegacyPhase(seasonBlock,race),
    diary:index===0
      ?base.diary
      :adaptiveBlockNeutralDiary(),
    start,
    end,
    weekRaces,
    seasonBlock,
    seasonLoadFactor:adaptiveBlockMicrocycleFactor(index,seasonBlock,weekRaces),
    forecast:index>0,
    allowKeySessionProgression:index===0,
    blockWeek:index+1
  };
}

function adaptiveBlockWeekVariant(index,context){
  if(
    context.phase?.phase==="taper" ||
    context.phase?.phase==="race-week" ||
    context.seasonBlock?.phase==="recovery"
  ){
    return 0;
  }
  return index%2===0?0:1;
}

function adaptiveBlockBuildWeek(context,index){
  const variant=adaptiveBlockWeekVariant(index,context);
  const unscheduled=createUnscheduledAiWeek(context,variant);
  const assigned=assignAiWeekToAvailability(context,unscheduled,variant);

  const workouts=(assigned.workouts||[]).map(workout=>({
    ...JSON.parse(JSON.stringify(workout)),
    sourceBlockPlanner:"10.8",
    blockWeek:index+1,
    blockGeneratedAt:new Date().toISOString()
  }));

  const totalKm=workouts.reduce(
    (sum,workout)=>sum+(Number(workout.distanceKm)||0),
    0
  );

  const quality=workouts.find(workout=>workout.planType==="quality")||null;
  const long=workouts.find(workout=>workout.planType==="long")||null;

  return{
    index,
    weekNumber:index+1,
    start:context.start,
    end:context.end,
    context,
    targetKm:assigned.targetKm,
    totalKm,
    workouts,
    quality,
    long,
    races:context.weekRaces||[],
    focus:weekFocusLabel(context),
    phase:context.seasonBlock?.phase||context.phase?.phase||"general",
    progressionApplied:Boolean(quality?.progressionV107?.applied)
  };
}

function buildAdaptiveTrainingBlock(){
  const base=weekPlanningContext();
  const firstStart=base.start;
  const weeks=[];

  for(let index=0;index<4;index++){
    const start=addDays(firstStart,index*7);
    const context=adaptiveBlockContextForWeek(start,index,base);
    weeks.push(adaptiveBlockBuildWeek(context,index));
  }

  pendingAdaptiveBlockPlan={
    createdAt:new Date().toISOString(),
    start:firstStart,
    end:weeks.at(-1)?.end||firstStart,
    weeks,
    totalKm:weeks.reduce((sum,week)=>sum+week.totalKm,0),
    races:weeks.flatMap(week=>week.races),
    primaryRace:
      weeks.map(week=>week.context.race).find(Boolean) ||
      base.race ||
      null,
    firstProgression:weeks.find(week=>week.progressionApplied)||null,
    integrity:{
      futureReadinessForecasted:false,
      existingCalendarOverwrite:false,
      raceOverwrite:false,
      progressionWeeks:weeks.filter(week=>week.progressionApplied).length
    }
  };

  return pendingAdaptiveBlockPlan;
}

function adaptiveBlockPhaseLabel(phase){
  return({
    base:"Basis",
    build:"Opbouw",
    specific:"Specifiek",
    taper:"Taper",
    "race-week":"Raceweek",
    race:"Race",
    recovery:"Herstel",
    general:"Algemeen"
  })[phase]||phase||"Algemeen";
}

function adaptiveBlockKeySessionText(week){
  if(week.quality) return week.quality.name;
  const race=week.races[0];
  return race
    ?`${race.priority}-race · ${race.name}`
    :"Geen kwaliteit gepland";
}

function adaptiveBlockLongText(week){
  return week.long
    ?`${week.long.distanceKm} km`
    :week.races.length
      ?"Vervangen door wedstrijdcontext"
      :"—";
}

function adaptiveBlockWeekNote(week){
  const parts=[
    week.weekNumber===1
      ?"actuele readiness meegewogen"
      :"geen toekomstig herstel voorspeld"
  ];

  if(week.progressionApplied){
    parts.push("10.7 dosis toegepast");
  }else if(week.weekNumber>1){
    parts.push("10.7 dosis niet vooruit gekopieerd");
  }

  if(week.races.length){
    parts.push(
      week.races.map(race=>`${race.priority} ${race.name}`).join(", ")
    );
  }

  return parts.join(" · ");
}

function renderAdaptiveTrainingBlock(){
  const root=document.getElementById("adaptiveBlockPlannerCard");
  if(!root) return null;

  const plan=pendingAdaptiveBlockPlan;

  if(!plan){
    root.className="card adaptive-block-card learning";
    document.getElementById("adaptiveBlockStatus").textContent="Nog niet gegenereerd";
    document.getElementById("adaptiveBlockSummary").textContent=
      "Genereer vier weken vanaf de eerstvolgende maandag.";
    document.getElementById("adaptiveBlockTotal").textContent="—";
    document.getElementById("adaptiveBlockRace").textContent="—";
    document.getElementById("adaptiveBlockProgression").textContent="—";
    document.getElementById("adaptiveBlockWeeks").innerHTML=
      '<p class="help">Hier verschijnt de 4-wekenplanning.</p>';
    document.getElementById("applyAdaptiveBlock").disabled=true;
    return null;
  }

  root.className="card adaptive-block-card ready";
  document.getElementById("adaptiveBlockStatus").textContent="4 weken klaar";
  document.getElementById("adaptiveBlockSummary").textContent=
    `${plan.start} t/m ${plan.end}. Week 1 gebruikt actuele hersteldata; week 2–4 gebruiken alleen seizoensfase, kalender, beschikbaarheid en geleerd trainingsbewijs.`;
  document.getElementById("adaptiveBlockTotal").textContent=
    `${Math.round(plan.totalKm)} km`;
  document.getElementById("adaptiveBlockRace").textContent=
    plan.primaryRace
      ?`${plan.primaryRace.name} · ${plan.primaryRace.date}`
      :"Geen doelwedstrijd";
  document.getElementById("adaptiveBlockProgression").textContent=
    plan.integrity.progressionWeeks
      ?`Alleen week ${plan.firstProgression?.weekNumber||1}`
      :"Geen actieve 10.7-stap";

  document.getElementById("adaptiveBlockWeeks").innerHTML=
    plan.weeks.map(week=>`
      <div class="adaptive-block-week ${safe(week.phase)}">
        <div class="adaptive-block-week-head">
          <div>
            <span>Week ${week.weekNumber}</span>
            <strong>${safe(week.start)} – ${safe(week.end)}</strong>
          </div>
          <div>
            <strong>${Math.round(week.totalKm)} km</strong>
            <small>doel ${Math.round(week.targetKm)} km</small>
          </div>
        </div>

        <div class="adaptive-block-week-grid">
          <div>
            <span>Fase</span>
            <strong>${safe(adaptiveBlockPhaseLabel(week.phase))}</strong>
          </div>
          <div>
            <span>Focus</span>
            <strong>${safe(week.focus)}</strong>
          </div>
          <div>
            <span>Sleutelsessie</span>
            <strong>${safe(adaptiveBlockKeySessionText(week))}</strong>
          </div>
          <div>
            <span>Lange duur</span>
            <strong>${safe(adaptiveBlockLongText(week))}</strong>
          </div>
        </div>

        <small class="adaptive-block-week-note">
          ${safe(adaptiveBlockWeekNote(week))}
        </small>
      </div>
    `).join("");

  document.getElementById("applyAdaptiveBlock").disabled=false;
  return plan;
}

function generateAdaptiveTrainingBlock(){
  const status=document.getElementById("adaptiveBlockApplyStatus");

  try{
    const plan=buildAdaptiveTrainingBlock();
    renderAdaptiveTrainingBlock();

    if(status){
      status.className="status ok";
      status.textContent=
        `Voorstel gemaakt: ${plan.weeks.length} weken · ${Math.round(plan.totalKm)} km. Er is nog niets aan je kalender gewijzigd.`;
    }
    return plan;
  }catch(error){
    if(status){
      status.className="status error";
      status.textContent=`4-wekenplanning mislukt: ${error.message}`;
    }
    return null;
  }
}

function applyAdaptiveTrainingBlock(){
  const status=document.getElementById("adaptiveBlockApplyStatus");
  const plan=pendingAdaptiveBlockPlan||buildAdaptiveTrainingBlock();

  if(!plan?.weeks?.length){
    if(status){
      status.className="status error";
      status.textContent="Geen blok beschikbaar.";
    }
    return;
  }

  const totalSessions=plan.weeks.reduce(
    (sum,week)=>sum+week.workouts.length,
    0
  );

  if(!confirm(
    `${totalSessions} voorgestelde trainingen over vier weken toevoegen? Bestaande kalenderdagen en races worden overgeslagen.`
  )){
    return;
  }

  let added=0;
  let skipped=0;
  let raceProtected=0;

  for(const week of plan.weeks){
    for(const workout of week.workouts){
      const existing=allWorkouts()[workout.date];

      if(existing){
        skipped++;
        if(existing.type==="Race") raceProtected++;
        continue;
      }

      customWorkouts[workout.date]=JSON.parse(JSON.stringify(workout));
      added++;
    }
  }

  saveObject(STORAGE_KEY,customWorkouts);
  pendingAdaptiveBlockPlan=null;
  refreshAfterCalendarMutation();
  renderAdaptiveTrainingBlock();

  if(status){
    status.className="status ok";
    status.textContent=
      `${added} trainingen toegevoegd · ${skipped} bestaande dagen overgeslagen${raceProtected?` · ${raceProtected} racedag${raceProtected===1?"":"en"} beschermd`:""}.`;
  }
}
