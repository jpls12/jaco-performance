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
