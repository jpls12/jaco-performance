const VISUAL_EXERCISES={
  plank:{
    name:"Plank",
    icon:"🧍",
    coros:"Plank",
    prescription:"40 seconden",
    rest:"20 seconden",
    cue:"Maak een rechte lijn van schouders tot hielen en span buik en billen aan."
  },
  sidePlank:{
    name:"Side plank",
    icon:"↔️",
    coros:"Side Plank",
    prescription:"30 seconden per zijde",
    rest:"20 seconden",
    cue:"Houd heupen hoog en schouders recht boven elkaar."
  },
  deadBug:{
    name:"Dead bug",
    icon:"🐞",
    coros:"Dead Bug",
    prescription:"10 herhalingen per zijde",
    rest:"20 seconden",
    cue:"Houd je onderrug tegen de grond en beweeg arm en tegenovergesteld been langzaam."
  },
  birdDog:{
    name:"Bird dog",
    icon:"🐕",
    coros:"Bird Dog",
    prescription:"10 herhalingen per zijde",
    rest:"20 seconden",
    cue:"Houd de heupen recht en maak lengte met arm en tegenovergesteld been."
  },
  gluteBridge:{
    name:"Glute bridge",
    icon:"🌉",
    coros:"Glute Bridge",
    prescription:"12 herhalingen",
    rest:"30 seconden",
    cue:"Duw vanuit de hielen en span bovenin de bilspieren aan."
  },
  copenhagen:{
    name:"Copenhagen plank",
    icon:"🦵",
    coros:"Copenhagen Plank",
    prescription:"20 seconden per zijde",
    rest:"30 seconden",
    cue:"Steun met het bovenste been en houd romp en bekken in één lijn."
  },
  hipMobility:{
    name:"90/90 heuprotatie",
    icon:"🧘",
    coros:"90/90 Hip Switch",
    prescription:"60 seconden",
    rest:"15 seconden",
    cue:"Beweeg gecontroleerd tussen beide kanten zonder de beweging te forceren."
  },
  ankleMobility:{
    name:"Enkelmobiliteit",
    icon:"🦶",
    coros:"Ankle Mobility",
    prescription:"60 seconden per zijde",
    rest:"15 seconden",
    cue:"Breng de knie naar voren terwijl de hiel volledig op de grond blijft."
  },
  hamstring:{
    name:"Dynamische hamstring",
    icon:"🦿",
    coros:"Hamstring Stretch",
    prescription:"45 seconden per zijde",
    rest:"15 seconden",
    cue:"Houd de rug lang en beweeg rustig vanuit de heup."
  },
  thoracic:{
    name:"Borstrotatie",
    icon:"🔄",
    coros:"Thoracic Rotation",
    prescription:"8 herhalingen per zijde",
    rest:"15 seconden",
    cue:"Volg je hand met je ogen en houd je heupen zo stil mogelijk."
  },
  breathing:{
    name:"Herstelademhaling",
    icon:"🌬️",
    coros:"Breathing Exercise",
    prescription:"2 minuten",
    rest:"0 seconden",
    cue:"Adem vier tellen in en zes tellen rustig uit."
  }
};

const VISUAL_WORKOUTS={
  core:{
    title:"Core Running Power",
    type:"Core",
    rounds:3,
    exercises:["plank","deadBug","birdDog","sidePlank","gluteBridge","copenhagen"]
  },
  mobility:{
    title:"Mobiliteit & herstel",
    type:"Mobility",
    rounds:2,
    exercises:["hipMobility","ankleMobility","hamstring","thoracic","gluteBridge","breathing"]
  }
};

let activeVisualWorkout="core";

let visualPlayer={
  workoutKey:"core",
  sequence:[],
  index:0,
  secondsLeft:0,
  elapsedSeconds:0,
  intervalId:null,
  paused:false,
  wakeLock:null,
  startedAt:null
};

function prescriptionSeconds(text){
  const value=String(text||"").toLowerCase();
  const minuteMatch=value.match(/(\d+)\s*min/);
  if(minuteMatch) return Number(minuteMatch[1])*60;
  const secondMatch=value.match(/(\d+)\s*secon/);
  if(secondMatch) return Number(secondMatch[1]);
  return null;
}

function restSeconds(text){
  const value=String(text||"").toLowerCase();
  const minuteMatch=value.match(/(\d+)\s*min/);
  if(minuteMatch) return Number(minuteMatch[1])*60;
  const secondMatch=value.match(/(\d+)\s*secon/);
  if(secondMatch) return Number(secondMatch[1]);
  return 20;
}

function buildPlayerSequence(workoutKey){
  const workout=VISUAL_WORKOUTS[workoutKey];
  const sequence=[];

  for(let round=1;round<=workout.rounds;round++){
    workout.exercises.forEach((exerciseId,exerciseIndex)=>{
      const exercise=VISUAL_EXERCISES[exerciseId];
      const seconds=prescriptionSeconds(exercise.prescription);

      sequence.push({
        kind:"work",
        round,
        exerciseIndex,
        id:exerciseId,
        name:exercise.name,
        icon:exercise.icon,
        cue:exercise.cue,
        prescription:exercise.prescription,
        seconds,
        reps:seconds ? null : exercise.prescription
      });

      const isFinal=round===workout.rounds &&
        exerciseIndex===workout.exercises.length-1;

      if(!isFinal){
        sequence.push({
          kind:"rest",
          round,
          exerciseIndex,
          id:`rest-${round}-${exerciseIndex}`,
          name:"Rust",
          icon:"💧",
          cue:"Adem rustig door en maak je klaar voor de volgende oefening.",
          prescription:exercise.rest,
          seconds:restSeconds(exercise.rest),
          reps:null
        });
      }
    });
  }

  return sequence;
}

async function requestPlayerWakeLock(){
  try{
    if("wakeLock" in navigator){
      visualPlayer.wakeLock=await navigator.wakeLock.request("screen");
    }
  }catch{}
}

function releasePlayerWakeLock(){
  if(visualPlayer.wakeLock){
    visualPlayer.wakeLock.release().catch(()=>{});
    visualPlayer.wakeLock=null;
  }
}

function speakPlayer(text){
  if(!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(text);
  utterance.lang="nl-NL";
  utterance.rate=.95;
  window.speechSynthesis.speak(utterance);
}

function formatPlayerTime(seconds){
  const value=Math.max(0,Math.round(seconds));
  return `${Math.floor(value/60)}:${String(value%60).padStart(2,"0")}`;
}

function currentPlayerStep(){
  return visualPlayer.sequence[visualPlayer.index] || null;
}

function nextWorkStep(fromIndex=visualPlayer.index+1){
  for(let i=fromIndex;i<visualPlayer.sequence.length;i++){
    if(visualPlayer.sequence[i].kind==="work") return visualPlayer.sequence[i];
  }
  return null;
}

function openVisualWorkoutPlayer(workoutKey){
  visualPlayer.workoutKey=workoutKey;
  visualPlayer.sequence=buildPlayerSequence(workoutKey);
  visualPlayer.index=0;
  visualPlayer.elapsedSeconds=0;
  visualPlayer.paused=false;
  visualPlayer.startedAt=Date.now();

  const workout=VISUAL_WORKOUTS[workoutKey];
  document.getElementById("playerWorkoutName").textContent=workout.title;
  document.getElementById("visualWorkoutPlayer").classList.add("active");
  document.getElementById("visualWorkoutPlayer").setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";

  document.getElementById("playerActiveScreen").style.display="flex";
  document.getElementById("playerFinishScreen").classList.remove("active");
  document.getElementById("playerControls").style.display="grid";

  requestPlayerWakeLock();
  loadPlayerStep(true);
  startPlayerClock();
}

function closeVisualWorkoutPlayer(){
  clearInterval(visualPlayer.intervalId);
  visualPlayer.intervalId=null;
  releasePlayerWakeLock();
  if("speechSynthesis" in window) window.speechSynthesis.cancel();
  document.getElementById("visualWorkoutPlayer").classList.remove("active");
  document.getElementById("visualWorkoutPlayer").setAttribute("aria-hidden","true");
  document.body.style.overflow="";
}

function loadPlayerStep(announce=false){
  const step=currentPlayerStep();
  if(!step){
    finishVisualWorkout();
    return;
  }

  visualPlayer.secondsLeft=step.seconds || 0;
  const workout=VISUAL_WORKOUTS[visualPlayer.workoutKey];
  const workSteps=visualPlayer.sequence.filter(item=>item.kind==="work");
  const completedWork=visualPlayer.sequence
    .slice(0,visualPlayer.index+1)
    .filter(item=>item.kind==="work").length;

  document.getElementById("playerPhase").textContent=
    step.kind==="rest" ? "Rust" : `Ronde ${step.round}`;
  document.getElementById("playerVisual").textContent=step.icon;
  document.getElementById("playerVisual").classList.toggle("animate",step.kind==="work");
  document.getElementById("playerExerciseName").textContent=step.name;
  document.getElementById("playerExerciseCue").textContent=step.cue;

  const timer=document.getElementById("playerTimer");
  const reps=document.getElementById("playerReps");

  if(step.seconds){
    timer.hidden=false;
    reps.hidden=true;
    timer.textContent=visualPlayer.secondsLeft;
  }else{
    timer.hidden=true;
    reps.hidden=false;
    reps.textContent=step.reps;
  }

  const next=nextWorkStep();
  document.getElementById("playerNext").textContent=
    next ? `Hierna: ${next.name}` : "Laatste onderdeel";

  document.getElementById("playerRound").textContent=`${step.round}/${workout.rounds}`;
  document.getElementById("playerExerciseIndex").textContent=
    `${Math.max(1,completedWork)}/${workSteps.length}`;

  const progress=(visualPlayer.index/Math.max(1,visualPlayer.sequence.length))*100;
  document.getElementById("playerProgressBar").style.width=`${progress}%`;

  if(announce){
    if(step.kind==="rest"){
      speakPlayer(`Rust. ${step.seconds} seconden.`);
    }else{
      speakPlayer(`${step.name}. ${step.prescription}. ${step.cue}`);
    }
  }
}

function startPlayerClock(){
  clearInterval(visualPlayer.intervalId);

  visualPlayer.intervalId=setInterval(()=>{
    if(visualPlayer.paused) return;

    visualPlayer.elapsedSeconds++;
    document.getElementById("playerElapsed").textContent=
      formatPlayerTime(visualPlayer.elapsedSeconds);

    const step=currentPlayerStep();
    if(!step) return;

    if(step.seconds){
      visualPlayer.secondsLeft--;
      document.getElementById("playerTimer").textContent=
        Math.max(0,visualPlayer.secondsLeft);

      if(visualPlayer.secondsLeft===5){
        speakPlayer("Nog vijf seconden.");
      }

      if(visualPlayer.secondsLeft<=0){
        advancePlayerStep();
      }
    }
  },1000);
}

function advancePlayerStep(){
  visualPlayer.index++;
  loadPlayerStep(true);
}

function previousPlayerStep(){
  visualPlayer.index=Math.max(0,visualPlayer.index-1);
  loadPlayerStep(true);
}

function adjustPlayerSeconds(delta){
  const step=currentPlayerStep();
  if(!step?.seconds) return;
  visualPlayer.secondsLeft=Math.max(1,visualPlayer.secondsLeft+delta);
  document.getElementById("playerTimer").textContent=visualPlayer.secondsLeft;
}

function togglePlayerPause(){
  visualPlayer.paused=!visualPlayer.paused;
  document.getElementById("playerPause").textContent=
    visualPlayer.paused ? "Hervat" : "Pauze";
  speakPlayer(visualPlayer.paused ? "Workout gepauzeerd." : "Workout hervat.");
}

function finishVisualWorkout(){
  clearInterval(visualPlayer.intervalId);
  visualPlayer.intervalId=null;
  releasePlayerWakeLock();

  document.getElementById("playerActiveScreen").style.display="none";
  document.getElementById("playerControls").style.display="none";
  document.getElementById("playerFinishScreen").classList.add("active");
  document.getElementById("playerProgressBar").style.width="100%";

  const workout=VISUAL_WORKOUTS[visualPlayer.workoutKey];
  document.getElementById("playerFinishSummary").textContent=
    `${workout.title} voltooid in ${formatPlayerTime(visualPlayer.elapsedSeconds)}.`;

  speakPlayer("Workout voltooid. Goed gedaan.");
}

function restartVisualWorkout(){
  openVisualWorkoutPlayer(visualPlayer.workoutKey);
}

function saveCompletedVisualWorkout(){
  const workoutDefinition=VISUAL_WORKOUTS[visualPlayer.workoutKey];
  const date=todayDateString();
  const durationMinutes=Math.max(1,Math.round(visualPlayer.elapsedSeconds/60));
  const exerciseNames=workoutDefinition.exercises
    .map(id=>VISUAL_EXERCISES[id].name);

  const workout={
    date,
    type:workoutDefinition.type,
    distanceKm:0,
    durationMinutes,
    name:workoutDefinition.title,
    uploadName:`Jaco - ${workoutDefinition.title}`,
    rpe:workoutDefinition.type==="Core"?"4/10":"2/10",
    status:"completed",
    priority:"could",
    planType:workoutDefinition.type.toLowerCase(),
    displaySteps:exerciseNames,
    intervalsDescription:[
      `${workoutDefinition.title} voltooid`,
      `${workoutDefinition.rounds} rondes`,
      ...exerciseNames.map(name=>`- ${name}`)
    ].join("\n")
  };

  customWorkouts[date]=workout;
  completed[date]=true;
  saveObject(STORAGE_KEY,customWorkouts);
  saveObject(COMPLETED_KEY,completed);

  renderMonth();
  renderSelected();
  renderSaved();
  renderTodayCoach();

  closeVisualWorkoutPlayer();
  switchView("calendar");
  selectedDate=date;
  renderSelected();
}

document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible" &&
     document.getElementById("visualWorkoutPlayer").classList.contains("active")){
    requestPlayerWakeLock();
  }
});


function renderVisualWorkout(key="core"){
  activeVisualWorkout=key;
  const workout=VISUAL_WORKOUTS[key];
  const exercises=workout.exercises.map(id=>VISUAL_EXERCISES[id]);

  document.getElementById("recipeTitle").textContent=workout.title;

  document.getElementById("exerciseLibrary").innerHTML=exercises.map(exercise=>`
    <div class="exercise-card">
      <div class="exercise-head">
        <div class="exercise-visual">${exercise.icon}</div>
        <div>
          <h3>${safe(exercise.name)}</h3>
          <strong>${safe(exercise.prescription)}</strong>
        </div>
      </div>
      <p>${safe(exercise.cue)}</p>
      <span class="coros-name">COROS: ${safe(exercise.coros)}</span>
    </div>
  `).join("");

  let phase=1;
  const rows=[];

  for(let round=1;round<=workout.rounds;round++){
    for(const exercise of exercises){
      rows.push({
        number:phase++,
        title:`Ronde ${round} · ${exercise.name}`,
        detail:`${exercise.prescription} · daarna ${exercise.rest} rust`,
        coros:exercise.coros
      });
    }
  }

  document.getElementById("corosRecipe").innerHTML=rows.map(row=>`
    <div class="recipe-row">
      <div class="recipe-number">${row.number}</div>
      <div>
        <strong>${safe(row.title)}</strong>
        <small>${safe(row.detail)}</small>
      </div>
      <code>${safe(row.coros)}</code>
    </div>
  `).join("");

  document.getElementById("corosRecipeText").textContent=buildCorosRecipeText(workout,exercises);
}

function buildCorosRecipeText(workout,exercises){
  const lines=[
    workout.title,
    "COROS workout type: Strength",
    `Rondes: ${workout.rounds}`,
    ""
  ];

  for(let round=1;round<=workout.rounds;round++){
    lines.push(`RONDE ${round}`);
    exercises.forEach((exercise,index)=>{
      lines.push(
        `${index+1}. ${exercise.name}`,
        `   Zoek in COROS: ${exercise.coros}`,
        `   Doel: ${exercise.prescription}`,
        `   Rust: ${exercise.rest}`,
        `   Uitvoering: ${exercise.cue}`
      );
    });
    lines.push("");
  }

  lines.push(
    "Synchroniseer daarna via de COROS-app naar je horloge.",
    "Ondersteunde oefeningen tonen een animatie wanneer Strength Animation Files zijn gedownload."
  );

  return lines.join("\n");
}

async function copyCorosRecipe(){
  const text=document.getElementById("corosRecipeText").textContent;
  const status=document.getElementById("copyRecipeStatus");

  try{
    await navigator.clipboard.writeText(text);
    status.className="status ok";
    status.textContent="COROS-recept gekopieerd.";
  }catch{
    status.className="status error";
    status.textContent="Kopiëren lukte niet. Houd de tekst ingedrukt en kies Kopieer.";
  }
}

const TRAINING_TYPES={
  Run:{label:"Hardlopen",icon:"🏃",css:"sport-run",unit:"km",uploadable:true},
  Ride:{label:"Fietsen",icon:"🚴",css:"sport-bike",unit:"km",uploadable:false},
  Swim:{label:"Zwemmen",icon:"🏊",css:"sport-swim",unit:"m",uploadable:false},
  Strength:{label:"Kracht",icon:"💪",css:"sport-strength",unit:"min",uploadable:false},
  Core:{label:"Core",icon:"🧱",css:"sport-core",unit:"min",uploadable:true},
  Mobility:{label:"Mobiliteit",icon:"🧘",css:"sport-mobility",unit:"min",uploadable:true},
  Rest:{label:"Rust",icon:"😴",css:"sport-rest",unit:"",uploadable:false}
};

function trainingTypeInfo(type){
  return TRAINING_TYPES[type] || TRAINING_TYPES.Run;
}

function trainingVolumeLabel(workout){
  const info=trainingTypeInfo(workout?.type);
  if(workout?.type==="Swim" && Number(workout?.distanceMeters)>0){
    return `${workout.distanceMeters} m`;
  }
  if(["Strength","Core","Mobility"].includes(workout?.type)){
    return `${Number(workout?.durationMinutes)||0} min`;
  }
  if(workout?.type==="Rest") return "Rust";
  if(Number(workout?.distanceKm)>0) return `${workout.distanceKm} km`;
  if(Number(workout?.durationMinutes)>0) return `${workout.durationMinutes} min`;
  return "—";
}

function updateWorkoutTypeFields(){
  const type=document.getElementById("workoutType")?.value || "Run";
  const isRun=type==="Run";
  document.getElementById("runFields").hidden=!isRun;
  document.getElementById("nonRunFields").hidden=isRun;

  const duration=document.getElementById("durationMinutes");
  if(type==="Rest"){
    duration.value=0;
    duration.disabled=true;
  }else{
    duration.disabled=false;
    if(!Number(duration.value)) duration.value=type==="Core"||type==="Mobility"?15:60;
  }

  updatePreview();
}

const STORAGE_KEY = "jp_custom_workouts_v1";
const DONE_KEY = "jp_done_workouts_v1";
const UPLOAD_KEY = "jp_uploaded_workouts_v1";
const RACES_KEY = "jp_races_v1";
const PROFILE_KEY = "jp_profile_v1";

let serverWorkouts = {};
let customWorkouts = loadObject(STORAGE_KEY);
let doneWorkouts = loadObject(DONE_KEY);
let uploadedWorkouts = loadObject(UPLOAD_KEY);
let races = loadObject(RACES_KEY);
let profile = loadObject(PROFILE_KEY);
let pendingWeekPlan = [];
let pendingAdaptiveWeek = [];
let latestWellnessSnapshot = null;


let pendingCoachChatWorkout=null;

function coachChatContext(){
  const availability=todayAvailabilityInfo();
  const snapshot=getWellnessSnapshot();
  const readiness=determineReadiness(snapshot);
  const race=getRaceFocus();
  const phase=classifyRacePhase(race);
  const profileData=getProfile();
  const existing=currentTodayWorkout();
  return{availability,snapshot,readiness,race,phase,profile:profileData,existing};
}

function normalizeCoachMessage(message){
  return String(message||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}

function extractMinutesFromMessage(message){
  const normalized=normalizeCoachMessage(message);
  const match=normalized.match(/(\d{2,3})\s*(min|minuten|minute)/);
  if(match) return Number(match[1]);
  const hourMatch=normalized.match(/(\d+(?:[.,]\d+)?)\s*(uur|u)/);
  if(hourMatch) return Math.round(Number(hourMatch[1].replace(",","."))*60);
  return null;
}

function coachChatAddMessage(role,text){
  const box=document.getElementById("coachChatMessages");
  if(!box) return;
  const row=document.createElement("div");
  row.className=`coach-message ${role}`;
  const avatar=document.createElement("div");
  avatar.className="coach-avatar";
  avatar.textContent=role==="user"?"J":"C";
  const bubble=document.createElement("div");
  bubble.className="coach-bubble";
  bubble.textContent=text;
  row.appendChild(avatar);
  row.appendChild(bubble);
  box.appendChild(row);
  box.scrollTop=box.scrollHeight;
}

function coachChatResponse(message){
  const text=normalizeCoachMessage(message);
  const context=coachChatContext();
  const minutes=extractMinutesFromMessage(message);
  let response="";
  let workout=null;

  const heavyLegs=/zwaar|vermoeid|stram|stijf|moe|lood/.test(text);
  const poorSleep=/slecht geslapen|weinig geslapen|korte nacht/.test(text);
  const feelGood=/heel goed|fris|topfit|sterk vandaag|voel me goed|goede benen/.test(text);
  const unavailableTomorrow=/morgen.*niet|niet.*morgen|morgen kan ik niet|morgen geen tijd/.test(text);
  const missed=/gemist|training overgeslagen|niet kunnen trainen/.test(text);
  const wantsLong=/lange duur|lange duurloop|long run/.test(text);
  const pain=/pijn|blessure|stekende|scherpe pijn|gezwollen/.test(text);

  if(pain){
    response="Bij pijn maak ik geen intensieve trainingsaanpassing. Kies vandaag voor rust of zeer lichte mobiliteit en beoordeel eerst of trainen verantwoord voelt. Bij aanhoudende of duidelijke pijn is professionele beoordeling verstandiger.";
    workout=createGeneratorWorkout("mobility",context);
    return{response,workout};
  }

  if(heavyLegs || poorSleep || context.readiness.level==="low"){
    if(context.availability.available){
      response="Je herstel krijgt vandaag voorrang. Ik zou de intensiteit schrappen en kiezen voor een korte herstelloop of mobiliteit. Zo behouden we ritme zonder extra vermoeidheid op te stapelen.";
      const adjusted={...context,availability:{...context.availability,maxMinutes:minutes||context.availability.maxMinutes}};
      workout=createGeneratorWorkout(minutes && minutes<=25 ? "mobility" : "recovery",adjusted);
    }else{
      response="Vandaag staat al als rustdag of niet beschikbaar. Met zware benen is dat passend: laat de geplande rust staan en voeg alleen korte mobiliteit toe als dat prettig voelt.";
      workout=createGeneratorWorkout("mobility",context);
    }
    return{response,workout};
  }

  if(minutes){
    const adjusted={...context,availability:{...context.availability,available:true,maxMinutes:minutes}};
    if(minutes<=25){
      response=`Met ${minutes} minuten beschikbaar is een volledige loopkwaliteitssessie niet zinvol. Ik kies liever een korte core- of mobiliteitssessie.`;
      workout=createGeneratorWorkout("core",adjusted);
    }else if(minutes<=45){
      response=`Met ${minutes} minuten houden we de training compact. Geen onnodig lange warming-up of extra volume; de trainingsprikkel blijft centraal staan.`;
      workout=context.readiness.level==="good"
        ? createGeneratorWorkout("sharpen",adjusted)
        : createGeneratorWorkout("easy",adjusted);
    }else{
      response=`${minutes} minuten is voldoende om een volwaardige training te doen. Ik laat wedstrijdfase en herstel bepalen of dat kwaliteit of rustige duur wordt.`;
      const kinds=chooseGeneratorKinds(adjusted);
      workout=createGeneratorWorkout(kinds[0],adjusted);
    }
    workout=fitGeneratedWorkout(workout,adjusted);
    return{response,workout};
  }

  if(unavailableTomorrow){
    response="Dan zou ik morgen niet proberen te compenseren met een dubbele sessie. We houden de belangrijkste kwaliteitsprikkel op de eerstvolgende geschikte beschikbare dag en laten de rest van de week daaromheen schuiven.";
    return{response,workout:null};
  }

  if(missed){
    response="Een gemiste training hoeft niet automatisch ingehaald te worden. Ik zou alleen de belangrijkste kwaliteitstraining behouden en extra kilometers niet stapelen. De weekcoach kan de resterende sessies opnieuw verdelen.";
    return{response,workout:null};
  }

  if(wantsLong){
    if(context.readiness.level==="good" && context.availability.available){
      response="Je herstel laat een langere duurprikkel toe. Ik zou hem wel rustig houden en geen zware intervaltraining er direct naast plannen.";
      workout=createGeneratorWorkout("long",context);
    }else{
      response="Een lange duurloop past vandaag minder goed bij je herstel of beschikbaarheid. Ik zou hem verplaatsen naar de eerstvolgende ruime, goed herstelde dag.";
    }
    return{response,workout};
  }

  if(feelGood){
    if(!context.availability.available){
      response="Je voelt je goed, maar vandaag staat als niet beschikbaar. Ik zou dat niet automatisch veranderen. Bewaar de frisheid voor de volgende geplande kwaliteitstraining.";
      return{response,workout:null};
    }
    const kinds=chooseGeneratorKinds(context);
    workout=createGeneratorWorkout(kinds[0],context);
    response=`Je herstel en gevoel zijn positief. Daarom kan vandaag een gerichte trainingsprikkel, passend bij ${context.race?context.race.name:"je huidige opbouw"}.`;
    return{response,workout};
  }

  const recoveryText=context.readiness.sufficientData
    ? `een coachscore van ${context.readiness.score}/100`
    :"onvoldoende actuele hersteldata voor een coachscore";

  response=`Ik combineer je bericht met ${recoveryText}${context.race?`, ${context.race.name} over ${context.phase.days} dagen`:""} en je huidige beschikbaarheid. Voor een concrete wijziging kun je aangeven hoeveel tijd je hebt, hoe je benen voelen of welke training je wilt verplaatsen.`;
  return{response,workout:null};
}

function showCoachChatAction(workout){
  const box=document.getElementById("coachChatAction");
  pendingCoachChatWorkout=workout||null;
  if(!workout){
    box.hidden=true;
    return;
  }
  box.hidden=false;
  document.getElementById("coachChatActionTitle").textContent=workout.name;
  document.getElementById("coachChatActionText").textContent=
    `${trainingVolumeLabel(workout)} · RPE ${workout.rpe||"—"} · ${(workout.displaySteps||[]).join(" · ")}`;
}

function handleCoachChat(message){
  const input=String(message||"").trim();
  if(!input) return;
  coachChatAddMessage("user",input);
  const result=coachChatResponse(input);
  setTimeout(()=>{
    coachChatAddMessage("coach",result.response);
    showCoachChatAction(result.workout);
  },120);
}

function sendCoachChatMessage(){
  const input=document.getElementById("coachChatInput");
  const message=input.value.trim();
  if(!message) return;
  input.value="";
  handleCoachChat(message);
}

function clearCoachChat(){
  const box=document.getElementById("coachChatMessages");
  box.innerHTML=`
    <div class="coach-message coach">
      <div class="coach-avatar">C</div>
      <div class="coach-bubble">
        Vertel me wat er verandert. Bijvoorbeeld: “Mijn benen voelen zwaar”
        of “Ik heb vandaag maar 40 minuten.”
      </div>
    </div>
  `;
  pendingCoachChatWorkout=null;
  document.getElementById("coachChatAction").hidden=true;
  document.getElementById("coachChatStatus").textContent="";
}

function applyCoachChatWorkout(){
  const status=document.getElementById("coachChatStatus");
  if(!pendingCoachChatWorkout) return;

  const date=todayDateString();
  const existing=customWorkouts[date];

  if(existing){
    const confirmed=confirm(`De bestaande training "${existing.name}" vervangen door "${pendingCoachChatWorkout.name}"?`);
    if(!confirmed) return;
  }

  const saved=JSON.parse(JSON.stringify(pendingCoachChatWorkout));
  saved.date=date;
  saved.status="planned";
  customWorkouts[date]=saved;
  saveObject(STORAGE_KEY,customWorkouts);

  renderMonth();
  renderSelected();
  renderSaved();
  renderTodayCoach();
  renderPerformanceEngine();
  renderCoachIntelligence();
  renderPerformanceTrend(activeTrendDays);

  status.className="status ok";
  status.textContent=`${saved.name} is voor vandaag ingepland.`;
  coachChatAddMessage("coach",`${saved.name} staat nu in je kalender voor vandaag.`);
}

let smartWeekOptions=[];
let selectedSmartWeekIndex=0;

function weekdayIndexFromDate(dateString){
  const day=new Date(dateString+"T12:00:00").getDay();
  return day===0?6:day-1;
}

function isHardWorkout(workout){
  const type=String(workout?.planType||"").toLowerCase();
  const rpe=Number(String(workout?.rpe||"0").split("/")[0])||0;
  const name=String(workout?.name||"").toLowerCase();

  return["quality","threshold","vo2"].includes(type) ||
    rpe>=7 ||
    /interval|vo₂|vo2|drempel|threshold|tempo|400|800|1000|2000|3000/.test(name);
}

function isLongWorkout(workout){
  const type=String(workout?.planType||"").toLowerCase();
  return type==="long" || Number(workout?.distanceKm||0)>=16;
}

function smartWeekContext(){
  const profileData=getProfile();
  const availability=availableDaysForPlanner();
  const readiness=determineReadiness(getWellnessSnapshot());
  const race=getRaceFocus();
  const phase=classifyRacePhase(race);
  const start=nextMonday();
  const end=addDays(start,6);

  const existing=Object.entries(customWorkouts)
    .filter(([date])=>date>=start && date<=end)
    .map(([date,workout])=>({...JSON.parse(JSON.stringify(workout)),date}));

  return{profile:profileData,availability,readiness,race,phase,start,end,existing};
}

function availableDayInfo(context,dateString){
  const index=weekdayIndexFromDate(dateString);
  return context.availability.find(day=>day.index===index)||null;
}

function compatibleWithDay(workout,dayInfo){
  if(!dayInfo) return false;
  const pref=String(dayInfo.preference||"").toLowerCase();
  const type=String(workout.planType||workout.type||"").toLowerCase();

  if(pref==="rust") return false;
  if(pref==="core") return type==="core";
  if(pref==="mobiliteit") return type==="mobility";
  if(pref==="lange-duur") return type==="long" || type==="easy";
  if(pref==="drempel") return isHardWorkout(workout);
  if(pref==="herstel") return ["recovery","easy","mobility"].includes(type);
  return true;
}

function estimatedWorkoutMinutes(workout){
  if(Number(workout.durationMinutes)>0) return Number(workout.durationMinutes);

  const km=Number(workout.distanceKm)||0;
  if(!km) return 20;

  const type=String(workout.planType||"").toLowerCase();
  let pace=5.15;
  if(isHardWorkout(workout)) pace=4.6;
  if(type==="long") pace=5.1;
  if(type==="recovery") pace=5.45;

  return Math.round(km*pace);
}

function fitsTime(workout,dayInfo){
  if(!dayInfo) return false;
  const max=Number(dayInfo.maxMinutes)||999;
  return estimatedWorkoutMinutes(workout)<=max+10;
}

function dateGapDays(a,b){
  return Math.round(
    Math.abs(
      new Date(a+"T12:00:00")-new Date(b+"T12:00:00")
    )/86400000
  );
}

function smartWeekWarningsFor(workouts,context){
  const sorted=[...workouts].sort((a,b)=>a.date.localeCompare(b.date));
  const warnings=[];

  const hard=sorted.filter(isHardWorkout);
  const long=sorted.filter(isLongWorkout);

  for(let i=1;i<hard.length;i++){
    const gap=dateGapDays(hard[i-1].date,hard[i].date);
    if(gap<2){
      warnings.push({
        state:"warn",
        icon:"!",
        text:`Zware sessies op ${hard[i-1].date} en ${hard[i].date} staan te dicht op elkaar.`
      });
    }
  }

  if(hard.length>2){
    warnings.push({
      state:"warn",icon:"!",
      text:`${hard.length} zware loopsessies in één week is relatief veel.`
    });
  }

  if(long.length>1){
    warnings.push({
      state:"warn",icon:"!",
      text:"Er staan meerdere lange duurlopen in dezelfde week."
    });
  }

  sorted.forEach(workout=>{
    const dayInfo=availableDayInfo(context,workout.date);
    if(!dayInfo){
      warnings.push({
        state:"warn",icon:"!",
        text:`${workout.name} staat op ${workout.date}, maar die dag is niet beschikbaar ingesteld.`
      });
    }else if(!fitsTime(workout,dayInfo)){
      warnings.push({
        state:"warn",icon:"!",
        text:`${workout.name} past waarschijnlijk niet binnen ${dayInfo.maxMinutes} beschikbare minuten.`
      });
    }
  });

  if(!warnings.length){
    warnings.push({
      state:"good",icon:"✓",
      text:"De week heeft een goede spreiding tussen belasting en herstel."
    });
  }

  return warnings;
}

function chooseBestDateForWorkout(workout,context,usedDates,variant=0){
  const candidates=context.availability
    .map(day=>({...day,date:addDays(context.start,day.index)}))
    .filter(day=>!usedDates.has(day.date))
    .filter(day=>compatibleWithDay(workout,day))
    .filter(day=>fitsTime(workout,day));

  if(!candidates.length){
    const fallback=context.availability
      .map(day=>({...day,date:addDays(context.start,day.index)}))
      .filter(day=>!usedDates.has(day.date))
      .filter(day=>fitsTime(workout,day));
    if(!fallback.length) return null;
    candidates.push(...fallback);
  }

  const hard=isHardWorkout(workout);
  const long=isLongWorkout(workout);

  const scored=candidates.map(day=>{
    let score=50;

    if(day.priority==="must") score+=20;
    if(day.priority==="should") score+=10;

    const pref=String(day.preference||"").toLowerCase();

    if(hard && pref==="drempel") score+=30;
    if(long && pref==="lange-duur") score+=35;
    if(!hard && !long && pref==="rustig") score+=20;
    if(String(workout.planType||"").toLowerCase()==="recovery" && pref==="herstel") score+=30;
    if(workout.type==="Core" && pref==="core") score+=40;
    if(workout.type==="Mobility" && pref==="mobiliteit") score+=40;

    if(variant===1) score+=day.index*2;
    if(variant===2) score+=(6-day.index)*2;

    return{...day,score};
  });

  scored.sort((a,b)=>b.score-a.score);
  return scored[0];
}

function optimizeWeekWorkouts(sourceWorkouts,context,variant=0){
  const ordered=[...sourceWorkouts].sort((a,b)=>{
    const weight=workout=>{
      if(isHardWorkout(workout)) return 1;
      if(isLongWorkout(workout)) return 2;
      const type=String(workout.planType||workout.type||"").toLowerCase();
      if(type==="easy") return 3;
      if(type==="recovery") return 4;
      if(type==="core" || type==="mobility") return 5;
      return 6;
    };
    return weight(a)-weight(b);
  });

  const scheduled=[];
  const usedDates=new Set();

  for(const workout of ordered){
    const candidate=chooseBestDateForWorkout(workout,context,usedDates,variant);
    if(!candidate) continue;

    let date=candidate.date;

    if(isHardWorkout(workout)){
      const conflicting=scheduled.find(existing=>
        isHardWorkout(existing) && dateGapDays(existing.date,date)<2
      );

      if(conflicting){
        const alternates=context.availability
          .map(day=>({...day,date:addDays(context.start,day.index)}))
          .filter(day=>!usedDates.has(day.date))
          .filter(day=>fitsTime(workout,day))
          .filter(day=>
            scheduled
              .filter(isHardWorkout)
              .every(existing=>dateGapDays(existing.date,day.date)>=2)
          );

        if(alternates.length){
          date=alternates[0].date;
        }
      }
    }

    scheduled.push({...JSON.parse(JSON.stringify(workout)),date});
    usedDates.add(date);
  }

  return scheduled.sort((a,b)=>a.date.localeCompare(b.date));
}

function generateSmartWeekOptions(){
  const context=smartWeekContext();

  let baseWeek=[];

  if(aiWeekOptions?.length && aiWeekOptions[selectedAiWeekIndex]?.workouts?.length){
    baseWeek=aiWeekOptions[selectedAiWeekIndex].workouts;
  }else{
    const generated=createUnscheduledAiWeek(context,0);
    baseWeek=generated.workouts;
  }

  smartWeekOptions=[0,1,2].map(variant=>
    optimizeWeekWorkouts(baseWeek,context,variant)
  );

  selectedSmartWeekIndex=0;
  renderSmartWeekCoach(context);
}

function smartWeekBalanceScore(workouts,context){
  let score=100;
  const warnings=smartWeekWarningsFor(workouts,context);

  score-=warnings.filter(item=>item.state==="warn").length*12;

  const hard=workouts.filter(isHardWorkout).length;
  const recovery=workouts.filter(workout=>
    ["recovery","easy","mobility"].includes(
      String(workout.planType||workout.type||"").toLowerCase()
    )
  ).length;

  if(hard<=2) score+=4;
  if(recovery>=2) score+=4;

  return clampScore(score);
}

function renderSmartWeekCoach(context=smartWeekContext()){
  const balance=document.getElementById("smartWeekBalance");
  if(!balance) return;

  const option=smartWeekOptions[selectedSmartWeekIndex];

  if(!option){
    balance.textContent="—";
    document.getElementById("smartWeekHardSessions").textContent="—";
    document.getElementById("smartWeekRecoveryDays").textContent="—";
    document.getElementById("smartWeekAvailability").textContent=`${context.availability.length} dagen`;
    document.getElementById("smartWeekWarnings").innerHTML="";
    document.getElementById("smartWeekPlan").innerHTML='<p class="help">Hier verschijnt de geoptimaliseerde week.</p>';
    document.getElementById("applySmartWeek").disabled=true;
    document.getElementById("smartWeekAlternative").disabled=true;
    return;
  }

  const warnings=smartWeekWarningsFor(option,context);
  const hard=option.filter(isHardWorkout).length;
  const recovery=option.filter(workout=>
    ["recovery","easy","mobility"].includes(
      String(workout.planType||workout.type||"").toLowerCase()
    )
  ).length;
  const score=smartWeekBalanceScore(option,context);

  balance.textContent=`${score}/100`;
  document.getElementById("smartWeekHardSessions").textContent=hard;
  document.getElementById("smartWeekRecoveryDays").textContent=recovery;
  document.getElementById("smartWeekAvailability").textContent=`${context.availability.length} dagen`;

  document.getElementById("smartWeekWarnings").innerHTML=
    warnings.map(item=>`
      <div class="reason-item">
        <div class="reason-icon ${item.state}">${item.icon}</div>
        <div>${safe(item.text)}</div>
      </div>
    `).join("");

  let headline="Week is goed verdeeld";
  let conclusion="Kwaliteit, duur en herstel zijn logisch over de week verspreid.";

  if(score<60){
    headline="Week vraagt aanpassing";
    conclusion="Er zijn meerdere conflicten met herstel of beschikbaarheid. Kies een alternatieve verdeling.";
  }else if(score<80){
    headline="Week is bruikbaar, maar niet optimaal";
    conclusion="De week kan worden uitgevoerd, maar let op de gemarkeerde belasting- of tijdsconflicten.";
  }

  document.getElementById("smartWeekHeadline").textContent=headline;
  document.getElementById("smartWeekConclusion").textContent=conclusion;

  document.getElementById("smartWeekPlan").innerHTML=
    option.map(workout=>`
      <div class="smart-week-row ${safe(workout.planType||workout.type.toLowerCase())}">
        <div class="day">
          ${new Intl.DateTimeFormat("nl-NL",{weekday:"short",day:"numeric"}).format(new Date(workout.date+"T12:00:00"))}
        </div>
        <div>
          <strong>${safe(workout.name)}</strong>
          <small>${safe((workout.displaySteps||[])[0]||"")}</small>
        </div>
        <div class="smart-week-pill">
          ${trainingVolumeLabel(workout)}
        </div>
      </div>
    `).join("");

  document.getElementById("applySmartWeek").disabled=false;
  document.getElementById("smartWeekAlternative").disabled=false;
}

function selectNextSmartWeek(){
  if(!smartWeekOptions.length){
    generateSmartWeekOptions();
    return;
  }
  selectedSmartWeekIndex=(selectedSmartWeekIndex+1)%smartWeekOptions.length;
  renderSmartWeekCoach();
}

function applySmartWeekPlan(){
  const option=smartWeekOptions[selectedSmartWeekIndex];
  const status=document.getElementById("smartWeekStatus");
  if(!option?.length) return;

  let added=0;
  let skipped=0;

  for(const workout of option){
    if(customWorkouts[workout.date]){
      skipped++;
      continue;
    }

    customWorkouts[workout.date]=JSON.parse(JSON.stringify(workout));
    added++;
  }

  saveObject(STORAGE_KEY,customWorkouts);
  renderMonth();
  renderSaved();
  renderTodayCoach();
  renderPerformanceEngine();
  renderCoachIntelligence();

  status.className="status ok";
  status.textContent=`${added} trainingen toegepast${skipped?` · ${skipped} bestaande dagen behouden`:""}.`;
}

let latestWellnessRecords=[];
let pendingTodayAdvice = null;

const today = new Date();
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = "2026-08-04";
let duplicateSourceDate = null;

const fullDate = new Intl.DateTimeFormat("nl-NL",{
  weekday:"long",day:"numeric",month:"long",year:"numeric"
});
const monthFmt = new Intl.DateTimeFormat("nl-NL",{month:"long",year:"numeric"});

function loadObject(key){
  try{return JSON.parse(localStorage.getItem(key) || "{}")}catch{return {}}
}
function saveObject(key,value){
  localStorage.setItem(key,JSON.stringify(value));
}
function allWorkouts(){
  const raceWorkouts = Object.fromEntries(
    Object.values(races).map(race => [
      race.date,
      {
        name: race.name,
        uploadName: race.name,
        date: race.date,
        type: "Race",
        distanceKm: race.distanceKm,
        rpe: "10/10",
        status: "planned",
        displaySteps: [
          `${formatRaceDistance(race.distanceKm)} wedstrijd`,
          race.targetTime ? `Streeftijd: ${race.targetTime}` : "Geen streeftijd ingevuld",
          `${race.priority}-wedstrijd`
        ],
        intervalsDescription: ""
      }
    ])
  );
  return {...serverWorkouts,...customWorkouts,...raceWorkouts};
}
function safe(value){
  return String(value ?? "").replace(/[<>]/g,"");
}
function ymd(date){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,"0");
  const d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function clone(value){
  return JSON.parse(JSON.stringify(value));
}
function switchView(id){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.view===id));
  document.getElementById(id).classList.add("active");
  if(id==="saved") renderSaved();
  if(id==="races"){
    renderRaces();
    renderRaceOptions();
  }
  if(id==="dashboard"){loadWellnessDashboard();renderProfileSummary();}
  if(id==="profile"){fillProfileForm();}
}

function workoutState(date,workout){
  if(doneWorkouts[date] || workout?.status==="done") return "done";
  if(workout?.type==="Race" || /wedstrijd|race/i.test(workout?.name || "")) return "race";
  if(customWorkouts[date]) return "custom";
  return "planned";
}

function renderMonth(){
  const grid=document.getElementById("calendarGrid");
  document.getElementById("monthTitle").textContent=monthFmt.format(visibleMonth);

  const year=visibleMonth.getFullYear();
  const month=visibleMonth.getMonth();
  const first=new Date(year,month,1);
  const lastDay=new Date(year,month+1,0).getDate();
  const mondayIndex=(first.getDay()+6)%7;
  const workouts=allWorkouts();

  let html="";
  for(let i=0;i<mondayIndex;i++){
    html+=`<button class="day empty" type="button"></button>`;
  }

  for(let day=1;day<=lastDay;day++){
    const dateObj=new Date(year,month,day);
    const date=ymd(dateObj);
    const workout=workouts[date];
    const isToday=date===ymd(today);
    const isSelected=date===selectedDate;
    const state=workout ? workoutState(date,workout) : "";
    const uploaded=uploadedWorkouts[date] ? "uploaded" : "";

    html+=`
      <button class="day ${isToday?"today":""} ${isSelected?"selected":""}"
        type="button" onclick="selectDate('${date}')">
        <span class="day-number">${day}</span>
        ${workout?`
          <span class="dot ${state} ${uploaded}"></span>
          <div class="day-name">${safe(workout.name)}</div>
        `:""}
      </button>`;
  }
  grid.innerHTML=html;
}

function renderSelected(){
  const workout=allWorkouts()[selectedDate];
  const card=document.getElementById("workoutCard");

  if(!workout){
    card.innerHTML=`
      <p class="label">${fullDate.format(new Date(selectedDate+"T12:00:00"))}</p>
      <div class="workout-title">Geen training gepland</div>
      <p class="help">Maak voor deze dag een training.</p>
      <button type="button" onclick="newForSelected()">Training toevoegen</button>`;
    return;
  }

  const isCustom=Boolean(customWorkouts[selectedDate]);
  const done=workoutState(selectedDate,workout)==="done";
  const uploaded=Boolean(uploadedWorkouts[selectedDate]);

  card.innerHTML=`
    <p class="label">${fullDate.format(new Date(selectedDate+"T12:00:00"))}</p>
    <div class="workout-title">${safe(workout.name)}</div>

    <div class="meta">
      <span class="sport-badge ${trainingTypeInfo(workout.type).css}">
        <span class="sport-dot"></span>${trainingTypeInfo(workout.type).icon} ${trainingTypeInfo(workout.type).label}
      </span>
      <span class="pill">${trainingVolumeLabel(workout)}</span>
      <span class="pill">RPE ${safe(workout.rpe)}</span>
      <span class="pill">${done?"Voltooid":isCustom?"Eigen training":"Schema"}</span>
      ${uploaded?`<span class="pill">In Intervals ✓</span>`:""}
    </div>

    <ul class="steps">
      ${(workout.displaySteps||[]).map((step,index)=>`
        <li><span class="step">${index+1}</span><span>${safe(step)}</span></li>
      `).join("")}
    </ul>

    <div class="actions">
      <button type="button" onclick="toggleDone()">
        ${done?"Markeer als gepland":"Markeer als voltooid"}
      </button>

      <button class="secondary" type="button" onclick="uploadSelected()"
        ${trainingTypeInfo(workout.type).uploadable ? "" : "disabled"}>
        ${trainingTypeInfo(workout.type).uploadable
          ? (uploaded?"Opnieuw naar Intervals":"Zet in Intervals.icu")
          : "Intervals-export volgt"}
      </button>

      ${isCustom?`
        <button class="secondary" type="button" onclick="editWorkout('${selectedDate}')">Bewerken</button>
        <button class="secondary" type="button" onclick="openDuplicate('${selectedDate}')">Dupliceren</button>
        <button class="danger wide" type="button" onclick="deleteWorkout('${selectedDate}')">Verwijderen</button>
      `:`
        <button class="secondary wide" type="button" onclick="copyServerWorkout('${selectedDate}')">
          Maak bewerkbare kopie
        </button>
      `}
    </div>

    <p id="uploadStatus" class="status"></p>`;
}

function selectDate(date){
  selectedDate=date;
  renderMonth();
  renderSelected();
}

function toggleDone(){
  doneWorkouts[selectedDate]=!doneWorkouts[selectedDate];
  saveObject(DONE_KEY,doneWorkouts);
  renderMonth();
  renderSelected();
}

async function uploadSelected(){
  const workout=allWorkouts()[selectedDate];
  if(!workout) return;

  if(!trainingTypeInfo(workout.type).uploadable){
    const status=document.getElementById("uploadStatus");
    if(status){
      status.className="status error";
      status.textContent=`Intervals.icu-export voor ${trainingTypeInfo(workout.type).label.toLowerCase()} wordt in fase 2 toegevoegd.`;
    }
    return;
  }

  const pin=prompt("Voer je Jaco Performance app-pincode in:");
  if(pin===null) return;

  const status=document.getElementById("uploadStatus");
  status.className="status";
  status.textContent="Workout wordt verstuurd…";

  try{
    const payload={workoutDate:selectedDate,pin};
    if(customWorkouts[selectedDate]){
      const customWorkout=JSON.parse(JSON.stringify(workout));

      if(["Core","Mobility"].includes(customWorkout.type)){
        const steps=Array.isArray(customWorkout.displaySteps)
          ? customWorkout.displaySteps.filter(Boolean)
          : [];

        const bulletSteps=steps.map(step=>`- ${step}`).join("\n");
        const duration=Number(customWorkout.durationMinutes)||15;

        customWorkout.intervalsDescription=[
          `${trainingTypeInfo(customWorkout.type).label} · ${duration} minuten`,
          bulletSteps,
          customWorkout.intervalsDescription || ""
        ].filter(Boolean).join("\n\n");
      }

      payload.customWorkout=customWorkout;
    }

    const response=await fetch("/api/upload-workout",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    });

    const data=await response.json();
    if(!response.ok){
      throw new Error(data.error || "Upload mislukt");
    }

    uploadedWorkouts[selectedDate]={
      uploadedAt:new Date().toISOString(),
      name:workout.name
    };
    saveObject(UPLOAD_KEY,uploadedWorkouts);

    status.className="status ok";
    status.textContent="Gelukt: workout staat in Intervals.icu.";
    renderMonth();
  }catch(error){
    status.className="status error";
    status.textContent=error.message;
  }
}

function setDefaultForm(date=ymd(today)){
  document.getElementById("workoutForm").reset();
  document.getElementById("originalDate").value="";
  document.getElementById("date").value=date;
  document.getElementById("workoutType").value="Run";
  document.getElementById("durationMinutes").value=60;
  document.getElementById("activitySteps").value="";
  document.getElementById("activityDescription").value="";
  document.getElementById("rpe").value="8/10";
  document.getElementById("warmupKm").value=3;
  document.getElementById("warmupPace").value="5:00-5:30/km";
  document.getElementById("repeats").value=5;
  document.getElementById("workMeters").value=1000;
  document.getElementById("targetPace").value="3:28-3:30/km";
  document.getElementById("recoveryType").value="time";
  document.getElementById("recoveryValue").value=2;
  document.getElementById("cooldownKm").value=2;
  document.getElementById("notes").value="";
  document.getElementById("editorLabel").textContent="Nieuwe training";
  document.getElementById("editorTitle").textContent="Training toevoegen";
  document.getElementById("saveButton").textContent="Training opslaan";
  document.getElementById("cancelEdit").hidden=true;
  document.getElementById("formStatus").textContent="";
  updateRecoveryLabel();
  updateWorkoutTypeFields();
  updatePreview();
}

function newForSelected(){
  setDefaultForm(selectedDate);
  switchView("editor");
}


function parseDateFromText(text){
  const lower=text.toLowerCase();
  const base=new Date();

  if(/\bmorgen\b/.test(lower)){
    base.setDate(base.getDate()+1);
    return ymd(base);
  }
  if(/\bovermorgen\b/.test(lower)){
    base.setDate(base.getDate()+2);
    return ymd(base);
  }

  const weekdays={
    zondag:0,maandag:1,dinsdag:2,woensdag:3,
    donderdag:4,vrijdag:5,zaterdag:6
  };

  for(const [name,index] of Object.entries(weekdays)){
    if(lower.includes(name)){
      const current=base.getDay();
      let delta=(index-current+7)%7;
      if(delta===0) delta=7;
      base.setDate(base.getDate()+delta);
      return ymd(base);
    }
  }

  const iso=lower.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if(iso){
    return `${iso[1]}-${iso[2].padStart(2,"0")}-${iso[3].padStart(2,"0")}`;
  }

  const dutch=lower.match(/\b(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)(?:\s+(20\d{2}))?\b/);
  if(dutch){
    const months={
      januari:1,februari:2,maart:3,april:4,mei:5,juni:6,
      juli:7,augustus:8,september:9,oktober:10,november:11,december:12
    };
    const year=dutch[3] || String(base.getFullYear());
    return `${year}-${String(months[dutch[2]]).padStart(2,"0")}-${dutch[1].padStart(2,"0")}`;
  }

  return document.getElementById("date").value || ymd(base);
}


function paceToSeconds(pace){
  const match=String(pace).match(/(\d+):(\d{2})/);
  if(!match) return null;
  return Number(match[1])*60+Number(match[2]);
}

function secondsToPace(seconds){
  const rounded=Math.max(1,Math.round(seconds));
  return `${Math.floor(rounded/60)}:${String(rounded%60).padStart(2,"0")}`;
}

function estimateRacePaceSeconds(text, distanceKm){
  const lower=text.toLowerCase();

  const subMatch=lower.match(/sub\s*(\d{1,2})(?::(\d{2}))?/);
  if(subMatch){
    const minutes=Number(subMatch[1]);
    const seconds=Number(subMatch[2] || 0);
    return Math.round((minutes*60+seconds)/distanceKm);
  }

  const timeMatch=lower.match(/(?:in|doel|richting)\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if(timeMatch){
    const a=Number(timeMatch[1]);
    const b=Number(timeMatch[2]);
    const c=Number(timeMatch[3] || 0);
    const total=timeMatch[3] ? a*3600+b*60+c : a*60+b;
    return Math.round(total/distanceKm);
  }

  return null;
}

function chooseGeneratedWorkout(text){
  const lower=text.toLowerCase();
  const date=parseDateFromText(text);

  const explicitDistance=lower.match(/\b(\d+(?:[.,]\d+)?)\s*km\b/);
  const requestedKm=explicitDistance ? Number(explicitDistance[1].replace(",",".")) : null;

  const isRecovery=/herstel|zeer rustig|loslopen/.test(lower);
  const isEasy=/rustig|easy|duurloop/.test(lower);
  const isLong=/lange duur|lange duurloop|lang duur/.test(lower) || (requestedKm && requestedKm>=16);
  const isThreshold=/drempel|threshold|tempo/.test(lower);
  const isFiveK=/5\s*km|vijf kilometer/.test(lower);
  const isTenK=/10\s*km|tien kilometer/.test(lower);
  const isHalf=/halve marathon|21[.,]?1\s*km/.test(lower);
  const isMarathon=/marathon/.test(lower) && !isHalf;
  const isHard=/pittig|zwaar|hard|kwaliteit|intensief/.test(lower);

  let raceDistance=5;
  if(isTenK) raceDistance=10;
  else if(isHalf) raceDistance=21.0975;
  else if(isMarathon) raceDistance=42.195;

  const racePace=estimateRacePaceSeconds(lower,raceDistance);

  if(isRecovery){
    const km=requestedKm || 8;
    return {
      date,
      name:`Herstelloop ${km} km`,
      distanceKm:km,
      rpe:"2/10",
      warmupKm:km,
      warmupPace:"5:10-5:35/km",
      repeats:1,
      workMeters:100,
      targetPace:"5:10-5:35/km",
      recoveryType:"time",
      recoveryValue:1,
      cooldownKm:0,
      notes:"Zeer ontspannen lopen. Hartslag laag houden en niet versnellen."
    };
  }

  if(isLong){
    const km=requestedKm || 18;
    return {
      date,
      name:`Lange duurloop ${km} km`,
      distanceKm:km,
      rpe:"4/10",
      warmupKm:km,
      warmupPace:"4:55-5:20/km",
      repeats:1,
      workMeters:100,
      targetPace:"4:55-5:20/km",
      recoveryType:"time",
      recoveryValue:1,
      cooldownKm:0,
      notes:"Rustig en gecontroleerd. Alleen versnellen als je fris bent."
    };
  }

  if(isThreshold || (isTenK && isHard)){
    const target=racePace ? secondsToPace(racePace+8) : "3:42-3:48";
    return {
      date,
      name:"3 × 2 km drempel",
      distanceKm:13,
      rpe:"7/10",
      warmupKm:3,
      warmupPace:"5:00-5:25/km",
      repeats:3,
      workMeters:2000,
      targetPace:`${target}/km`,
      recoveryType:"time",
      recoveryValue:2,
      cooldownKm:2,
      notes:"Drempeltraining: gecontroleerd starten en alle herhalingen gelijkmatig lopen."
    };
  }

  if(isFiveK || isHard){
    let repeats=5;
    let meters=1000;
    let recovery=2;
    let target="3:28-3:30/km";

    if(racePace){
      const fast=racePace-3;
      const slow=racePace+1;
      target=`${secondsToPace(fast)}-${secondsToPace(slow)}/km`;
    }

    if(/kort|snelheid|400/.test(lower)){
      repeats=12;
      meters=400;
      recovery=200;
      target=racePace
        ? `${secondsToPace(racePace-8)}-${secondsToPace(racePace-3)}/km`
        : "3:13-3:18/km";

      return {
        date,
        name:"12 × 400 m",
        distanceKm:12.2,
        rpe:"8/10",
        warmupKm:3,
        warmupPace:"5:00-5:25/km",
        repeats,
        workMeters:meters,
        targetPace:target,
        recoveryType:"distance",
        recoveryValue:recovery,
        cooldownKm:2,
        notes:"Vlot maar technisch ontspannen. De laatste herhalingen mogen zwaar zijn."
      };
    }

    return {
      date,
      name:`${repeats} × ${meters} m VO₂max`,
      distanceKm:12,
      rpe:"8/10",
      warmupKm:3,
      warmupPace:"5:00-5:25/km",
      repeats,
      workMeters:meters,
      targetPace:target,
      recoveryType:"time",
      recoveryValue:recovery,
      cooldownKm:2,
      notes:"5 km-specifieke kwaliteitstraining. Eerste herhaling gecontroleerd openen."
    };
  }

  if(isHalf){
    const target=racePace ? secondsToPace(racePace+3) : "3:48-3:52";
    return {
      date,
      name:"2 × 5 km halve-marathontempo",
      distanceKm:16,
      rpe:"7/10",
      warmupKm:3,
      warmupPace:"5:00-5:20/km",
      repeats:2,
      workMeters:5000,
      targetPace:`${target}/km`,
      recoveryType:"time",
      recoveryValue:3,
      cooldownKm:2,
      notes:"Halve-marathonspecifiek. Tempo beheerst houden en niet boven drempel lopen."
    };
  }

  if(isMarathon){
    const target=racePace ? secondsToPace(racePace) : "4:15-4:20";
    return {
      date,
      name:"Marathonduur met tempoblok",
      distanceKm:22,
      rpe:"6/10",
      warmupKm:8,
      warmupPace:"5:00-5:20/km",
      repeats:2,
      workMeters:5000,
      targetPace:`${target}/km`,
      recoveryType:"distance",
      recoveryValue:1000,
      cooldownKm:3,
      notes:"Marathonspecifiek. Voeding en drinken oefenen zoals op wedstrijddag."
    };
  }

  if(isEasy || requestedKm){
    const km=requestedKm || 10;
    return {
      date,
      name:`Rustige duurloop ${km} km`,
      distanceKm:km,
      rpe:"3/10",
      warmupKm:km,
      warmupPace:"5:00-5:25/km",
      repeats:1,
      workMeters:100,
      targetPace:"5:00-5:25/km",
      recoveryType:"time",
      recoveryValue:1,
      cooldownKm:0,
      notes:"Volledig ontspannen duurloop in zone 2."
    };
  }

  return {
    date,
    name:"5 × 1000 m VO₂max",
    distanceKm:12,
    rpe:"8/10",
    warmupKm:3,
    warmupPace:"5:00-5:25/km",
    repeats:5,
    workMeters:1000,
    targetPace:"3:28-3:30/km",
    recoveryType:"time",
    recoveryValue:2,
    cooldownKm:2,
    notes:"Algemene 5 km-specifieke kwaliteitstraining."
  };
}

function applyGeneratedWorkout(workout){
  document.getElementById("date").value=workout.date;
  document.getElementById("name").value=workout.name;
  document.getElementById("distanceKm").value=workout.distanceKm;
  document.getElementById("rpe").value=workout.rpe;
  document.getElementById("warmupKm").value=workout.warmupKm;
  document.getElementById("warmupPace").value=workout.warmupPace;
  document.getElementById("repeats").value=workout.repeats;
  document.getElementById("workMeters").value=workout.workMeters;
  document.getElementById("targetPace").value=workout.targetPace;
  document.getElementById("recoveryType").value=workout.recoveryType;
  document.getElementById("recoveryValue").value=workout.recoveryValue;
  document.getElementById("cooldownKm").value=workout.cooldownKm;
  document.getElementById("notes").value=workout.notes;

  updateRecoveryLabel();
  updatePreview();
}

function generateSmartWorkout(){
  const input=document.getElementById("smartInput").value.trim();
  const status=document.getElementById("smartStatus");

  if(!input){
    status.className="status error";
    status.textContent="Beschrijf eerst wat voor training je wilt.";
    return;
  }

  try{
    const generated=chooseGeneratedWorkout(input);
    applyGeneratedWorkout(generated);
    status.className="status ok";
    status.textContent=
      `Training voorgesteld: ${generated.name}. Controleer tempo, afstand en herstel en tik daarna op Opslaan.`;
  }catch(error){
    status.className="status error";
    status.textContent="De training kon niet worden gegenereerd.";
  }
}

function parseSmartTraining(){
  const raw=document.getElementById("smartInput").value.trim();
  const status=document.getElementById("smartStatus");

  if(!raw){
    status.className="status error";
    status.textContent="Beschrijf eerst een training.";
    return;
  }

  const text=raw.toLowerCase().replace(/×/g,"x").replace(/,/g,".");
  const date=parseDateFromText(raw);

  const interval=text.match(/\b(\d{1,2})\s*x\s*(\d{2,4})\s*m\b/);
  const easyKm=text.match(/\b(\d+(?:\.\d+)?)\s*km\s*(?:herstel|rustig|easy|duurloop)?/);
  const warmup=text.match(/(\d+(?:\.\d+)?)\s*km\s*(?:inlopen|warming.?up)/);
  const cooldown=text.match(/(\d+(?:\.\d+)?)\s*km\s*(?:uitlopen|cool.?down)/);
  const recoveryMin=text.match(/(\d+(?:\.\d+)?)\s*(?:min|minuten)\s*(?:herstel|pauze|dribbel)?/);
  const recoveryMeters=text.match(/(\d{2,4})\s*m\s*(?:herstel|dribbel|pauze)/);

  const paceRange=text.match(/\b(\d:\d{2})\s*[-–]\s*(\d:\d{2})(?:\s*\/?\s*km)?\b/);
  const paceSingle=text.match(/\b(?:in|op|tempo)?\s*(\d:\d{2})(?:\s*\/?\s*km)?\b/);
  const seconds=text.match(/\b(?:in|op)?\s*(\d{2,3})\s*(?:sec|seconden)\b/);

  document.getElementById("date").value=date;

  if(interval){
    const repeats=Number(interval[1]);
    const meters=Number(interval[2]);

    document.getElementById("repeats").value=repeats;
    document.getElementById("workMeters").value=meters;
    document.getElementById("name").value=`${repeats} × ${meters} m`;

    if(seconds){
      const sec=Number(seconds[1]);
      const paceSeconds=Math.round(sec*1000/meters);
      const min=Math.floor(paceSeconds/60);
      const rest=String(paceSeconds%60).padStart(2,"0");
      document.getElementById("targetPace").value=`${min}:${rest}/km`;
    }else if(paceRange){
      document.getElementById("targetPace").value=`${paceRange[1]}-${paceRange[2]}/km`;
    }else if(paceSingle){
      document.getElementById("targetPace").value=`${paceSingle[1]}/km`;
    }

    if(recoveryMin){
      document.getElementById("recoveryType").value="time";
      document.getElementById("recoveryValue").value=Number(recoveryMin[1]);
    }else if(recoveryMeters){
      document.getElementById("recoveryType").value="distance";
      document.getElementById("recoveryValue").value=Number(recoveryMeters[1]);
    }

    const wu=warmup ? Number(warmup[1]) : 3;
    const cd=cooldown ? Number(cooldown[1]) : 2;
    document.getElementById("warmupKm").value=wu;
    document.getElementById("cooldownKm").value=cd;

    const recoveryKm=
      document.getElementById("recoveryType").value==="distance"
        ? ((repeats-1)*Number(document.getElementById("recoveryValue").value))/1000
        : 0;

    const total=wu+(repeats*meters/1000)+recoveryKm+cd;
    document.getElementById("distanceKm").value=Math.round(total*10)/10;
    document.getElementById("rpe").value=repeats*meters>=5000 ? "8/10" : "7/10";
  }else if(easyKm){
    const km=Number(easyKm[1]);
    document.getElementById("name").value=
      /herstel/.test(text) ? `Herstelloop ${km} km` : `Duurloop ${km} km`;
    document.getElementById("distanceKm").value=km;
    document.getElementById("warmupKm").value=km;
    document.getElementById("repeats").value=1;
    document.getElementById("workMeters").value=100;
    document.getElementById("cooldownKm").value=0;
    document.getElementById("rpe").value=/herstel/.test(text) ? "2/10" : "3/10";

    if(paceRange){
      document.getElementById("warmupPace").value=`${paceRange[1]}-${paceRange[2]}/km`;
    }else if(paceSingle){
      document.getElementById("warmupPace").value=`${paceSingle[1]}/km`;
    }
  }else{
    status.className="status error";
    status.textContent="Ik herken nog geen intervalafstand of aantal kilometers.";
    return;
  }

  updateRecoveryLabel();
  updatePreview();

  status.className="status ok";
  status.textContent="Training herkend en automatisch ingevuld. Controleer de velden en tik op Opslaan.";
}

function buildWorkout(){
  const type=document.getElementById("workoutType").value || "Run";
  const name=safe(document.getElementById("name").value).trim();
  const notes=safe(document.getElementById("notes").value).trim();
  const durationMinutes=Number(document.getElementById("durationMinutes").value || 0);

  if(type!=="Run"){
    const steps=document.getElementById("activitySteps").value
      .split(/\n+/)
      .map(step=>safe(step).trim())
      .filter(Boolean);

    const description=safe(document.getElementById("activityDescription").value).trim();
    const info=trainingTypeInfo(type);

    return{
      name,
      uploadName:`Jaco - ${name}`,
      date:document.getElementById("date").value,
      type,
      distanceKm:0,
      durationMinutes,
      rpe:document.getElementById("rpe").value,
      status:"planned",
      editorData:{
        durationMinutes,
        activitySteps:document.getElementById("activitySteps").value,
        activityDescription:document.getElementById("activityDescription").value,
        notes
      },
      displaySteps:steps.length?steps:[
        type==="Rest"?"Volledige rustdag":`${durationMinutes} minuten ${info.label.toLowerCase()}`
      ],
      intervalsDescription:[
        description,
        steps.length ? steps.map(step=>`- ${step}`).join("\n") : "",
        notes
      ].filter(Boolean).join("\n\n")
    };
  }

  const recoveryType=document.getElementById("recoveryType").value;
  const recoveryValue=Number(document.getElementById("recoveryValue").value);
  const warmupKm=Number(document.getElementById("warmupKm").value || 0);
  const cooldownKm=Number(document.getElementById("cooldownKm").value || 0);
  const repeats=Number(document.getElementById("repeats").value);
  const workMeters=Number(document.getElementById("workMeters").value);
  const target=safe(document.getElementById("targetPace").value).trim() || "Z1";
  const displaySteps=[];
  const lines=[];

  if(notes) lines.push(notes,"");

  if(warmupKm>0){
    const warmupPace=safe(document.getElementById("warmupPace").value).trim() || "Z1";
    displaySteps.push(`${warmupKm} km rustig inlopen`);
    lines.push("Warmup",`- ${warmupKm}km ${warmupPace} Pace`,"");
  }

  displaySteps.push(
    `${repeats} × ${workMeters} m @ ${target}, ${
      recoveryType==="time" ? `${recoveryValue} min herstel` : `${recoveryValue} m herstel`
    }`
  );

  lines.push(`Main set ${repeats}x`);
  lines.push(`- ${workMeters}mtr ${target} Pace`);
  lines.push(
    recoveryType==="time" ? `- ${recoveryValue}m Z1 Pace` : `- ${recoveryValue}mtr Z1 Pace`,
    ""
  );

  if(cooldownKm>0){
    displaySteps.push(`${cooldownKm} km rustig uitlopen`);
    lines.push("Cooldown",`- ${cooldownKm}km Z1 Pace`);
  }

  return{
    name,
    uploadName:`Jaco - ${name}`,
    date:document.getElementById("date").value,
    type:"Run",
    distanceKm:Number(document.getElementById("distanceKm").value),
    durationMinutes,
    rpe:document.getElementById("rpe").value,
    status:"planned",
    editorData:{
      durationMinutes,
      warmupKm,
      warmupPace:document.getElementById("warmupPace").value,
      repeats,
      workMeters,
      targetPace:document.getElementById("targetPace").value,
      recoveryType,
      recoveryValue,
      cooldownKm,
      notes
    },
    displaySteps,
    intervalsDescription:lines.join("\n")
  };
}

function fillEditor(workout,originalDate){
  const editor=workout.editorData || inferEditorData(workout);

  document.getElementById("originalDate").value=originalDate || "";
  document.getElementById("date").value=workout.date;
  document.getElementById("name").value=workout.name || "";
  document.getElementById("workoutType").value=workout.type || "Run";
  document.getElementById("durationMinutes").value=workout.durationMinutes ?? editor.durationMinutes ?? 60;
  document.getElementById("activitySteps").value=editor.activitySteps || (workout.type!=="Run" ? (workout.displaySteps||[]).join("\n") : "");
  document.getElementById("activityDescription").value=editor.activityDescription || (workout.type!=="Run" ? workout.intervalsDescription||"" : "");
  document.getElementById("distanceKm").value=workout.distanceKm ?? "";
  document.getElementById("rpe").value=workout.rpe || "8/10";
  document.getElementById("warmupKm").value=editor.warmupKm ?? 3;
  document.getElementById("warmupPace").value=editor.warmupPace || "5:00-5:30/km";
  document.getElementById("repeats").value=editor.repeats ?? 5;
  document.getElementById("workMeters").value=editor.workMeters ?? 1000;
  document.getElementById("targetPace").value=editor.targetPace || "3:28-3:30/km";
  document.getElementById("recoveryType").value=editor.recoveryType || "time";
  document.getElementById("recoveryValue").value=editor.recoveryValue ?? 2;
  document.getElementById("cooldownKm").value=editor.cooldownKm ?? 2;
  document.getElementById("notes").value=editor.notes || "";

  document.getElementById("editorLabel").textContent="Training bewerken";
  document.getElementById("editorTitle").textContent=workout.name;
  document.getElementById("saveButton").textContent="Wijzigingen opslaan";
  document.getElementById("cancelEdit").hidden=false;
  document.getElementById("formStatus").textContent="";
  updateRecoveryLabel();
  updateWorkoutTypeFields();
  updatePreview();
}

function inferEditorData(workout){
  return{
    warmupKm:3,
    warmupPace:"5:00-5:30/km",
    repeats:5,
    workMeters:1000,
    targetPace:"3:28-3:30/km",
    recoveryType:"time",
    recoveryValue:2,
    cooldownKm:2,
    notes:""
  };
}

function editWorkout(date){
  const workout=customWorkouts[date];
  if(!workout) return;
  fillEditor(workout,date);
  switchView("editor");
}

function copyServerWorkout(date){
  const workout=serverWorkouts[date];
  if(!workout) return;

  const copy=clone(workout);
  copy.date=date;
  copy.uploadName=copy.uploadName || `Jaco - ${copy.name}`;
  copy.intervalsDescription=copy.intervalsDescription || "";
  copy.editorData=inferEditorData(copy);

  customWorkouts[date]=copy;
  saveObject(STORAGE_KEY,customWorkouts);

  selectedDate=date;
  renderMonth();
  renderSelected();
  editWorkout(date);
}

function updatePreview(){
  try{
    const workout=buildWorkout();
    const info=trainingTypeInfo(workout.type);
    const steps=(workout.displaySteps||[]).map(step=>`- ${step}`).join("\n");
    document.getElementById("preview").textContent=
      `${info.icon} ${info.label}\n${workout.name || "Naam ontbreekt"}\n${trainingVolumeLabel(workout)} · RPE ${workout.rpe}\n\n${steps || workout.intervalsDescription || "Vul de training in."}`;
  }catch{
    document.getElementById("preview").textContent="Vul de training in.";
  }
}

function updateRecoveryLabel(){
  const isTime=document.getElementById("recoveryType").value==="time";
  document.getElementById("recoveryValueLabel").firstChild.textContent=
    isTime ? "Herstel (minuten)" : "Herstel (meter)";
  document.getElementById("recoveryValue").step=isTime ? "0.5" : "50";
}

function saveWorkout(event){
  event.preventDefault();

  const workout=buildWorkout();
  const originalDate=document.getElementById("originalDate").value;

  if(!workout.date || !workout.name){
    document.getElementById("formStatus").className="status error";
    document.getElementById("formStatus").textContent="Datum en naam zijn verplicht.";
    return;
  }

  if(originalDate && originalDate!==workout.date){
    delete customWorkouts[originalDate];
    delete doneWorkouts[originalDate];
    delete uploadedWorkouts[originalDate];
  }

  customWorkouts[workout.date]=workout;
  saveObject(STORAGE_KEY,customWorkouts);
  saveObject(DONE_KEY,doneWorkouts);
  saveObject(UPLOAD_KEY,uploadedWorkouts);

  selectedDate=workout.date;
  const dateObj=new Date(workout.date+"T12:00:00");
  visibleMonth=new Date(dateObj.getFullYear(),dateObj.getMonth(),1);

  document.getElementById("originalDate").value=workout.date;
  document.getElementById("formStatus").className="status ok";
  document.getElementById("formStatus").textContent=
    originalDate && originalDate!==workout.date
      ? "Training gewijzigd en naar de nieuwe datum verplaatst."
      : "Training opgeslagen.";

  document.getElementById("editorLabel").textContent="Training bewerken";
  document.getElementById("editorTitle").textContent=workout.name;
  document.getElementById("saveButton").textContent="Wijzigingen opslaan";
  document.getElementById("cancelEdit").hidden=false;

  renderMonth();
  renderSelected();
  renderSaved();
}

function openDuplicate(date){
  duplicateSourceDate=date;
  const workout=allWorkouts()[date];
  if(!workout) return;

  const source=new Date(date+"T12:00:00");
  source.setDate(source.getDate()+7);

  document.getElementById("duplicateTitle").textContent=`Kopie van ${workout.name}`;
  document.getElementById("duplicateDate").value=ymd(source);
  document.getElementById("duplicateStatus").textContent="";
  document.getElementById("duplicateModal").classList.add("open");
}

function closeDuplicate(){
  duplicateSourceDate=null;
  document.getElementById("duplicateModal").classList.remove("open");
}

function duplicateWorkout(){
  const newDate=document.getElementById("duplicateDate").value;
  const source=allWorkouts()[duplicateSourceDate];
  const status=document.getElementById("duplicateStatus");

  if(!source || !newDate){
    status.className="status error";
    status.textContent="Kies een geldige datum.";
    return;
  }

  if(allWorkouts()[newDate]){
    status.className="status error";
    status.textContent="Op deze datum staat al een training.";
    return;
  }

  const copy=clone(source);
  copy.date=newDate;
  copy.status="planned";
  copy.uploadName=copy.uploadName || `Jaco - ${copy.name}`;
  copy.editorData=copy.editorData || inferEditorData(copy);

  customWorkouts[newDate]=copy;
  saveObject(STORAGE_KEY,customWorkouts);

  selectedDate=newDate;
  const dateObj=new Date(newDate+"T12:00:00");
  visibleMonth=new Date(dateObj.getFullYear(),dateObj.getMonth(),1);

  closeDuplicate();
  switchView("calendar");
  renderMonth();
  renderSelected();
}

function deleteWorkout(date){
  if(!customWorkouts[date]) return;
  if(!confirm(`Training "${customWorkouts[date].name}" verwijderen?`)) return;

  delete customWorkouts[date];
  delete doneWorkouts[date];
  delete uploadedWorkouts[date];

  saveObject(STORAGE_KEY,customWorkouts);
  saveObject(DONE_KEY,doneWorkouts);
  saveObject(UPLOAD_KEY,uploadedWorkouts);

  renderMonth();
  renderSelected();
  renderSaved();
}

function renderSaved(){
  const list=document.getElementById("savedList");
  const entries=Object.entries(customWorkouts).sort(([a],[b])=>a.localeCompare(b));

  if(!entries.length){
    list.innerHTML=`<p class="help">Je hebt nog geen eigen trainingen opgeslagen.</p>`;
    return;
  }

  list.innerHTML=entries.map(([date,workout])=>`
    <div class="saved-row">
      <div class="saved-row-top">
        <div>
          <strong>${safe(workout.name)}</strong>
          <small>
            ${fullDate.format(new Date(date+"T12:00:00"))}
            · ${trainingVolumeLabel(workout)}
            · ${trainingTypeInfo(workout.type).label}
            · RPE ${safe(workout.rpe)}
            ${uploadedWorkouts[date] ? " · In Intervals ✓" : ""}
          </small>
        </div>
      </div>

      <div class="mini-actions">
        <button class="secondary" type="button" onclick="openSaved('${date}')">Open</button>
        <button class="secondary" type="button" onclick="editWorkout('${date}');switchView('editor')">Bewerk</button>
        <button class="secondary" type="button" onclick="openDuplicate('${date}')">Dupliceer</button>
        <button class="danger" type="button" onclick="deleteWorkout('${date}')">Verwijder</button>
      </div>
    </div>
  `).join("");
}

function openSaved(date){
  selectedDate=date;
  const dateObj=new Date(date+"T12:00:00");
  visibleMonth=new Date(dateObj.getFullYear(),dateObj.getMonth(),1);
  switchView("calendar");
  renderMonth();
  renderSelected();
}


function raceId(){
  return `race-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}

function formatRaceDistance(distance){
  const d=Number(distance);
  if(Math.abs(d-21.0975)<0.01) return "Halve marathon";
  if(Math.abs(d-42.195)<0.01) return "Marathon";
  return `${d} km`;
}

function parseTimeToSeconds(value){
  const parts=String(value||"").trim().split(":").map(Number);
  if(parts.some(Number.isNaN)) return null;
  if(parts.length===2) return parts[0]*60+parts[1];
  if(parts.length===3) return parts[0]*3600+parts[1]*60+parts[2];
  return null;
}

function racePaceSeconds(race){
  const total=parseTimeToSeconds(race.targetTime);
  return total ? total/Number(race.distanceKm) : null;
}

function formatPace(seconds){
  if(!seconds || !Number.isFinite(seconds)) return null;
  const s=Math.round(seconds);
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
}

function daysUntil(date){
  const now=new Date();
  now.setHours(0,0,0,0);
  const target=new Date(date+"T00:00:00");
  return Math.ceil((target-now)/86400000);
}

function selectedRaceDistance(){
  const value=document.getElementById("raceDistance").value;
  return value==="other"
    ? Number(document.getElementById("customRaceDistance").value)
    : Number(value);
}

function resetRaceForm(){
  document.getElementById("raceForm").reset();
  document.getElementById("raceOriginalId").value="";
  document.getElementById("raceDistance").value="5";
  document.getElementById("customRaceDistanceLabel").hidden=true;
  document.getElementById("racePriority").value="A";
  document.getElementById("raceFormStatus").textContent="";
}

function saveRace(event){
  event.preventDefault();

  const existingId=document.getElementById("raceOriginalId").value;
  const id=existingId || raceId();
  const name=safe(document.getElementById("raceName").value).trim();
  const date=document.getElementById("raceDate").value;
  const distanceKm=selectedRaceDistance();

  if(!name || !date || !distanceKm){
    document.getElementById("raceFormStatus").className="status error";
    document.getElementById("raceFormStatus").textContent="Naam, datum en afstand zijn verplicht.";
    return;
  }

  races[id]={
    id,
    name,
    date,
    distanceKm,
    targetTime:safe(document.getElementById("raceTargetTime").value).trim(),
    priority:document.getElementById("racePriority").value,
    notes:safe(document.getElementById("raceNotes").value).trim()
  };

  saveObject(RACES_KEY,races);
  document.getElementById("raceFormStatus").className="status ok";
  document.getElementById("raceFormStatus").textContent=
    existingId ? "Wedstrijd bijgewerkt." : "Wedstrijd toegevoegd aan de kalender.";

  renderRaces();
  renderRaceOptions();
  renderMonth();
  renderSelected();
}

function editRace(id){
  const race=races[id];
  if(!race) return;

  document.getElementById("raceOriginalId").value=id;
  document.getElementById("raceName").value=race.name;
  document.getElementById("raceDate").value=race.date;

  const standard=["5","10","21.0975","42.195"];
  const distanceString=String(race.distanceKm);
  if(standard.includes(distanceString)){
    document.getElementById("raceDistance").value=distanceString;
    document.getElementById("customRaceDistanceLabel").hidden=true;
  }else{
    document.getElementById("raceDistance").value="other";
    document.getElementById("customRaceDistance").value=race.distanceKm;
    document.getElementById("customRaceDistanceLabel").hidden=false;
  }

  document.getElementById("raceTargetTime").value=race.targetTime || "";
  document.getElementById("racePriority").value=race.priority || "A";
  document.getElementById("raceNotes").value=race.notes || "";
  switchView("races");
  window.scrollTo({top:0,behavior:"smooth"});
}

function deleteRace(id){
  const race=races[id];
  if(!race) return;
  if(!confirm(`Wedstrijd "${race.name}" verwijderen?`)) return;

  delete races[id];
  saveObject(RACES_KEY,races);
  renderRaces();
  renderRaceOptions();
  renderMonth();
  renderSelected();
}

function openRace(id){
  const race=races[id];
  if(!race) return;
  selectedDate=race.date;
  const d=new Date(race.date+"T12:00:00");
  visibleMonth=new Date(d.getFullYear(),d.getMonth(),1);
  switchView("calendar");
  renderMonth();
  renderSelected();
}

function renderRaces(){
  const list=document.getElementById("raceList");
  if(!list) return;

  const entries=Object.values(races).sort((a,b)=>a.date.localeCompare(b.date));
  if(!entries.length){
    list.innerHTML='<p class="help">Je hebt nog geen wedstrijden toegevoegd.</p>';
    return;
  }

  list.innerHTML=entries.map(race=>{
    const remaining=daysUntil(race.date);
    return `
      <div class="race-card ${String(race.priority).toLowerCase()}">
        <div class="race-top">
          <div>
            <strong>${safe(race.name)}</strong>
            <small>
              ${fullDate.format(new Date(race.date+"T12:00:00"))}
              · ${formatRaceDistance(race.distanceKm)}
              · ${safe(race.priority)}-wedstrijd
            </small>
          </div>
          <div class="race-time">${safe(race.targetTime || "—")}</div>
        </div>
        <p class="countdown">
          ${remaining>=0 ? `Nog ${remaining} dagen` : `${Math.abs(remaining)} dagen geleden`}
        </p>
        ${race.notes ? `<p class="help">${safe(race.notes)}</p>` : ""}
        <div class="mini-actions">
          <button class="secondary" onclick="openRace('${race.id}')">Open</button>
          <button class="secondary" onclick="editRace('${race.id}')">Bewerk</button>
          <button class="danger" onclick="deleteRace('${race.id}')">Verwijder</button>
        </div>
      </div>`;
  }).join("");
}

function renderRaceOptions(){
  const select=document.getElementById("planRaceSelect");
  if(!select) return;
  const future=Object.values(races)
    .filter(r=>daysUntil(r.date)>=0)
    .sort((a,b)=>a.date.localeCompare(b.date));

  select.innerHTML=future.length
    ? future.map(r=>`<option value="${r.id}">${safe(r.name)} — ${r.date}</option>`).join("")
    : '<option value="">Voeg eerst een wedstrijd toe</option>';
}

function addDays(dateString,days){
  const d=new Date(dateString+"T12:00:00");
  d.setDate(d.getDate()+days);
  return ymd(d);
}

function mondayOf(dateString){
  const d=new Date(dateString+"T12:00:00");
  const day=(d.getDay()+6)%7;
  d.setDate(d.getDate()-day);
  return ymd(d);
}

function makeWorkout(date,name,distanceKm,rpe,displaySteps,description){
  return{
    name,
    uploadName:`Jaco - ${name}`,
    date,
    type:"Run",
    distanceKm:Math.round(distanceKm*10)/10,
    rpe,
    status:"planned",
    displaySteps,
    intervalsDescription:description
  };
}

function createQualityWorkout(date,race,weekIndex,weeksTotal){
  const distance=Number(race.distanceKm);
  const pace=racePaceSeconds(race);

  if(distance<=5){
    if(weekIndex%2===0){
      const target=pace ? `${formatPace(pace-8)}-${formatPace(pace-3)}/km` : "3:13-3:18/km";
      return makeWorkout(
        date,"12 × 400 m",12.2,"8/10",
        ["3 km inlopen","12 × 400 m op 5 km-tempo of iets sneller","200 m dribbel","2 km uitlopen"],
        `5 km-specifieke snelheidstraining.

Warmup
- 3km Z1 Pace

Main set 12x
- 400mtr ${target} Pace
- 200mtr Z1 Pace

Cooldown
- 2km Z1 Pace`
      );
    }
    const target=pace ? `${formatPace(pace-3)}-${formatPace(pace+1)}/km` : "3:28-3:30/km";
    return makeWorkout(
      date,"5 × 1000 m VO₂max",12,"8/10",
      ["3 km inlopen","5 × 1000 m op 5 km-tempo","2 min dribbel","2 km uitlopen"],
      `5 km-specifieke VO2max-training.

Warmup
- 3km Z1 Pace

Main set 5x
- 1km ${target} Pace
- 2m Z1 Pace

Cooldown
- 2km Z1 Pace`
    );
  }

  if(distance<=10){
    const target=pace ? `${formatPace(pace+5)}-${formatPace(pace+10)}/km` : "3:42-3:48/km";
    return makeWorkout(
      date,"3 × 2 km drempel",13,"7/10",
      ["3 km inlopen","3 × 2 km rond drempeltempo","2 min dribbel","2 km uitlopen"],
      `10 km-specifieke drempeltraining.

Warmup
- 3km Z1 Pace

Main set 3x
- 2km ${target} Pace
- 2m Z1 Pace

Cooldown
- 2km Z1 Pace`
    );
  }

  if(distance<30){
    const target=pace ? `${formatPace(pace)}-${formatPace(pace+5)}/km` : "3:48-3:52/km";
    return makeWorkout(
      date,"3 × 3 km halve-marathontempo",15,"7/10",
      ["3 km inlopen","3 × 3 km op halve-marathontempo","3 min dribbel","2 km uitlopen"],
      `Halve-marathonspecifieke training.

Warmup
- 3km Z1 Pace

Main set 3x
- 3km ${target} Pace
- 3m Z1 Pace

Cooldown
- 2km Z1 Pace`
    );
  }

  const target=pace ? `${formatPace(pace)}-${formatPace(pace+5)}/km` : "4:15-4:20/km";
  return makeWorkout(
    date,"2 × 5 km marathontempo",18,"7/10",
    ["4 km inlopen","2 × 5 km op marathontempo","1 km rustig tussenin","3 km uitlopen"],
    `Marathonspecifieke training.

Warmup
- 4km Z1 Pace

Main set 2x
- 5km ${target} Pace
- 1km Z1 Pace

Cooldown
- 3km Z1 Pace`
  );
}

function createEasyWorkout(date,km,recovery=false){
  const pace=recovery ? "5:10-5:35/km" : "5:00-5:25/km";
  const name=recovery ? `Herstelloop ${km} km` : `Rustige duurloop ${km} km`;
  return makeWorkout(
    date,name,km,recovery?"2/10":"3/10",
    [`${km} km rustig lopen`,recovery?"Zeer lage inspanning":"Zone 2 aanhouden"],
    `${recovery?"Hersteltraining":"Rustige duurloop"}.

Easy
- ${km}km ${pace} Pace`
  );
}

function createLongRun(date,km,race){
  const distance=Number(race.distanceKm);
  let note="Volledig rustig lopen";
  let description=`Lange rustige duurloop.

Easy
- ${km}km 4:55-5:20/km Pace`;

  if(distance>=21 && km>=16){
    note="Laatste 3 km beheerst versnellen indien fris";
    description=`Lange duurloop met gecontroleerde finish.

Easy
- ${Math.max(1,km-3)}km 4:55-5:20/km Pace

Progression
- 3km 4:05-4:20/km Pace`;
  }

  return makeWorkout(
    date,`Lange duurloop ${km} km`,km,"4/10",
    [`${km} km totale duur`,note],
    description
  );
}

function generateRacePlan(){
  const raceIdValue=document.getElementById("planRaceSelect").value;
  const race=races[raceIdValue];
  const status=document.getElementById("planStatus");

  if(!race){
    status.className="status error";
    status.textContent="Voeg eerst een wedstrijd toe.";
    return;
  }

  const start=document.getElementById("planStartDate").value || ymd(today);
  const weeklyKm=Number(document.getElementById("planWeeklyKm").value);
  const days=Number(document.getElementById("planDays").value);
  const overwrite=document.getElementById("overwritePlan").checked;
  const raceDate=new Date(race.date+"T12:00:00");
  const startDate=new Date(start+"T12:00:00");
  const totalDays=Math.floor((raceDate-startDate)/86400000);

  if(totalDays<7){
    status.className="status error";
    status.textContent="De wedstrijd is minder dan één week verwijderd.";
    return;
  }

  const weeks=Math.max(1,Math.ceil(totalDays/7));
  let created=0;
  const firstMonday=mondayOf(start);

  for(let week=0;week<weeks;week++){
    const weekStart=addDays(firstMonday,week*7);
    const daysToRace=Math.floor((raceDate-new Date(weekStart+"T12:00:00"))/86400000);
    if(daysToRace<0) break;

    const taperFactor=daysToRace<=7 ? 0.55 : daysToRace<=14 ? 0.75 : 1;
    const km=Math.round(weeklyKm*taperFactor);
    const longKm=Math.max(8,Math.round(km*(Number(race.distanceKm)>=21 ? 0.30 : 0.24)));
    const easyKm=Math.max(6,Math.round((km-longKm-12)/Math.max(1,days-2)));

    const schedule=[];
    if(days===3){
      schedule.push([1,"quality"],[3,"easy"],[5,"long"]);
    }else if(days===4){
      schedule.push([1,"quality"],[3,"easy"],[5,"long"],[6,"recovery"]);
    }else if(days===5){
      schedule.push([0,"easy"],[1,"quality"],[3,"easy"],[5,"long"],[6,"recovery"]);
    }else{
      schedule.push([0,"easy"],[1,"quality"],[2,"recovery"],[3,"easy"],[5,"long"],[6,"recovery"]);
    }

    for(const [offset,type] of schedule){
      const date=addDays(weekStart,offset);
      if(date>=race.date) continue;
      if(customWorkouts[date] && !overwrite) continue;

      let workout;
      if(type==="quality") workout=createQualityWorkout(date,race,week,weeks);
      if(type==="easy") workout=createEasyWorkout(date,easyKm,false);
      if(type==="recovery") workout=createEasyWorkout(date,Math.max(6,easyKm-2),true);
      if(type==="long") workout=createLongRun(date,longKm,race);

      customWorkouts[date]=workout;
      created++;
    }
  }

  // Race day marker is already provided by races.
  saveObject(STORAGE_KEY,customWorkouts);

  selectedDate=race.date;
  visibleMonth=new Date(raceDate.getFullYear(),raceDate.getMonth(),1);

  renderRaces();
  renderMonth();
  renderSelected();
  renderSaved();

  status.className="status ok";
  status.textContent=`Schema aangemaakt: ${created} trainingen richting ${race.name}.`;
}


function numberOrNull(value){
  const n=Number(value);
  return Number.isFinite(n) ? n : null;
}

function latestValue(records,key){
  for(let i=records.length-1;i>=0;i--){
    const value=numberOrNull(records[i]?.[key]);
    if(value!==null) return value;
  }
  return null;
}

function averageRecent(records,key,count=7){
  const values=[];
  for(let i=records.length-1;i>=0 && values.length<count;i--){
    const value=numberOrNull(records[i]?.[key]);
    if(value!==null) values.push(value);
  }
  if(!values.length) return null;
  return values.reduce((a,b)=>a+b,0)/values.length;
}


function wellnessRecordDate(record){
  const raw=record?.id || record?.date || null;
  if(!raw) return null;
  const value=String(raw).slice(0,10);
  const parsed=new Date(value+"T12:00:00");
  return Number.isNaN(parsed.getTime()) ? null : value;
}

function wellnessDaysOld(dateString){
  if(!dateString) return null;
  const measurement=new Date(dateString+"T12:00:00");
  if(Number.isNaN(measurement.getTime())) return null;

  const today=new Date();
  today.setHours(12,0,0,0);

  return Math.floor((today-measurement)/86400000);
}

function latestMetric(records,key,maxAgeDays=1){
  for(let i=records.length-1;i>=0;i--){
    const value=numberOrNull(records[i]?.[key]);
    if(value===null) continue;

    const date=wellnessRecordDate(records[i]);
    const ageDays=wellnessDaysOld(date);
    const fresh=ageDays!==null && ageDays>=0 && ageDays<=maxAgeDays;

    return{key,value,date,ageDays,fresh,maxAgeDays};
  }

  return{
    key,
    value:null,
    date:null,
    ageDays:null,
    fresh:false,
    maxAgeDays
  };
}

function averageBeforeDate(records,key,dateString,count=7){
  const values=[];

  for(let i=records.length-1;i>=0 && values.length<count;i--){
    const date=wellnessRecordDate(records[i]);
    if(dateString && date && date>=dateString) continue;

    const value=numberOrNull(records[i]?.[key]);
    if(value!==null) values.push(value);
  }

  if(!values.length) return null;
  return values.reduce((sum,value)=>sum+value,0)/values.length;
}

function sourceFreshnessText(source,label){
  if(!source || source.value===null){
    return{
      cls:"source-missing",
      text:`${label}: geen data beschikbaar`
    };
  }

  if(source.fresh){
    return{
      cls:"source-fresh",
      text:`${label}: actueel · ${source.date}`
    };
  }

  const age=source.ageDays===null
    ? "datum onbekend"
    : `${source.ageDays} d oud`;

  return{
    cls:"source-stale",
    text:`${label}: niet actueel · laatste ${source.date || "onbekend"} (${age})`
  };
}

function weightedAvailableScore(items){
  const valid=items.filter(item=>
    item &&
    item.value!==null &&
    item.value!==undefined &&
    Number.isFinite(Number(item.value)) &&
    Number(item.weight)>0
  );

  if(!valid.length) return null;

  const weight=valid.reduce((sum,item)=>sum+Number(item.weight),0);
  const total=valid.reduce(
    (sum,item)=>sum+Number(item.value)*Number(item.weight),
    0
  );

  return clampScore(total/weight);
}

function formatMetric(value,digits=0){
  return value===null || value===undefined ? "—" : Number(value).toFixed(digits);
}

function formatSleep(seconds){
  const value=numberOrNull(seconds);
  if(value===null) return "—";
  const hours=Math.floor(value/3600);
  const minutes=Math.round((value%3600)/60);
  return `${hours}u ${String(minutes).padStart(2,"0")}`;
}

function trendLabel(latest,average,unit=""){
  if(latest===null || average===null) return "Geen trend beschikbaar";
  const difference=latest-average;
  const sign=difference>0?"+":"";
  return `${sign}${difference.toFixed(1)}${unit} t.o.v. 7-daags gemiddelde`;
}

function buildCoachAdvice(latest,averages){
  const ctl=numberOrNull(latest?.ctl);
  const atl=numberOrNull(latest?.atl);
  const form=ctl!==null && atl!==null ? ctl-atl : null;
  const hrv=numberOrNull(latest?.hrv);
  const resting=numberOrNull(latest?.restingHR);
  const readiness=numberOrNull(latest?.readiness);
  const sleep=numberOrNull(latest?.sleepSecs);

  const warnings=[];
  const positives=[];

  if(form!==null){
    if(form<-20) warnings.push("je vormscore wijst op hoge opgebouwde vermoeidheid");
    else if(form<-10) warnings.push("je vermoeidheid is duidelijk hoger dan je fitness");
    else if(form>5) positives.push("je vormscore is positief");
  }

  if(hrv!==null && averages.hrv!==null && hrv<averages.hrv*0.90){
    warnings.push("je HRV ligt meer dan 10% onder je recente gemiddelde");
  }else if(hrv!==null && averages.hrv!==null && hrv>averages.hrv*1.05){
    positives.push("je HRV ligt boven je recente gemiddelde");
  }

  if(resting!==null && averages.restingHR!==null && resting>averages.restingHR+5){
    warnings.push("je rusthartslag is duidelijk verhoogd");
  }

  if(sleep!==null && sleep<6.5*3600){
    warnings.push("je slaapduur was kort");
  }

  if(readiness!==null){
    if(readiness<50) warnings.push("je readiness is laag");
    else if(readiness>=75) positives.push("je readiness is goed");
  }

  if(warnings.length>=2){
    return{
      headline:"Vandaag liever herstellen",
      advice:`Ik zie meerdere signalen: ${warnings.join(", ")}. Kies een rustige zone 1–2-training of rust en verplaats intensieve intervallen.`
    };
  }

  if(warnings.length===1){
    return{
      headline:"Train gecontroleerd",
      advice:`Let op: ${warnings[0]}. Houd de eerste blokken bewust beheerst en stop als de inspanning onverwacht hoog voelt.`
    };
  }

  if(positives.length){
    return{
      headline:"Goede dag voor kwaliteit",
      advice:`Positieve signalen: ${positives.join(", ")}. Je kunt de geplande training uitvoeren, maar blijf binnen de afgesproken tempo’s.`
    };
  }

  return{
    headline:"Train volgens plan",
    advice:"De beschikbare wellnessdata geeft geen duidelijke reden om je training aan te passen. Gebruik je eigen gevoel als laatste controle."
  };
}


function renderWellnessDashboard(data){
  const records=Array.isArray(data.records)?data.records:[];
  latestWellnessRecords=records;
  const latest=data.latest || records[records.length-1] || {};

  // Trainingsbelasting mag iets ouder zijn dan herstelmetingen.
  const ctlSource=latestMetric(records,"ctl",2);
  const atlSource=latestMetric(records,"atl",2);

  // Herstelmetingen moeten van vandaag of maximaal gisteren zijn.
  const hrvSource=latestMetric(records,"hrv",1);
  const restingSource=latestMetric(records,"restingHR",1);
  const sleepSource=latestMetric(records,"sleepSecs",1);
  const sleepScoreSource=latestMetric(records,"sleepScore",1);
  const readinessSource=latestMetric(records,"readiness",1);

  const ctl=ctlSource.fresh?ctlSource.value:null;
  const atl=atlSource.fresh?atlSource.value:null;
  const form=ctl!==null && atl!==null ? ctl-atl : null;
  const hrv=hrvSource.fresh?hrvSource.value:null;
  const restingHR=restingSource.fresh?restingSource.value:null;
  const sleepSecs=sleepSource.fresh?sleepSource.value:null;
  const sleepScore=sleepScoreSource.fresh?sleepScoreSource.value:null;
  const readinessValue=readinessSource.fresh?readinessSource.value:null;

  const averages={
    hrv:hrvSource.date
      ? averageBeforeDate(records,"hrv",hrvSource.date,7)
      : null,
    restingHR:restingSource.date
      ? averageBeforeDate(records,"restingHR",restingSource.date,7)
      : null,
    sleepSecs:sleepSource.date
      ? averageBeforeDate(records,"sleepSecs",sleepSource.date,7)
      : null
  };

  const hrvDelta=
    hrv!==null && averages.hrv!==null ? hrv-averages.hrv : null;
  const rhrDelta=
    restingHR!==null && averages.restingHR!==null
      ? restingHR-averages.restingHR
      : null;

  const freshRecoverySignals=[
    hrvSource,
    restingSource,
    sleepSource,
    readinessSource
  ].filter(source=>source.fresh).length;

  const requiredRecoverySignals=2;
  const dataSufficient=freshRecoverySignals>=requiredRecoverySignals;

  document.getElementById("metricCtl").textContent=formatMetric(ctl,1);
  document.getElementById("metricAtl").textContent=formatMetric(atl,1);
  document.getElementById("metricForm").textContent=formatMetric(form,1);
  document.getElementById("metricHrv").textContent=
    hrv===null?"—":`${formatMetric(hrv,0)} ms`;
  document.getElementById("metricRestingHr").textContent=
    restingHR===null?"—":`${formatMetric(restingHR,0)} bpm`;
  document.getElementById("metricSleep").textContent=formatSleep(sleepSecs);
  document.getElementById("sleepScore").textContent=
    sleepScore===null
      ?"Geen actuele slaapscore"
      :`Slaapscore ${formatMetric(sleepScore,0)}`;

  const formEl=document.getElementById("metricForm");
  formEl.className="";
  if(form!==null){
    if(form<-10){
      formEl.classList.add("form-negative");
      document.getElementById("formLabel").textContent="Vermoeid";
    }else if(form>5){
      formEl.classList.add("form-positive");
      document.getElementById("formLabel").textContent="Fris";
    }else{
      formEl.classList.add("form-neutral");
      document.getElementById("formLabel").textContent="Neutraal";
    }
  }else{
    document.getElementById("formLabel").textContent="Geen actuele data";
  }

  document.getElementById("hrvTrend").textContent=
    hrv===null
      ?"Geen actuele HRV"
      :trendLabel(hrv,averages.hrv," ms");

  document.getElementById("restingHrTrend").textContent=
    restingHR===null
      ?"Geen actuele rusthartslag"
      :trendLabel(restingHR,averages.restingHR," bpm");

  latestWellnessSnapshot={
    dataIntegrityVersion:"7.4.1",
    ctl,
    atl,
    form,
    hrv,
    restingHR,
    sleepSecs,
    sleepHours:sleepSecs===null?null:sleepSecs/3600,
    readinessValue,
    hrvDelta,
    rhrDelta,
    averages,
    freshRecoverySignals,
    requiredRecoverySignals,
    dataSufficient,
    sources:{
      ctl:ctlSource,
      atl:atlSource,
      hrv:hrvSource,
      restingHR:restingSource,
      sleep:sleepSource,
      sleepScore:sleepScoreSource,
      readiness:readinessSource
    }
  };

  const advice=dataSufficient
    ? buildCoachAdvice(
        {
          ctl,
          atl,
          hrv,
          restingHR,
          sleepSecs,
          readiness:readinessValue
        },
        averages
      )
    : {
        headline:"Onvoldoende actuele hersteldata",
        advice:`Slechts ${freshRecoverySignals} van minimaal ${requiredRecoverySignals} actuele herstelsignalen beschikbaar. Er wordt geen hersteladvies berekend.`
      };

  document.getElementById("coachHeadline").textContent=advice.headline;
  document.getElementById("coachAdvice").textContent=advice.advice;

  renderTodayCoach();

  document.getElementById("dashboardUpdated").textContent=
    `Intervals.icu gecontroleerd t/m ${latest.id || latest.date || "onbekende datum"}.`;

  renderPerformanceEngine();
  renderPerformanceTrend(activeTrendDays);

  const history=records.slice(-7).reverse();
  document.getElementById("wellnessHistory").innerHTML=history.length
    ? history.map(record=>{
        const recordCtl=numberOrNull(record.ctl);
        const recordAtl=numberOrNull(record.atl);
        const recordForm=
          recordCtl!==null && recordAtl!==null
            ? recordCtl-recordAtl
            : null;

        return `
          <div class="wellness-row">
            <div>
              <strong>${record.id || record.date || "Datum onbekend"}</strong>
              <small>HRV ${record.hrv ?? "—"} · RHR ${record.restingHR ?? "—"} · slaap ${formatSleep(record.sleepSecs)}</small>
            </div>
            <div>
              <strong>${formatMetric(recordForm,1)}</strong>
              <small>vorm</small>
            </div>
          </div>`;
      }).join("")
    : '<p class="help">Nog geen historie beschikbaar.</p>';

  document.getElementById("wellnessStatus").className="status ok";
  document.getElementById("wellnessStatus").textContent=
    dataSufficient
      ? "Actuele hersteldata geladen."
      : "Data geladen, maar onvoldoende actuele herstelmetingen voor een coachscore.";
}

async function loadWellnessDashboard(){
  const error=document.getElementById("dashboardError");
  error.textContent="";
  document.getElementById("dashboardUpdated").textContent="Intervals.icu-data wordt geladen…";

  try{
    const response=await fetch("/api/intervals-status");
    const data=await response.json();
    if(!response.ok) throw new Error(data.error || "Dashboarddata kon niet worden geladen.");
    renderWellnessDashboard(data);
  }catch(err){
    error.textContent=err.message;
    document.getElementById("dashboardUpdated").textContent="Data niet beschikbaar.";
  }
}



const DAY_NAMES=["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"];
const DAY_KEYS=["mon","tue","wed","thu","fri","sat","sun"];

function defaultAvailability(){
  return{
    mon:{available:false,maxMinutes:0,daypart:"avond",preference:"rust",priority:"could"},
    tue:{available:true,maxMinutes:75,daypart:"avond",preference:"kwaliteit",priority:"must"},
    wed:{available:true,maxMinutes:50,daypart:"ochtend",preference:"rustig",priority:"should"},
    thu:{available:false,maxMinutes:0,daypart:"avond",preference:"rust",priority:"could"},
    fri:{available:true,maxMinutes:70,daypart:"avond",preference:"kwaliteit",priority:"must"},
    sat:{available:true,maxMinutes:150,daypart:"ochtend",preference:"lange-duur",priority:"must"},
    sun:{available:true,maxMinutes:60,daypart:"ochtend",preference:"herstel",priority:"should"}
  };
}

function availabilityPreferenceOptions(selected){
  const options=[
    ["rust","Rust"],
    ["kwaliteit","Interval / kwaliteit"],
    ["rustig","Rustige duurloop"],
    ["drempel","Tempo / drempel"],
    ["lange-duur","Lange duurloop"],
    ["herstel","Herstel"],
    ["core","Core"],
    ["mobiliteit","Mobiliteit"]
  ];
  return options.map(([value,label])=>
    `<option value="${value}" ${selected===value?"selected":""}>${label}</option>`
  ).join("");
}

function priorityOptions(selected){
  return[
    ["must","Must"],
    ["should","Should"],
    ["could","Could"]
  ].map(([value,label])=>
    `<option value="${value}" ${selected===value?"selected":""}>${label}</option>`
  ).join("");
}

function renderAvailabilityEditor(){
  const p=getProfile();
  const availability={...defaultAvailability(),...(p.availability||{})};
  const editor=document.getElementById("availabilityEditor");
  if(!editor) return;

  editor.innerHTML=DAY_KEYS.map((key,index)=>{
    const day=availability[key] || defaultAvailability()[key];
    return `
      <div class="availability-row">
        <div class="availability-day">${DAY_NAMES[index]}</div>

        <label>Beschikbaar
          <input id="avail-${key}" type="checkbox" ${day.available?"checked":""}
            onchange="toggleAvailabilityRow('${key}')">
        </label>

        <label>Max. minuten
          <input id="minutes-${key}" type="number" min="0" max="300" step="5"
            value="${day.maxMinutes||0}" ${day.available?"":"disabled"}>
        </label>

        <label>Voorkeur
          <select id="preference-${key}" ${day.available?"":"disabled"}>
            ${availabilityPreferenceOptions(day.preference)}
          </select>
        </label>

        <label>Prioriteit
          <select id="priority-${key}" ${day.available?"":"disabled"}>
            ${priorityOptions(day.priority)}
          </select>
        </label>

        <label>Moment
          <select id="daypart-${key}" ${day.available?"":"disabled"}>
            <option value="ochtend" ${day.daypart==="ochtend"?"selected":""}>Ochtend</option>
            <option value="middag" ${day.daypart==="middag"?"selected":""}>Middag</option>
            <option value="avond" ${day.daypart==="avond"?"selected":""}>Avond</option>
            <option value="flexibel" ${day.daypart==="flexibel"?"selected":""}>Flexibel</option>
          </select>
        </label>
      </div>`;
  }).join("");
}

function toggleAvailabilityRow(key){
  const available=document.getElementById(`avail-${key}`).checked;
  ["minutes","preference","priority","daypart"].forEach(prefix=>{
    document.getElementById(`${prefix}-${key}`).disabled=!available;
  });

  if(!available){
    document.getElementById(`minutes-${key}`).value=0;
  }else if(Number(document.getElementById(`minutes-${key}`).value)===0){
    document.getElementById(`minutes-${key}`).value=60;
  }
}

function readAvailabilityForm(){
  return Object.fromEntries(DAY_KEYS.map(key=>[
    key,{
      available:document.getElementById(`avail-${key}`).checked,
      maxMinutes:Number(document.getElementById(`minutes-${key}`).value||0),
      preference:document.getElementById(`preference-${key}`).value,
      priority:document.getElementById(`priority-${key}`).value,
      daypart:document.getElementById(`daypart-${key}`).value
    }
  ]));
}

function availableDaysForPlanner(){
  const p=getProfile();
  const availability={...defaultAvailability(),...(p.availability||{})};

  return DAY_KEYS.map((key,index)=>({
    key,
    index,
    ...availability[key]
  })).filter(day=>day.available);
}

function workoutDurationEstimate(type,km){
  if(type==="core" || type==="mobiliteit") return Math.max(10,Math.round(km));
  if(type==="quality") return Math.round(km*5+15);
  if(type==="long") return Math.round(km*5);
  return Math.round(km*5.2);
}

function fitWorkoutToDay(workout,day){
  const maxMinutes=Number(day.maxMinutes||0);
  if(!maxMinutes) return workout;

  const estimated=workoutDurationEstimate(workout.planType||"easy",workout.distanceKm);
  if(estimated<=maxMinutes) return workout;

  const factor=Math.max(0.55,maxMinutes/estimated);
  const copy=JSON.parse(JSON.stringify(workout));

  if(copy.planType==="quality"){
    const reducedKm=Math.max(7,Math.round(copy.distanceKm*factor));
    copy.distanceKm=reducedKm;
    copy.name=`Verkorte ${copy.name}`;
    copy.displaySteps=[
      `Training ingekort tot maximaal ${maxMinutes} minuten`,
      ...copy.displaySteps.slice(0,2)
    ];
  }else if(copy.planType==="long"){
    copy.distanceKm=Math.max(10,Math.round(copy.distanceKm*factor));
    copy.name=`Lange duurloop ${copy.distanceKm} km`;
    copy.displaySteps=[`${copy.distanceKm} km rustig lopen`];
    copy.intervalsDescription=`Lange rustige duurloop.

Easy
- ${copy.distanceKm}km 4:55-5:20/km Pace`;
  }else{
    copy.distanceKm=Math.max(5,Math.round(copy.distanceKm*factor));
    copy.name=copy.planType==="recovery"
      ? `Herstelloop ${copy.distanceKm} km`
      : `Rustige duurloop ${copy.distanceKm} km`;
    copy.displaySteps=[`${copy.distanceKm} km rustig lopen`];
    copy.intervalsDescription=`Rustige training.

Easy
- ${copy.distanceKm}km 5:00-5:30/km Pace`;
  }

  return copy;
}

function makeCoreWorkout(date,minutes=15,priority="could"){
  return{
    date,
    type:"Core",
    distanceKm:0,
    durationMinutes:minutes,
    name:`Core ${minutes} minuten`,
    uploadName:`Jaco - Core ${minutes} minuten`,
    rpe:"4/10",
    status:"planned",
    priority,
    planType:"core",
    displaySteps:[
      "3 × 40 sec plank",
      "3 × 10 dead bug per zijde",
      "3 × 10 bird dog per zijde",
      "3 × 30 sec side plank per zijde",
      "3 × 12 glute bridge"
    ],
    intervalsDescription:`Coretraining ${minutes} minuten.

- Plank
- Dead bug
- Bird dog
- Side plank
- Glute bridge`
  };
}

function scheduleByAvailability(workouts){
  const days=availableDaysForPlanner();
  if(!days.length) return [];

  const start=nextMonday();
  const used=new Set();
  const scheduled=[];

  const preferredLong=Number(getProfile().longRunDay ?? 5);
  const longDay=days.find(d=>d.index===preferredLong)
    || days.find(d=>d.preference==="lange-duur")
    || days[days.length-1];

  const qualityDays=days
    .filter(d=>["kwaliteit","drempel"].includes(d.preference))
    .sort((a,b)=>
      (a.priority==="must"?0:a.priority==="should"?1:2) -
      (b.priority==="must"?0:b.priority==="should"?1:2)
    );

  const recoveryDays=days.filter(d=>d.preference==="herstel");
  const easyDays=days.filter(d=>["rustig","core","mobiliteit"].includes(d.preference));

  const pickDay=(type)=>{
    if(type==="long" && longDay && !used.has(longDay.index)) return longDay;
    if(type==="quality"){
      const q=qualityDays.find(d=>!used.has(d.index));
      if(q) return q;
    }
    if(type==="recovery"){
      const r=recoveryDays.find(d=>!used.has(d.index));
      if(r) return r;
    }
    return easyDays.find(d=>!used.has(d.index))
      || days.find(d=>!used.has(d.index))
      || null;
  };

  for(const workout of workouts){
    const day=pickDay(workout.planType||"easy");
    if(!day) continue;

    used.add(day.index);
    const date=addDays(start,day.index);
    const fitted=fitWorkoutToDay({...workout,date},day);

    fitted.date=date;
    fitted.priority=day.priority;
    fitted.preferredDaypart=day.daypart;
    fitted.displaySteps=[
      ...fitted.displaySteps,
      `Voorkeursmoment: ${day.daypart}`,
      `Prioriteit: ${day.priority.toUpperCase()}`
    ];

    scheduled.push(fitted);
  }

  const p=getProfile();
  if(p.autoCore){
    const coreDay=days.find(d=>
      !used.has(d.index) && ["core","mobiliteit","rustig"].includes(d.preference)
    );

    if(coreDay){
      const minutes=Math.min(20,Math.max(10,coreDay.maxMinutes||15));
      scheduled.push(makeCoreWorkout(
        addDays(start,coreDay.index),
        minutes,
        coreDay.priority
      ));
    }
  }

  return scheduled.sort((a,b)=>a.date.localeCompare(b.date));
}




const TRAINING_LIBRARY={
  recovery_run:{
    type:"Run",
    name:"Herstelloop",
    phase:["general","build","specific","taper","race-week"],
    readiness:["low","moderate","good"],
    preference:["herstel","rustig"],
    minMinutes:30,
    maxMinutes:60,
    rpe:"2/10"
  },
  easy_run:{
    type:"Run",
    name:"Rustige duurloop",
    phase:["general","build","specific","taper"],
    readiness:["moderate","good"],
    preference:["rustig","herstel"],
    minMinutes:40,
    maxMinutes:90,
    rpe:"3/10"
  },
  threshold_run:{
    type:"Run",
    name:"Drempeltraining",
    phase:["build","specific"],
    readiness:["good","moderate"],
    preference:["kwaliteit","drempel"],
    minMinutes:55,
    maxMinutes:90,
    rpe:"7/10"
  },
  vo2_run:{
    type:"Run",
    name:"VO₂max-training",
    phase:["build","specific"],
    readiness:["good"],
    preference:["kwaliteit"],
    minMinutes:55,
    maxMinutes:85,
    rpe:"8/10"
  },
  race_sharpening:{
    type:"Run",
    name:"Wedstrijdprikkel",
    phase:["taper","race-week"],
    readiness:["moderate","good"],
    preference:["kwaliteit","drempel"],
    minMinutes:35,
    maxMinutes:60,
    rpe:"5/10"
  },
  long_run:{
    type:"Run",
    name:"Lange duurloop",
    phase:["general","build","specific"],
    readiness:["moderate","good"],
    preference:["lange-duur"],
    minMinutes:75,
    maxMinutes:180,
    rpe:"4/10"
  },
  core:{
    type:"Core",
    name:"Core",
    phase:["general","build","specific","taper","race-week"],
    readiness:["low","moderate","good"],
    preference:["core"],
    minMinutes:10,
    maxMinutes:30,
    rpe:"4/10"
  },
  mobility:{
    type:"Mobility",
    name:"Mobiliteit",
    phase:["general","build","specific","taper","race-week"],
    readiness:["low","moderate","good"],
    preference:["mobiliteit","rust"],
    minMinutes:10,
    maxMinutes:30,
    rpe:"2/10"
  },
  rest:{
    type:"Rest",
    name:"Rustdag",
    phase:["general","build","specific","taper","race-week"],
    readiness:["low","moderate","good"],
    preference:["rust"],
    minMinutes:0,
    maxMinutes:0,
    rpe:"1/10"
  }
};

function coachContext(){
  const snapshot=getWellnessSnapshot();
  const readiness=determineReadiness(snapshot);
  const race=getRaceFocus();
  const phase=classifyRacePhase(race);
  const availability=todayAvailabilityInfo();
  const existing=currentTodayWorkout();

  return{snapshot,readiness,race,phase,availability,existing};
}

function scoreLibraryItem(item,context){
  let score=0;
  const reasons=[];

  if(item.phase.includes(context.phase.phase)){
    score+=30;
    reasons.push(`past bij fase ${phaseLabel(context.phase.phase).toLowerCase()}`);
  }else{
    score-=25;
  }

  if(context.readiness.level==="unknown"){
    reasons.push("hersteldata onvoldoende; herstel niet meegewogen");
  }else if(item.readiness.includes(context.readiness.level)){
    score+=25;
    reasons.push(`past bij herstelstatus ${context.readiness.level}`);
  }else{
    score-=35;
  }

  if(item.preference.includes(context.availability.preference)){
    score+=30;
    reasons.push(`sluit aan op jouw dagvoorkeur`);
  }

  const minutes=Number(context.availability.maxMinutes||0);
  if(minutes>=item.minMinutes && minutes<=item.maxMinutes){
    score+=20;
    reasons.push(`past binnen ${minutes} beschikbare minuten`);
  }else if(minutes>=item.minMinutes){
    score+=10;
  }else{
    score-=25;
  }

  if(!context.availability.available && item.type!=="Rest" && item.type!=="Mobility"){
    score-=100;
  }

  const itemKey=Object.keys(TRAINING_LIBRARY).find(
    key=>TRAINING_LIBRARY[key]===item
  );

  if(context.readiness.level==="low" &&
    ["vo2_run","threshold_run","long_run"].includes(itemKey)
  ){
    score-=70;
  }

  if(context.readiness.level==="unknown" &&
    ["vo2_run","threshold_run"].includes(itemKey)
  ){
    score-=45;
  }

  if(context.existing && item.type===context.existing.type){
    score+=5;
  }

  return{score,reasons};
}

function chooseCoachBrainSession(){
  const context=coachContext();

  const ranked=Object.entries(TRAINING_LIBRARY).map(([key,item])=>{
    const scored=scoreLibraryItem(item,context);
    return{key,item,...scored};
  }).sort((a,b)=>b.score-a.score);

  return{context,choice:ranked[0],alternatives:ranked.slice(1,4)};
}

function buildLibraryWorkout(decision){
  const {context,choice}=decision;
  const date=todayDateString();
  const minutes=Math.max(0,Number(context.availability.maxMinutes||0));
  const p=getProfile();
  const race=context.race;

  switch(choice.key){
    case "recovery_run":{
      const km=Math.max(5,Math.min(9,Math.round((minutes||45)/5.5)));
      return makeWeekWorkout(
        date,"recovery",km,`Herstelloop ${km} km`,
        [`${km} km zeer rustig`,`Hartslag onder ${p.z2Hr} bpm`,`Geen versnellingen`],
        `Hersteltraining.

Recovery
- ${km}km 5:10-5:35/km Pace`,
        "2/10"
      );
    }
    case "easy_run":{
      const km=Math.max(7,Math.min(14,Math.round((minutes||60)/5.2)));
      return makeWeekWorkout(
        date,"easy",km,`Rustige duurloop ${km} km`,
        [`${km} km zone 2`,`Hartslag bij voorkeur onder ${p.z2Hr} bpm`],
        `Rustige duurloop.

Easy
- ${km}km 5:00-5:25/km Pace`,
        "3/10"
      );
    }
    case "threshold_run":{
      const distance=Number(race?.distanceKm||10);
      const reps=distance>=21?3:4;
      const block=distance>=21?2000:1600;
      const pace=targetPacesForRace(race,p).threshold;
      return makeWeekWorkout(
        date,"quality",13,`${reps} × ${block} m drempel`,
        ["3 km inlopen",`${reps} × ${block} m @ ${pace}`,"2 min dribbel","2 km uitlopen"],
        `Drempeltraining.

Warmup
- 3km Z1 Pace

Main set ${reps}x
- ${block}mtr ${pace} Pace
- 2m Z1 Pace

Cooldown
- 2km Z1 Pace`,
        "7/10"
      );
    }
    case "vo2_run":{
      const pace=targetPacesForRace(race,p).vo2;
      return makeWeekWorkout(
        date,"quality",12,"5 × 1000 m VO₂max",
        ["3 km inlopen",`5 × 1000 m @ ${pace}`,"2 min dribbel","2 km uitlopen"],
        `VO2max-training.

Warmup
- 3km Z1 Pace

Main set 5x
- 1km ${pace} Pace
- 2m Z1 Pace

Cooldown
- 2km Z1 Pace`,
        "8/10"
      );
    }
    case "race_sharpening":{
      return makeWeekWorkout(
        date,"quality",7,"Wedstrijdprikkel",
        ["2 km inlopen","6 × 200 m ontspannen snel","200 m dribbel","2 km uitlopen"],
        `Wedstrijdprikkel.

Warmup
- 2km Z1 Pace

Main set 6x
- 200mtr 3:10-3:20/km Pace
- 200mtr Z1 Pace

Cooldown
- 2km Z1 Pace`,
        "5/10"
      );
    }
    case "long_run":{
      const km=Math.max(14,Math.min(28,Math.round((minutes||100)/5.2)));
      return makeWeekWorkout(
        date,"long",km,`Lange duurloop ${km} km`,
        [`${km} km rustig`,`Hartslag onder ${p.z2Hr} bpm`],
        `Lange duurloop.

Easy
- ${km}km 4:55-5:20/km Pace`,
        "4/10"
      );
    }
    case "core":
      return makeCoreWorkout(date,Math.min(minutes||20,25),context.availability.priority||"could");
    case "mobility":
      return{
        date,type:"Mobility",distanceKm:0,durationMinutes:Math.min(minutes||15,25),
        name:"Mobiliteit en herstel",uploadName:"Jaco - Mobiliteit en herstel",
        rpe:"2/10",status:"planned",priority:context.availability.priority||"could",
        planType:"mobility",
        displaySteps:["Heupmobiliteit","Enkelmobiliteit","Hamstrings en bilspieren","Rugrotaties","Rustige ademhaling"],
        intervalsDescription:"Mobiliteit en herstel."
      };
    default:
      return{
        date,type:"Rest",distanceKm:0,durationMinutes:0,
        name:"Rustdag",uploadName:"Jaco - Rustdag",rpe:"1/10",
        status:"planned",priority:"could",planType:"rest",
        displaySteps:["Geen verplichte training","Focus op slaap en herstel"],
        intervalsDescription:"Rustdag."
      };
  }
}

function renderCoachBrain(){
  const decision=chooseCoachBrainSession();
  const workout=buildLibraryWorkout(decision);
  const context=decision.context;
  const choice=decision.choice;

  pendingTodayAdvice={
    kind:context.existing?"replace":"new",
    workout,
    title:workout.name,
    text:`De Coach Brain koos ${choice.item.name.toLowerCase()} met een matchscore van ${choice.score}.`,
    steps:workout.displaySteps||[]
  };

  document.getElementById("brainDecisionTitle").textContent=workout.name;
  document.getElementById("brainDecisionText").textContent=
    `${choice.reasons.join(", ")}. ${context.race?`Focuswedstrijd: ${context.race.name}.`:"Geen komende wedstrijd ingesteld."}`;

  const factorRows=[
    {
      cls:context.readiness.level==="unknown"
        ?"warn"
        :context.readiness.level==="good"
          ?"good"
          :context.readiness.level==="moderate"
            ?"warn"
            :"bad",
      icon:context.readiness.level==="unknown"
        ?"?"
        :context.readiness.level==="good"
          ?"✓"
          :context.readiness.level==="moderate"
            ?"!"
            :"×",
      text:context.readiness.level==="unknown"
        ?"Herstelstatus: onbekend · onvoldoende actuele data"
        :`Herstelstatus: ${context.readiness.level} (${context.readiness.score}/100)`
    },
    {
      cls:context.availability.available?"good":"warn",
      icon:context.availability.available?"✓":"—",
      text:context.availability.available
        ? `${context.availability.maxMinutes} minuten beschikbaar · voorkeur ${preferenceLabel(context.availability.preference)}`
        : "Vandaag niet beschikbaar"
    },
    {
      cls:"good",
      icon:"🏁",
      text:context.race
        ? `${context.race.name} over ${context.phase.days} dagen · ${phaseLabel(context.phase.phase)}`
        : "Geen toekomstige wedstrijd ingesteld"
    }
  ];

  document.getElementById("brainFactors").innerHTML=factorRows.map(row=>`
    <div class="reason-item">
      <div class="reason-icon ${row.cls}">${row.icon}</div>
      <div>${safe(row.text)}</div>
    </div>`).join("");

  renderTodayCoach();
}


function horizonWeekPhase(raceDays,weekOffset){
  const daysAtWeek=raceDays-weekOffset*7;
  if(daysAtWeek<=7) return "Wedstrijdweek";
  if(daysAtWeek<=14) return "Taper";
  if(daysAtWeek<=35) return "Wedstrijdspecifiek";
  return "Opbouw";
}

function horizonQualityFocus(race,phase){
  const distance=Number(race?.distanceKm||5);

  if(phase==="Wedstrijdweek") return "Korte wedstrijdprikkel, verder fris worden";
  if(phase==="Taper") return "Minder volume, intensiteit kort behouden";

  if(distance<=5){
    return phase==="Wedstrijdspecifiek"
      ? "5 km-tempo, VO₂max en korte snelheid"
      : "Aerobe opbouw en drempel";
  }

  if(distance<=10){
    return phase==="Wedstrijdspecifiek"
      ? "Drempel en 10 km-tempo"
      : "Aerobe opbouw en gecontroleerde kwaliteit";
  }

  if(distance<30){
    return phase==="Wedstrijdspecifiek"
      ? "Halve-marathontempo en lange tempoblokken"
      : "Drempel, duurvermogen en lange duur";
  }

  return phase==="Wedstrijdspecifiek"
    ? "Marathontempo, voeding en lange duur"
    : "Aerobe omvang en belastbaarheid";
}

function buildCoachHorizon(){
  const box=document.getElementById("coachHorizon");
  if(!box) return;

  const race=getRaceFocus();
  const profileData=getProfile();
  const readiness=determineReadiness(getWellnessSnapshot());

  if(!race){
    box.innerHTML='<p class="help">Voeg eerst een toekomstige wedstrijd toe.</p>';
    return;
  }

  const raceDays=daysUntil(race.date);
  const baseKm=Math.min(Number(profileData.maxKm)||70,Number(profileData.weeklyKm)||60);
  const readinessFactor=readiness.level==="low"?0.78:readiness.level==="moderate"?0.90:1;

  const weeks=[0,1,2,3].map(offset=>{
    const phase=horizonWeekPhase(raceDays,offset);
    let phaseFactor=1;

    if(phase==="Taper") phaseFactor=0.75;
    if(phase==="Wedstrijdweek") phaseFactor=0.50;

    const km=Math.max(20,Math.round(baseKm*readinessFactor*phaseFactor));
    const start=addDays(nextMonday(),offset*7);
    const end=addDays(start,6);

    return{
      offset,
      start,
      end,
      phase,
      km,
      focus:horizonQualityFocus(race,phase)
    };
  });

  box.innerHTML=weeks.map((week,index)=>`
    <div class="adaptive-row">
      <div>
        <strong>Week ${index+1}</strong>
        <small>${new Intl.DateTimeFormat("nl-NL",{day:"numeric",month:"short"}).format(new Date(week.start+"T12:00:00"))}
        – ${new Intl.DateTimeFormat("nl-NL",{day:"numeric",month:"short"}).format(new Date(week.end+"T12:00:00"))}</small>
      </div>
      <div>
        <strong>${week.phase}</strong>
        <small>${safe(week.focus)}</small>
      </div>
      <span class="adaptive-tag ${week.phase==="Wedstrijdweek"?"red":week.phase==="Taper"?"orange":"green"}">
        ± ${week.km} km
      </span>
    </div>
  `).join("");
}







let activeTrendDays=7;

function trendNumber(value){
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}

function trendAverage(values){
  const valid=values.filter(value=>value!==null && Number.isFinite(value));
  if(!valid.length) return null;
  return valid.reduce((sum,value)=>sum+value,0)/valid.length;
}


function recordPerformanceScore(record,index,records){
  const ctl=trendNumber(record.ctl);
  const atl=trendNumber(record.atl);
  const hrv=trendNumber(record.hrv);
  const restingHR=trendNumber(record.restingHR);
  const sleepSecs=trendNumber(record.sleepSecs);
  const readinessValue=trendNumber(record.readiness);

  const previous=records.slice(Math.max(0,index-7),index);
  const avgHrv=trendAverage(
    previous.map(item=>trendNumber(item.hrv))
  );
  const avgRhr=trendAverage(
    previous.map(item=>trendNumber(item.restingHR))
  );

  const fitness=
    ctl===null
      ? null
      : clampScore(35+(ctl/70)*55);

  let fatigue=null;

  if(ctl!==null && ctl>0 && atl!==null){
    const ratio=atl/ctl;
    if(ratio<.65) fatigue=74;
    else if(ratio<=1.05) fatigue=92;
    else if(ratio<=1.25) fatigue=78;
    else if(ratio<=1.45) fatigue=58;
    else fatigue=35;
  }

  const form=
    ctl!==null && atl!==null
      ? ctl-atl
      : null;

  const recoverySignals=[
    hrv,
    restingHR,
    sleepSecs,
    readinessValue
  ].filter(value=>value!==null).length;

  let recovery=null;

  if(recoverySignals>=2){
    let value=70;

    if(form!==null){
      if(form<-20) value-=30;
      else if(form<-10) value-=15;
      else if(form>5) value+=10;
    }

    if(hrv!==null && avgHrv!==null){
      const diff=hrv-avgHrv;
      if(diff<=-6) value-=20;
      else if(diff>=4) value+=8;
    }

    if(restingHR!==null && avgRhr!==null){
      const diff=restingHR-avgRhr;
      if(diff>=5) value-=20;
      else if(diff<=-3) value+=5;
    }

    if(sleepSecs!==null){
      const hours=sleepSecs/3600;
      if(hours<6.5) value-=15;
      else if(hours>=7.5) value+=5;
    }

    if(readinessValue!==null){
      if(readinessValue<50) value-=15;
      else if(readinessValue>=75) value+=8;
    }

    recovery=clampScore(value);
  }

  const performance=weightedAvailableScore([
    {value:fitness,weight:.40},
    {value:fatigue,weight:.22},
    {value:recovery,weight:.38}
  ]);

  return{
    date:record.id||record.date||"",
    ctl,
    atl,
    form,
    recovery,
    recoverySignals,
    performance
  };
}

function trendDirection(values){
  const valid=values.filter(value=>value!==null && Number.isFinite(value));
  if(valid.length<2) return{delta:null,label:"Onvoldoende data",symbol:"—"};

  const split=Math.max(1,Math.floor(valid.length/2));
  const first=trendAverage(valid.slice(0,split));
  const second=trendAverage(valid.slice(split));
  const delta=second-first;

  if(delta>=3) return{delta,label:"Stijgend",symbol:"↗"};
  if(delta<=-3) return{delta,label:"Dalend",symbol:"↘"};
  return{delta,label:"Stabiel",symbol:"→"};
}

function selectedTrendRecords(days=activeTrendDays){
  const records=latestWellnessRecords.slice(-days);
  return records.map((record,index)=>recordPerformanceScore(record,index,records));
}

function renderTrendChart(points){
  const chart=document.getElementById("performanceTrendChart");
  const empty=document.getElementById("trendChartEmpty");
  const line=document.getElementById("performanceTrendLine");
  const dots=document.getElementById("performanceTrendDots");
  const grid=document.getElementById("performanceTrendGrid");

  if(!chart || !line || !dots || !grid) return;

  if(points.length<2){
    chart.hidden=true;
    empty.hidden=false;
    return;
  }

  chart.hidden=false;
  empty.hidden=true;

  const left=35;
  const right=680;
  const top=25;
  const bottom=205;
  const width=right-left;
  const height=bottom-top;

  const coordinates=points.map((point,index)=>{
    const x=left+(index/(points.length-1))*width;
    const y=bottom-(clampScore(point.performance)/100)*height;
    return{x,y,value:point.performance,date:point.date};
  });

  line.setAttribute(
    "points",
    coordinates.map(point=>`${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")
  );

  dots.innerHTML=coordinates.map((point,index)=>`
    <circle
      cx="${point.x.toFixed(1)}"
      cy="${point.y.toFixed(1)}"
      r="${index===coordinates.length-1?7:5}"
      class="trend-dot ${index===coordinates.length-1?"trend-dot-latest":""}">
      <title>${safe(point.date)} · ${point.value}/100</title>
    </circle>
  `).join("");

  grid.innerHTML=[25,50,75,100].map(value=>{
    const y=bottom-(value/100)*height;
    return`
      <line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="trend-grid-line"></line>
      <text x="2" y="${y+4}" fill="#7890a8" font-size="12">${value}</text>
    `;
  }).join("");
}


function renderPerformanceTrend(days=activeTrendDays){
  activeTrendDays=days;

  document.querySelectorAll(".trend-period").forEach(button=>{
    button.classList.toggle(
      "active",
      Number(button.dataset.trendDays)===days
    );
  });

  const points=selectedTrendRecords(days);
  const latest=points[points.length-1]||null;

  const performanceDirection=
    trendDirection(points.map(point=>point.performance));
  const fitnessDirection=
    trendDirection(points.map(point=>point.ctl));
  const recoveryDirection=
    trendDirection(points.map(point=>point.recovery));
  const formDirection=
    trendDirection(points.map(point=>point.form));

  const setMetric=(valueId,directionId,value,direction,suffix="")=>{
    document.getElementById(valueId).textContent=
      value===null || value===undefined
        ?"—"
        :`${Math.round(value)}${suffix}`;

    document.getElementById(directionId).textContent=
      `${direction.symbol} ${direction.label}${direction.delta===null?"":` (${direction.delta>=0?"+":""}${direction.delta.toFixed(1)})`}`;
  };

  setMetric(
    "trendPerformanceValue",
    "trendPerformanceDirection",
    latest?.performance??null,
    performanceDirection
  );

  setMetric(
    "trendFitnessValue",
    "trendFitnessDirection",
    latest?.ctl??null,
    fitnessDirection
  );

  setMetric(
    "trendRecoveryValue",
    "trendRecoveryDirection",
    latest?.recovery??null,
    recoveryDirection
  );

  setMetric(
    "trendFormValue",
    "trendFormDirection",
    latest?.form??null,
    formDirection
  );

  document.getElementById("trendChartRange").textContent=
    `Laatste ${days} dagen`;

  renderTrendChart(
    points.filter(point=>point.performance!==null)
  );

  const signals=[];

  if(performanceDirection.label==="Onvoldoende data"){
    signals.push({
      state:"warn",
      icon:"?",
      text:"Onvoldoende complete dagrecords om een betrouwbare performancetrend te bepalen."
    });
  }else{
    signals.push({
      state:performanceDirection.label==="Stijgend"
        ?"good"
        :performanceDirection.label==="Dalend"
          ?"warn"
          :"good",
      icon:performanceDirection.symbol,
      text:`Performance is ${performanceDirection.label.toLowerCase()} over de gekozen periode.`
    });
  }

  if(fitnessDirection.label==="Stijgend"){
    signals.push({
      state:"good",
      icon:"✓",
      text:"Je langetermijnfitness laat een positieve richting zien."
    });
  }else if(fitnessDirection.label==="Dalend"){
    signals.push({
      state:"warn",
      icon:"!",
      text:"Je fitnessbelasting daalt; controleer of dit herstel, taper of gemiste training is."
    });
  }

  if(recoveryDirection.label==="Dalend"){
    signals.push({
      state:"warn",
      icon:"!",
      text:"Herstel ontwikkelt zich neerwaarts; bewaak slaap en opeenvolgende zware trainingen."
    });
  }else if(recoveryDirection.label==="Stijgend"){
    signals.push({
      state:"good",
      icon:"✓",
      text:"Herstel ontwikkelt zich positief."
    });
  }else if(recoveryDirection.label==="Onvoldoende data"){
    signals.push({
      state:"warn",
      icon:"?",
      text:"Hersteltrend niet berekend: te weinig dagen met minimaal twee herstelsignalen."
    });
  }

  document.getElementById("performanceTrendSignals").innerHTML=
    signals.map(signal=>`
      <div class="reason-item">
        <div class="reason-icon ${signal.state}">${signal.icon}</div>
        <div>${safe(signal.text)}</div>
      </div>
    `).join("");

  let headline="Onvoldoende data voor trendconclusie";
  let conclusion=
    "De app wacht op voldoende complete wellnessdagen en vult ontbrekende hersteldata niet meer aan met neutrale standaardscores.";

  if(performanceDirection.label!=="Onvoldoende data"){
    headline="Trend is stabiel";
    conclusion=
      "Je recente ontwikkeling geeft geen sterke reden om de trainingskoers aan te passen.";

    if(
      performanceDirection.label==="Stijgend" &&
      recoveryDirection.label!=="Dalend" &&
      recoveryDirection.label!=="Onvoldoende data"
    ){
      headline="Je vorm beweegt de goede kant op";
      conclusion=
        "Fitness en herstel ondersteunen verdere opbouw. Houd de belasting gecontroleerd progressief.";
    }else if(
      performanceDirection.label==="Dalend" &&
      recoveryDirection.label==="Dalend"
    ){
      headline="Herstel eerst stabiliseren";
      conclusion=
        "Performance en herstel bewegen neerwaarts. Verminder tijdelijk intensiteit of omvang.";
    }else if(
      fitnessDirection.label==="Stijgend" &&
      recoveryDirection.label==="Dalend"
    ){
      headline="Fitness stijgt, maar herstel komt onder druk";
      conclusion=
        "De trainingsprikkel werkt, maar plan extra herstel om vermoeidheid niet te laten opstapelen.";
    }else if(
      fitnessDirection.label==="Dalend" &&
      recoveryDirection.label==="Stijgend"
    ){
      headline="Frisser, maar met minder trainingsprikkel";
      conclusion=
        "Dit kan passend zijn bij taper of herstel. Buiten die fases kan een gerichte kwaliteitsprikkel nodig zijn.";
    }
  }

  document.getElementById("performanceTrendHeadline").textContent=
    headline;

  document.getElementById("performanceTrendConclusion").textContent=
    conclusion;
}

function historicalWorkoutEntries(days){
  const cutoff=new Date();
  cutoff.setHours(0,0,0,0);
  cutoff.setDate(cutoff.getDate()-days+1);

  const end=new Date();
  end.setHours(23,59,59,999);

  return Object.entries({...serverWorkouts,...customWorkouts})
    .map(([date,workout])=>({date,workout,parsed:new Date(date+"T12:00:00")}))
    .filter(item=>
      item.workout &&
      item.parsed>=cutoff &&
      item.parsed<=end &&
      item.workout.type!=="Race" &&
      item.workout.type!=="Rest"
    );
}

function historySummary(days){
  const entries=historicalWorkoutEntries(days);
  const runEntries=entries.filter(item=>item.workout.type==="Run");
  const runKm=runEntries.reduce((sum,item)=>sum+(Number(item.workout.distanceKm)||0),0);

  const quality=runEntries.filter(item=>{
    const type=String(item.workout.planType||"").toLowerCase();
    const name=String(item.workout.name||"").toLowerCase();
    return["quality","threshold","vo2"].includes(type) ||
      /interval|vo₂|vo2|drempel|threshold|tempo|400|1000|2000/.test(name);
  });

  const longRuns=runEntries.filter(item=>{
    const type=String(item.workout.planType||"").toLowerCase();
    return type==="long" || Number(item.workout.distanceKm)>=16;
  });

  const support=entries.filter(item=>
    ["Core","Mobility","Strength"].includes(item.workout.type)
  );

  const easy=runEntries.filter(item=>!quality.includes(item) && !longRuns.includes(item));

  return{
    entries,
    sessions:entries.length,
    runSessions:runEntries.length,
    runKm:Math.round(runKm*10)/10,
    quality:quality.length,
    longRuns:longRuns.length,
    support:support.length,
    easy:easy.length
  };
}

function percentage(part,total){
  if(!total) return 0;
  return Math.round((part/total)*100);
}

function buildCoachIntelligence(){
  const seven=historySummary(7);
  const twentyEight=historySummary(28);
  const ninety=historySummary(90);

  const runTotal=Math.max(1,twentyEight.runSessions);
  const easyPct=percentage(twentyEight.easy,runTotal);
  const qualityPct=percentage(twentyEight.quality,runTotal);
  const supportPct=percentage(twentyEight.support,Math.max(1,twentyEight.sessions));

  const signals=[];

  if(twentyEight.quality===0){
    signals.push({state:"warn",icon:"!",text:"De afgelopen 28 dagen staat lokaal geen kwaliteitstraining geregistreerd."});
  }else if(qualityPct>35){
    signals.push({state:"warn",icon:"!",text:`${qualityPct}% van je looptrainingen was kwaliteit; bewaak voldoende rustige dagen.`});
  }else{
    signals.push({state:"good",icon:"✓",text:`${twentyEight.quality} kwaliteitstrainingen in 28 dagen geeft een bruikbare trainingsprikkel.`});
  }

  if(easyPct>=55){
    signals.push({state:"good",icon:"✓",text:`Rustige looptrainingen vormen ${easyPct}% van je loopfrequentie.`});
  }else{
    signals.push({state:"warn",icon:"!",text:`Rustige looptrainingen vormen slechts ${easyPct}% van je loopfrequentie.`});
  }

  if(twentyEight.longRuns>=3){
    signals.push({state:"good",icon:"✓",text:`${twentyEight.longRuns} lange duurlopen in 28 dagen ondersteunen je duurvermogen.`});
  }else{
    signals.push({state:"warn",icon:"!",text:`Slechts ${twentyEight.longRuns} lange duurlopen in 28 dagen geregistreerd.`});
  }

  if(twentyEight.support>=4){
    signals.push({state:"good",icon:"✓",text:`${twentyEight.support} core-, mobiliteits- of krachtsessies ondersteunen belastbaarheid.`});
  }else{
    signals.push({state:"warn",icon:"!",text:`${twentyEight.support} ondersteunende sessies in 28 dagen; regelmaat kan beter.`});
  }

  let headline="Trainingsbalans is bruikbaar";
  let conclusion="Behoud de huidige verhouding en laat zware sessies volgen door rustige belasting.";

  if(qualityPct>35 || easyPct<50){
    headline="Meer rustige training aanbevolen";
    conclusion="De lokale geschiedenis bevat relatief veel kwaliteit. Verhoog het aandeel rustige duur en herstel.";
  }else if(twentyEight.quality===0){
    headline="Kwaliteitsprikkel ontbreekt";
    conclusion="Wanneer je herstel het toelaat, plan één gerichte drempel- of VO₂max-training per week.";
  }else if(twentyEight.support<4){
    headline="Ondersteunende training kan consistenter";
    conclusion="Plan minimaal één core- en één mobiliteitssessie per week naast het lopen.";
  }else if(twentyEight.longRuns<3){
    headline="Lange duur verdient meer aandacht";
    conclusion="Richting langere wedstrijden is ongeveer één passende lange duurloop per week wenselijk.";
  }

  return{seven,twentyEight,ninety,easyPct,qualityPct,supportPct,signals,headline,conclusion};
}

function renderCoachIntelligence(){
  const result=buildCoachIntelligence();
  const setPeriod=(prefix,data)=>{
    document.getElementById(`${prefix}Sessions`).textContent=`${data.sessions} sessies`;
    document.getElementById(`${prefix}Volume`).textContent=`${data.runKm} km hardlopen`;
  };

  setPeriod("intel7",result.seven);
  setPeriod("intel28",result.twentyEight);
  setPeriod("intel90",result.ninety);

  document.getElementById("intelEasyBar").style.width=`${result.easyPct}%`;
  document.getElementById("intelQualityBar").style.width=`${result.qualityPct}%`;
  document.getElementById("intelSupportBar").style.width=`${result.supportPct}%`;

  document.getElementById("intelEasyText").textContent=`${result.twentyEight.easy} rustige looptrainingen · ${result.easyPct}%`;
  document.getElementById("intelQualityText").textContent=`${result.twentyEight.quality} kwaliteitstrainingen · ${result.qualityPct}%`;
  document.getElementById("intelSupportText").textContent=`${result.twentyEight.support} ondersteunende sessies · ${result.supportPct}%`;

  document.getElementById("coachIntelligenceSignals").innerHTML=
    result.signals.map(signal=>`
      <div class="reason-item">
        <div class="reason-icon ${signal.state}">${signal.icon}</div>
        <div>${safe(signal.text)}</div>
      </div>
    `).join("");

  document.getElementById("coachIntelligenceHeadline").textContent=result.headline;
  document.getElementById("coachIntelligenceConclusion").textContent=result.conclusion;
}

let aiWeekOptions=[];
let selectedAiWeekIndex=0;

function weekPlanningContext(){
  const profileData=getProfile();
  const availability=availableDaysForPlanner();
  const readiness=determineReadiness(getWellnessSnapshot());
  const race=getRaceFocus();
  const phase=classifyRacePhase(race);
  const start=nextMonday();

  return{
    profile:profileData,
    availability,
    readiness,
    race,
    phase,
    start
  };
}

function weeklyTargetKm(context,variant=0){
  const base=Math.min(
    Number(context.profile.maxKm)||70,
    Number(context.profile.weeklyKm)||60
  );

  let factor=1;
  if(context.readiness.level==="low") factor=.70;
  else if(context.readiness.level==="moderate") factor=.88;

  if(context.phase.phase==="taper") factor*=.78;
  if(context.phase.phase==="race-week") factor*=.52;

  if(variant===1) factor*=.92;
  if(variant===2) factor*=1.04;

  return Math.max(20,Math.round(base*factor));
}

function weekFocusLabel(context){
  if(!context.race) return "Algemene ontwikkeling";
  if(context.phase.phase==="race-week") return "Wedstrijdweek";
  if(context.phase.phase==="taper") return "Taper";
  const distance=Number(context.race.distanceKm||5);
  if(distance<=5) return "Snelheid en VO₂max";
  if(distance<=10) return "Drempel en 10 km-tempo";
  if(distance<30) return "Halve-marathontempo";
  return "Marathonuithouding";
}

function makeWeekQualitySession(context,date,variant=0){
  const paces=targetPacesForRace(context.race,context.profile);
  const distance=Number(context.race?.distanceKm||5);

  if(context.readiness.level==="low"){
    const workout=makeWeekWorkout(
      date,"recovery",8,"Herstelloop 8 km",
      ["8 km zeer rustig","Hartslag onder zone 2-bovengrens"],
      `Hersteltraining.

Recovery
- 8km 5:10-5:35/km Pace`,
      "2/10"
    );
    workout.planType="recovery";
    return workout;
  }

  if(context.phase.phase==="race-week"){
    const workout=makeWeekWorkout(
      date,"quality",7,"Wedstrijdprikkel",
      ["2 km inlopen","6 × 200 m ontspannen snel","200 m dribbel","2 km uitlopen"],
      `Wedstrijdprikkel.

Warmup
- 2km Z1 Pace

Main set 6x
- 200mtr 3:10-3:20/km Pace
- 200mtr Z1 Pace

Cooldown
- 2km Z1 Pace`,
      "5/10"
    );
    workout.planType="quality";
    return workout;
  }

  if(distance<=5){
    if(variant===1){
      const workout=makeWeekWorkout(
        date,"quality",11,"12 × 400 m snelheid",
        ["3 km inlopen",`12 × 400 m @ ${paces.vo2}`,"200 m dribbel","2 km uitlopen"],
        `Snelheidstraining.

Warmup
- 3km Z1 Pace

Main set 12x
- 400mtr ${paces.vo2} Pace
- 200mtr Z1 Pace

Cooldown
- 2km Z1 Pace`,
        "8/10"
      );
      workout.planType="quality";
      return workout;
    }

    const workout=makeWeekWorkout(
      date,"quality",12,"5 × 1000 m VO₂max",
      ["3 km inlopen",`5 × 1000 m @ ${paces.vo2}`,"2 min dribbel","2 km uitlopen"],
      `VO2max-training.

Warmup
- 3km Z1 Pace

Main set 5x
- 1km ${paces.vo2} Pace
- 2m Z1 Pace

Cooldown
- 2km Z1 Pace`,
      "8/10"
    );
    workout.planType="quality";
    return workout;
  }

  if(distance<=10){
    const reps=variant===1?3:4;
    const workout=makeWeekWorkout(
      date,"quality",variant===1?13:15,`${reps} × 2 km drempel`,
      ["3 km inlopen",`${reps} × 2 km @ ${paces.threshold}`,"2 min dribbel","2 km uitlopen"],
      `Drempeltraining.

Warmup
- 3km Z1 Pace

Main set ${reps}x
- 2km ${paces.threshold} Pace
- 2m Z1 Pace

Cooldown
- 2km Z1 Pace`,
      "7/10"
    );
    workout.planType="quality";
    return workout;
  }

  const reps=variant===1?2:3;
  const block=variant===1?4000:3000;
  const workout=makeWeekWorkout(
    date,"quality",variant===1?14:15,`${reps} × ${block/1000} km wedstrijdspecifiek`,
    ["3 km inlopen",`${reps} × ${block/1000} km @ ${paces.threshold}`,"3 min dribbel","2 km uitlopen"],
    `Wedstrijdspecifieke training.

Warmup
- 3km Z1 Pace

Main set ${reps}x
- ${block}mtr ${paces.threshold} Pace
- 3m Z1 Pace

Cooldown
- 2km Z1 Pace`,
    "7/10"
  );
  workout.planType="quality";
  return workout;
}

function makeWeekEasySession(date,km,recovery=false){
  const workout=makeWeekWorkout(
    date,
    recovery?"recovery":"easy",
    km,
    recovery?`Herstelloop ${km} km`:`Rustige duurloop ${km} km`,
    [
      `${km} km ${recovery?"zeer rustig":"zone 2"}`,
      recovery?"Geen versnellingen":"Hartslag gecontroleerd houden"
    ],
    `${recovery?"Hersteltraining":"Rustige duurloop"}.

Easy
- ${km}km ${recovery?"5:10-5:35/km":"5:00-5:25/km"} Pace`,
    recovery?"2/10":"3/10"
  );
  workout.planType=recovery?"recovery":"easy";
  return workout;
}

function makeWeekLongSession(context,date,km){
  const workout=makeWeekWorkout(
    date,"long",km,`Lange duurloop ${km} km`,
    [
      `${km} km rustig`,
      `Hartslag bij voorkeur onder ${context.profile.z2Hr} bpm`,
      Number(context.race?.distanceKm||0)>=21
        ?"Laatste 3 km beheerst versnellen indien fris"
        :"Volledig ontspannen houden"
    ],
    Number(context.race?.distanceKm||0)>=21 && km>=16
      ? `Lange duurloop met gecontroleerde finish.

Easy
- ${km-3}km 4:55-5:20/km Pace

Progression
- 3km 4:05-4:20/km Pace`
      : `Lange rustige duurloop.

Easy
- ${km}km 4:55-5:20/km Pace`,
    "4/10"
  );
  workout.planType="long";
  return workout;
}

function createUnscheduledAiWeek(context,variant=0){
  const targetKm=weeklyTargetKm(context,variant);
  const count=Math.min(
    Number(context.profile.days)||4,
    context.availability.length
  );

  if(count<=0){
    return{targetKm,workouts:[]};
  }

  const quality=makeWeekQualitySession(context,context.start,variant);
  const qualityKm=Number(quality.distanceKm)||0;

  let longRatio=Number(context.race?.distanceKm||5)>=21?.30:.24;
  if(context.phase.phase==="taper") longRatio=.22;
  if(context.phase.phase==="race-week") longRatio=.16;

  const longKm=Math.max(
    8,
    Math.round(targetKm*longRatio)
  );

  const remaining=Math.max(6,targetKm-qualityKm-(count>=3?longKm:0));
  const easyCount=Math.max(1,count-(count>=3?2:1));
  const easyKm=Math.max(6,Math.round(remaining/easyCount));

  const sessions=[quality];

  if(count>=3){
    sessions.push(makeWeekLongSession(context,context.start,longKm));
  }

  while(sessions.length<count){
    const isFinal=sessions.length===count-1;
    const recovery=isFinal || context.readiness.level!=="good";
    sessions.push(
      makeWeekEasySession(
        context.start,
        recovery?Math.max(6,easyKm-2):easyKm,
        recovery
      )
    );
  }

  return{targetKm,workouts:sessions};
}

function assignAiWeekToAvailability(context,unscheduled,variant=0){
  const scheduled=scheduleByAvailability(unscheduled.workouts);

  // Add core or mobility only if a free available day remains.
  const usedDates=new Set(scheduled.map(workout=>workout.date));
  const freeDay=context.availability.find(day=>{
    const date=addDays(context.start,day.index);
    return !usedDates.has(date) &&
      ["core","mobiliteit","rustig"].includes(day.preference);
  });

  if(freeDay && context.profile.autoCore){
    const date=addDays(context.start,freeDay.index);
    const extra=freeDay.preference==="mobiliteit"
      ? {
          date,type:"Mobility",distanceKm:0,
          durationMinutes:Math.min(freeDay.maxMinutes||15,20),
          name:"Mobiliteit en herstel",
          uploadName:"Jaco - Mobiliteit en herstel",
          rpe:"2/10",status:"planned",
          priority:freeDay.priority||"could",
          planType:"mobility",
          displaySteps:[
            "Heupmobiliteit",
            "Enkelmobiliteit",
            "Hamstrings en bilspieren",
            "Borstrotaties"
          ],
          intervalsDescription:"Mobiliteit en herstel."
        }
      : makeCoreWorkout(
          date,
          Math.min(freeDay.maxMinutes||15,20),
          freeDay.priority||"could"
        );

    scheduled.push(extra);
  }

  scheduled.sort((a,b)=>a.date.localeCompare(b.date));

  return{
    targetKm:unscheduled.targetKm,
    workouts:scheduled,
    variant
  };
}

function generateAiWeekOptions(){
  const context=weekPlanningContext();

  aiWeekOptions=[0,1,2].map(variant=>
    assignAiWeekToAvailability(
      context,
      createUnscheduledAiWeek(context,variant),
      variant
    )
  );

  selectedAiWeekIndex=0;
  renderAiWeekPlanner(context);
}

function renderAiWeekPlanner(context=weekPlanningContext()){
  const target=document.getElementById("aiWeekTargetKm");
  if(!target) return;

  target.textContent=`${weeklyTargetKm(context,selectedAiWeekIndex)} km`;
  document.getElementById("aiWeekAvailableDays").textContent=
    `${context.availability.length} dagen`;
  document.getElementById("aiWeekFocus").textContent=
    weekFocusLabel(context);

  const option=aiWeekOptions[selectedAiWeekIndex];

  if(!option){
    document.getElementById("aiWeekHeadline").textContent=
      "Nog geen week gegenereerd";
    document.getElementById("aiWeekReason").textContent=
      "Tik op Genereer week om een voorstel te maken.";
    document.getElementById("aiWeekPlan").innerHTML=
      '<p class="help">Hier verschijnt je weekvoorstel.</p>';
    document.getElementById("saveAiWeek").disabled=true;
    document.getElementById("regenerateAiWeek").disabled=true;
    return;
  }

  const totalKm=option.workouts.reduce(
    (sum,workout)=>sum+(Number(workout.distanceKm)||0),
    0
  );

  document.getElementById("aiWeekHeadline").textContent=
    `${option.workouts.length} trainingen · circa ${Math.round(totalKm)} km`;

  const raceText=context.race
    ? `${context.race.name} over ${context.phase.days} dagen`
    :"algemene opbouw";

  document.getElementById("aiWeekReason").textContent=
    context.readiness.level==="unknown"
      ?`Gebaseerd op ${context.availability.length} beschikbare dagen en ${raceText}; hersteldata is onvoldoende en daarom niet meegewogen.`
      :`Gebaseerd op herstelstatus ${context.readiness.level}, ${context.availability.length} beschikbare dagen en ${raceText}.`;

  document.getElementById("aiWeekPlan").innerHTML=
    option.workouts.map(workout=>{
      const typeClass=workout.planType||workout.type.toLowerCase();
      return`
        <div class="ai-week-row ${safe(typeClass)}">
          <div class="ai-week-day">
            ${new Intl.DateTimeFormat("nl-NL",{weekday:"short",day:"numeric"}).format(new Date(workout.date+"T12:00:00"))}
          </div>
          <div>
            <strong>${safe(workout.name)}</strong>
            <small>${safe((workout.displaySteps||[])[0]||"")}</small>
          </div>
          <div class="ai-week-volume">${trainingVolumeLabel(workout)}</div>
        </div>`;
    }).join("");

  document.getElementById("saveAiWeek").disabled=false;
  document.getElementById("regenerateAiWeek").disabled=false;
}

function regenerateAiWeek(){
  if(!aiWeekOptions.length){
    generateAiWeekOptions();
    return;
  }

  selectedAiWeekIndex=(selectedAiWeekIndex+1)%aiWeekOptions.length;
  renderAiWeekPlanner();
  renderCoachIntelligence();
  renderPerformanceTrend(activeTrendDays);
  renderSmartWeekCoach();
}

function saveAiGeneratedWeek(){
  const option=aiWeekOptions[selectedAiWeekIndex];
  const status=document.getElementById("aiWeekStatus");

  if(!option?.workouts?.length) return;

  let added=0;
  let skipped=0;

  for(const workout of option.workouts){
    if(customWorkouts[workout.date]){
      skipped++;
      continue;
    }

    customWorkouts[workout.date]=JSON.parse(JSON.stringify(workout));
    added++;
  }

  saveObject(STORAGE_KEY,customWorkouts);
  renderMonth();
  renderSaved();
  renderTodayCoach();
  renderPerformanceEngine();

  status.className="status ok";
  status.textContent=
    `${added} trainingen toegevoegd${skipped?` · ${skipped} bestaande dagen overgeslagen`:""}.`;
}

let aiTrainingOptions=[];
let selectedAiTrainingIndex=0;

function generatorContext(){
  const availability=todayAvailabilityInfo();
  const snapshot=getWellnessSnapshot();
  const readiness=determineReadiness(snapshot);
  const race=getRaceFocus();
  const phase=classifyRacePhase(race);
  const profileData=getProfile();
  const existing=currentTodayWorkout();

  return{
    availability,
    snapshot,
    readiness,
    race,
    phase,
    profile:profileData,
    existing
  };
}

function generatorTargetLabel(context){
  if(!context.race) return "Algemene ontwikkeling";
  const distance=Number(context.race.distanceKm||0);
  if(distance<=5) return "5 km-snelheid";
  if(distance<=10) return "10 km-drempel";
  if(distance<30) return "Halve marathon";
  return "Marathonuithouding";
}

function generatorIntensityLabel(context){
  if(context.readiness.level==="unknown") return "Hersteldata onbekend";
  if(context.readiness.level==="low") return "Herstel";
  if(context.readiness.level==="moderate") return "Gecontroleerd";
  if(context.phase.phase==="race-week") return "Kort en scherp";
  return "Kwaliteit mogelijk";
}

function secondsForAvailableRun(minutes,paceMinutes=5.2){
  return Math.max(5,Math.round(Number(minutes||45)/paceMinutes));
}

function createGeneratorWorkout(kind,context,variant=0){
  const date=todayDateString();
  const minutes=Math.max(0,Number(context.availability.maxMinutes||0));
  const p=context.profile;
  const race=context.race;
  const paces=targetPacesForRace(race,p);
  const distance=Number(race?.distanceKm||5);

  if(kind==="rest"){
    return{
      date,type:"Rest",distanceKm:0,durationMinutes:0,
      name:"Rustdag",uploadName:"Jaco - Rustdag",rpe:"1/10",
      status:"planned",priority:"could",planType:"rest",
      displaySteps:["Geen verplichte training","Focus op slaap, voeding en herstel"],
      intervalsDescription:"Rustdag."
    };
  }

  if(kind==="mobility"){
    const duration=Math.min(minutes||15,25);
    return{
      date,type:"Mobility",distanceKm:0,durationMinutes:duration,
      name:`Mobiliteit en herstel ${duration} min`,
      uploadName:`Jaco - Mobiliteit en herstel ${duration} min`,
      rpe:"2/10",status:"planned",priority:"could",planType:"mobility",
      displaySteps:[
        "Heupmobiliteit 4 min",
        "Enkelmobiliteit 4 min",
        "Hamstrings en bilspieren 4 min",
        "Borstrotaties 3 min"
      ],
      intervalsDescription:`Mobiliteit en herstel ${duration} minuten.

- Heupmobiliteit
- Enkelmobiliteit
- Hamstrings en bilspieren
- Borstrotaties`
    };
  }

  if(kind==="core"){
    return makeCoreWorkout(
      date,
      Math.min(minutes||20,25),
      context.availability.priority||"could"
    );
  }

  if(kind==="recovery"){
    const km=Math.max(5,Math.min(9,secondsForAvailableRun(minutes,5.6)));
    return makeWeekWorkout(
      date,"recovery",km,`Herstelloop ${km} km`,
      [`${km} km zeer rustig`,`Hartslag onder ${p.z2Hr} bpm`,`Geen versnellingen`],
      `Hersteltraining.

Recovery
- ${km}km 5:10-5:35/km Pace`,
      "2/10"
    );
  }

  if(kind==="easy"){
    const km=Math.max(7,Math.min(15,secondsForAvailableRun(minutes,5.15)));
    return makeWeekWorkout(
      date,"easy",km,`Rustige duurloop ${km} km`,
      [`${km} km zone 2`,`Hartslag bij voorkeur onder ${p.z2Hr} bpm`],
      `Rustige duurloop.

Easy
- ${km}km 5:00-5:25/km Pace`,
      "3/10"
    );
  }

  if(kind==="long"){
    const km=Math.max(14,Math.min(30,secondsForAvailableRun(minutes,5.2)));
    return makeWeekWorkout(
      date,"long",km,`Lange duurloop ${km} km`,
      [`${km} km rustig`,`Hartslag bij voorkeur onder ${p.z2Hr} bpm`],
      `Lange duurloop.

Easy
- ${km}km 4:55-5:20/km Pace`,
      "4/10"
    );
  }

  if(kind==="sharpen"){
    return makeWeekWorkout(
      date,"quality",7,"Wedstrijdprikkel",
      ["2 km inlopen","6 × 200 m ontspannen snel","200 m dribbel","2 km uitlopen"],
      `Wedstrijdprikkel.

Warmup
- 2km Z1 Pace

Main set 6x
- 200mtr 3:10-3:20/km Pace
- 200mtr Z1 Pace

Cooldown
- 2km Z1 Pace`,
      "5/10"
    );
  }

  if(kind==="threshold"){
    let reps=4;
    let block=1600;

    if(distance>=21){
      reps=variant===1?2:3;
      block=variant===1?4000:3000;
    }else if(distance>=10){
      reps=variant===1?3:4;
      block=2000;
    }

    return makeWeekWorkout(
      date,"quality",distance>=21?15:13,
      `${reps} × ${block} m drempel`,
      ["3 km inlopen",`${reps} × ${block} m @ ${paces.threshold}`,"2–3 min dribbel","2 km uitlopen"],
      `Drempeltraining.

Warmup
- 3km Z1 Pace

Main set ${reps}x
- ${block}mtr ${paces.threshold} Pace
- ${distance>=21?3:2}m Z1 Pace

Cooldown
- 2km Z1 Pace`,
      "7/10"
    );
  }

  if(kind==="vo2"){
    const reps=variant===1?12:5;
    const meters=variant===1?400:1000;
    const recovery=variant===1?"200mtr":"2m";
    const name=variant===1?"12 × 400 m snelheid":"5 × 1000 m VO₂max";
    const total=variant===1?11:12;

    return makeWeekWorkout(
      date,"quality",total,name,
      ["3 km inlopen",`${reps} × ${meters} m @ ${paces.vo2}`,`${recovery} herstel`,"2 km uitlopen"],
      `VO2max-training.

Warmup
- 3km Z1 Pace

Main set ${reps}x
- ${meters}mtr ${paces.vo2} Pace
- ${recovery} Z1 Pace

Cooldown
- 2km Z1 Pace`,
      "8/10"
    );
  }

  return createGeneratorWorkout("easy",context,variant);
}

function chooseGeneratorKinds(context){
  if(!context.availability.available){
    return["mobility","rest","core"];
  }

  if(context.readiness.level==="unknown"){
    const preference=context.availability.preference;
    if(preference==="core") return["core","mobility","easy"];
    if(preference==="mobiliteit") return["mobility","core","easy"];
    if(preference==="herstel") return["recovery","easy","mobility"];
    return["easy","core","mobility"];
  }

  if(context.readiness.level==="low"){
    return["recovery","mobility","rest"];
  }

  if(context.phase.phase==="race-week"){
    return["sharpen","easy","mobility"];
  }

  const preference=context.availability.preference;

  if(preference==="core") return["core","mobility","easy"];
  if(preference==="mobiliteit") return["mobility","core","recovery"];
  if(preference==="lange-duur") return["long","easy","recovery"];
  if(preference==="herstel") return["recovery","easy","mobility"];
  if(preference==="rustig") return["easy","recovery","core"];
  if(preference==="drempel") return["threshold","easy","recovery"];

  const raceDistance=Number(context.race?.distanceKm||5);
  if(raceDistance<=5) return["vo2","threshold","easy"];
  if(raceDistance<=10) return["threshold","vo2","easy"];
  return["threshold","long","easy"];
}

function fitGeneratedWorkout(workout,context){
  if(!workout || workout.type!=="Run") return workout;
  return fitWorkoutToDay(workout,context.availability);
}

function generateAiTrainingOptions(){
  const context=generatorContext();
  const kinds=chooseGeneratorKinds(context);

  aiTrainingOptions=kinds.map((kind,index)=>
    fitGeneratedWorkout(createGeneratorWorkout(kind,context,index===1?1:0),context)
  );

  selectedAiTrainingIndex=0;
  renderAiTrainingGenerator(context);
}

function renderAiTrainingGenerator(context=generatorContext()){
  const available=document.getElementById("generatorAvailableTime");
  if(!available) return;

  available.textContent=context.availability.available
    ? `${context.availability.maxMinutes} min`
    :"Rustdag";
  document.getElementById("generatorGoal").textContent=
    generatorTargetLabel(context);
  document.getElementById("generatorIntensity").textContent=
    generatorIntensityLabel(context);

  const workout=aiTrainingOptions[selectedAiTrainingIndex];

  if(!workout){
    document.getElementById("generatorTitle").textContent=
      "Nog geen training gegenereerd";
    document.getElementById("generatorExplanation").textContent=
      "Tik op Genereer training om een voorstel te maken.";
    document.getElementById("generatorSteps").innerHTML="";
    document.getElementById("generatorAlternatives").innerHTML="";
    document.getElementById("saveAiTraining").disabled=true;
    document.getElementById("regenerateAiTraining").disabled=true;
    return;
  }

  document.getElementById("generatorTitle").textContent=workout.name;

  const reasonParts=[
    context.readiness.level==="unknown"
      ?"hersteldata niet meegewogen"
      :`herstelstatus ${context.readiness.level}`,
    context.availability.available
      ? `${context.availability.maxMinutes} minuten beschikbaar`
      :"vandaag niet beschikbaar",
    context.race
      ? `${phaseLabel(context.phase.phase).toLowerCase()} richting ${context.race.name}`
      :"algemene trainingsopbouw"
  ];

  document.getElementById("generatorExplanation").textContent=
    `Gekozen vanwege ${reasonParts.join(", ")}.`;

  document.getElementById("generatorSteps").innerHTML=
    (workout.displaySteps||[]).map((step,index)=>`
      <li><span class="step">${index+1}</span><span>${safe(step)}</span></li>
    `).join("");

  document.getElementById("generatorAlternatives").innerHTML=
    aiTrainingOptions.map((option,index)=>`
      <button type="button"
        class="generator-alt ${index===selectedAiTrainingIndex?"active":""}"
        onclick="selectAiTrainingOption(${index})">
        <strong>${safe(option.name)}</strong>
        <small>${trainingVolumeLabel(option)} · RPE ${safe(option.rpe||"—")}</small>
      </button>
    `).join("");

  document.getElementById("saveAiTraining").disabled=false;
  document.getElementById("regenerateAiTraining").disabled=false;
}

function selectAiTrainingOption(index){
  if(!aiTrainingOptions[index]) return;
  selectedAiTrainingIndex=index;
  renderAiTrainingGenerator();
}

function saveAiGeneratedTraining(){
  const workout=aiTrainingOptions[selectedAiTrainingIndex];
  const status=document.getElementById("generatorStatus");
  if(!workout) return;

  const date=todayDateString();
  const existing=customWorkouts[date];

  if(existing){
    const confirmed=confirm(
      `De bestaande training "${existing.name}" vervangen door "${workout.name}"?`
    );
    if(!confirmed) return;
  }

  const saved=JSON.parse(JSON.stringify(workout));
  saved.date=date;
  saved.status="planned";
  customWorkouts[date]=saved;
  saveObject(STORAGE_KEY,customWorkouts);

  renderMonth();
  renderSelected();
  renderSaved();
  renderTodayCoach();
  renderPerformanceEngine();

  status.className="status ok";
  status.textContent=`${saved.name} is toegevoegd aan vandaag.`;
}

function regenerateAiTraining(){
  if(!aiTrainingOptions.length){
    generateAiTrainingOptions();
    return;
  }

  selectedAiTrainingIndex=
    (selectedAiTrainingIndex+1)%aiTrainingOptions.length;
  renderAiTrainingGenerator();
}

function clampScore(value){
  return Math.max(0,Math.min(100,Math.round(Number(value)||0)));
}

function dateDaysAgo(days){
  const value=new Date();
  value.setHours(0,0,0,0);
  value.setDate(value.getDate()-days);
  return value;
}

function calculateConsistencyScore(){
  const cutoff=dateDaysAgo(28);
  const todayValue=new Date();
  todayValue.setHours(23,59,59,999);

  const workouts=Object.entries({...serverWorkouts,...customWorkouts})
    .filter(([date,workout])=>{
      if(!workout || workout.type==="Race" || workout.type==="Rest") return false;
      const parsed=new Date(date+"T12:00:00");
      return parsed>=cutoff && parsed<=todayValue;
    });

  if(!workouts.length){
    return{
      score:60,
      completed:0,
      planned:0,
      explanation:"Nog onvoldoende lokale trainingshistorie"
    };
  }

  const completed=workouts.filter(([date,workout])=>
    Boolean(doneWorkouts[date]) ||
    workout.status==="done" ||
    workout.status==="completed"
  ).length;

  const ratio=completed/workouts.length;
  return{
    score:clampScore(45+ratio*55),
    completed,
    planned:workouts.length,
    explanation:`${completed} van ${workouts.length} trainingen lokaal als voltooid gemarkeerd`
  };
}


function calculatePerformanceEngine(){
  const snapshot=getWellnessSnapshot();
  const readiness=determineReadiness(snapshot);
  const race=getRaceFocus();
  const phase=classifyRacePhase(race);
  const consistency=calculateConsistencyScore();

  const ctl=snapshot.ctl;
  const atl=snapshot.atl;

  const fitness=ctl===null
    ? null
    : clampScore(35+(ctl/70)*55);

  let loadRatio=null;
  let fatigue=null;

  if(ctl!==null && ctl>0 && atl!==null){
    loadRatio=atl/ctl;

    if(loadRatio<0.65) fatigue=74;
    else if(loadRatio<=1.05) fatigue=92;
    else if(loadRatio<=1.25) fatigue=78;
    else if(loadRatio<=1.45) fatigue=58;
    else fatigue=35;
  }

  const recovery=readiness.sufficientData
    ? readiness.score
    : null;

  let phaseScore=62;
  if(phase.phase==="specific") phaseScore=78;
  if(phase.phase==="taper") phaseScore=88;
  if(phase.phase==="race-week") phaseScore=90;
  if(!race) phaseScore=null;

  let raceReadiness=weightedAvailableScore([
    {value:fitness,weight:.32},
    {value:recovery,weight:.30},
    {value:consistency.score,weight:.23},
    {value:phaseScore,weight:.15}
  ]);

  if(
    race &&
    phase.days!==null &&
    phase.days<=7 &&
    recovery!==null &&
    recovery<55 &&
    raceReadiness!==null
  ){
    raceReadiness=clampScore(raceReadiness-10);
  }

  let dataPoints=0;
  const possibleDataPoints=8;
  const freshness=snapshot.sources||{};

  if(freshness.ctl?.fresh) dataPoints++;
  if(freshness.atl?.fresh) dataPoints++;
  if(snapshot.form!==null) dataPoints++;
  if(freshness.hrv?.fresh) dataPoints++;
  if(freshness.restingHR?.fresh) dataPoints++;
  if(freshness.sleep?.fresh) dataPoints++;
  if(race) dataPoints++;
  if(getProfile()?.availability) dataPoints++;

  const confidence=clampScore(
    20+(dataPoints/possibleDataPoints)*80
  );

  const performance=weightedAvailableScore([
    {value:fitness,weight:.23},
    {value:fatigue,weight:.17},
    {value:recovery,weight:.27},
    {value:consistency.score,weight:.16},
    {value:raceReadiness,weight:.12},
    {value:confidence,weight:.05}
  ]);

  const signals=[];

  if(recovery===null){
    signals.push({
      state:"warn",
      icon:"?",
      text:`Recovery niet berekend: ${readiness.currentSignalCount}/${readiness.requiredSignals} actuele herstelsignalen`
    });
  }else{
    signals.push({
      state:recovery>=75?"good":recovery>=55?"warn":"bad",
      icon:recovery>=75?"✓":recovery>=55?"!":"×",
      text:`Recovery ${recovery}/100: ${readiness.reasons.length?readiness.reasons.join(", "):"geen duidelijke negatieve signalen"}`
    });
  }

  signals.push({
    state:fatigue===null?"warn":fatigue>=75?"good":fatigue>=55?"warn":"bad",
    icon:fatigue===null?"?":fatigue>=75?"✓":fatigue>=55?"!":"×",
    text:loadRatio===null
      ?"Belastingsverhouding niet actueel genoeg beschikbaar"
      :`ATL/CTL-verhouding ${loadRatio.toFixed(2)}`
  });

  signals.push({
    state:consistency.score>=75?"good":consistency.score>=55?"warn":"bad",
    icon:consistency.score>=75?"✓":consistency.score>=55?"!":"×",
    text:consistency.explanation
  });

  if(race){
    signals.push({
      state:raceReadiness===null
        ?"warn"
        :raceReadiness>=75
          ?"good"
          :raceReadiness>=55
            ?"warn"
            :"bad",
      icon:"🏁",
      text:`${race.name}: ${phase.days} dagen · ${phaseLabel(phase.phase)}`
    });
  }

  return{
    performance,
    fitness,
    fatigue,
    recovery,
    consistency:consistency.score,
    raceReadiness,
    confidence,
    loadRatio,
    race,
    phase,
    signals,
    explanations:{
      fitness:ctl===null
        ?"Geen actuele CTL; fitnessscore niet berekend"
        :`CTL ${ctl.toFixed(1)} als indicatie van langetermijnfitness`,
      fatigue:loadRatio===null
        ?"Geen actuele combinatie van CTL en ATL"
        :loadRatio<=1.05
          ?"Acute belasting is goed in balans"
          :loadRatio<=1.25
            ?"Acute belasting is verhoogd maar beheersbaar"
            :"Acute belasting ligt hoog ten opzichte van je fitness",
      recovery:recovery===null
        ?"Onvoldoende actuele HRV-, slaap-, rusthartslag- of readinessdata"
        :`Coach-readiness ${recovery}/100`,
      consistency:consistency.explanation,
      race:race
        ? `${phaseLabel(phase.phase)} richting ${race.name}`
        :"Voeg een komende wedstrijd toe voor race readiness",
      confidence:`${dataPoints} van ${possibleDataPoints} actuele databronnen beschikbaar`
    }
  };
}

function scoreHeadline(score){
  if(score===null || score===undefined) return "Onvoldoende actuele data";
  if(score>=85) return "Sterke performancepositie";
  if(score>=72) return "Goede basis om gericht te trainen";
  if(score>=58) return "Train gecontroleerd en bewaak herstel";
  return "Herstel en belastingsbeheersing hebben prioriteit";
}


function setPerformanceMetric(id,barId,value,explanationId,explanation){
  const valueElement=document.getElementById(id);
  const bar=document.getElementById(barId);
  const explanationElement=document.getElementById(explanationId);

  if(valueElement){
    valueElement.textContent=
      value===null || value===undefined ? "—" : value;
  }

  if(bar){
    bar.style.width=
      value===null || value===undefined
        ?"0%"
        :`${clampScore(value)}%`;
  }

  if(explanationElement){
    explanationElement.textContent=explanation;
  }
}

function renderPerformanceEngine(){
  const scoreElement=document.getElementById("performanceScore");
  if(!scoreElement) return;

  const engine=calculatePerformanceEngine();

  scoreElement.textContent=
    engine.performance===null ? "—" : engine.performance;
  document.getElementById("performanceHeadline").textContent=
    scoreHeadline(engine.performance);

  const raceText=engine.race
    ? `De score wordt mede bepaald door ${engine.race.name} over ${engine.phase.days} dagen.`
    :"Voeg een toekomstige wedstrijd toe om race readiness specifieker te maken.";

  document.getElementById("performanceExplanation").textContent=
    engine.performance===null
      ?"Nog onvoldoende actuele data om de samengestelde performancescore te berekenen."
      :`Performance ${engine.performance}/100. ${raceText}`;

  setPerformanceMetric(
    "fitnessScore","fitnessBar",engine.fitness,
    "fitnessExplanation",engine.explanations.fitness
  );
  setPerformanceMetric(
    "fatigueScore","fatigueBar",engine.fatigue,
    "fatigueExplanation",engine.explanations.fatigue
  );
  setPerformanceMetric(
    "recoveryScore","recoveryBar",engine.recovery,
    "recoveryExplanation",engine.explanations.recovery
  );
  setPerformanceMetric(
    "consistencyScore","consistencyBar",engine.consistency,
    "consistencyExplanation",engine.explanations.consistency
  );
  setPerformanceMetric(
    "raceReadinessScore","raceReadinessBar",engine.raceReadiness,
    "raceReadinessExplanation",engine.explanations.race
  );
  setPerformanceMetric(
    "coachConfidenceScore","coachConfidenceBar",engine.confidence,
    "coachConfidenceExplanation",engine.explanations.confidence
  );

  document.getElementById("performanceSignals").innerHTML=
    engine.signals.map(signal=>`
      <div class="reason-item">
        <div class="reason-icon ${signal.state}">${signal.icon}</div>
        <div>${safe(signal.text)}</div>
      </div>
    `).join("");

  return engine;
}

function todayAvailabilityInfo(){
  const p=getProfile();
  const availability={...defaultAvailability(),...(p.availability||{})};
  const jsDay=new Date().getDay();
  const mondayIndex=(jsDay+6)%7;
  const key=DAY_KEYS[mondayIndex];
  return {key,index:mondayIndex,...availability[key]};
}

function todayDateString(){
  return ymd(new Date());
}

function currentTodayWorkout(){
  return allWorkouts()[todayDateString()] || null;
}

function phaseLabel(phase){
  const labels={
    "race-week":"Wedstrijdweek",
    taper:"Taper",
    specific:"Wedstrijdspecifiek",
    build:"Opbouw",
    general:"Algemene training"
  };
  return labels[phase] || phase;
}

function createTodayRecommendation(readiness,race,phase,availability,currentWorkout){
  const date=todayDateString();

  if(!availability.available){
    const minutes=15;
    const workout={
      date,
      type:"Mobility",
      distanceKm:0,
      durationMinutes:minutes,
      name:"Mobiliteit en herstel 15 min",
      uploadName:"Jaco - Mobiliteit en herstel 15 min",
      rpe:"2/10",
      status:"planned",
      priority:"could",
      planType:"mobility",
      displaySteps:[
        "3 min rustige heupmobiliteit",
        "3 min enkelmobiliteit",
        "3 min hamstring en bilspieren",
        "3 min rug en borstrotaties",
        "3 min rustig foamrollen of ademhaling"
      ],
      intervalsDescription:`Mobiliteit en herstel 15 minuten.

- Heupmobiliteit
- Enkelmobiliteit
- Hamstrings en bilspieren
- Rug- en borstrotaties
- Rustige ademhaling`
    };

    return{
      kind:"rest",
      workout,
      title:"Rustdag + mobiliteit 15 min",
      text:"Vandaag staat als niet beschikbaar ingesteld. De coach plant daarom geen looptraining, maar je kunt wel een korte mobiliteitssessie toevoegen.",
      steps:workout.displaySteps
    };
  }


  if(readiness.level==="unknown"){
    if(currentWorkout){
      return{
        kind:"keep",
        workout:currentWorkout,
        title:currentWorkout.name,
        text:"Er zijn te weinig actuele herstelmetingen om je training op basis van herstel aan te passen. De bestaande planning blijft daarom ongewijzigd.",
        steps:currentWorkout.displaySteps||[]
      };
    }

    return{
      kind:"keep",
      workout:null,
      title:"Geen hersteladvies",
      text:"Er zijn te weinig actuele herstelmetingen om automatisch een training te adviseren. Je beschikbaarheid en wedstrijd blijven zichtbaar, maar herstel wordt niet geïnterpreteerd.",
      steps:[]
    };
  }

  if(readiness.level==="low"){
    const minutes=Math.min(availability.maxMinutes||45,45);
    const km=Math.max(5,Math.min(8,Math.round(minutes/5.5)));
    const workout=makeWeekWorkout(
      date,"recovery",km,`Herstelloop ${km} km`,
      [`${km} km zeer rustig`,`Hartslag onder ${getProfile().z2Hr} bpm`,`Stop bij zwaar gevoel`],
      `Hersteltraining.

Recovery
- ${km}km 5:10-5:35/km Pace`,
      "2/10"
    );
    workout.planType="recovery";
    return{
      kind:"replace",
      workout,
      title:`Herstelloop ${km} km`,
      text:"De hersteldata geeft meerdere signalen om intensiteit te beperken. Vandaag bouw je vooral herstel op.",
      steps:workout.displaySteps
    };
  }

  if(availability.preference==="core"){
    const mins=Math.min(availability.maxMinutes||20,25);
    const workout=makeCoreWorkout(date,mins,availability.priority||"could");
    return{
      kind:"new",
      workout,
      title:workout.name,
      text:"Je beschikbaarheid is vandaag ingesteld op core. Dit ondersteunt loopstabiliteit zonder extra loopbelasting.",
      steps:workout.displaySteps
    };
  }

  if(availability.preference==="mobiliteit"){
    const workout={
      date,type:"Mobility",distanceKm:0,durationMinutes:Math.min(availability.maxMinutes||20,25),
      name:"Mobiliteit en herstel",uploadName:"Jaco - Mobiliteit en herstel",
      rpe:"2/10",status:"planned",priority:availability.priority||"could",
      planType:"mobility",
      displaySteps:["Heupmobiliteit 5 min","Enkelmobiliteit 5 min","Hamstring en bilspieren 5 min","Rustig foamrollen 5 min"],
      intervalsDescription:"Mobiliteit en herstel."
    };
    return{
      kind:"new",workout,title:workout.name,
      text:"Een lichte mobiliteitssessie past vandaag het beste bij je ingestelde voorkeur.",
      steps:workout.displaySteps
    };
  }

  if(currentWorkout && readiness.level!=="low"){
    return{
      kind:"keep",
      workout:currentWorkout,
      title:currentWorkout.name,
      text:"De geplande training past bij je herstelstatus. Voer hem uit zoals gepland en gebruik je gevoel als laatste controle.",
      steps:currentWorkout.displaySteps||[]
    };
  }

  const generated=makeAdaptiveQuality(date,race,readiness,phase);

  if(!["kwaliteit","drempel"].includes(availability.preference) && generated.planType==="quality"){
    const minutes=Math.min(availability.maxMinutes||60,70);
    const km=Math.max(6,Math.min(12,Math.round(minutes/5.2)));
    const easy=makeWeekWorkout(
      date,"easy",km,`Rustige duurloop ${km} km`,
      [`${km} km zone 2`,`Hartslag onder circa ${getProfile().z2Hr} bpm`],
      `Rustige duurloop.

Easy
- ${km}km 5:00-5:25/km Pace`,
      "3/10"
    );
    easy.planType="easy";
    return{
      kind:"new",workout:easy,title:easy.name,
      text:"Je dagvoorkeur is geen kwaliteitstraining. De coach kiest daarom een rustige duurloop.",
      steps:easy.displaySteps
    };
  }

  const fitted=fitWorkoutToDay(generated,availability);
  fitted.date=date;
  fitted.priority=availability.priority||"should";
  fitted.preferredDaypart=availability.daypart||"flexibel";

  return{
    kind:"new",
    workout:fitted,
    title:fitted.name,
    text:`Deze training past bij je ${phaseLabel(phase.phase).toLowerCase()}, herstelstatus en beschikbare tijd.`,
    steps:fitted.displaySteps||[]
  };
}

function renderCurrentTodayWorkout(workout){
  const box=document.getElementById("todayCurrentWorkout");
  if(!workout){
    box.innerHTML='<p class="help">Er staat vandaag nog geen training in je kalender.</p>';
    return;
  }

  box.innerHTML=`
    <div class="saved-row">
      <div class="saved-row-top">
        <div>
          <strong>${safe(workout.name)}</strong>
          <small>${safe(workout.type||"Run")} · ${workout.distanceKm ? `${workout.distanceKm} km` : `${workout.durationMinutes||0} min`} · RPE ${safe(workout.rpe||"—")}</small>
        </div>
        <span class="pill">${customWorkouts[todayDateString()]?"EIGEN":"SCHEMA"}</span>
      </div>
    </div>`;
}


function renderTodayDataSources(snapshot,readiness){
  const quality=document.getElementById("todayDataQuality");
  const box=document.getElementById("todayDataSources");
  if(!quality || !box) return;

  quality.textContent=readiness.sufficientData
    ? `${readiness.currentSignalCount} actuele signalen`
    : `${readiness.currentSignalCount}/${readiness.requiredSignals} actueel`;

  const sources=snapshot.sources||{};
  const rows=[
    sourceFreshnessText(sources.hrv,"HRV"),
    sourceFreshnessText(sources.sleep,"Slaap"),
    sourceFreshnessText(sources.restingHR,"Rusthartslag"),
    {
      cls:sources.ctl?.fresh && sources.atl?.fresh
        ?"source-fresh"
        :(sources.ctl?.value!==null || sources.atl?.value!==null)
          ?"source-stale"
          :"source-missing",
      text:sources.ctl?.fresh && sources.atl?.fresh
        ? `CTL/ATL: actueel · ${sources.ctl.date || sources.atl.date}`
        :(sources.ctl?.value!==null || sources.atl?.value!==null)
          ? `CTL/ATL: niet actueel · laatste ${sources.ctl?.date || sources.atl?.date || "onbekend"}`
          :"CTL/ATL: geen data beschikbaar"
    }
  ];

  box.innerHTML=rows.map(row=>
    `<div class="${row.cls}">${safe(row.text)}</div>`
  ).join("");
}


function renderTodayCoach(){
  const snapshot=getWellnessSnapshot();
  const readiness=determineReadiness(snapshot);
  const race=getRaceFocus();
  const phase=classifyRacePhase(race);
  const availability=todayAvailabilityInfo();
  const existing=currentTodayWorkout();

  pendingTodayAdvice=createTodayRecommendation(
    readiness,
    race,
    phase,
    availability,
    existing
  );

  const score=document.getElementById("coachScore");
  const ring=document.getElementById("coachScoreRing");

  if(readiness.sufficientData){
    score.textContent=readiness.score;
    ring.style.setProperty("--score",readiness.score);
    ring.classList.remove("data-unknown");
  }else{
    score.textContent="—";
    ring.style.setProperty("--score",0);
    ring.classList.add("data-unknown");
  }

  let headline="Train volgens plan";
  if(readiness.level==="good") headline="Je bent klaar om te trainen";
  if(readiness.level==="moderate") headline="Vandaag gecontroleerd trainen";
  if(readiness.level==="low") headline="Herstel heeft vandaag prioriteit";
  if(readiness.level==="unknown") headline="Herstelstatus onbekend";
  document.getElementById("todayHeadline").textContent=headline;

  if(readiness.sufficientData){
    const reasons=readiness.reasons.length
      ? readiness.reasons.join(", ")
      : "geen duidelijke negatieve herstelsignalen";

    document.getElementById("todaySummary").textContent=
      `Coachscore ${readiness.score}/100: ${reasons}.`;
  }else{
    document.getElementById("todaySummary").textContent=
      `Onvoldoende actuele hersteldata: ${readiness.currentSignalCount} van minimaal ${readiness.requiredSignals} signalen beschikbaar.`;
  }

  document.getElementById("todayAvailability").textContent=
    availability.available
      ? `${availability.maxMinutes} min · ${availability.daypart}`
      : "Niet beschikbaar";

  document.getElementById("todayRace").textContent=
    race
      ? `${race.name} · ${daysUntil(race.date)} d`
      : "Geen wedstrijd";

  document.getElementById("todayPhase").textContent=
    phaseLabel(phase.phase);

  const reasonRows=[];

  reasonRows.push({
    cls:availability.available?"good":"warn",
    icon:availability.available?"✓":"—",
    text:availability.available
      ? `Beschikbaar voor maximaal ${availability.maxMinutes} minuten (${availability.daypart}).`
      : "Vandaag staat als rustdag of niet beschikbaar ingesteld."
  });

  if(readiness.sufficientData){
    reasonRows.push({
      cls:readiness.level==="good"
        ?"good"
        :readiness.level==="moderate"
          ?"warn"
          :"bad",
      icon:readiness.level==="good"
        ?"✓"
        :readiness.level==="moderate"
          ?"!"
          :"×",
      text:`Herstelniveau: ${readiness.level} (${readiness.score}/100).`
    });
  }else{
    reasonRows.push({
      cls:"warn",
      icon:"?",
      text:`Hersteldata onvoldoende: ${readiness.currentSignalCount}/${readiness.requiredSignals} actuele signalen. Geen herstel-score berekend.`
    });
  }

  if(race){
    reasonRows.push({
      cls:phase.phase==="race-week"?"warn":"good",
      icon:"🏁",
      text:`${race.name} is over ${phase.days} dagen; fase: ${phaseLabel(phase.phase)}.`
    });
  }

  document.getElementById("todayReasons").innerHTML=
    reasonRows.map(row=>`
      <div class="reason-item">
        <div class="reason-icon ${row.cls}">${row.icon}</div>
        <div>${safe(row.text)}</div>
      </div>
    `).join("");

  renderTodayDataSources(snapshot,readiness);

  document.getElementById("todayRecommendationTitle").textContent=
    pendingTodayAdvice.title;

  document.getElementById("todayRecommendationText").textContent=
    pendingTodayAdvice.text;

  document.getElementById("todayRecommendationSteps").innerHTML=
    (pendingTodayAdvice.steps||[]).map((step,index)=>`
      <li>
        <span class="step">${index+1}</span>
        <span>${safe(step)}</span>
      </li>
    `).join("");

  const apply=document.getElementById("applyTodayAdvice");
  apply.disabled=
    !pendingTodayAdvice.workout ||
    pendingTodayAdvice.kind==="keep";

  apply.textContent=
    pendingTodayAdvice.kind==="replace" && existing
      ?"Vervang training van vandaag"
      :pendingTodayAdvice.kind==="keep"
        ?readiness.level==="unknown"
          ?"Geen automatische aanpassing"
          :"Training staat al goed"
        :pendingTodayAdvice.kind==="rest"
          ?(existing
              ?"Vervang door mobiliteit"
              :"Plan mobiliteit voor vandaag")
          :"Plan advies voor vandaag";

  renderCurrentTodayWorkout(existing);
  renderPerformanceEngine();
  renderAiTrainingGenerator();
  renderAiWeekPlanner();
}

function applyTodayRecommendation(){
  if(!pendingTodayAdvice?.workout) return;

  const date=todayDateString();
  const existing=customWorkouts[date];

  if(existing){
    const replacement=pendingTodayAdvice.kind==="rest"
      ? `De bestaande training "${existing.name}" vervangen door 15 minuten mobiliteit?`
      : `De bestaande training "${existing.name}" vervangen door "${pendingTodayAdvice.workout.name}"?`;

    if(!confirm(replacement)){
      return;
    }
  }

  const workout=JSON.parse(JSON.stringify(pendingTodayAdvice.workout));
  workout.date=date;
  customWorkouts[date]=workout;
  saveObject(STORAGE_KEY,customWorkouts);

  renderMonth();
  renderSelected();
  renderSaved();
  renderTodayCoach();

  const status=document.getElementById("todayStatus");
  status.className="status ok";
  status.textContent=`${workout.name} is toegevoegd aan vandaag.`;
}

async function refreshTodayCoach(){
  const status=document.getElementById("todayStatus");
  status.className="status";
  status.textContent="Hersteldata wordt vernieuwd…";

  try{
    await loadWellnessDashboard();
    renderTodayCoach();
    status.className="status ok";
    status.textContent="Coachadvies is bijgewerkt.";
  }catch(error){
    renderTodayCoach();
    status.className="status error";
    status.textContent=`Wellnessdata kon niet volledig worden vernieuwd: ${error.message}`;
  }
}


function getWellnessSnapshot(){
  if(latestWellnessSnapshot?.dataIntegrityVersion==="7.4.1"){
    return{
      ...latestWellnessSnapshot,
      sources:{...(latestWellnessSnapshot.sources||{})}
    };
  }

  return{
    dataIntegrityVersion:"7.4.1",
    ctl:null,
    atl:null,
    form:null,
    hrv:null,
    restingHR:null,
    sleepSecs:null,
    sleepHours:null,
    readinessValue:null,
    hrvDelta:null,
    rhrDelta:null,
    averages:{hrv:null,restingHR:null,sleepSecs:null},
    freshRecoverySignals:0,
    requiredRecoverySignals:2,
    dataSufficient:false,
    sources:{}
  };
}


function determineReadiness(snapshot){
  const required=Number(snapshot?.requiredRecoverySignals||2);
  const currentSignals=Number(snapshot?.freshRecoverySignals||0);

  if(!snapshot?.dataSufficient || currentSignals<required){
    return{
      score:null,
      level:"unknown",
      reasons:["onvoldoende actuele hersteldata"],
      sufficientData:false,
      currentSignalCount:currentSignals,
      requiredSignals:required
    };
  }

  let score=70;
  const reasons=[];

  if(snapshot.form!==null){
    if(snapshot.form<-20){
      score-=30;
      reasons.push("vorm sterk negatief");
    }else if(snapshot.form<-10){
      score-=15;
      reasons.push("vermoeidheid verhoogd");
    }else if(snapshot.form>5){
      score+=10;
      reasons.push("vorm positief");
    }
  }

  if(snapshot.hrvDelta!==null){
    if(snapshot.hrvDelta<=-6){
      score-=20;
      reasons.push("HRV duidelijk lager");
    }else if(snapshot.hrvDelta>=4){
      score+=8;
      reasons.push("HRV boven gemiddeld");
    }
  }

  if(snapshot.rhrDelta!==null){
    if(snapshot.rhrDelta>=5){
      score-=20;
      reasons.push("rusthartslag verhoogd");
    }else if(snapshot.rhrDelta<=-3){
      score+=5;
      reasons.push("rusthartslag gunstig");
    }
  }

  if(snapshot.sleepHours!==null){
    if(snapshot.sleepHours<6.5){
      score-=15;
      reasons.push("korte slaap");
    }else if(snapshot.sleepHours>=7.5){
      score+=5;
      reasons.push("goede slaapduur");
    }
  }

  if(snapshot.readinessValue!==null){
    if(snapshot.readinessValue<50){
      score-=15;
      reasons.push("readiness laag");
    }else if(snapshot.readinessValue>=75){
      score+=8;
      reasons.push("readiness goed");
    }
  }

  score=Math.max(0,Math.min(100,score));
  const level=score<45?"low":score<70?"moderate":"good";

  return{
    score,
    level,
    reasons,
    sufficientData:true,
    currentSignalCount:currentSignals,
    requiredSignals:required
  };
}

function getRaceFocus(){
  const future=Object.values(races)
    .filter(r=>daysUntil(r.date)>=0)
    .sort((a,b)=>{
      const priorityOrder={A:0,B:1,C:2};
      const pa=priorityOrder[a.priority] ?? 3;
      const pb=priorityOrder[b.priority] ?? 3;
      if(pa!==pb) return pa-pb;
      return a.date.localeCompare(b.date);
    });

  return future[0] || null;
}

function classifyRacePhase(race){
  if(!race) return {phase:"general",days:null};
  const days=daysUntil(race.date);

  if(days<=7) return {phase:"race-week",days};
  if(days<=14) return {phase:"taper",days};
  if(days<=35) return {phase:"specific",days};
  return {phase:"build",days};
}

function targetPacesForRace(race,profileData){
  const p=profileData || getProfile();
  let racePace=null;

  if(race?.targetTime){
    racePace=racePaceSeconds(race);
  }

  if(!racePace){
    const distance=Number(race?.distanceKm || 5);
    if(distance<=5) racePace=parseTimeToSeconds(p.fiveKGoal)/5;
    else if(distance<=10) racePace=parseTimeToSeconds(p.tenKPr)/10;
    else racePace=parseTimeToSeconds(p.halfGoal)/21.0975;
  }

  return{
    race:racePace,
    easy:"5:00-5:25/km",
    recovery:"5:10-5:35/km",
    threshold:racePace ? `${formatPace(racePace+8)}-${formatPace(racePace+15)}/km` : "3:42-3:48/km",
    vo2:racePace ? `${formatPace(racePace-8)}-${formatPace(racePace-3)}/km` : "3:28-3:30/km"
  };
}

function makeAdaptiveQuality(date,race,readiness,phase){
  const paces=targetPacesForRace(race,getProfile());
  const distance=Number(race?.distanceKm || 5);

  if(readiness.level==="low"){
    const w=makeWeekWorkout(
      date,"easy",8,"Herstelduur met mobiliteit",
      ["8 km zeer rustig","10 minuten mobiliteit na afloop"],
      `Hersteltraining.

Recovery
- 8km ${paces.recovery} Pace`,
      "2/10"
    );
    w.planType="recovery";
    return w;
  }

  if(phase.phase==="race-week"){
    const w=makeWeekWorkout(
      date,"quality",7,"Wedstrijdprikkel",
      ["2 km inlopen","6 × 200 m ontspannen snel","200 m dribbel","2 km uitlopen"],
      `Korte wedstrijdprikkel.

Warmup
- 2km Z1 Pace

Main set 6x
- 200mtr 3:10-3:20/km Pace
- 200mtr Z1 Pace

Cooldown
- 2km Z1 Pace`,
      "5/10"
    );
    w.planType="quality";
    return w;
  }

  if(distance<=5){
    const reps=readiness.level==="good"?6:5;
    const w=makeWeekWorkout(
      date,"quality",readiness.level==="good"?13:12,
      `${reps} × 1000 m VO₂max`,
      ["3 km inlopen",`${reps} × 1000 m @ ${paces.vo2}`,"2 min dribbel","2 km uitlopen"],
      `5 km-specifieke VO2max-training.

Warmup
- 3km Z1 Pace

Main set ${reps}x
- 1km ${paces.vo2} Pace
- 2m Z1 Pace

Cooldown
- 2km Z1 Pace`,
      readiness.level==="good"?"8/10":"7/10"
    );
    w.planType="quality";
    return w;
  }

  if(distance<=10){
    const reps=readiness.level==="good"?4:3;
    const w=makeWeekWorkout(
      date,"quality",readiness.level==="good"?15:13,
      `${reps} × 2 km drempel`,
      ["3 km inlopen",`${reps} × 2 km @ ${paces.threshold}`,"2 min dribbel","2 km uitlopen"],
      `10 km-specifieke drempeltraining.

Warmup
- 3km Z1 Pace

Main set ${reps}x
- 2km ${paces.threshold} Pace
- 2m Z1 Pace

Cooldown
- 2km Z1 Pace`,
      readiness.level==="good"?"8/10":"7/10"
    );
    w.planType="quality";
    return w;
  }

  const reps=readiness.level==="good"?3:2;
  const blockKm=3;
  const w=makeWeekWorkout(
    date,"quality",reps===3?15:12,
    `${reps} × ${blockKm} km wedstrijdspecifiek`,
    ["3 km inlopen",`${reps} × ${blockKm} km rond wedstrijdtempo`,"3 min dribbel","2 km uitlopen"],
    `Wedstrijdspecifieke training richting ${race?.name || "volgende wedstrijd"}.

Warmup
- 3km Z1 Pace

Main set ${reps}x
- ${blockKm}km ${paces.threshold} Pace
- 3m Z1 Pace

Cooldown
- 2km Z1 Pace`,
    readiness.level==="good"?"8/10":"7/10"
  );
  w.planType="quality";
  return w;
}

function buildUnscheduledAdaptiveWeek(readiness,race,phase){
  const p=getProfile();
  const available=availableDaysForPlanner();
  const count=Math.min(p.days,available.length);
  const targetFactor=readiness.level==="low"?0.70:
    readiness.level==="moderate"?0.88:1;

  let targetKm=Math.round(Math.min(p.maxKm,p.weeklyKm)*targetFactor);
  if(phase.phase==="taper") targetKm=Math.round(targetKm*0.75);
  if(phase.phase==="race-week") targetKm=Math.round(targetKm*0.50);

  const quality=makeAdaptiveQuality(nextMonday(),race,readiness,phase);
  let qualityKm=Number(quality.distanceKm)||0;

  const longRatio=Number(race?.distanceKm || 5)>=21 ? 0.30 : 0.24;
  let longKm=Math.max(10,Math.round(targetKm*longRatio));
  if(phase.phase==="taper") longKm=Math.max(10,Math.round(longKm*0.75));
  if(phase.phase==="race-week") longKm=8;

  const remaining=Math.max(8,targetKm-qualityKm-longKm);
  const otherCount=Math.max(1,count-2);
  const easyKm=Math.max(6,Math.round(remaining/otherCount));

  const items=[quality];

  if(count>=3){
    const long=makeWeekWorkout(
      nextMonday(),"long",longKm,`Lange duurloop ${longKm} km`,
      [`${longKm} km rustig`,`Hartslag bij voorkeur onder ${p.z2Hr} bpm`],
      `Lange rustige duurloop.

Easy
- ${longKm}km 4:55-5:20/km Pace`,
      "4/10"
    );
    long.planType="long";
    items.push(long);
  }

  while(items.length<count){
    const isLast=items.length===count-1;
    const type=isLast && readiness.level!=="good" ? "recovery" : "easy";
    const km=type==="recovery"?Math.max(6,easyKm-2):easyKm;
    const name=type==="recovery"?`Herstelloop ${km} km`:`Rustige duurloop ${km} km`;
    const pace=type==="recovery"?"5:10-5:35/km":"5:00-5:25/km";

    const w=makeWeekWorkout(
      nextMonday(),type,km,name,
      [`${km} km rustig`,type==="recovery"?"Zeer lage inspanning":"Zone 2 aanhouden"],
      `${type==="recovery"?"Hersteltraining":"Rustige duurloop"}.

Easy
- ${km}km ${pace} Pace`,
      type==="recovery"?"2/10":"3/10"
    );
    w.planType=type;
    items.push(w);
  }

  return items;
}

function buildAdaptiveWeek(){
  const snapshot=getWellnessSnapshot();
  latestWellnessSnapshot=snapshot;
  const readiness=determineReadiness(snapshot);
  const race=getRaceFocus();
  const phase=classifyRacePhase(race);
  const unscheduled=buildUnscheduledAdaptiveWeek(readiness,race,phase);

  pendingAdaptiveWeek=scheduleByAvailability(unscheduled);

  const headline=document.getElementById("adaptiveCoachHeadline");
  const reason=document.getElementById("adaptiveCoachReason");
  const tag=readiness.level==="unknown"
    ?"Hersteldata onvoldoende"
    :readiness.level==="good"
      ?"Goede trainingsbereidheid"
      :readiness.level==="moderate"
        ?"Train gecontroleerd"
        :"Herstel heeft prioriteit";

  headline.textContent=readiness.level==="unknown"
    ?tag
    :`${tag} · ${readiness.score}/100`;

  const raceText=race
    ? `${race.name} over ${phase.days} dagen (${phase.phase})`
    : "geen komende wedstrijd gevonden";

  reason.textContent=
    `${readiness.level==="unknown"
      ?"Herstel is niet meegewogen wegens onvoldoende actuele data"
      :readiness.reasons.length
        ?readiness.reasons.join(", ")
        :"geen duidelijke negatieve herstelsignalen"}. `+
    `Focus: ${raceText}. De trainingen zijn verdeeld over je beschikbare dagen.`;

  renderAdaptiveWeek(readiness,race,phase);
}

function renderAdaptiveWeek(readiness,race,phase){
  const box=document.getElementById("adaptiveWeekPlan");
  const status=document.getElementById("adaptiveWeekStatus");

  if(!pendingAdaptiveWeek.length){
    box.innerHTML='<p class="help">Geen trainingen konden worden ingepland. Controleer je beschikbaarheid.</p>';
    document.getElementById("saveAdaptiveWeek").disabled=true;
    return;
  }

  box.innerHTML=pendingAdaptiveWeek.map(w=>{
    const tagClass=w.planType==="quality"?"red":
      w.planType==="long"?"orange":"green";
    const duration=w.type==="Core"
      ? `${w.durationMinutes || 15} min`
      : `${w.distanceKm} km`;

    return `
      <div class="adaptive-row">
        <div>
          <strong>${new Intl.DateTimeFormat("nl-NL",{weekday:"short",day:"numeric"}).format(new Date(w.date+"T12:00:00"))}</strong>
          <small>${duration}</small>
        </div>
        <div>
          <strong>${safe(w.name)}</strong>
          <small>${safe(w.displaySteps[0] || "")} · ${safe(w.preferredDaypart || "flexibel")}</small>
        </div>
        <span class="adaptive-tag ${tagClass}">${safe(w.priority || "should").toUpperCase()}</span>
      </div>`;
  }).join("");

  const totalKm=pendingAdaptiveWeek.reduce((sum,w)=>sum+(Number(w.distanceKm)||0),0);
  status.className="status";
  status.textContent=
    `${Math.round(totalKm)} km voorgesteld${race?` richting ${race.name}`:""}. `+
    readiness.level==="unknown"
      ?"Hersteldata onvoldoende; herstel is niet meegewogen."
      :`Herstelniveau: ${readiness.level}.`;
  document.getElementById("saveAdaptiveWeek").disabled=false;
}

function saveAdaptiveWeek(){
  if(!pendingAdaptiveWeek.length) return;

  let added=0;
  let skipped=0;

  for(const workout of pendingAdaptiveWeek){
    if(customWorkouts[workout.date]){
      skipped++;
      continue;
    }
    customWorkouts[workout.date]=workout;
    added++;
  }

  saveObject(STORAGE_KEY,customWorkouts);
  renderMonth();
  renderSaved();

  const status=document.getElementById("adaptiveWeekStatus");
  status.className="status ok";
  status.textContent=
    `${added} trainingen ingepland${skipped?` · ${skipped} dagen overgeslagen omdat daar al iets stond`:""}.`;
}

function defaultProfile(){
  return{
    name:"Jaco",
    days:4,
    weeklyKm:60,
    maxKm:70,
    fiveKPr:"18:16",
    fiveKGoal:"17:59",
    tenKPr:"38:03",
    halfGoal:"1:19:59",
    maxHr:185,
    z2Hr:145,
    qualityGap:2,
    longRunDay:5,
    autoCore:true,
    availability:defaultAvailability()
  };
}
function getProfile(){return{...defaultProfile(),...profile};}

function fillPlanningForm(){
  const p=getProfile();
  document.getElementById("profileQualityGap").value=String(p.qualityGap ?? 2);
  document.getElementById("profileLongRunDay").value=String(p.longRunDay ?? 5);
  document.getElementById("profileAutoCore").checked=p.autoCore !== false;
  renderAvailabilityEditor();
  renderPlanningPreview();
}

function savePlanning(event){
  event.preventDefault();

  const current=getProfile();
  profile={
    ...current,
    qualityGap:Number(document.getElementById("profileQualityGap").value),
    longRunDay:document.getElementById("profileLongRunDay").value === ""
      ? ""
      : Number(document.getElementById("profileLongRunDay").value),
    autoCore:document.getElementById("profileAutoCore").checked,
    availability:readAvailabilityForm()
  };

  saveObject(PROFILE_KEY,profile);

  document.getElementById("planningStatus").className="status ok";
  document.getElementById("planningStatus").textContent=
    "Planning opgeslagen. Plan mijn week gebruikt vanaf nu deze dagen.";

  renderPlanningPreview();
  renderProfileSummary();
}

function renderPlanningPreview(){
  const box=document.getElementById("planningPreview");
  if(!box) return;

  const p=getProfile();
  const availability={...defaultAvailability(),...(p.availability||{})};

  box.innerHTML=DAY_KEYS.map((key,index)=>{
    const day=availability[key];
    const available=Boolean(day.available);

    return `
      <div class="saved-row">
        <div class="saved-row-top">
          <div>
            <strong>${DAY_NAMES[index]}</strong>
            <small>
              ${available
                ? `${day.daypart} · maximaal ${day.maxMinutes} min · ${preferenceLabel(day.preference)}`
                : "Rust / niet beschikbaar"}
            </small>
          </div>
          <span class="pill">${available ? day.priority.toUpperCase() : "RUST"}</span>
        </div>
      </div>`;
  }).join("");
}

function preferenceLabel(value){
  const labels={
    rust:"Rust",
    kwaliteit:"Interval / kwaliteit",
    rustig:"Rustige duurloop",
    drempel:"Tempo / drempel",
    "lange-duur":"Lange duurloop",
    herstel:"Herstel",
    core:"Core",
    mobiliteit:"Mobiliteit"
  };
  return labels[value] || value;
}

function fillProfileForm(){const p=getProfile();profileName.value=p.name;profileDays.value=String(p.days);profileWeeklyKm.value=p.weeklyKm;profileMaxKm.value=p.maxKm;profileFiveKPr.value=p.fiveKPr;profileFiveKGoal.value=p.fiveKGoal;profileTenKPr.value=p.tenKPr;profileHalfGoal.value=p.halfGoal;profileMaxHr.value=p.maxHr;profileZ2Hr.value=p.z2Hr;renderProfileSummary();}
function saveProfile(e){
  e.preventDefault();
  const current=getProfile();
  profile={
    ...current,
    name:safe(profileName.value).trim()||"Jaco",
    days:Number(profileDays.value),
    weeklyKm:Number(profileWeeklyKm.value),
    maxKm:Number(profileMaxKm.value),
    fiveKPr:safe(profileFiveKPr.value).trim(),
    fiveKGoal:safe(profileFiveKGoal.value).trim(),
    tenKPr:safe(profileTenKPr.value).trim(),
    halfGoal:safe(profileHalfGoal.value).trim(),
    maxHr:Number(profileMaxHr.value),
    z2Hr:Number(profileZ2Hr.value)
  };
  saveObject(PROFILE_KEY,profile);
  profileStatus.className="status ok";
  profileStatus.textContent="Profiel opgeslagen.";
  renderProfileSummary();
}
function renderProfileSummary(){const p=getProfile();summaryDays.textContent=p.days;summaryKm.textContent=`${p.weeklyKm} km`;summaryFiveK.textContent=p.fiveKGoal||"—";summaryHalf.textContent=p.halfGoal||"—";}
function nextMonday(){const d=new Date();const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day+7);return ymd(d);}
function raceForPlanner(){return Object.values(races).filter(r=>daysUntil(r.date)>=0).sort((a,b)=>a.date.localeCompare(b.date))[0]||null;}
function plannerReduced(){const form=Number(metricForm.textContent);return Number.isFinite(form)&&form<-15;}
function makeWeekWorkout(date,name,km,rpe,steps,desc){return{date,name,uploadName:`Jaco - ${name}`,type:"Run",distanceKm:Math.round(km*10)/10,rpe,status:"planned",displaySteps:steps,intervalsDescription:desc};}
function generatePersonalWeek(){const p=getProfile(),start=nextMonday(),race=raceForPlanner(),reduced=plannerReduced();const target=Math.min(p.maxKm,Math.round(p.weeklyKm*(reduced?.75:1)));let qName="5 × 1000 m VO₂max",qKm=12,qRpe="8/10",qSteps=["3 km inlopen","5 × 1000 m @ 3:28–3:30/km","2 min dribbel","2 km uitlopen"],qDesc=`5 km-specifieke VO2max-training.\n\nWarmup\n- 3km Z1 Pace\n\nMain set 5x\n- 1km 3:28-3:30/km Pace\n- 2m Z1 Pace\n\nCooldown\n- 2km Z1 Pace`;
if(race&&Number(race.distanceKm)>=10){qName="3 × 2 km drempel";qKm=13;qRpe="7/10";qSteps=["3 km inlopen","3 × 2 km rond drempeltempo","2 min dribbel","2 km uitlopen"];qDesc=`Drempeltraining richting ${race.name}.\n\nWarmup\n- 3km Z1 Pace\n\nMain set 3x\n- 2km 3:42-3:48/km Pace\n- 2m Z1 Pace\n\nCooldown\n- 2km Z1 Pace`;}
if(reduced){qName="Rustige duurloop met strides";qKm=10;qRpe="5/10";qSteps=["9 km rustig in zone 2","6 × 100 m ontspannen strides indien fris"];qDesc=`Gecontroleerde duurloop wegens vermoeidheidssignalen.\n\nEasy\n- 9km 5:00-5:25/km Pace\n\nStrides 6x\n- 100mtr 3:20-3:30/km Pace\n- 100mtr Z1 Pace`;}
const longKm=Math.max(14,Math.round(target*(race&&Number(race.distanceKm)>=21?.30:.25))),easyCount=Math.max(1,p.days-2),easyKm=Math.max(6,Math.round(Math.max(12,target-qKm-longKm)/easyCount));const offsets=p.days===3?[1,3,5]:p.days===4?[1,3,5,6]:p.days===5?[0,1,3,5,6]:[0,1,2,3,5,6];const types=p.days===3?["quality","easy","long"]:p.days===4?["quality","easy","long","recovery"]:p.days===5?["easy","quality","easy","long","recovery"]:["easy","quality","recovery","easy","long","recovery"];
pendingWeekPlan=offsets.map((o,i)=>{const date=addDays(start,o),t=types[i];if(t==="quality")return makeWeekWorkout(date,qName,qKm,qRpe,qSteps,qDesc);if(t==="long")return makeWeekWorkout(date,`Lange duurloop ${longKm} km`,longKm,"4/10",[`${longKm} km rustig lopen`,`Hartslag onder circa ${p.z2Hr} bpm houden`],`Lange rustige duurloop.\n\nEasy\n- ${longKm}km 4:55-5:20/km Pace`);if(t==="recovery"){const km=Math.max(6,easyKm-2);return makeWeekWorkout(date,`Herstelloop ${km} km`,km,"2/10",[`${km} km zeer rustig`,`Geen strides als de benen zwaar zijn`],`Hersteltraining.\n\nRecovery\n- ${km}km 5:10-5:35/km Pace`);}return makeWeekWorkout(date,`Rustige duurloop ${easyKm} km`,easyKm,"3/10",[`${easyKm} km zone 2`,`Hartslag bij voorkeur onder ${p.z2Hr} bpm`],`Rustige duurloop.\n\nEasy\n- ${easyKm}km 5:00-5:25/km Pace`);});renderWeekPlan(reduced,race,target);}
function renderWeekPlan(reduced,race,target){weekPlan.innerHTML=pendingWeekPlan.map(w=>`<div class="week-plan-row"><div><strong>${new Intl.DateTimeFormat("nl-NL",{weekday:"short",day:"numeric"}).format(new Date(w.date+"T12:00:00"))}</strong><small>${w.distanceKm} km</small></div><div><strong>${safe(w.name)}</strong><small>${safe(w.displaySteps[0]||"")}</small></div><span class="readiness-badge">${safe(w.rpe)}</span></div>`).join("");saveWeekPlan.disabled=false;weekPlanStatus.className="status";weekPlanStatus.textContent=`${target} km gepland${race?` richting ${race.name}`:""}${reduced?" · volume verlaagd door herstelsignalen":""}.`;}
function savePersonalWeek(){if(!pendingWeekPlan.length)return;let added=0;for(const w of pendingWeekPlan){if(!customWorkouts[w.date]){customWorkouts[w.date]=w;added++;}}saveObject(STORAGE_KEY,customWorkouts);renderMonth();renderSaved();weekPlanStatus.className="status ok";weekPlanStatus.textContent=`${added} trainingen toegevoegd aan de kalender.`;}

async function loadServer(){
  try{
    const response=await fetch("/api/workouts");
    const data=await response.json();

    if(!response.ok){
      throw new Error(data.error || "Laden mislukt");
    }

    serverWorkouts=data.workouts || {};
  }catch(error){
    console.error(error);
    serverWorkouts={};
  }

  renderMonth();
  renderSelected();
}
