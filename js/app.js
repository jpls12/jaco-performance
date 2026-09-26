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

  const existing=currentTodayWorkout();
  const sameVisualWorkout=
    existing &&
    existing.name===workoutDefinition.title &&
    existing.type===workoutDefinition.type;

  if(existing?.type==="Race"){
    document.getElementById("playerFinishSummary").textContent=
      `Niet opgeslagen: vandaag staat wedstrijd "${existing.name}" in je kalender.`;
    return;
  }

  if(existing && !sameVisualWorkout){
    const confirmed=confirm(
      `Vandaag staat al "${existing.name}". Jaco Performance bewaart nu één hoofdtraining per dag. Deze vervangen door de voltooide ${workoutDefinition.title}?`
    );
    if(!confirmed){
      document.getElementById("playerFinishSummary").textContent=
        "Workout voltooid, maar niet in de kalender opgeslagen omdat daar al een andere training staat.";
      return;
    }
  }

  clearWorkoutMarkersForDate(date);

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
  markWorkoutCompleted(date,workout);
  saveObject(STORAGE_KEY,customWorkouts);
  saveObject(DONE_KEY,doneWorkouts);
  saveObject(UPLOAD_KEY,uploadedWorkouts);

  refreshAfterCalendarMutation();

  closeVisualWorkoutPlayer();
  selectedDate=date;
  openDiaryForDate(date);
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
  const type=workout?.type;
  if(workout?.distanceLabel) return workout.distanceLabel;

  if(type==="Swim"){
    const meters=finiteNumberOrNull(workout?.distanceMeters);
    if(meters!==null && meters>0) return `${meters} m`;
  }

  if(["Strength","Core","Mobility"].includes(type)){
    const minutes=finiteNumberOrNull(workout?.durationMinutes);
    return minutes!==null && minutes>0 ? `${minutes} min` : "—";
  }

  if(type==="Rest") return "Rust";

  const distanceKm=finiteNumberOrNull(workout?.distanceKm);
  if(distanceKm!==null && distanceKm>0) return `${distanceKm} km`;

  const durationMinutes=finiteNumberOrNull(workout?.durationMinutes);
  if(durationMinutes!==null && durationMinutes>0) return `${durationMinutes} min`;

  return "—";
}

function updateWorkoutTypeFields(){
  const type=document.getElementById("workoutType")?.value || "Run";
  const isRun=type==="Run";

  document.getElementById("runFields").hidden=!isRun || Boolean(exactRunDraft);
  document.getElementById("nonRunFields").hidden=isRun;

  const exactPanel=document.getElementById("exactRunPanel");
  if(exactPanel){
    exactPanel.hidden=!isRun || !exactRunDraft;
  }

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

const APP_VERSION = "10.9.7";
const STORAGE_KEY = "jp_custom_workouts_v1";
const DONE_KEY = "jp_done_workouts_v1";
const UPLOAD_KEY = "jp_uploaded_workouts_v1";
const RACES_KEY = "jp_races_v1";
const PROFILE_KEY = "jp_profile_v1";
const DIARY_KEY = "jp_coach_diary_v1";
const HM_AMSTERDAM_BLOCK_KEY = "jp_hm_amsterdam_2026_v1_installed";
const HM_AMSTERDAM_BACKUP_KEY = "jp_hm_amsterdam_2026_v1_backup";
const HM_AMSTERDAM_RACEWEEK_KEY = "jp_hm_amsterdam_2026_raceweek_v1_installed";
const HM_AMSTERDAM_RACEWEEK_BACKUP_KEY = "jp_hm_amsterdam_2026_raceweek_v1_backup";
const PREIMPORT_BACKUP_KEY = "jp_last_preimport_backup_v1";
const BACKUP_FORMAT = "jaco-performance-backup";
const BACKUP_SCHEMA_VERSION = 1;
const SESSION_PIN_KEY = "jaco_performance_session_pin_v1";

let serverWorkouts = {};
let customWorkouts = loadObject(STORAGE_KEY);
let doneWorkouts = loadObject(DONE_KEY);
let uploadedWorkouts = loadObject(UPLOAD_KEY);
let races = loadObject(RACES_KEY);
let profile = loadObject(PROFILE_KEY);
let coachDiary = loadObject(DIARY_KEY);
let pendingWeekPlan = [];
let pendingAdaptiveWeek = [];
let latestWellnessSnapshot = null;
let exactRunDraft = null;
let pendingBackupImport = null;



const HM_AMSTERDAM_BLOCK_2026={
  "2026-09-21":{
    date:"2026-09-21",
    name:"Rust / wandelen + mobiliteit",
    uploadName:"Jaco - Rust wandelen mobiliteit",
    type:"Rest",
    distanceKm:0,
    distanceLabel:"Rust",
    rpe:"—",
    status:"planned",
    planType:"rest",
    displaySteps:[
      "Rust",
      "Wandelen",
      "Mobiliteit"
    ],
    intervalsDescription:"",
    sourcePlan:"HM Amsterdam 2026",
    sourcePlanVersion:"hm-amsterdam-2026-v1",
    importedPlan:true
  },
  "2026-09-22":{
    date:"2026-09-22",
    name:"6–8 km zeer rustig",
    uploadName:"Jaco - 6-8 km zeer rustig",
    type:"Run",
    distanceKm:7,
    distanceLabel:"6–8 km",
    rpe:"—",
    status:"planned",
    planType:"recovery",
    displaySteps:[
      "6–8 km zeer rustig @ 4:50–5:15/km"
    ],
    intervalsDescription:`Zeer rustige loop.

Easy
- 7km 4:50-5:15/km Pace

Bronplanning: 6-8 km; 7 km is alleen de interne middenwaarde voor volumeberekening.`,
    sourcePlan:"HM Amsterdam 2026",
    sourcePlanVersion:"hm-amsterdam-2026-v1",
    importedPlan:true
  },
  "2026-09-23":{
    date:"2026-09-23",
    name:"10 km Z2",
    uploadName:"Jaco - 10 km Z2",
    type:"Run",
    distanceKm:10,
    distanceLabel:"10 km",
    rpe:"—",
    status:"planned",
    planType:"easy",
    displaySteps:[
      "10 km Z2 @ ±4:35–4:55/km"
    ],
    intervalsDescription:`Zone 2 duurloop.

Easy
- 10km 4:35-4:55/km Pace`,
    sourcePlan:"HM Amsterdam 2026",
    sourcePlanVersion:"hm-amsterdam-2026-v1",
    importedPlan:true
  },
  "2026-09-24":{
    date:"2026-09-24",
    name:"Rust",
    uploadName:"Jaco - Rust",
    type:"Rest",
    distanceKm:0,
    distanceLabel:"Rust",
    rpe:"—",
    status:"planned",
    planType:"rest",
    displaySteps:["Rust"],
    intervalsDescription:"",
    sourcePlan:"HM Amsterdam 2026",
    sourcePlanVersion:"hm-amsterdam-2026-v1",
    importedPlan:true
  },
  "2026-09-25":{
    date:"2026-09-25",
    name:"3 × 2 km @ 3:48–3:52/km",
    uploadName:"Jaco - 3 x 2 km 3:48-3:52",
    type:"Run",
    distanceKm:10,
    distanceLabel:"3 × 2 km + in/uit",
    rpe:"—",
    status:"planned",
    planType:"quality",
    displaySteps:[
      "2 km inlopen",
      "3 × 2 km @ 3:48–3:52/km",
      "2 min rustig dribbelen",
      "2 km uitlopen"
    ],
    intervalsDescription:`Drempeltraining.

Warmup
- 2km Z1 Pace

Main set 3x
- 2km 3:48-3:52/km Pace
- 2m Z1 Pace

Cooldown
- 2km Z1 Pace`,
    sourcePlan:"HM Amsterdam 2026",
    sourcePlanVersion:"hm-amsterdam-2026-v1",
    importedPlan:true
  },
  "2026-09-26":{
    date:"2026-09-26",
    name:"7–8 km easy",
    uploadName:"Jaco - 7-8 km easy",
    type:"Run",
    distanceKm:7.5,
    distanceLabel:"7–8 km",
    rpe:"—",
    status:"planned",
    planType:"easy",
    displaySteps:[
      "7–8 km easy @ 4:45–5:05/km"
    ],
    intervalsDescription:`Easy run.

Easy
- 7.5km 4:45-5:05/km Pace

Bronplanning: 7-8 km; 7,5 km is alleen de interne middenwaarde voor volumeberekening.`,
    sourcePlan:"HM Amsterdam 2026",
    sourcePlanVersion:"hm-amsterdam-2026-v1",
    importedPlan:true
  },
  "2026-09-27":{
    date:"2026-09-27",
    name:"18 km duurloop met snelle finish",
    uploadName:"Jaco - 18 km duurloop snelle finish",
    type:"Run",
    distanceKm:18,
    distanceLabel:"18 km",
    rpe:"—",
    status:"planned",
    planType:"long",
    displaySteps:[
      "12 km easy",
      "Laatste 6 km @ 4:05–4:10/km"
    ],
    intervalsDescription:`Duurloop met gecontroleerde snelle finish.

Easy
- 12km Z2 Pace

Progression
- 6km 4:05-4:10/km Pace`,
    sourcePlan:"HM Amsterdam 2026",
    sourcePlanVersion:"hm-amsterdam-2026-v1",
    importedPlan:true
  },

  "2026-09-28":{
    date:"2026-09-28",
    name:"Rust",
    uploadName:"Jaco - Rust",
    type:"Rest",
    distanceKm:0,
    distanceLabel:"Rust",
    rpe:"—",
    status:"planned",
    planType:"rest",
    displaySteps:["Rust"],
    intervalsDescription:"",
    sourcePlan:"HM Amsterdam 2026",
    sourcePlanVersion:"hm-amsterdam-2026-v1",
    importedPlan:true
  },
  "2026-09-29":{
    date:"2026-09-29",
    name:"5 × 1 km @ 3:35–3:40/km",
    uploadName:"Jaco - 5 x 1 km 3:35-3:40",
    type:"Run",
    distanceKm:10,
    distanceLabel:"5 × 1 km + in/uit",
    rpe:"—",
    status:"planned",
    planType:"quality",
    displaySteps:[
      "Inlopen",
      "5 × 1 km @ 3:35–3:40/km",
      "90 sec jogpauze",
      "Uitlopen"
    ],
    intervalsDescription:`Intervaltraining.

Warmup
- Z1 Pace

Main set 5x
- 1km 3:35-3:40/km Pace
- 90s Z1 Pace

Cooldown
- Z1 Pace

De bronplanning noemt in- en uitlopen zonder exacte afstand; 10 km is alleen de interne volumewaarde.`,
    sourcePlan:"HM Amsterdam 2026",
    sourcePlanVersion:"hm-amsterdam-2026-v1",
    importedPlan:true
  },
  "2026-09-30":{
    date:"2026-09-30",
    name:"10–12 km Z2",
    uploadName:"Jaco - 10-12 km Z2",
    type:"Run",
    distanceKm:11,
    distanceLabel:"10–12 km",
    rpe:"—",
    status:"planned",
    planType:"easy",
    displaySteps:[
      "10–12 km Z2 @ 4:35–4:55/km"
    ],
    intervalsDescription:`Zone 2 duurloop.

Easy
- 11km 4:35-4:55/km Pace

Bronplanning: 10-12 km; 11 km is alleen de interne middenwaarde voor volumeberekening.`,
    sourcePlan:"HM Amsterdam 2026",
    sourcePlanVersion:"hm-amsterdam-2026-v1",
    importedPlan:true
  },
  "2026-10-01":{
    date:"2026-10-01",
    name:"8 km easy + strides",
    uploadName:"Jaco - 8 km easy + 6 x 20 sec strides",
    type:"Run",
    distanceKm:8,
    distanceLabel:"8 km + strides",
    rpe:"—",
    status:"planned",
    planType:"easy",
    displaySteps:[
      "8 km easy",
      "6 × 20 sec strides"
    ],
    intervalsDescription:`Easy run met strides.

Easy
- 8km Z2 Pace

Strides 6x
- 20s Fast Pace
- 60s Z1 Pace`,
    sourcePlan:"HM Amsterdam 2026",
    sourcePlanVersion:"hm-amsterdam-2026-v1",
    importedPlan:true
  },
  "2026-10-02":{
    date:"2026-10-02",
    name:"Rust",
    uploadName:"Jaco - Rust",
    type:"Rest",
    distanceKm:0,
    distanceLabel:"Rust",
    rpe:"—",
    status:"planned",
    planType:"rest",
    displaySteps:["Rust"],
    intervalsDescription:"",
    sourcePlan:"HM Amsterdam 2026",
    sourcePlanVersion:"hm-amsterdam-2026-v1",
    importedPlan:true
  },
  "2026-10-03":{
    date:"2026-10-03",
    name:"HM-specifiek · 3 × 3 km",
    uploadName:"Jaco - HM specifiek 3 x 3 km",
    type:"Run",
    distanceKm:11,
    distanceLabel:"3 × 3 km + 2 × 1 km float",
    rpe:"—",
    status:"planned",
    planType:"quality",
    displaySteps:[
      "3 × 3 km @ 3:52–3:54/km",
      "1 km float @ 4:25–4:35/km tussen de blokken",
      "Belangrijkste sessie van het blok",
      "Niet versnellen naar 3:45; beoogd wedstrijdtempo gecontroleerd automatiseren"
    ],
    intervalsDescription:`HM-specifieke kerntraining.

Main set
- 3km 3:52-3:54/km Pace
- 1km 4:25-4:35/km Pace
- 3km 3:52-3:54/km Pace
- 1km 4:25-4:35/km Pace
- 3km 3:52-3:54/km Pace

Doel: gecontroleerd wedstrijdtempo automatiseren; niet sneller lopen omdat het kan.`,
    sourcePlan:"HM Amsterdam 2026",
    sourcePlanVersion:"hm-amsterdam-2026-v1",
    importedPlan:true
  },
  "2026-10-04":{
    date:"2026-10-04",
    name:"16–18 km easy",
    uploadName:"Jaco - 16-18 km easy",
    type:"Run",
    distanceKm:17,
    distanceLabel:"16–18 km",
    rpe:"—",
    status:"planned",
    planType:"long",
    displaySteps:[
      "16–18 km easy @ 4:35–4:55/km"
    ],
    intervalsDescription:`Rustige duurloop.

Easy
- 17km 4:35-4:55/km Pace

Bronplanning: 16-18 km; 17 km is alleen de interne middenwaarde voor volumeberekening.`,
    sourcePlan:"HM Amsterdam 2026",
    sourcePlanVersion:"hm-amsterdam-2026-v1",
    importedPlan:true
  },

  "2026-10-05":{
    date:"2026-10-05",
    name:"Rust",
    uploadName:"Jaco - Rust",
    type:"Rest",
    distanceKm:0,
    distanceLabel:"Rust",
    rpe:"—",
    status:"planned",
    planType:"rest",
    displaySteps:["Rust"],
    intervalsDescription:"",
    sourcePlan:"HM Amsterdam 2026",
    sourcePlanVersion:"hm-amsterdam-2026-v1",
    importedPlan:true
  },
  "2026-10-06":{
    date:"2026-10-06",
    name:"10 km easy",
    uploadName:"Jaco - 10 km easy",
    type:"Run",
    distanceKm:10,
    distanceLabel:"10 km",
    rpe:"—",
    status:"planned",
    planType:"easy",
    displaySteps:["10 km easy"],
    intervalsDescription:`Easy run.

Easy
- 10km Z2 Pace`,
    sourcePlan:"HM Amsterdam 2026",
    sourcePlanVersion:"hm-amsterdam-2026-v1",
    importedPlan:true
  },
  "2026-10-07":{
    date:"2026-10-07",
    name:"4 × 2 km @ 3:47–3:50/km",
    uploadName:"Jaco - 4 x 2 km 3:47-3:50",
    type:"Run",
    distanceKm:8,
    distanceLabel:"4 × 2 km",
    rpe:"—",
    status:"planned",
    planType:"quality",
    displaySteps:[
      "4 × 2 km @ 3:47–3:50/km",
      "2 min jog"
    ],
    intervalsDescription:`Kwaliteitstraining.

Main set 4x
- 2km 3:47-3:50/km Pace
- 2m Z1 Pace

De bronplanning vermeldt geen exacte in- of uitloopafstand.`,
    sourcePlan:"HM Amsterdam 2026",
    sourcePlanVersion:"hm-amsterdam-2026-v1",
    importedPlan:true
  },
  "2026-10-08":{
    date:"2026-10-08",
    name:"8–10 km herstel",
    uploadName:"Jaco - 8-10 km herstel",
    type:"Run",
    distanceKm:9,
    distanceLabel:"8–10 km",
    rpe:"—",
    status:"planned",
    planType:"recovery",
    displaySteps:[
      "8–10 km herstel @ 4:50–5:10/km"
    ],
    intervalsDescription:`Herstelloop.

Recovery
- 9km 4:50-5:10/km Pace

Bronplanning: 8-10 km; 9 km is alleen de interne middenwaarde voor volumeberekening.`,
    sourcePlan:"HM Amsterdam 2026",
    sourcePlanVersion:"hm-amsterdam-2026-v1",
    importedPlan:true
  },
  "2026-10-09":{
    date:"2026-10-09",
    name:"Rust óf 6 km zeer rustig",
    uploadName:"Jaco - Rust of 6 km zeer rustig",
    type:"Rest",
    distanceKm:0,
    distanceLabel:"Rust óf 6 km",
    rpe:"—",
    status:"planned",
    planType:"rest",
    displaySteps:[
      "Rust",
      "Alternatief: 6 km zeer rustig"
    ],
    intervalsDescription:"",
    sourcePlan:"HM Amsterdam 2026",
    sourcePlanVersion:"hm-amsterdam-2026-v1",
    importedPlan:true
  },
  "2026-10-10":{
    date:"2026-10-10",
    name:"HM-test · 2 × 5 km",
    uploadName:"Jaco - HM test 2 x 5 km",
    type:"Run",
    distanceKm:16,
    distanceLabel:"±16 km",
    rpe:"—",
    status:"planned",
    planType:"quality",
    displaySteps:[
      "Inlopen",
      "5 km @ 3:52–3:54/km",
      "1 km @ ±4:25/km",
      "5 km @ 3:52–3:54/km",
      "Uitlopen tot totaal ±16 km",
      "Generale repetitie: niet sneller dan 3:52/km",
      "Doel: tweede blok gecontroleerd zonder duidelijke terugval"
    ],
    intervalsDescription:`HM-test / generale repetitie.

Warmup
- Z1 Pace

Main set
- 5km 3:52-3:54/km Pace
- 1km 4:25/km Pace
- 5km 3:52-3:54/km Pace

Cooldown
- Z1 Pace

Totaal volgens bronplanning circa 16 km. Niet sneller dan 3:52/km.`,
    sourcePlan:"HM Amsterdam 2026",
    sourcePlanVersion:"hm-amsterdam-2026-v1",
    importedPlan:true
  },
  "2026-10-11":{
    date:"2026-10-11",
    name:"12–14 km zeer rustig",
    uploadName:"Jaco - 12-14 km zeer rustig",
    type:"Run",
    distanceKm:13,
    distanceLabel:"12–14 km",
    rpe:"—",
    status:"planned",
    planType:"recovery",
    displaySteps:[
      "12–14 km zeer rustig"
    ],
    intervalsDescription:`Zeer rustige duurloop.

Recovery
- 13km Z1-Z2 Pace

Bronplanning: 12-14 km; 13 km is alleen de interne middenwaarde voor volumeberekening.`,
    sourcePlan:"HM Amsterdam 2026",
    sourcePlanVersion:"hm-amsterdam-2026-v1",
    importedPlan:true
  }
};

function installHmAmsterdamBlock2026(){
  if(localStorage.getItem(HM_AMSTERDAM_BLOCK_KEY)==="1"){
    return;
  }

  const backup={};

  Object.entries(HM_AMSTERDAM_BLOCK_2026).forEach(([date,workout])=>{
    if(customWorkouts[date]){
      backup[date]=clone(customWorkouts[date]);
    }
    customWorkouts[date]=clone(workout);
  });

  if(Object.keys(backup).length){
    saveObject(HM_AMSTERDAM_BACKUP_KEY,backup);
  }

  saveObject(STORAGE_KEY,customWorkouts);
  localStorage.setItem(HM_AMSTERDAM_BLOCK_KEY,"1");
}


const HM_AMSTERDAM_RACEWEEK_2026={
  "2026-10-12":{
    date:"2026-10-12",
    name:"Rust",
    uploadName:"Jaco - Rust",
    type:"Rest",
    distanceKm:0,
    distanceLabel:"Rust",
    rpe:"—",
    status:"planned",
    planType:"rest",
    displaySteps:["Rust"],
    intervalsDescription:"",
    sourcePlan:"HM Amsterdam 2026 · raceweek",
    sourcePlanVersion:"hm-amsterdam-raceweek-2026-v1",
    importedPlan:true
  },
  "2026-10-13":{
    date:"2026-10-13",
    name:"8 km easy + strides",
    uploadName:"Jaco - 8 km easy + 4 x 20 sec strides",
    type:"Run",
    distanceKm:8,
    distanceLabel:"8 km + strides",
    rpe:"—",
    status:"planned",
    planType:"easy",
    displaySteps:[
      "8 km easy",
      "4 × 20 sec strides"
    ],
    intervalsDescription:`Raceweek easy run met strides.

Easy
- 8km Z2 Pace

Strides 4x
- 20s Fast Pace
- 60s Z1 Pace`,
    sourcePlan:"HM Amsterdam 2026 · raceweek",
    sourcePlanVersion:"hm-amsterdam-raceweek-2026-v1",
    importedPlan:true
  },
  "2026-10-14":{
    date:"2026-10-14",
    name:"3 × 1,5 km @ 3:50–3:53/km",
    uploadName:"Jaco - 3 x 1.5 km 3:50-3:53",
    type:"Run",
    distanceKm:8,
    distanceLabel:"3 × 1,5 km + jog",
    rpe:"—",
    status:"planned",
    planType:"quality",
    displaySteps:[
      "3 × 1,5 km @ 3:50–3:53/km",
      "2 min jog tussen de blokken"
    ],
    intervalsDescription:`Raceweek kwaliteitstraining.

Warmup
- Z1 Pace

Main set 3x
- 1.5km 3:50-3:53/km Pace
- 2m Z1 Pace

Cooldown
- Z1 Pace

De bronplanning noemt geen exacte in- en uitloopafstand; 8 km is alleen de interne volumewaarde.`,
    sourcePlan:"HM Amsterdam 2026 · raceweek",
    sourcePlanVersion:"hm-amsterdam-raceweek-2026-v1",
    importedPlan:true
  },
  "2026-10-15":{
    date:"2026-10-15",
    name:"6–8 km zeer rustig",
    uploadName:"Jaco - 6-8 km zeer rustig",
    type:"Run",
    distanceKm:7,
    distanceLabel:"6–8 km",
    rpe:"—",
    status:"planned",
    planType:"recovery",
    displaySteps:[
      "6–8 km zeer rustig"
    ],
    intervalsDescription:`Zeer rustige raceweekloop.

Recovery
- 7km Z1-Z2 Pace

Bronplanning: 6-8 km; 7 km is alleen de interne middenwaarde voor volumeberekening.`,
    sourcePlan:"HM Amsterdam 2026 · raceweek",
    sourcePlanVersion:"hm-amsterdam-raceweek-2026-v1",
    importedPlan:true
  },
  "2026-10-16":{
    date:"2026-10-16",
    name:"Rust",
    uploadName:"Jaco - Rust",
    type:"Rest",
    distanceKm:0,
    distanceLabel:"Rust",
    rpe:"—",
    status:"planned",
    planType:"rest",
    displaySteps:["Rust"],
    intervalsDescription:"",
    sourcePlan:"HM Amsterdam 2026 · raceweek",
    sourcePlanVersion:"hm-amsterdam-raceweek-2026-v1",
    importedPlan:true
  },
  "2026-10-17":{
    date:"2026-10-17",
    name:"4–5 km loslopen + strides",
    uploadName:"Jaco - 4-5 km loslopen + 4 x 15 sec strides",
    type:"Run",
    distanceKm:4.5,
    distanceLabel:"4–5 km + strides",
    rpe:"—",
    status:"planned",
    planType:"easy",
    displaySteps:[
      "4–5 km loslopen",
      "4 × 15 sec strides"
    ],
    intervalsDescription:`Loslopen voor de halve marathon.

Easy
- 4.5km Z1-Z2 Pace

Strides 4x
- 15s Fast Pace
- 60s Z1 Pace

Bronplanning: 4-5 km; 4,5 km is alleen de interne middenwaarde voor volumeberekening.`,
    sourcePlan:"HM Amsterdam 2026 · raceweek",
    sourcePlanVersion:"hm-amsterdam-raceweek-2026-v1",
    importedPlan:true
  },
  "2026-10-18":{
    date:"2026-10-18",
    name:"Halve Marathon Amsterdam",
    uploadName:"Halve Marathon Amsterdam",
    type:"Race",
    distanceKm:21.0975,
    distanceLabel:"Halve marathon",
    rpe:"10/10",
    status:"planned",
    planType:"race",
    displaySteps:[
      "Halve Marathon Amsterdam",
      "Raceweek-doel uit bronplanning: 1:22"
    ],
    intervalsDescription:"",
    sourcePlan:"HM Amsterdam 2026 · raceweek",
    sourcePlanVersion:"hm-amsterdam-raceweek-2026-v1",
    importedPlan:true
  }
};

function installHmAmsterdamRaceweek2026(){
  if(localStorage.getItem(HM_AMSTERDAM_RACEWEEK_KEY)==="1"){
    return;
  }

  const backup={};

  Object.entries(HM_AMSTERDAM_RACEWEEK_2026).forEach(([date,workout])=>{
    if(customWorkouts[date]){
      backup[date]=clone(customWorkouts[date]);
    }
    customWorkouts[date]=clone(workout);
  });

  if(Object.keys(backup).length){
    saveObject(HM_AMSTERDAM_RACEWEEK_BACKUP_KEY,backup);
  }

  saveObject(STORAGE_KEY,customWorkouts);
  localStorage.setItem(HM_AMSTERDAM_RACEWEEK_KEY,"1");
}


function finiteNumberOrNull(value){
  if(value===null || value===undefined || typeof value==="boolean") return null;
  if(typeof value==="string" && value.trim()==="") return null;

  const normalized=
    typeof value==="string"
      ?value.trim().replace(",",".")
      :value;

  const number=Number(normalized);
  return Number.isFinite(number)?number:null;
}

function diaryNumber(value){
  return finiteNumberOrNull(value);
}

function coachDiaryEntries(days=28){
  return Object.entries(coachDiary)
    .map(([date,entry])=>({
      date,
      entry,
      parsed:new Date(date+"T12:00:00")
    }))
    .filter(item=>{
      if(Number.isNaN(item.parsed.getTime())) return false;
      const age=calendarDayDifference(todayDateString(),item.date);
      return age!==null && age>=0 && age<days;
    })
    .sort((a,b)=>b.date.localeCompare(a.date));
}

function diaryAverage(items,key){
  const values=items
    .map(item=>diaryNumber(item.entry?.[key]))
    .filter(value=>value!==null);
  if(!values.length) return null;
  return values.reduce((sum,value)=>sum+value,0)/values.length;
}

function buildDiaryContext(){
  const recent4=coachDiaryEntries(4);
  const latest=recent4[0]?.entry||null;
  const heavyCount=recent4.filter(item=>diaryNumber(item.entry.legs)>=4).length;
  const lowEnergyCount=recent4.filter(item=>diaryNumber(item.entry.energy)<=2).length;
  const complaintCount=recent4.filter(item=>diaryNumber(item.entry.complaintSeverity)>=2).length;
  const severeComplaint=recent4.some(item=>diaryNumber(item.entry.complaintSeverity)>=3);
  const latestLegs=diaryNumber(latest?.legs);
  const latestEnergy=diaryNumber(latest?.energy);
  const latestRpe=diaryNumber(latest?.sessionRpe);

  if(!recent4.length){
    return{
      level:"unknown",
      entries:0,
      reasons:["geen recente dagboekcheck-in"],
      latest:null
    };
  }

  const reasons=[];
  let level="stable";

  if(severeComplaint){
    level="elevated";
    reasons.push("sterke klacht gemeld");
  }

  if(latestLegs===5 && latestEnergy!==null && latestEnergy<=2){
    level="elevated";
    reasons.push("zeer zware benen én lage energie");
  }

  if(level!=="elevated"){
    if(complaintCount>=1){
      level="attention";
      reasons.push("duidelijke klacht gemeld");
    }
    if(heavyCount>=2){
      level="attention";
      reasons.push(`${heavyCount} recente check-ins met zware benen`);
    }
    if(lowEnergyCount>=2){
      level="attention";
      reasons.push(`${lowEnergyCount} recente check-ins met lage energie`);
    }
    if(latestRpe!==null && latestRpe>=9 && latestLegs!==null && latestLegs>=4){
      level="attention";
      reasons.push("zeer zware sessie gecombineerd met zware benen");
    }
  }

  if(level==="stable"){
    reasons.push("geen terugkerend subjectief belastingssignaal");
  }

  return{
    level,
    entries:recent4.length,
    reasons,
    latest,
    heavyCount,
    lowEnergyCount,
    complaintCount
  };
}

function diaryStatusLabel(level){
  const labels={
    stable:"Stabiel",
    attention:"Aandacht",
    elevated:"Verhoogd",
    unknown:"Geen recente data"
  };
  return labels[level]||level;
}

function diaryWorkoutForDate(date){
  return allWorkouts()[date]||null;
}

function diaryPlanComparison(entry){
  if(!entry) return "";
  const actualDistance=diaryNumber(entry.actualDistanceKm);
  const plannedDistance=diaryNumber(entry.plannedDistanceKm);
  if(actualDistance!==null && plannedDistance!==null && plannedDistance>0){
    const diff=Math.round((actualDistance-plannedDistance)*10)/10;
    if(Math.abs(diff)<0.1) return "afstand volgens plan";
    return `${diff>0?"+":""}${diff} km t.o.v. plan`;
  }

  const actualDuration=diaryNumber(entry.actualDurationMinutes);
  const plannedDuration=diaryNumber(entry.plannedDurationMinutes);
  if(actualDuration!==null && plannedDuration!==null && plannedDuration>0){
    const diff=Math.round(actualDuration-plannedDuration);
    if(Math.abs(diff)<1) return "duur volgens plan";
    return `${diff>0?"+":""}${diff} min t.o.v. plan`;
  }

  return "";
}

function fillCoachDiaryForm(date){
  const entry=coachDiary[date]||null;
  const workout=diaryWorkoutForDate(date);

  document.getElementById("diaryDate").value=date;
  document.getElementById("diaryRpe").value=String(entry?.sessionRpe??5);
  document.getElementById("diaryLegs").value=String(entry?.legs??3);
  document.getElementById("diaryEnergy").value=String(entry?.energy??3);
  document.getElementById("diaryEnjoyment").value=String(entry?.enjoyment??4);
  document.getElementById("diaryComplaint").value=String(entry?.complaintSeverity??0);
  document.getElementById("diaryActualDistance").value=
    entry?.actualDistanceKm??"";
  document.getElementById("diaryActualDuration").value=
    entry?.actualDurationMinutes??"";
  document.getElementById("diaryComplaintText").value=
    entry?.complaintText||"";
  document.getElementById("diaryNote").value=entry?.note||"";
  if(entry && (entry.actualDistanceKm!=null || entry.actualDurationMinutes!=null ||
      entry.complaintText || entry.note)){
    document.getElementById("diaryExtra").open=true;
  }

  const context=document.getElementById("diaryWorkoutContext");
  if(workout){
    const planned=trainingVolumeLabel(workout);
    const done=workoutState(date,workout)==="done";
    context.innerHTML=
      `<strong>${safe(workout.name)}</strong><br>${safe(planned)} · RPE ${safe(workout.rpe||"—")} · ${done?"voltooid":"nog gepland"}`;
  }else{
    context.textContent="Geen training voor deze datum gevonden. Je kunt de check-in alsnog handmatig bewaren.";
  }

  document.getElementById("deleteDiaryEntry").disabled=!entry;
  document.getElementById("diaryStatus").textContent="";
}

function renderDiaryRecent(entries){
  const box=document.getElementById("diaryRecent");
  if(!box) return;

  if(!entries.length){
    box.innerHTML='<p class="help">Nog geen dagboekgegevens.</p>';
    return;
  }

  box.innerHTML=entries.slice(0,7).map(({date,entry})=>{
    const comparison=diaryPlanComparison(entry);
    const complaint=diaryNumber(entry.complaintSeverity)||0;
    const note=entry.note||entry.complaintText||"";
    return `
      <button type="button" class="diary-entry-row" onclick="openDiaryForDate('${date}')">
        <div class="diary-entry-top">
          <div>
            <strong>${safe(entry.workoutName||date)}</strong>
            <small>${safe(date)}${comparison?` · ${safe(comparison)}`:""}</small>
          </div>
          <span class="pill">RPE ${safe(entry.sessionRpe??"—")}</span>
        </div>
        <div class="diary-entry-tags">
          <span class="pill">benen ${safe(entry.legs??"—")}/5</span>
          <span class="pill">energie ${safe(entry.energy??"—")}/5</span>
          <span class="pill">plezier ${safe(entry.enjoyment??"—")}/5</span>
          ${complaint?`<span class="pill">klacht ${complaint}/3</span>`:""}
        </div>
        ${note?`<div class="diary-entry-note">${safe(note)}</div>`:""}
      </button>`;
  }).join("");
}

function renderCoachDiary(date=todayDateString()){
  if(typeof renderSupportHistory==="function") renderSupportHistory();
  const seven=coachDiaryEntries(7);
  const twentyEight=coachDiaryEntries(28);
  const context=buildDiaryContext();

  fillCoachDiaryForm(date);

  document.getElementById("diary7Count").textContent=String(seven.length);

  const avgRpe=diaryAverage(seven,"sessionRpe");
  document.getElementById("diary7Rpe").textContent=
    avgRpe===null?"—":avgRpe.toFixed(1);

  const heavy=seven.filter(item=>diaryNumber(item.entry.legs)>=4).length;
  document.getElementById("diary7Heavy").textContent=String(heavy);

  const avgEnjoyment=diaryAverage(twentyEight,"enjoyment");
  document.getElementById("diary28Enjoyment").textContent=
    avgEnjoyment===null?"—":`${avgEnjoyment.toFixed(1)}/5`;

  const headline=document.getElementById("diaryCoachHeadline");
  const conclusion=document.getElementById("diaryCoachConclusion");

  if(context.level==="unknown"){
    headline.textContent="Nog geen recente check-in";
    conclusion.textContent=
      "Vul na een training je korte check-in in. Ontbrekende feedback wordt niet als neutraal of positief geïnterpreteerd.";
  }else{
    headline.innerHTML=
      `<span class="diary-status-dot ${context.level}"></span>${diaryStatusLabel(context.level)}`;
    conclusion.textContent=
      context.reasons.join(". ")+". De coach gebruikt dit als subjectieve trainingsinput naast je objectieve hersteldata.";
  }

  renderDiaryRecent(twentyEight);
}

function saveCoachDiary(event){
  event.preventDefault();
  const date=document.getElementById("diaryDate").value;
  if(!date) return;

  const workout=diaryWorkoutForDate(date);
  const actualDistanceRaw=document.getElementById("diaryActualDistance").value;
  const actualDurationRaw=document.getElementById("diaryActualDuration").value;

  coachDiary[date]={
    date,
    workoutName:workout?.name||"",
    workoutType:workout?.type||"",
    plannedDistanceKm:
      Number(workout?.distanceKm)>0?Number(workout.distanceKm):null,
    plannedDurationMinutes:
      Number(workout?.durationMinutes)>0?Number(workout.durationMinutes):null,
    actualDistanceKm:
      actualDistanceRaw===""?null:Number(actualDistanceRaw),
    actualDurationMinutes:
      actualDurationRaw===""?null:Number(actualDurationRaw),
    sessionRpe:Number(document.getElementById("diaryRpe").value),
    legs:Number(document.getElementById("diaryLegs").value),
    energy:Number(document.getElementById("diaryEnergy").value),
    enjoyment:Number(document.getElementById("diaryEnjoyment").value),
    complaintSeverity:Number(document.getElementById("diaryComplaint").value),
    complaintText:safe(document.getElementById("diaryComplaintText").value).trim(),
    note:safe(document.getElementById("diaryNote").value).trim(),
    savedAt:new Date().toISOString()
  };

  saveObject(DIARY_KEY,coachDiary);
  renderCoachDiary(date);
  resetGeneratedPlannerPreviews();
  renderFullSeasonSchedulePreview();
  refreshDerivedCoachViews();

  const status=document.getElementById("diaryStatus");
  status.className="status ok";
  status.textContent="Check-in opgeslagen en meegenomen in je coachadvies.";
}

function deleteCoachDiaryEntry(){
  const date=document.getElementById("diaryDate").value;
  if(!date || !coachDiary[date]) return;
  if(!confirm(`Check-in van ${date} verwijderen?`)) return;

  delete coachDiary[date];
  saveObject(DIARY_KEY,coachDiary);
  renderCoachDiary(date);
  resetGeneratedPlannerPreviews();
  renderFullSeasonSchedulePreview();
  refreshDerivedCoachViews();

  const status=document.getElementById("diaryStatus");
  status.className="status ok";
  status.textContent="Check-in verwijderd.";
}

function openDiaryForDate(date=todayDateString()){
  switchView("today");
  renderCoachDiary(date);
  setTimeout(()=>{
    document.getElementById("coachDiaryCard")?.scrollIntoView({
      behavior:"smooth",
      block:"start"
    });
  },50);
}

let pendingCoachChatWorkout=null;

function coachChatContext(){
  const availability=todayAvailabilityInfo();
  const snapshot=getWellnessSnapshot();
  const readiness=determineReadiness(snapshot);
  const race=getRaceFocus();
  const seasonBlock=seasonBlockForDate(todayDateString());
  const phase=seasonPhaseToLegacyPhase(seasonBlock,race);
  const profileData=getProfile();
  const existing=currentTodayWorkout();
  const loadMonitor=buildLoadMonitor();
  const diary=buildDiaryContext();

  return{
    availability,
    snapshot,
    readiness,
    race,
    phase,
    seasonBlock,
    profile:profileData,
    existing,
    loadMonitor,
    diary
  };
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

  if(context.existing?.type==="Race"){
    response=pain
      ?"Vandaag staat je wedstrijd gepland. Omdat je pijn noemt, maak ik geen vervangende training of intensiteitsadvies. Beoordeel eerst of starten verantwoord is en laat duidelijke of aanhoudende klachten zo nodig professioneel beoordelen."
      :"Vandaag is wedstrijddag. Coach Chat verandert je wedstrijd niet automatisch. Gebruik de chat alleen voor uitvoering, planning en hoe je je voelt; de wedstrijd blijft in de kalender staan.";
    return{response,workout:null};
  }

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
    if(context.diary.level==="elevated"){
      response="Je voelt je vandaag goed, maar je recente dagboekfeedback bevat een verhoogd subjectief belastingssignaal. Ik zou daarom niet automatisch extra intensiteit toevoegen.";
      workout=createGeneratorWorkout("easy",context);
      return{response,workout};
    }

    if(context.loadMonitor.level==="elevated"){
      response="Je gevoel is positief, maar de belastbaarheidsmonitor geeft een verhoogd trainingssignaal. Ik zou vandaag geen extra zware prikkel toevoegen en de belasting eerst laten stabiliseren.";
      workout=createGeneratorWorkout("easy",context);
      return{response,workout};
    }

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

  const diaryText=context.diary.level==="unknown"
    ?"geen recente dagboekfeedback"
    :`dagboekstatus ${diaryStatusLabel(context.diary.level)}`;

  response=`Ik combineer je bericht met ${recoveryText}, ${diaryText}${context.race?`, ${context.race.name} over ${context.phase.days} dagen`:""} en je huidige beschikbaarheid. Voor een concrete wijziging kun je aangeven hoeveel tijd je hebt, hoe je benen voelen of welke training je wilt verplaatsen.`;
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
  const existing=currentTodayWorkout();

  if(existing?.type==="Race"){
    status.className="status error";
    status.textContent="Coach Chat vervangt een wedstrijd niet automatisch.";
    return;
  }

  if(existing){
    const confirmed=confirm(`De bestaande training "${existing.name}" vervangen door "${pendingCoachChatWorkout.name}"?`);
    if(!confirmed) return;
  }

  const saved=JSON.parse(JSON.stringify(pendingCoachChatWorkout));
  saved.date=date;
  saved.status="planned";
  if(existing){
    clearWorkoutMarkersForDate(date);
  }

  customWorkouts[date]=saved;
  saveObject(STORAGE_KEY,customWorkouts);
  saveObject(DONE_KEY,doneWorkouts);
  saveObject(UPLOAD_KEY,uploadedWorkouts);

  refreshAfterCalendarMutation();

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

function isRunLikeWorkout(workout){
  return ["Run","Race"].includes(String(workout?.type||""));
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
  const weekRaces=racesInRange(start,end);
  const seasonBlock=seasonBlockForWeek(start);

  const existing=Object.entries(customWorkouts)
    .filter(([date])=>date>=start && date<=end)
    .map(([date,workout])=>({...JSON.parse(JSON.stringify(workout)),date}));

  return{
    profile:profileData,
    availability,
    readiness,
    race,
    phase:seasonPhaseToLegacyPhase(seasonBlock,race),
    start,
    end,
    existing,
    weekRaces,
    seasonBlock
  };
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
  return Math.abs(signedDateGapDays(a,b));
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


  (context.weekRaces||[]).forEach(race=>{
    sorted.forEach(workout=>{
      const delta=signedDateGapDays(workout.date,race.date);
      const priority=String(race.priority||"C").toUpperCase();

      if(delta===0){
        warnings.push({
          state:"warn",icon:"!",
          text:`${workout.name} staat op dezelfde datum als ${race.name}; de wedstrijddag moet vrij blijven van een gewone training.`
        });
      }

      if(
        delta<0 &&
        Math.abs(delta)<=(priority==="A"?2:priority==="B"?1:0) &&
        (isHardWorkout(workout)||isLongWorkout(workout))
      ){
        warnings.push({
          state:"warn",icon:"!",
          text:`${workout.name} staat te dicht voor ${priority}-wedstrijd ${race.name}.`
        });
      }

      if(
        delta>0 &&
        delta<=raceRecoveryDays(race) &&
        (isHardWorkout(workout)||isLongWorkout(workout))
      ){
        warnings.push({
          state:"warn",icon:"!",
          text:`${workout.name} valt binnen het herstelvenster na ${race.name}.`
        });
      }
    });
  });

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

  return applyRaceCalendarToWeek(
    context,
    scheduled.sort((a,b)=>a.date.localeCompare(b.date))
  );
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
    if(allWorkouts()[workout.date]){
      skipped++;
      continue;
    }

    customWorkouts[workout.date]=JSON.parse(JSON.stringify(workout));
    added++;
  }

  saveObject(STORAGE_KEY,customWorkouts);
  refreshAfterCalendarMutation();

  status.className="status ok";
  status.textContent=`${added} trainingen toegepast${skipped?` · ${skipped} bestaande dagen behouden`:""}.`;
}

let latestWellnessRecords=[];
let pendingTodayAdvice = null;

const today = new Date();
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = ymd(today);
let duplicateSourceDate = null;

const fullDate = new Intl.DateTimeFormat("nl-NL",{
  weekday:"long",day:"numeric",month:"long",year:"numeric"
});
const monthFmt = new Intl.DateTimeFormat("nl-NL",{month:"long",year:"numeric"});

function loadObject(key){
  try{
    const raw=localStorage.getItem(key);
    if(!raw) return {};

    const parsed=JSON.parse(raw);
    if(isPlainBackupObject(parsed)) return parsed;

    console.warn(`Lokale opslag voor ${key} had geen geldig object en is genegeerd.`);
    return {};
  }catch(error){
    console.warn(`Lokale opslag voor ${key} kon niet worden gelezen:`,error);
    return {};
  }
}
function saveObject(key,value){
  localStorage.setItem(key,JSON.stringify(value));
}


function readSessionAppPin(){
  try{
    return sessionStorage.getItem(SESSION_PIN_KEY) || "";
  }catch{
    return "";
  }
}

function rememberSessionAppPin(pin){
  try{
    if(pin) sessionStorage.setItem(SESSION_PIN_KEY,String(pin));
  }catch{
    // De app blijft bruikbaar als sessionStorage niet beschikbaar is.
  }
}

function clearSessionAppPin(){
  try{
    sessionStorage.removeItem(SESSION_PIN_KEY);
  }catch{
    // Geen actie nodig.
  }
}

function promptForAppPin(message="Voer je Jaco Performance app-pincode in:"){
  const pin=prompt(message);
  if(pin===null) return null;
  const value=String(pin).trim();
  return value || null;
}

async function fetchWithAppPin(url,options={}){
  let pin=readSessionAppPin();

  if(!pin){
    pin=promptForAppPin();
    if(!pin){
      throw new Error("App-pincode is nodig om Intervals.icu-data te openen.");
    }
  }

  const send=currentPin=>fetch(url,{
    ...options,
    headers:{
      ...(options.headers||{}),
      "X-Jaco-Pin":currentPin
    }
  });

  let response=await send(pin);

  if(response.status===401){
    clearSessionAppPin();

    const retryPin=promptForAppPin("Onjuiste pincode. Probeer opnieuw:");
    if(!retryPin) return response;

    response=await send(retryPin);

    if(response.ok){
      rememberSessionAppPin(retryPin);
    }else if(response.status===401){
      clearSessionAppPin();
    }

    return response;
  }

  if(response.ok){
    rememberSessionAppPin(pin);
  }

  return response;
}


function isPlainBackupObject(value){
  return Boolean(
    value &&
    typeof value==="object" &&
    !Array.isArray(value)
  );
}

function managedLocalStorageKeys(){
  const keys=[];
  for(let index=0;index<localStorage.length;index++){
    const key=localStorage.key(index);
    if(
      key &&
      key.startsWith("jp_") &&
      key!==PREIMPORT_BACKUP_KEY
    ){
      keys.push(key);
    }
  }
  return keys.sort();
}

function buildLocalBackupPayload(){
  const data={};

  managedLocalStorageKeys().forEach(key=>{
    const value=localStorage.getItem(key);
    if(value!==null){
      data[key]=value;
    }
  });

  return{
    format:BACKUP_FORMAT,
    schemaVersion:BACKUP_SCHEMA_VERSION,
    appVersion:APP_VERSION,
    createdAt:new Date().toISOString(),
    data
  };
}

function backupParsedValue(payload,key){
  const raw=payload?.data?.[key];
  if(typeof raw!=="string") return null;
  try{
    return JSON.parse(raw);
  }catch{
    return null;
  }
}

function backupObjectCount(payload,key){
  const value=backupParsedValue(payload,key);
  return isPlainBackupObject(value)
    ?Object.keys(value).length
    :0;
}

function backupPayloadSummary(payload){
  const profileValue=backupParsedValue(payload,PROFILE_KEY);
  return{
    workouts:backupObjectCount(payload,STORAGE_KEY),
    races:backupObjectCount(payload,RACES_KEY),
    diary:backupObjectCount(payload,DIARY_KEY),
    done:backupObjectCount(payload,DONE_KEY),
    uploaded:backupObjectCount(payload,UPLOAD_KEY),
    profile:isPlainBackupObject(profileValue)
  };
}

function validateDateKeyedBackupObject(value,label,{requireWorkoutObject=false}={}){
  for(const [date,item] of Object.entries(value)){
    if(calendarDayNumber(date)===null){
      throw new Error(`${label} bevat een ongeldige datum: ${date}.`);
    }

    if(requireWorkoutObject){
      if(!isPlainBackupObject(item)){
        throw new Error(`${label} bevat een ongeldige training op ${date}.`);
      }

      if(item.date && item.date!==date){
        throw new Error(`${label} bevat een training met een afwijkende datum op ${date}.`);
      }
    }
  }
}

function validateRaceBackupObject(value){
  const raceDates=new Map();

  for(const [id,race] of Object.entries(value)){
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(id)){
      throw new Error("De backup bevat een ongeldige wedstrijd-ID.");
    }

    if(!isPlainBackupObject(race)){
      throw new Error(`Wedstrijd ${id} heeft geen geldige gegevens.`);
    }

    if(race.id && String(race.id)!==id){
      throw new Error(`Wedstrijd ${id} heeft een afwijkende interne ID.`);
    }

    const date=String(race.date||"");
    if(calendarDayNumber(date)===null){
      throw new Error(`Wedstrijd ${id} heeft een ongeldige datum.`);
    }

    if(raceDates.has(date)){
      throw new Error(
        `De backup bevat meerdere wedstrijden op ${date}. Jaco Performance bewaart één hoofdwedstrijd per dag.`
      );
    }
    raceDates.set(date,id);

    const distance=finiteNumberOrNull(race.distanceKm);
    if(distance===null || distance<=0 || distance>1000){
      throw new Error(`Wedstrijd ${id} heeft een ongeldige afstand.`);
    }

    if(!["A","B","C"].includes(String(race.priority||"C").toUpperCase())){
      throw new Error(`Wedstrijd ${id} heeft een ongeldige prioriteit.`);
    }
  }
}

function validateKnownBackupContents(key,value){
  if(["jp_support_settings_v1","jp_support_done_v1","jp_support_skip_v1","jp_support_upload_v1"].includes(key)){
    validateSupportBackup(key,value);
    return;
  }
  if(key===STORAGE_KEY){
    validateDateKeyedBackupObject(value,"Trainingen",{requireWorkoutObject:true});
    return;
  }

  if([
    DONE_KEY,
    UPLOAD_KEY,
    DIARY_KEY
  ].includes(key)){
    validateDateKeyedBackupObject(value,key);
    return;
  }

  if([
    HM_AMSTERDAM_BACKUP_KEY,
    HM_AMSTERDAM_RACEWEEK_BACKUP_KEY
  ].includes(key)){
    validateDateKeyedBackupObject(value,key,{requireWorkoutObject:true});
    return;
  }

  if(key===RACES_KEY){
    validateRaceBackupObject(value);
    return;
  }

  if(key==="jp_race_simulations_v1"){
    for(const raceId of Object.keys(value)){
      if(!/^[A-Za-z0-9_-]{1,100}$/.test(raceId)){
        throw new Error("De backup bevat een ongeldige simulatie-ID.");
      }
    }
  }
}

function validateBackupPayload(input){
  if(!isPlainBackupObject(input)){
    throw new Error("Dit bestand bevat geen geldige Jaco Performance-backup.");
  }

  if(input.format!==BACKUP_FORMAT){
    throw new Error("Dit is geen Jaco Performance-backupbestand.");
  }

  if(Number(input.schemaVersion)!==BACKUP_SCHEMA_VERSION){
    if(Number(input.schemaVersion)>BACKUP_SCHEMA_VERSION){
      throw new Error("Deze backup is gemaakt met een nieuwere backupversie.");
    }
    throw new Error("Deze backupversie wordt niet ondersteund.");
  }

  if(!isPlainBackupObject(input.data)){
    throw new Error("De backup bevat geen geldige data-sectie.");
  }

  const entries=Object.entries(input.data);
  if(entries.length>100){
    throw new Error("De backup bevat onverwacht veel datasleutels.");
  }

  let totalCharacters=0;
  const cleanData={};

  for(const [key,value] of entries){
    if(
      !key.startsWith("jp_") ||
      key===PREIMPORT_BACKUP_KEY
    ){
      throw new Error("De backup bevat een niet-toegestane datasleutel.");
    }

    if(typeof value!=="string"){
      throw new Error("De backup bevat een ongeldige gegevenswaarde.");
    }

    const objectValuedKeys=new Set([
      STORAGE_KEY,
      DONE_KEY,
      UPLOAD_KEY,
      RACES_KEY,
      PROFILE_KEY,
      DIARY_KEY,
      HM_AMSTERDAM_BACKUP_KEY,
      HM_AMSTERDAM_RACEWEEK_BACKUP_KEY,
      "jp_race_simulations_v1",
      "jp_support_settings_v1",
      "jp_support_done_v1",
      "jp_support_skip_v1",
      "jp_support_upload_v1"
    ]);

    if(objectValuedKeys.has(key)){
      let parsedValue;
      try{
        parsedValue=JSON.parse(value);
      }catch{
        throw new Error(`De backup bevat ongeldige JSON voor ${key}.`);
      }

      if(!isPlainBackupObject(parsedValue)){
        throw new Error(`De backup bevat een ongeldig object voor ${key}.`);
      }

      validateKnownBackupContents(key,parsedValue);
    }

    totalCharacters+=value.length;
    if(totalCharacters>5_000_000){
      throw new Error("De backup is te groot om veilig te importeren.");
    }

    cleanData[key]=value;
  }

  return{
    format:BACKUP_FORMAT,
    schemaVersion:BACKUP_SCHEMA_VERSION,
    appVersion:safe(input.appVersion||"onbekend"),
    createdAt:input.createdAt||null,
    data:cleanData
  };
}

function formatBackupTimestamp(value){
  if(!value) return "datum onbekend";
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return "datum onbekend";

  return new Intl.DateTimeFormat("nl-NL",{
    day:"2-digit",
    month:"2-digit",
    year:"numeric",
    hour:"2-digit",
    minute:"2-digit"
  }).format(date);
}

function currentBackupSummary(){
  return backupPayloadSummary(buildLocalBackupPayload());
}

function renderBackupManager(){
  const workouts=document.getElementById("backupCurrentWorkouts");
  if(!workouts) return;

  const summary=currentBackupSummary();
  workouts.textContent=String(summary.workouts);
  document.getElementById("backupCurrentRaces").textContent=
    String(summary.races);
  document.getElementById("backupCurrentDiary").textContent=
    String(summary.diary);

  const safetyRaw=localStorage.getItem(PREIMPORT_BACKUP_KEY);
  const restoreButton=document.getElementById("restoreSafetyBackup");
  const safetyState=document.getElementById("backupSafetyState");
  const safetyDate=document.getElementById("backupSafetyDate");

  if(safetyRaw){
    try{
      const safety=validateBackupPayload(JSON.parse(safetyRaw));
      safetyState.textContent="Beschikbaar";
      safetyDate.textContent=formatBackupTimestamp(safety.createdAt);
      restoreButton.disabled=false;
    }catch{
      safetyState.textContent="Ongeldig";
      safetyDate.textContent="kan niet worden hersteld";
      restoreButton.disabled=true;
    }
  }else{
    safetyState.textContent="Geen";
    safetyDate.textContent="nog niet gemaakt";
    restoreButton.disabled=true;
  }
}

function triggerBackupDownload(fileName,jsonText){
  const blob=new Blob([jsonText],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=url;
  anchor.download=fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function exportLocalBackup(){
  const status=document.getElementById("backupStatus");

  status.className="status";
  status.textContent="Backup wordt voorbereid…";

  try{
    const payload=buildLocalBackupPayload();
    const jsonText=JSON.stringify(payload,null,2);
    const fileName=`jaco-performance-backup-${ymd(new Date())}.json`;
    if(
      typeof File!=="undefined" &&
      navigator.share &&
      navigator.canShare
    ){
      const file=new File(
        [jsonText],
        fileName,
        {type:"application/json"}
      );

      if(navigator.canShare({files:[file]})){
        try{
          await navigator.share({
            title:"Jaco Performance backup",
            text:"Backup van mijn Jaco Performance-data.",
            files:[file]
          });

          status.className="status ok";
          status.textContent=
            "Backup gedeeld. Kies op iPhone bijvoorbeeld ‘Bewaar in Bestanden’ om hem lokaal te bewaren.";
          return;
        }catch(error){
          if(error?.name==="AbortError"){
            status.className="status";
            status.textContent="Delen van de backup geannuleerd.";
            return;
          }
          console.warn("Web Share mislukt, download wordt gebruikt:",error);
        }
      }
    }

    triggerBackupDownload(fileName,jsonText);
    status.className="status ok";
    status.textContent="Backupbestand aangemaakt.";
  }catch(error){
    status.className="status error";
    status.textContent=`Backup maken mislukt: ${error.message}`;
  }
}

function renderPendingBackupImport(){
  const panel=document.getElementById("backupImportPanel");
  if(!panel) return;

  if(!pendingBackupImport){
    panel.hidden=true;
    document.getElementById("applyBackupImport").disabled=true;
    return;
  }

  const {payload,fileName,fileSize}=pendingBackupImport;
  const summary=backupPayloadSummary(payload);

  panel.hidden=false;
  document.getElementById("backupImportName").textContent=
    fileName||"Backupbestand";
  document.getElementById("backupImportMeta").textContent=
    `Backup ${formatBackupTimestamp(payload.createdAt)} · app ${payload.appVersion} · ${Math.max(1,Math.round(fileSize/1024))} KB`;

  document.getElementById("backupImportWorkouts").textContent=
    String(summary.workouts);
  document.getElementById("backupImportRaces").textContent=
    String(summary.races);
  document.getElementById("backupImportDiary").textContent=
    String(summary.diary);
  document.getElementById("backupImportDone").textContent=
    String(summary.done);
  document.getElementById("backupImportUploaded").textContent=
    String(summary.uploaded);
  document.getElementById("backupImportProfile").textContent=
    summary.profile?"Ja":"Nee";

  document.getElementById("applyBackupImport").disabled=false;
  updateBackupImportModeHelp();
}

function updateBackupImportModeHelp(){
  const help=document.getElementById("backupImportModeHelp");
  if(!help) return;

  const mode=document.getElementById("backupImportMode").value;
  help.textContent=
    mode==="replace"
      ?"Alle huidige Jaco Performance-data op dit toestel wordt vervangen door de backup. Er wordt eerst automatisch een herstelpunt gemaakt."
      :"Bestaande en geïmporteerde gegevens worden gecombineerd. Bij dezelfde sleutel wint het backupbestand. Er wordt eerst automatisch een herstelpunt gemaakt.";
}

async function handleBackupFileSelection(event){
  const status=document.getElementById("backupStatus");
  const file=event.target.files?.[0];

  pendingBackupImport=null;
  renderPendingBackupImport();

  if(!file) return;

  if(file.size>5_000_000){
    status.className="status error";
    status.textContent="Dit backupbestand is groter dan 5 MB en wordt niet geïmporteerd.";
    event.target.value="";
    return;
  }

  try{
    const text=await file.text();
    const parsed=JSON.parse(text);
    const payload=validateBackupPayload(parsed);

    pendingBackupImport={
      payload,
      fileName:file.name,
      fileSize:file.size
    };

    renderPendingBackupImport();
    status.className="status ok";
    status.textContent=
      "Backup gecontroleerd. Bekijk de preview en kies daarna de importmethode.";
  }catch(error){
    status.className="status error";
    status.textContent=`Backup kan niet worden gelezen: ${error.message}`;
    event.target.value="";
  }
}

function cancelBackupImport(){
  pendingBackupImport=null;
  const input=document.getElementById("backupFileInput");
  if(input) input.value="";
  renderPendingBackupImport();

  const status=document.getElementById("backupStatus");
  status.className="status";
  status.textContent="Import geannuleerd.";
}

function mergedBackupStorageValue(currentRaw,incomingRaw){
  if(currentRaw===null) return incomingRaw;

  try{
    const current=JSON.parse(currentRaw);
    const incoming=JSON.parse(incomingRaw);

    if(
      isPlainBackupObject(current) &&
      isPlainBackupObject(incoming)
    ){
      return JSON.stringify({
        ...current,
        ...incoming
      });
    }
  }catch{
    // Bij niet-objectwaarden wint de backup.
  }

  return incomingRaw;
}

function removeManagedLocalStorageData(){
  const keys=[];
  for(let index=0;index<localStorage.length;index++){
    const key=localStorage.key(index);
    if(
      key &&
      key.startsWith("jp_") &&
      key!==PREIMPORT_BACKUP_KEY
    ){
      keys.push(key);
    }
  }

  keys.forEach(key=>localStorage.removeItem(key));
}

function prospectiveBackupStorage(payload,mode="merge"){
  const values={};

  if(mode==="merge"){
    managedLocalStorageKeys().forEach(key=>{
      const current=localStorage.getItem(key);
      if(current!==null) values[key]=current;
    });
  }

  Object.entries(payload.data).forEach(([key,incomingRaw])=>{
    values[key]=
      mode==="merge"
        ?mergedBackupStorageValue(values[key]??null,incomingRaw)
        :incomingRaw;
  });

  return values;
}

function parsedBackupStorageObject(values,key){
  const raw=values[key];
  if(raw===undefined) return {};

  try{
    const parsed=JSON.parse(raw);
    if(isPlainBackupObject(parsed)) return parsed;
  }catch{
    // Onderstaande fout geeft de gebruiker een duidelijke importsituatie.
  }

  throw new Error(`De samengevoegde data voor ${key} is ongeldig.`);
}

function validateProspectiveBackupCalendar(values){
  const workoutData=parsedBackupStorageObject(values,STORAGE_KEY);
  const raceData=parsedBackupStorageObject(values,RACES_KEY);

  validateDateKeyedBackupObject(
    workoutData,
    "Samengevoegde trainingen",
    {requireWorkoutObject:true}
  );
  validateRaceBackupObject(raceData);

  const racesByDate=new Map(
    Object.values(raceData).map(race=>[String(race.date),race])
  );

  for(const [date,workout] of Object.entries(workoutData)){
    const race=racesByDate.get(date);
    if(!race) continue;

    const allowedImportedRaceFallback=
      workout?.type==="Race" &&
      workout?.importedPlan;

    if(!allowedImportedRaceFallback){
      throw new Error(
        `Backupconflict op ${date}: wedstrijd "${race.name||"Wedstrijd"}" en training "${workout.name||"Training"}" kunnen niet op dezelfde kalenderdag staan.`
      );
    }
  }

  for(const race of Object.values(raceData)){
    const fixed=serverWorkouts[String(race.date)];
    if(fixed){
      throw new Error(
        `Backupconflict op ${race.date}: wedstrijd "${race.name||"Wedstrijd"}" botst met vaste training "${fixed.name}".`
      );
    }
  }
}

function writeBackupData(payload,mode="merge"){
  const prospective=prospectiveBackupStorage(payload,mode);
  validateProspectiveBackupCalendar(prospective);

  if(mode==="replace"){
    removeManagedLocalStorageData();
  }

  Object.entries(payload.data).forEach(([key,incomingRaw])=>{
    const value=
      mode==="merge"
        ?mergedBackupStorageValue(localStorage.getItem(key),incomingRaw)
        :incomingRaw;

    localStorage.setItem(key,value);
  });
}

function restoreManagedDataFromPayload(payload){
  removeManagedLocalStorageData();
  Object.entries(payload.data).forEach(([key,value])=>{
    localStorage.setItem(key,value);
  });
}

function applySelectedBackupImport(){
  const status=document.getElementById("backupStatus");
  if(!pendingBackupImport) return;

  const mode=document.getElementById("backupImportMode").value;
  const summary=backupPayloadSummary(pendingBackupImport.payload);
  const action=mode==="replace"?"volledig vervangen":"veilig samenvoegen";

  const confirmed=confirm(
    `Backup importeren via ‘${action}’?\n\n`+
    `${summary.workouts} trainingen · ${summary.races} wedstrijden · ${summary.diary} dagboekitems.\n\n`+
    "De huidige data wordt eerst automatisch als veiligheidskopie bewaard."
  );

  if(!confirmed) return;

  let safety=null;

  try{
    safety=buildLocalBackupPayload();

    localStorage.setItem(
      PREIMPORT_BACKUP_KEY,
      JSON.stringify(safety)
    );

    writeBackupData(pendingBackupImport.payload,mode);

    status.className="status ok";
    status.textContent=
      "Import gelukt. De app wordt opnieuw geladen met de geïmporteerde gegevens.";

    setTimeout(()=>location.reload(),450);
  }catch(error){
    if(safety){
      try{
        restoreManagedDataFromPayload(safety);
        localStorage.setItem(
          PREIMPORT_BACKUP_KEY,
          JSON.stringify(safety)
        );
      }catch(rollbackError){
        console.error("Rollback na mislukte import faalde:",rollbackError);
      }
    }

    status.className="status error";
    status.textContent=
      `Import mislukt: ${error.message}. De vorige lokale toestand is zo goed mogelijk hersteld.`;
  }
}

function restoreLastSafetyBackup(){
  const status=document.getElementById("backupStatus");
  const raw=localStorage.getItem(PREIMPORT_BACKUP_KEY);

  if(!raw){
    status.className="status error";
    status.textContent="Er is nog geen veiligheidskopie beschikbaar.";
    return;
  }

  let safety;
  try{
    safety=validateBackupPayload(JSON.parse(raw));
  }catch(error){
    status.className="status error";
    status.textContent=`Veiligheidskopie is ongeldig: ${error.message}`;
    return;
  }

  const confirmed=confirm(
    "De app terugzetten naar de toestand van vóór de laatste import?\n\n"+
    "De huidige toestand wordt op zijn beurt als nieuw herstelpunt bewaard."
  );
  if(!confirmed) return;

  const current=buildLocalBackupPayload();

  try{
    restoreManagedDataFromPayload(safety);

    localStorage.setItem(
      PREIMPORT_BACKUP_KEY,
      JSON.stringify(current)
    );

    status.className="status ok";
    status.textContent=
      "Veiligheidskopie hersteld. De app wordt opnieuw geladen.";

    setTimeout(()=>location.reload(),450);
  }catch(error){
    try{
      restoreManagedDataFromPayload(current);
      localStorage.setItem(
        PREIMPORT_BACKUP_KEY,
        JSON.stringify(safety)
      );
    }catch(rollbackError){
      console.error("Rollback na mislukte restore faalde:",rollbackError);
    }

    status.className="status error";
    status.textContent=
      `Herstellen mislukt: ${error.message}. De toestand van vóór de herstelpoging is zo goed mogelijk teruggezet.`;
  }
}



function workoutCompletionIdentity(workout){
  if(!workout) return "";
  if(workout.raceId) return `race:${workout.raceId}`;
  return JSON.stringify([
    String(workout.type||""),
    String(workout.name||""),
    finiteNumberOrNull(workout.distanceKm),
    finiteNumberOrNull(workout.durationMinutes),
    String(workout.sourcePlanVersion||"")
  ]);
}

function completionMarkerMatches(marker,workout){
  if(!marker || !workout) return false;

  // Legacy booleans worden bij startup gemigreerd naar een workoutgebonden marker.
  if(marker===true) return true;
  if(marker===false) return false;

  if(!isPlainBackupObject(marker) || marker.done===false) return false;

  if(marker.identity){
    return marker.identity===workoutCompletionIdentity(workout);
  }

  return String(marker.name||"")===String(workout.name||"") &&
    String(marker.type||"")===String(workout.type||"");
}

function markWorkoutCompleted(date,workout){
  doneWorkouts[date]={
    done:true,
    identity:workoutCompletionIdentity(workout),
    name:String(workout?.name||""),
    type:String(workout?.type||""),
    markedAt:new Date().toISOString()
  };
}

function workoutUploadFingerprint(workout){
  if(!workout) return "";
  return JSON.stringify([
    String(workout.name||""),
    String(workout.type||""),
    finiteNumberOrNull(workout.distanceKm),
    finiteNumberOrNull(workout.durationMinutes),
    String(workout.rpe||""),
    Array.isArray(workout.displaySteps)?workout.displaySteps:[],
    String(workout.intervalsDescription||"")
  ]);
}

function workoutUploadIsCurrent(date,workout){
  const record=uploadedWorkouts[date];
  if(!record || !workout) return false;

  if(record.fingerprint){
    return record.fingerprint===workoutUploadFingerprint(workout);
  }

  // Backwards compatibility voor uploadrecords van vóór 8.3.3.
  return String(record.name||"")===String(workout.name||"");
}


function clearWorkoutMarkersForDate(date){
  delete doneWorkouts[date];
  delete uploadedWorkouts[date];
}

function upgradeCompletionMarkers(){
  let completionChanged=false;
  let uploadChanged=false;
  const workouts=allWorkouts();

  Object.entries(doneWorkouts).forEach(([date,marker])=>{
    const workout=workouts[date]||null;

    if(marker===false || marker===null || !workout){
      delete doneWorkouts[date];
      completionChanged=true;
      return;
    }

    if(marker===true){
      markWorkoutCompleted(date,workout);
      completionChanged=true;
      return;
    }

    if(!completionMarkerMatches(marker,workout)){
      delete doneWorkouts[date];
      completionChanged=true;
    }
  });

  Object.keys(uploadedWorkouts).forEach(date=>{
    const workout=workouts[date]||null;
    if(!workout || !workoutUploadIsCurrent(date,workout)){
      delete uploadedWorkouts[date];
      uploadChanged=true;
    }
  });

  if(completionChanged){
    saveObject(DONE_KEY,doneWorkouts);
  }
  if(uploadChanged){
    saveObject(UPLOAD_KEY,uploadedWorkouts);
  }

  if(completionChanged || uploadChanged){
    renderMonth();
    renderSelected();
  }
}


function allWorkouts(){
  const raceWorkouts = Object.fromEntries(
    Object.values(races).map(race => [
      race.date,
      {
        raceId: race.id,
        name: race.name,
        uploadName: race.name,
        date: race.date,
        type: "Race",
        distanceKm: race.distanceKm,
        priority: race.priority,
        targetTime: race.targetTime || "",
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
function escapeHtmlAttribute(value){
  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}
function ymd(date){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,"0");
  const d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function calendarDayNumber(dateString){
  const match=String(dateString||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!match) return null;

  const year=Number(match[1]);
  const month=Number(match[2]);
  const day=Number(match[3]);

  if(month<1 || month>12 || day<1 || day>31) return null;

  const date=new Date(Date.UTC(year,month-1,day));
  if(
    date.getUTCFullYear()!==year ||
    date.getUTCMonth()!==month-1 ||
    date.getUTCDate()!==day
  ){
    return null;
  }

  return date.getTime()/86400000;
}
function calendarDayDifference(laterDate,earlierDate){
  const later=calendarDayNumber(laterDate);
  const earlier=calendarDayNumber(earlierDate);
  if(later===null || earlier===null) return null;
  return Math.round(later-earlier);
}
function clone(value){
  return JSON.parse(JSON.stringify(value));
}
function switchView(id){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.view===id));
  const target=document.getElementById(id);
  if(!target) return;

  target.classList.add("active");

  if(typeof window.syncMobileNavigation==="function"){
    window.syncMobileNavigation(id);
  }
  if(typeof window.closeAppMenu==="function"){
    window.closeAppMenu();
  }

  if(id==="saved") renderSaved();
  if(id==="races"){
    renderRaces();
    renderRaceOptions();
    renderRaceCalendarOptimizer();
    renderSeasonPlanner();
    renderFullSeasonTargetOptions();
  }
  if(id==="dashboard"){loadWellnessDashboard();renderProfileSummary();}
  if(id==="profile"){
    fillProfileForm();
    renderBackupManager();
  }
}

function workoutState(date,workout){
  if(workoutWasCompleted(date,workout)) return "done";
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
    const isToday=date===todayDateString();
    const isSelected=date===selectedDate;
    const state=workout ? workoutState(date,workout) : "";
    const uploaded=workoutUploadIsCurrent(date,workout) ? "uploaded" : "";

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
  if(typeof renderSupportTraining==="function") renderSupportTraining();
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

  const raceOnDate=Object.values(races).find(
    race=>race.date===selectedDate
  )||null;
  const isCalendarRace=Boolean(raceOnDate) && workout.type==="Race";
  const isCustom=!isCalendarRace && Boolean(customWorkouts[selectedDate]);
  const isServer=!isCalendarRace && !isCustom && Boolean(serverWorkouts[selectedDate]);
  const done=workoutState(selectedDate,workout)==="done";
  const uploaded=workoutUploadIsCurrent(selectedDate,workout);

  card.innerHTML=`
    <p class="label">${fullDate.format(new Date(selectedDate+"T12:00:00"))}</p>
    <div class="workout-title">${safe(workout.name)}</div>

    <div class="meta">
      <span class="sport-badge ${trainingTypeInfo(workout.type).css}">
        <span class="sport-dot"></span>${trainingTypeInfo(workout.type).icon} ${trainingTypeInfo(workout.type).label}
      </span>
      <span class="pill">${trainingVolumeLabel(workout)}</span>
      <span class="pill">RPE ${safe(workout.rpe)}</span>
      <span class="pill">${done?"Voltooid":isCalendarRace?"Wedstrijd":isCustom?"Eigen training":"Schema"}</span>
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

      ${done?`
        <button class="secondary" type="button" onclick="openDiaryForDate('${selectedDate}')">
          ${coachDiary[selectedDate]?"Bekijk coachdagboek":"Vul coachdagboek in"}
        </button>
      `:""}

      <button class="secondary" type="button" onclick="uploadSelected()"
        ${trainingTypeInfo(workout.type).uploadable ? "" : "disabled"}>
        ${trainingTypeInfo(workout.type).uploadable
          ? (uploaded?"Opnieuw naar Intervals":"Zet in Intervals.icu")
          : "Niet exporteerbaar"}
      </button>

      ${isCalendarRace?`
        <button class="secondary wide" type="button" onclick="editRace('${raceOnDate.id}')">
          Bewerk wedstrijd
        </button>
      `:isCustom?`
        <button class="secondary" type="button" onclick="editWorkout('${selectedDate}')">Bewerken</button>
        <button class="secondary" type="button" onclick="openDuplicate('${selectedDate}')">Dupliceren</button>
        <button class="danger wide" type="button" onclick="deleteWorkout('${selectedDate}')">Verwijderen</button>
      `:isServer?`
        <button class="secondary wide" type="button" onclick="copyServerWorkout('${selectedDate}')">
          Maak bewerkbare kopie
        </button>
      `:""}
    </div>

    <p id="uploadStatus" class="status"></p>`;
}

function selectDate(date){
  selectedDate=date;
  renderMonth();
  renderSelected();
}

function toggleDone(){
  const workout=allWorkouts()[selectedDate];
  if(!workout) return;

  const isCurrentlyDone=workoutWasCompleted(selectedDate,workout);
  const isNowDone=!isCurrentlyDone;

  if(isNowDone){
    markWorkoutCompleted(selectedDate,workout);
  }else{
    delete doneWorkouts[selectedDate];
  }

  saveObject(DONE_KEY,doneWorkouts);
  renderMonth();
  renderSelected();
  refreshDerivedCoachViews();

  if(isNowDone){
    openDiaryForDate(selectedDate);
  }
}

async function uploadSelected(){
  const workout=allWorkouts()[selectedDate];
  if(!workout) return;

  if(!trainingTypeInfo(workout.type).uploadable){
    const status=document.getElementById("uploadStatus");
    if(status){
      status.className="status error";
      status.textContent=`Intervals.icu-export is niet beschikbaar voor ${trainingTypeInfo(workout.type).label.toLowerCase()}.`;
    }
    return;
  }

  const status=document.getElementById("uploadStatus");
  if(!status) return;

  const wasUploaded=workoutUploadIsCurrent(selectedDate,workout);
  status.className="status";
  status.textContent=wasUploaded
    ?"Workout wordt bijgewerkt in Intervals.icu…"
    :"Workout wordt verstuurd naar Intervals.icu…";

  try{
    const payload={workoutDate:selectedDate};
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

    const response=await fetchWithAppPin("/api/upload-workout",{
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
      name:workout.name,
      externalId:data.externalId||`jaco-performance-${selectedDate}`,
      eventId:data.eventId??null,
      fingerprint:workoutUploadFingerprint(workout)
    };
    saveObject(UPLOAD_KEY,uploadedWorkouts);

    status.className="status ok";
    status.textContent=wasUploaded
      ?"Workout bijgewerkt in Intervals.icu."
      :"Gelukt: workout staat in Intervals.icu.";
    renderMonth();
  }catch(error){
    status.className="status error";
    status.textContent=error.message;
  }
}

function setDefaultForm(date=todayDateString()){
  clearExactRunMode(false);
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
    clearExactRunMode(false);
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


function normalizedWorkoutText(text){
  return String(text||"")
    .replace(/×/g,"x")
    .replace(/[–—]/g,"-")
    .replace(/,/g,".")
    .replace(/\s+/g," ")
    .trim();
}

function displayPaceRange(a,b){
  return b && b!==a ? `${a}-${b}/km` : `${a}/km`;
}

function paceRangeAverageSeconds(a,b){
  const first=paceToSeconds(a);
  const second=b?paceToSeconds(b):first;
  if(first===null) return null;
  return Math.round((first+(second??first))/2);
}

function estimateDistanceFromSeconds(seconds,paceSeconds){
  if(!seconds || !paceSeconds) return 0;
  return seconds/paceSeconds;
}

function buildExactRunName(blocks){
  const paced=blocks.filter(block=>block.kind==="pace");
  const floats=blocks.filter(block=>block.kind==="float");

  if(paced.length===2 && floats.length===1){
    const a=paced[0];
    const b=paced[1];

    if(
      Math.abs(a.km-b.km)<0.01 &&
      a.pace===b.pace
    ){
      return `2 × ${a.km} km @ ${a.pace} + ${floats[0].km} km float`;
    }
  }

  if(paced.length){
    return `Tempotraining · ${paced.length} blok${paced.length===1?"":"ken"}`;
  }

  return "Multi-block hardlooptraining";
}

function buildExactIntervalsDescription(blocks,notes=[]){
  const lines=[];

  blocks.forEach(block=>{
    if(block.kind==="warmup"){
      lines.push("Warmup",`- ${block.km}km Z1 Pace`,"");
      return;
    }

    if(block.kind==="strides"){
      lines.push(
        `Strides ${block.repeats}x`,
        `- ${block.seconds}s ${block.stridePace} Pace`,
        `- ${block.recoverySeconds}s Z1 Pace`,
        ""
      );
      return;
    }

    if(block.kind==="pace" || block.kind==="float"){
      lines.push(
        block.kind==="float" ? "Float" : "Tempo",
        `- ${block.km}km ${block.pace} Pace`,
        ""
      );
      return;
    }

    if(block.kind==="cooldown"){
      lines.push(
        "Cooldown",
        `- ${block.deviceKm}km Z1 Pace`,
        ""
      );
    }
  });

  if(notes.length){
    lines.unshift(...notes,"");
  }

  return lines.join("\n").trim();
}

function estimateExactRunDistance(blocks){
  let distance=0;

  blocks.forEach(block=>{
    if(["warmup","pace","float"].includes(block.kind)){
      distance+=Number(block.km)||0;
      return;
    }

    if(block.kind==="cooldown"){
      distance+=Number(block.deviceKm)||0;
      return;
    }

    if(block.kind==="strides"){
      const stridePace=paceToSeconds(
        String(block.stridePace).split("-")[0]
      ) || 200;
      const easyPace=330;

      distance+=block.repeats*
        estimateDistanceFromSeconds(block.seconds,stridePace);

      distance+=block.repeats*
        estimateDistanceFromSeconds(block.recoverySeconds,easyPace);
    }
  });

  return Math.round(distance*10)/10;
}

function estimateExactRunMinutes(blocks){
  let seconds=0;

  blocks.forEach(block=>{
    if(block.kind==="warmup"){
      seconds+=block.km*315;
      return;
    }

    if(block.kind==="strides"){
      seconds+=block.repeats*
        (block.seconds+block.recoverySeconds);
      return;
    }

    if(block.kind==="pace" || block.kind==="float"){
      const pace=paceRangeAverageSeconds(
        block.paceStart,
        block.paceEnd
      );
      if(pace) seconds+=block.km*pace;
      return;
    }

    if(block.kind==="cooldown"){
      seconds+=block.deviceKm*315;
    }
  });

  return Math.round(seconds/60);
}

function parseMultiBlockRun(raw){
  const text=normalizedWorkoutText(raw);
  const blocks=[];
  const assumptions=[];

  const addMatches=(regex,builder)=>{
    for(const match of text.matchAll(regex)){
      const block=builder(match);
      if(block){
        block.index=match.index;
        blocks.push(block);
      }
    }
  };

  addMatches(
    /(\d+(?:\.\d+)?)\s*km\s*(?:warming\s*up|warming-up|warmup|inlopen)/gi,
    match=>({
      kind:"warmup",
      km:Number(match[1]),
      display:`${match[1]} km rustig inlopen`
    })
  );

  addMatches(
    /(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(?:sec|seconden|s)\s*strides?/gi,
    match=>({
      kind:"strides",
      repeats:Number(match[1]),
      seconds:Number(match[2]),
      recoverySeconds:40,
      stridePace:"3:10-3:25/km",
      display:`${match[1]} × ${match[2]} sec strides`
    })
  );

  addMatches(
    /(\d+(?:\.\d+)?)\s*km\s*(float\s*)?(?:@|op|in)\s*(\d:\d{2})(?:\s*-\s*(\d:\d{2}))?\s*(?:\/?\s*km)?/gi,
    match=>{
      const km=Number(match[1]);
      const isFloat=Boolean(match[2]);
      const pace=displayPaceRange(match[3],match[4]);

      return{
        kind:isFloat?"float":"pace",
        km,
        paceStart:match[3],
        paceEnd:match[4]||match[3],
        pace,
        display:isFloat
          ?`${km} km float @ ${pace}`
          :`${km} km @ ${pace}`
      };
    }
  );

  addMatches(
    /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*km\s*(?:uitlopen|cooldown|cool\s*down)/gi,
    match=>{
      const minKm=Number(match[1]);
      const maxKm=Number(match[2]);

      return{
        kind:"cooldown",
        minKm,
        maxKm,
        deviceKm:minKm,
        display:`${minKm}-${maxKm} km rustig uitlopen`
      };
    }
  );

  addMatches(
    /(?:^|\s)(\d+(?:\.\d+)?)\s*km\s*(?:uitlopen|cooldown|cool\s*down)/gi,
    match=>({
      kind:"cooldown-single",
      km:Number(match[1]),
      display:`${match[1]} km rustig uitlopen`
    })
  );

  const hasRangeCooldown=blocks.some(block=>block.kind==="cooldown");
  let filtered=blocks.filter(block=>
    !(hasRangeCooldown && block.kind==="cooldown-single")
  );

  filtered=filtered.map(block=>{
    if(block.kind==="cooldown-single"){
      return{
        ...block,
        kind:"cooldown",
        minKm:block.km,
        maxKm:block.km,
        deviceKm:block.km
      };
    }
    return block;
  });

  filtered.sort((a,b)=>a.index-b.index);

  const pacedCount=filtered.filter(block=>
    block.kind==="pace" || block.kind==="float"
  ).length;
  const hasStrides=filtered.some(block=>block.kind==="strides");

  if(filtered.length<3 || (!hasStrides && pacedCount<2)){
    return null;
  }

  if(hasStrides){
    assumptions.push(
      "Voor de 20 sec strides is 40 sec rustig dribbelen als herstel toegevoegd, omdat geen herstelduur was opgegeven."
    );
  }

  const rangeCooldown=filtered.find(block=>
    block.kind==="cooldown" &&
    block.maxKm>block.minKm
  );

  if(rangeCooldown){
    assumptions.push(
      `${rangeCooldown.minKm}-${rangeCooldown.maxKm} km uitlopen wordt voor het device als ${rangeCooldown.deviceKm} km vast blok opgeslagen; de extra kilometer blijft optioneel.`
    );
  }

  const name=buildExactRunName(filtered);
  const distanceKm=estimateExactRunDistance(filtered);
  const durationMinutes=estimateExactRunMinutes(filtered);
  const notes=[...assumptions];

  return{
    date:parseDateFromText(raw),
    name,
    uploadName:`Jaco - ${name}`,
    type:"Run",
    distanceKm,
    durationMinutes,
    rpe:"7/10",
    status:"planned",
    exactStructured:true,
    structuredBlocks:filtered.map(({index,...block})=>block),
    displaySteps:filtered.map(block=>block.display),
    intervalsDescription:buildExactIntervalsDescription(filtered,notes),
    editorData:{
      exactStructured:true,
      rawInput:raw,
      structuredBlocks:filtered.map(({index,...block})=>block),
      durationMinutes,
      notes:""
    },
    assumptions
  };
}

function renderExactRunDraft(){
  const panel=document.getElementById("exactRunPanel");
  const list=document.getElementById("exactRunSteps");
  const assumptions=document.getElementById("exactRunAssumptions");

  if(!panel || !list || !assumptions) return;

  if(!exactRunDraft){
    panel.hidden=true;
    if(document.getElementById("workoutType")?.value==="Run"){
      document.getElementById("runFields").hidden=false;
    }
    return;
  }

  panel.hidden=false;
  document.getElementById("runFields").hidden=true;
  document.getElementById("exactRunTitle").textContent=exactRunDraft.name;

  list.innerHTML=(exactRunDraft.displaySteps||[]).map((step,index)=>`
    <div class="exact-run-step">
      <div class="step-number">${index+1}</div>
      <div>
        <strong>${safe(step)}</strong>
      </div>
    </div>
  `).join("");

  assumptions.textContent=(exactRunDraft.assumptions||[]).length
    ? exactRunDraft.assumptions.join(" ")
    :"Alle blokken worden exact in deze volgorde opgeslagen.";
}

function clearExactRunMode(update=true){
  exactRunDraft=null;
  const panel=document.getElementById("exactRunPanel");
  if(panel) panel.hidden=true;

  if(document.getElementById("workoutType")?.value==="Run"){
    document.getElementById("runFields").hidden=false;
  }

  if(update) updatePreview();
}

function applyExactRunDraft(workout){
  exactRunDraft=clone(workout);

  document.getElementById("workoutType").value="Run";
  document.getElementById("date").value=workout.date;
  document.getElementById("name").value=workout.name;
  document.getElementById("distanceKm").value=workout.distanceKm;
  document.getElementById("durationMinutes").value=workout.durationMinutes;
  document.getElementById("rpe").value=workout.rpe;
  document.getElementById("notes").value="";

  renderExactRunDraft();
  updatePreview();
}


function parseSmartTraining(){
  const raw=document.getElementById("smartInput").value.trim();
  const status=document.getElementById("smartStatus");

  if(!raw){
    status.className="status error";
    status.textContent="Beschrijf eerst een training.";
    return;
  }

  const multiBlock=parseMultiBlockRun(raw);

  if(multiBlock){
    applyExactRunDraft(multiBlock);
    status.className="status ok";
    status.textContent=
      `Volledige multi-block training herkend: ${multiBlock.displaySteps.length} onderdelen. Controleer het exacte blokkenoverzicht en tik daarna op Opslaan.`;
    return;
  }

  clearExactRunMode(false);

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


  if(type==="Run" && exactRunDraft){
    const currentName=safe(
      document.getElementById("name").value
    ).trim() || exactRunDraft.name;

    const currentNotes=safe(
      document.getElementById("notes").value
    ).trim();

    const workout=clone(exactRunDraft);
    workout.name=currentName;
    workout.uploadName=`Jaco - ${currentName}`;
    workout.date=document.getElementById("date").value;
    workout.distanceKm=Number(
      document.getElementById("distanceKm").value ||
      exactRunDraft.distanceKm ||
      0
    );
    workout.durationMinutes=Number(
      document.getElementById("durationMinutes").value ||
      exactRunDraft.durationMinutes ||
      0
    );
    workout.rpe=document.getElementById("rpe").value;
    workout.status="planned";
    workout.exactStructured=true;

    workout.editorData={
      ...(workout.editorData||{}),
      exactStructured:true,
      durationMinutes:workout.durationMinutes,
      structuredBlocks:clone(workout.structuredBlocks||[]),
      notes:currentNotes
    };

    if(currentNotes){
      workout.intervalsDescription=
        `${currentNotes}\n\n${exactRunDraft.intervalsDescription}`;
    }else{
      workout.intervalsDescription=exactRunDraft.intervalsDescription;
    }

    return workout;
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
  const synchronizedName=synchronizedIntervalTitle(
    name,
    repeats,
    workMeters
  );

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
    name:synchronizedName,
    uploadName:`Jaco - ${synchronizedName}`,
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
  clearExactRunMode(false);
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

  if(
    workout.type==="Run" &&
    (workout.exactStructured || editor.exactStructured) &&
    (workout.structuredBlocks || editor.structuredBlocks)
  ){
    exactRunDraft=clone({
      ...workout,
      exactStructured:true,
      structuredBlocks:clone(
        workout.structuredBlocks ||
        editor.structuredBlocks ||
        []
      ),
      assumptions:workout.assumptions || []
    });
    renderExactRunDraft();
  }

  updateRecoveryLabel();
  updateWorkoutTypeFields();
  updatePreview();
}


function parseLocaleNumber(value){
  return finiteNumberOrNull(value);
}

function parseStructuredRunData(workout){
  if(!workout || workout.type!=="Run") return null;
  if(workout.exactStructured || workout.editorData?.exactStructured) return null;

  const steps=Array.isArray(workout.displaySteps)
    ? workout.displaySteps.join("\n")
    :"";

  const description=String(workout.intervalsDescription||"");
  const text=`${steps}\n${description}`;

  let warmupKm=null;
  let cooldownKm=null;
  let repeats=null;
  let workMeters=null;
  let targetPace=null;
  let recoveryType=null;
  let recoveryValue=null;

  const warmupMatch=text.match(
    /(\d+(?:[.,]\d+)?)\s*km[^\n]*(?:inlopen|warmup|warm-up)/i
  );
  if(warmupMatch){
    warmupKm=parseLocaleNumber(warmupMatch[1]);
  }

  const cooldownMatch=text.match(
    /(\d+(?:[.,]\d+)?)\s*km[^\n]*(?:uitlopen|cooldown|cool-down)/i
  );
  if(cooldownMatch){
    cooldownKm=parseLocaleNumber(cooldownMatch[1]);
  }

  // Beste bron: de zichtbare trainingsstap.
  const stepMatch=steps.match(
    /(\d+)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*m(?:tr)?\s*@\s*([^,\n]+?)(?:,\s*(\d+(?:[.,]\d+)?)\s*(min(?:uten?)?|m(?:eter)?)\s*herstel)?(?:\n|$)/i
  );

  if(stepMatch){
    repeats=Number(stepMatch[1]);
    workMeters=Math.round(parseLocaleNumber(stepMatch[2]));
    targetPace=String(stepMatch[3]||"").trim();

    if(stepMatch[4]){
      recoveryValue=parseLocaleNumber(stepMatch[4]);
      recoveryType=/min/i.test(stepMatch[5]||"") ? "time" : "distance";
    }
  }

  // Ook stappen als "5 × 1000 m op 5 km-tempo" herkennen.
  if(repeats===null || workMeters===null){
    const simpleStep=text.match(
      /(\d+)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*m\b/i
    );
    if(simpleStep){
      repeats=Number(simpleStep[1]);
      workMeters=Math.round(parseLocaleNumber(simpleStep[2]));
    }
  }

  // Fallback naar Intervals-description.
  const mainSetMatch=description.match(/Main set\s+(\d+)x/i);
  if(repeats===null && mainSetMatch){
    repeats=Number(mainSetMatch[1]);
  }

  const workLine=description.match(
    /-\s*(\d+(?:[.,]\d+)?)\s*(km|mtr|m)\s+([^\n]+?)\s+Pace/i
  );
  if(workMeters===null && workLine){
    const value=parseLocaleNumber(workLine[1]);
    workMeters=workLine[2].toLowerCase()==="km"
      ?Math.round(value*1000)
      :Math.round(value);
  }
  if(!targetPace && workLine){
    targetPace=String(workLine[3]||"").trim();
  }

  const recoveryLine=description.match(
    /-\s*(\d+(?:[.,]\d+)?)\s*(mtr|m)\s+Z1 Pace/i
  );
  if(recoveryValue===null && recoveryLine){
    const value=parseLocaleNumber(recoveryLine[1]);
    const unit=recoveryLine[2].toLowerCase();

    // In bestaande Intervals export betekent "2m" minuten,
    // terwijl "200mtr" afstand is.
    if(unit==="mtr" || value>=50){
      recoveryType="distance";
      recoveryValue=value;
    }else{
      recoveryType="time";
      recoveryValue=value;
    }
  }

  if(repeats===null || workMeters===null){
    return null;
  }

  return{
    warmupKm:warmupKm ?? 3,
    warmupPace:"5:00-5:30/km",
    repeats,
    workMeters,
    targetPace:targetPace || "Z1",
    recoveryType:recoveryType || "time",
    recoveryValue:recoveryValue ?? 2,
    cooldownKm:cooldownKm ?? 2,
    notes:""
  };
}

function isGenericIntervalTitle(name){
  return /^\s*\d+\s*[×x]\s*\d+(?:[.,]\d+)?\s*m\b/i.test(
    String(name||"")
  );
}

function synchronizedIntervalTitle(name,repeats,workMeters){
  const current=String(name||"").trim();

  if(!isGenericIntervalTitle(current)){
    return current;
  }

  const suffix=/vo(?:₂|2)\s*max/i.test(current)
    ?" VO₂max"
    :"";

  return `${repeats} × ${workMeters} m${suffix}`;
}

function repairStructuredWorkout(workout){
  if(!workout || workout.type!=="Run") return false;
  if(workout.exactStructured || workout.editorData?.exactStructured) return false;

  const inferred=parseStructuredRunData(workout);
  if(!inferred) return false;

  let changed=false;

  if(!workout.editorData){
    workout.editorData={...inferred};
    changed=true;
  }

  if(isGenericIntervalTitle(workout.name)){
    const synced=synchronizedIntervalTitle(
      workout.name,
      inferred.repeats,
      inferred.workMeters
    );

    if(synced!==workout.name){
      workout.name=synced;
      workout.uploadName=`Jaco - ${synced}`;
      changed=true;
    }
  }

  return changed;
}

function repairStoredWorkoutMismatches(){
  let changed=false;

  Object.values(customWorkouts).forEach(workout=>{
    if(repairStructuredWorkout(workout)){
      changed=true;
    }
  });

  if(changed){
    saveObject(STORAGE_KEY,customWorkouts);
  }

  return changed;
}



function inferEditorData(workout){
  const parsed=parseStructuredRunData(workout);

  if(parsed){
    return{
      durationMinutes:Number(workout.durationMinutes)||0,
      ...parsed,
      notes:""
    };
  }

  return{
    durationMinutes:Number(workout.durationMinutes)||0,
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

  if(repairStructuredWorkout(workout)){
    saveObject(STORAGE_KEY,customWorkouts);
  }

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
    const volume=workout.exactStructured
      ? `${trainingVolumeLabel(workout)} geschat · RPE ${workout.rpe}`
      : `${trainingVolumeLabel(workout)} · RPE ${workout.rpe}`;

    document.getElementById("preview").textContent=
      `${info.icon} ${info.label}\n${workout.name || "Naam ontbreekt"}\n${volume}\n\n${steps || workout.intervalsDescription || "Vul de training in."}`;
  }catch{
    document.getElementById("preview").textContent="Vul de training in.";
  }
}

function updateRecoveryLabel(){
  const isTime=document.getElementById("recoveryType").value==="time";
  const input=document.getElementById("recoveryValue");

  document.getElementById("recoveryValueLabelText").textContent=
    isTime ? "Herstel (minuten)" : "Herstel (meter)";

  input.min=isTime ? "0.5" : "50";
  input.step=isTime ? "0.5" : "50";
  input.inputMode=isTime ? "decimal" : "numeric";

  const value=Number(input.value);

  if(Number.isFinite(value)){
    if(isTime && value<0.5){
      input.value="0.5";
    }

    if(!isTime && value<50){
      input.value="50";
    }
  }

  // Safari/iOS opnieuw laten valideren met de actuele min/step-combinatie.
  input.setCustomValidity("");
}

function saveWorkout(event){
  event.preventDefault();

  const workout=buildWorkout();
  const originalDate=document.getElementById("originalDate").value;
  const originalWorkout=originalDate
    ?customWorkouts[originalDate]||null
    :null;
  const originalWasDone=
    originalWorkout &&
    workoutWasCompleted(originalDate,originalWorkout);

  if(!workout.date || !workout.name){
    document.getElementById("formStatus").className="status error";
    document.getElementById("formStatus").textContent="Datum en naam zijn verplicht.";
    return;
  }

  const targetExisting=allWorkouts()[workout.date]||null;
  const sameCustomDate=
    Boolean(originalDate) &&
    originalDate===workout.date &&
    Boolean(customWorkouts[workout.date]);

  if(targetExisting && !sameCustomDate){
    if(targetExisting.type==="Race"){
      document.getElementById("formStatus").className="status error";
      document.getElementById("formStatus").textContent=
        "Op deze datum staat een wedstrijd. Verplaats de training naar een andere dag.";
      return;
    }

    const confirmed=confirm(
      `Op ${workout.date} staat al "${targetExisting.name}". Deze vervangen door "${workout.name}"?`
    );
    if(!confirmed) return;
  }

  if(originalDate && originalDate!==workout.date){
    delete customWorkouts[originalDate];
    clearWorkoutMarkersForDate(originalDate);
  }

  if(targetExisting && !sameCustomDate){
    clearWorkoutMarkersForDate(workout.date);
  }

  if(sameCustomDate && originalWorkout){
    const uploadChanged=
      workoutUploadFingerprint(originalWorkout)!==
      workoutUploadFingerprint(workout);

    if(uploadChanged){
      delete uploadedWorkouts[workout.date];
    }

    if(!originalWasDone){
      delete doneWorkouts[workout.date];
    }
  }

  customWorkouts[workout.date]=workout;

  if(sameCustomDate && originalWasDone){
    markWorkoutCompleted(workout.date,workout);
  }

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

  refreshAfterCalendarMutation();
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
  refreshAfterCalendarMutation();
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

  refreshAfterCalendarMutation();
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
            ${workoutUploadIsCurrent(date,workout) ? " · In Intervals ✓" : ""}
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



const RACE_SIM_KEY="jp_race_simulations_v1";
let raceSimulations=loadObject(RACE_SIM_KEY);
let activeRaceSimulation=null;

function formatRaceTime(totalSeconds){
  const seconds=Math.round(Number(totalSeconds)||0);
  if(!seconds) return null;

  const hours=Math.floor(seconds/3600);
  const minutes=Math.floor((seconds%3600)/60);
  const secs=seconds%60;

  if(hours>0){
    return `${hours}:${String(minutes).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
  }

  return `${minutes}:${String(secs).padStart(2,"0")}`;
}

function riegelPrediction(sourceSeconds,sourceDistance,targetDistance){
  const seconds=Number(sourceSeconds);
  const d1=Number(sourceDistance);
  const d2=Number(targetDistance);

  if(!seconds || !d1 || !d2) return null;
  return seconds*Math.pow(d2/d1,1.06);
}

function profilePerformanceSources(profileData=getProfile()){
  const sources=[];

  const five=parseTimeToSeconds(profileData.fiveKPr);
  if(five){
    sources.push({
      distance:5,
      seconds:five,
      label:`5 km PR ${profileData.fiveKPr}`,
      type:"pr"
    });
  }

  const ten=parseTimeToSeconds(profileData.tenKPr);
  if(ten){
    sources.push({
      distance:10,
      seconds:ten,
      label:`10 km PR ${profileData.tenKPr}`,
      type:"pr"
    });
  }

  return sources;
}

function bestProfilePrediction(race,profileData=getProfile()){
  const distance=Number(race?.distanceKm||0);
  const sources=profilePerformanceSources(profileData);

  if(!distance || !sources.length){
    const target=parseTimeToSeconds(race?.targetTime);
    if(target){
      return{
        seconds:target,
        source:"Alleen ingesteld wedstrijddoel",
        confidence:"Laag",
        independent:false
      };
    }

    return{
      seconds:null,
      source:"Geen PR of streeftijd beschikbaar",
      confidence:"Onvoldoende",
      independent:false
    };
  }

  const exact=sources.find(source=>
    Math.abs(source.distance-distance)<0.01
  );

  if(exact){
    return{
      seconds:exact.seconds,
      source:`Exacte profielreferentie · ${exact.label}`,
      confidence:"Hoog",
      independent:true
    };
  }

  const ranked=[...sources].sort((a,b)=>
    Math.abs(Math.log(distance/a.distance))-
    Math.abs(Math.log(distance/b.distance))
  );

  const source=ranked[0];
  const predicted=riegelPrediction(
    source.seconds,
    source.distance,
    distance
  );

  const ratio=Math.max(distance/source.distance,source.distance/distance);
  const confidence=
    ratio<=1.7
      ?"Redelijk"
      :ratio<=2.5
        ?"Matig"
        :"Laag";

  return{
    seconds:predicted,
    source:`Riegel-prognose vanuit ${source.label}`,
    confidence,
    independent:true
  };
}

function adjustedRacePrediction(race,basePrediction){
  if(!basePrediction.seconds) return basePrediction;

  const phase=classifyRacePhase(race);
  const readiness=determineReadiness(getWellnessSnapshot());

  // Alleen een kleine actuele aanpassing wanneer de wedstrijd dichtbij is
  // én voldoende verse hersteldata beschikbaar is.
  if(
    !readiness.sufficientData ||
    phase.days===null ||
    phase.days>14
  ){
    return{
      ...basePrediction,
      adjustment:0,
      adjustmentText:
        readiness.sufficientData
          ?"Geen vormcorrectie: wedstrijd is nog verder dan 14 dagen."
          :"Geen vormcorrectie: onvoldoende actuele hersteldata."
    };
  }

  let adjustment=0;

  if(readiness.score>=85) adjustment=-0.008;
  else if(readiness.score>=75) adjustment=-0.004;
  else if(readiness.score<45) adjustment=0.018;
  else if(readiness.score<60) adjustment=0.010;

  return{
    ...basePrediction,
    seconds:basePrediction.seconds*(1+adjustment),
    adjustment,
    adjustmentText:
      adjustment===0
        ?"Actueel herstel geeft geen correctie."
        :adjustment<0
          ?`Kleine positieve vormcorrectie (${Math.abs(adjustment*100).toFixed(1)}%).`
          :`Voorzichtige herstelcorrectie (+${(adjustment*100).toFixed(1)}%).`
  };
}

function raceGoalComparison(race,prediction){
  const target=parseTimeToSeconds(race?.targetTime);

  if(!target){
    return{
      target:null,
      gapSeconds:null,
      gapPercent:null,
      label:"Geen streeftijd"
    };
  }

  if(!prediction?.seconds || !prediction.independent){
    return{
      target,
      gapSeconds:null,
      gapPercent:null,
      label:"Geen onafhankelijke vergelijking"
    };
  }

  const gap=target-prediction.seconds;
  const percent=(prediction.seconds-target)/prediction.seconds*100;

  let label="Realistisch";
  if(percent>1.5 && percent<=3) label="Ambitieus";
  if(percent>3) label="Agressief";
  if(percent<-2) label="Conservatief";

  return{
    target,
    gapSeconds:gap,
    gapPercent:percent,
    label
  };
}

function customRaceReadiness(race){
  const snapshot=getWellnessSnapshot();
  const readiness=determineReadiness(snapshot);
  const phase=classifyRacePhase(race);
  const consistency=calculateConsistencyScore();

  const fitness=snapshot.ctl===null
    ?null
    :clampScore(35+(snapshot.ctl/70)*55);

  const recovery=readiness.sufficientData
    ?readiness.score
    :null;

  let phaseScore=null;
  if(phase.days!==null){
    if(phase.phase==="race-week") phaseScore=90;
    else if(phase.phase==="taper") phaseScore=86;
    else if(phase.phase==="specific") phaseScore=76;
    else phaseScore=66;
  }

  const consistencyValue=
    consistency.completed>0
      ?consistency.score
      :null;

  const inputs=[
    {label:"fitness",value:fitness,weight:.36},
    {label:"herstel",value:recovery,weight:.34},
    {label:"consistentie",value:consistencyValue,weight:.16},
    {label:"wedstrijdfase",value:phaseScore,weight:.14}
  ];

  const available=inputs.filter(item=>item.value!==null);
  const score=available.length>=2
    ?weightedAvailableScore(inputs)
    :null;

  let confidence="Onvoldoende";
  if(available.length===2) confidence="Laag";
  if(available.length===3) confidence="Redelijk";
  if(available.length===4) confidence="Goed";

  return{
    score,
    confidence,
    availableInputs:available.map(item=>item.label),
    missingInputs:inputs.filter(item=>item.value===null).map(item=>item.label),
    fitness,
    recovery,
    consistency:consistencyValue,
    phaseScore,
    phase
  };
}

function paceTextWithOffset(baseSeconds,offsetSeconds){
  if(!baseSeconds) return "—";
  return `${formatPace(baseSeconds+offsetSeconds)}/km`;
}

function racePacingPlan(race,paceSeconds){
  const d=Number(race.distanceKm);

  if(!paceSeconds){
    return[{
      label:"Pacing",
      text:"Geen tempo beschikbaar. Vul een streeftijd of bruikbare profielreferentie in."
    }];
  }

  if(d<=5.5){
    return[
      {label:"Start",text:`Eerste 1 km rond ${paceTextWithOffset(paceSeconds,3)}. Niet sneller openen.`},
      {label:"Midden",text:`Km 2–4 rond ${paceTextWithOffset(paceSeconds,0)}. Ritme en ontspanning vasthouden.`},
      {label:"Finish",text:`Laatste km progressief. Vanaf ongeveer 600 m te gaan versnellen als je nog controle hebt.`}
    ];
  }

  if(d<=10.5){
    return[
      {label:"Km 0–2",text:`Open gecontroleerd rond ${paceTextWithOffset(paceSeconds,3)}.`},
      {label:"Km 2–8",text:`Stabiliseer rond ${paceTextWithOffset(paceSeconds,0)}.`},
      {label:"Km 8–10",text:`Tempo vasthouden; laatste 1–2 km versnellen als de marge er is.`}
    ];
  }

  if(d<=23){
    return[
      {label:"Km 0–3",text:`Rustige opening rond ${paceTextWithOffset(paceSeconds,4)}.`},
      {label:"Km 3–16",text:`Hoofdblok rond ${paceTextWithOffset(paceSeconds,0)}.`},
      {label:"Km 16–20",text:`Blijf bij doeltempo; alleen versnellen als ademhaling en benen stabiel zijn.`},
      {label:"Laatste 1,1",text:"Progressief naar maximaal haalbare inspanning."}
    ];
  }

  return[
    {label:"Km 0–5",text:`Beheerst openen rond ${paceTextWithOffset(paceSeconds,7)}.`},
    {label:"Km 5–30",text:`Zo constant mogelijk rond ${paceTextWithOffset(paceSeconds,0)}.`},
    {label:"Km 30–38",text:"Niet forceren om kleine achterstand terug te pakken; tempo op gevoel en voeding bewaken."},
    {label:"Laatste 4,2",text:"Pas hier versnellen als energie, spieren en maag nog goed functioneren."}
  ];
}

function raceTaperPlan(race){
  const days=daysUntil(race.date);
  const d=Number(race.distanceKm);

  if(days<0){
    return[{label:"Status",text:"Deze wedstrijd is al geweest."}];
  }

  if(days<=3){
    return[
      {label:"Volume",text:"Geen zware trainingsprikkel meer. Alleen kort en rustig."},
      {label:"Scherpte",text:d<=10?"Eventueel 4–6 korte ontspannen versnellingen.":"Enkele korte strides, geen vermoeiende blokken."},
      {label:"Prioriteit",text:"Slaap, normale voeding en frisse benen."}
    ];
  }

  if(days<=7){
    return[
      {label:"Volume",text:`Ongeveer ${d>=21?"50–60%":"60–70%"} van een normale trainingsweek.`},
      {label:"Laatste prikkel",text:"Eén korte wedstrijdspecifieke prikkel, daarna vooral gemakkelijk."},
      {label:"Herstel",text:"Geen gemiste kilometers meer proberen in te halen."}
    ];
  }

  if(days<=14){
    return[
      {label:"Volume",text:`Bouw richting ongeveer ${d>=21?"65–75%":"70–80%"} van normaal.`},
      {label:"Kwaliteit",text:"Laatste stevige kwaliteit vroeg in deze periode; daarna korter en specifieker."},
      {label:"Doel",text:"Fitness behouden, vermoeidheid laten dalen."}
    ];
  }

  return[
    {label:"Nu",text:"Nog geen volledige taper nodig."},
    {label:"Training",text:"Blijf wedstrijdspecifiek trainen met voldoende herstel tussen zware sessies."},
    {label:"Laatste 14 dagen",text:"Dan pas gericht volume afbouwen."}
  ];
}

function raceFuelPlan(race,expectedSeconds){
  const duration=Number(expectedSeconds)||null;
  const minutes=duration?duration/60:null;

  if(!minutes){
    return[
      {label:"Voeding",text:"Vul eerst een streeftijd of bruikbare prognose in."}
    ];
  }

  if(minutes<=45){
    return[
      {label:"Vooraf",text:"Normale koolhydraatrijke maaltijd 2–3 uur vooraf; niets nieuws proberen."},
      {label:"Tijdens",text:"Geen koolhydraten nodig tijdens deze korte race."},
      {label:"Drinken",text:"Meestal alleen drinken naar dorst; bij warmte vooraf goed gehydrateerd starten."}
    ];
  }

  if(minutes<=75){
    return[
      {label:"Vooraf",text:"Koolhydraatrijke maaltijd 2–3 uur vooraf. Een kleine gel vlak voor de start kan als je dit gewend bent."},
      {label:"Tijdens",text:"Ongeveer 20–30 g koolhydraten kan voldoende zijn; bij een 10 km vaak niet noodzakelijk."},
      {label:"Drinken",text:"Kleine slokken bij posten, vooral bij warm weer."}
    ];
  }

  if(minutes<=150){
    return[
      {label:"Koolhydraten",text:"Richtlijn 45–60 g koolhydraten per uur, vooraf in training testen."},
      {label:"Timing",text:"Begin vroeg; bijvoorbeeld een gel ongeveer iedere 25–30 minuten afhankelijk van product."},
      {label:"Drinken",text:"Globaal 400–750 ml per uur, aangepast aan temperatuur en je eigen zweetverlies."},
      {label:"Natrium",text:"Gebruik je normale elektrolytenstrategie; behoefte verschilt sterk per persoon."}
    ];
  }

  return[
    {label:"Koolhydraten",text:"Richtlijn 60–90 g koolhydraten per uur, alleen als je maag dit in training verdraagt."},
    {label:"Timing",text:"Start binnen het eerste halfuur en voer consequent door."},
    {label:"Drinken",text:"Globaal 450–750 ml per uur, aangepast aan weer en persoonlijk zweetverlies."},
    {label:"Natrium",text:"Gebruik een vooraf geteste elektrolytenstrategie; niet op racedag experimenteren."}
  ];
}

function raceSimulationSignals(race,prediction,goal,readiness){
  const signals=[];

  signals.push({
    state:prediction.independent?"good":"warn",
    icon:prediction.independent?"✓":"?",
    text:`Voorspelling: ${prediction.source}. Betrouwbaarheid: ${prediction.confidence}.`
  });

  if(goal.target && goal.gapPercent!==null){
    signals.push({
      state:goal.label==="Agressief"
        ?"warn"
        :"good",
      icon:goal.label==="Agressief"
        ?"!"
        :"✓",
      text:`Doel versus profielprognose: ${goal.label.toLowerCase()} (${goal.gapPercent>=0?goal.gapPercent.toFixed(1)+"% sneller":Math.abs(goal.gapPercent).toFixed(1)+"% rustiger"}).`
    });
  }

  if(readiness.score===null){
    signals.push({
      state:"warn",
      icon:"?",
      text:`Race readiness niet berekend: onvoldoende actuele databronnen (${readiness.availableInputs.join(", ") || "geen"}).`
    });
  }else{
    signals.push({
      state:readiness.score>=75
        ?"good"
        :readiness.score>=55
          ?"warn"
          :"bad",
      icon:readiness.score>=75
        ?"✓"
        :readiness.score>=55
          ?"!"
          :"×",
      text:`Race readiness ${readiness.score}/100 op basis van ${readiness.availableInputs.join(", ")}.`
    });
  }

  if(readiness.missingInputs.length){
    signals.push({
      state:"warn",
      icon:"i",
      text:`Niet meegewogen: ${readiness.missingInputs.join(", ")}.`
    });
  }

  return signals;
}

function buildRaceSimulation(race){
  const optimizer=
    typeof buildRaceReadinessGoalOptimizer==="function"
      ?buildRaceReadinessGoalOptimizer(race)
      :null;

  const modelPrediction=
    typeof performanceModelPredictionForDistance==="function"
      ?performanceModelPredictionForDistance(
        Number(race?.distanceKm||0)
      )
      :null;

  const base=
    modelPrediction?.seconds
      ?modelPrediction
      :bestProfilePrediction(race,getProfile());

  const prediction=adjustedRacePrediction(race,base);
  const goal=raceGoalComparison(race,prediction);
  const readiness=customRaceReadiness(race);

  const pacingSeconds=
    optimizer?.referenceSeconds ||
    goal.target ||
    prediction.seconds ||
    null;

  const expectedSeconds=
    optimizer?.referenceSeconds ||
    goal.target ||
    prediction.seconds ||
    null;

  const strategy=
    typeof buildRaceStrategyEngine==="function"
      ?buildRaceStrategyEngine(race,optimizer)
      :null;

  return{
    race,
    prediction,
    goal,
    readiness,
    optimizer,
    strategy,
    pacingSeconds,
    pacing:strategy
      ?raceStrategyPacingRows(strategy)
      :racePacingPlan(race,pacingSeconds),
    taper:raceTaperPlan(race),
    fuel:strategy
      ?raceStrategyFuelRows(strategy)
      :raceFuelPlan(race,expectedSeconds),
    createdAt:new Date().toISOString()
  };
}

function renderRaceSimulationPlan(targetId,rows){
  const target=document.getElementById(targetId);
  if(!target) return;

  target.innerHTML=rows.map(row=>`
    <div class="race-sim-row">
      <strong>${safe(row.label)}</strong>
      <span>${safe(row.text)}</span>
    </div>
  `).join("");
}

function renderRaceSimulator(){
  const select=document.getElementById("raceSimulatorSelect");
  if(!select) return;

  const race=races[select.value];

  if(!race){
    activeRaceSimulation=null;
    if(typeof renderRaceReadinessGoalOptimizer==="function"){
      renderRaceReadinessGoalOptimizer(null);
    }
    if(typeof renderRaceStrategyEngine==="function"){
      renderRaceStrategyEngine(null);
    }
    if(typeof renderRaceDaySummaryCard==="function"){
      renderRaceDaySummaryCard(null);
    }
    document.getElementById("raceSimPrediction").textContent="—";
    document.getElementById("raceSimPredictionSource").textContent="Voeg eerst een toekomstige wedstrijd toe";
    document.getElementById("raceSimTarget").textContent="—";
    document.getElementById("raceSimTargetGap").textContent="—";
    document.getElementById("raceSimPace").textContent="—";
    document.getElementById("raceSimPaceSource").textContent="—";
    document.getElementById("raceSimReadiness").textContent="—";
    document.getElementById("raceSimReadinessConfidence").textContent="—";
    document.getElementById("raceSimSignals").innerHTML="";
    document.getElementById("raceSimPacing").innerHTML='<p class="help">Voeg eerst een toekomstige wedstrijd toe.</p>';
    document.getElementById("raceSimTaper").innerHTML="";
    document.getElementById("raceSimFuel").innerHTML="";
    document.getElementById("raceSimHeadline").textContent="Geen wedstrijd geselecteerd";
    document.getElementById("raceSimConclusion").textContent="De simulator heeft een wedstrijd nodig.";
    document.getElementById("saveRaceSimulation").disabled=true;
    document.getElementById("editSimulatedRace").disabled=true;
    return;
  }

  const simulation=buildRaceSimulation(race);
  activeRaceSimulation=simulation;

  if(typeof renderRaceReadinessGoalOptimizer==="function"){
    renderRaceReadinessGoalOptimizer(race);
  }
  if(typeof renderRaceStrategyEngine==="function"){
    renderRaceStrategyEngine(simulation.strategy);
  }
  if(typeof renderRaceDaySummaryCard==="function"){
    renderRaceDaySummaryCard(simulation.strategy);
  }

  document.getElementById("raceSimPrediction").textContent=
    simulation.prediction.seconds
      ?formatRaceTime(simulation.prediction.seconds)
      :"—";

  document.getElementById("raceSimPredictionSource").textContent=
    `${simulation.prediction.source} · ${simulation.prediction.confidence}`;

  document.getElementById("raceSimTarget").textContent=
    race.targetTime || "—";

  document.getElementById("raceSimTargetGap").textContent=
    simulation.goal.gapPercent===null
      ?simulation.goal.label
      :simulation.goal.label;

  document.getElementById("raceSimPace").textContent=
    simulation.pacingSeconds
      ?`${formatPace(simulation.pacingSeconds/Number(race.distanceKm))}/km`
      :"—";

  document.getElementById("raceSimPaceSource").textContent=
    simulation.optimizer?.referenceSeconds
      ?"10.1 geoptimaliseerde race-referentie"
      :simulation.goal.target
        ?"Gebaseerd op streeftijd"
        :simulation.prediction.seconds
          ?"Gebaseerd op prognose"
          :"Geen tempo beschikbaar";

  document.getElementById("raceSimReadiness").textContent=
    simulation.readiness.score===null
      ?"—"
      :`${simulation.readiness.score}/100`;

  document.getElementById("raceSimReadinessConfidence").textContent=
    `Datadekking: ${simulation.readiness.confidence}`;

  const signals=raceSimulationSignals(
    race,
    simulation.prediction,
    simulation.goal,
    simulation.readiness
  );

  document.getElementById("raceSimSignals").innerHTML=
    signals.map(signal=>`
      <div class="reason-item">
        <div class="reason-icon ${signal.state}">${signal.icon}</div>
        <div>${safe(signal.text)}</div>
      </div>
    `).join("");

  renderRaceSimulationPlan("raceSimPacing",simulation.pacing);
  renderRaceSimulationPlan("raceSimTaper",simulation.taper);
  renderRaceSimulationPlan("raceSimFuel",simulation.fuel);

  let headline=simulation.strategy?.headline || "Raceplan is bruikbaar";
  let conclusion=
    simulation.strategy?.summary ||
    `Gebruik ${race.targetTime?"je ingestelde streeftijd":"de profielprognose"} als uitgangspunt en pas op racedag alleen aan op omstandigheden en gevoel.`;

  if(
    simulation.goal.gapPercent!==null &&
    simulation.goal.gapPercent>3
  ){
    headline="Doel vraagt een duidelijke stap";
    conclusion=
      "Je ingestelde doel ligt meer dan 3% sneller dan de huidige profielprognose. Dat betekent niet dat het onmogelijk is, maar de app heeft nog geen recente pace-data om die stap te onderbouwen.";
  }

  if(simulation.readiness.score!==null && simulation.readiness.score<55){
    headline="Race readiness vraagt aandacht";
    conclusion=
      "De beschikbare actuele data wijst niet op optimale frisheid. Gebruik de komende dagen vooral om vermoeidheid te laten dalen.";
  }

  if(!simulation.prediction.independent){
    headline="Geen onafhankelijke tijdsvoorspelling";
    conclusion=
      "De simulator kan wel pacing en taper tonen, maar heeft een bruikbare PR of recente prestatiedata nodig voor een onafhankelijke voorspelling.";
  }

  document.getElementById("raceSimHeadline").textContent=headline;
  document.getElementById("raceSimConclusion").textContent=conclusion;

  document.getElementById("saveRaceSimulation").disabled=false;
  document.getElementById("editSimulatedRace").disabled=false;

  const saved=raceSimulations[race.id];
  document.getElementById("raceSimStatus").className="status";
  document.getElementById("raceSimStatus").textContent=
    saved
      ?`Eerder raceplan bewaard op ${new Date(saved.createdAt).toLocaleString("nl-NL")}.`
      :"";
}

function saveCurrentRaceSimulation(){
  if(!activeRaceSimulation) return;

  const race=activeRaceSimulation.race;
  raceSimulations[race.id]=JSON.parse(
    JSON.stringify(activeRaceSimulation)
  );

  saveObject(RACE_SIM_KEY,raceSimulations);

  const status=document.getElementById("raceSimStatus");
  status.className="status ok";
  status.textContent="Raceplan lokaal bewaard.";
}

function editCurrentSimulatedRace(){
  if(!activeRaceSimulation?.race?.id) return;
  editRace(activeRaceSimulation.race.id);
}



function seasonSpecificDaysForRace(race){
  const distance=Number(race?.distanceKm||0);
  if(distance<=5) return 21;
  if(distance<=10) return 28;
  if(distance<30) return 35;
  return 49;
}

function seasonBuildDaysForRace(race){
  const distance=Number(race?.distanceKm||0);
  if(distance<=5) return 28;
  if(distance<=10) return 35;
  if(distance<30) return 42;
  return 56;
}

function seasonPhaseInfo(phase){
  const map={
    base:{
      label:"Basis",
      volumeFactor:.90,
      focus:"Aerobe basis, rustige omvang, techniek, core en gecontroleerde drempel.",
      quality:"Drempelcontrole of korte heuvel-/stridesprikkel"
    },
    build:{
      label:"Opbouw",
      volumeFactor:1.00,
      focus:"Belastbaarheid en kwaliteit opbouwen met drempel, VO₂max en een passende lange duur.",
      quality:"Gerichte drempel- of VO₂max-prikkel"
    },
    specific:{
      label:"Specifiek",
      volumeFactor:.98,
      focus:"Training steeds meer laten lijken op de eisen van de doelwedstrijd.",
      quality:"Wedstrijdspecifieke blokken en doeltempo"
    },
    taper:{
      label:"Taper",
      volumeFactor:.72,
      focus:"Volume verlagen, frisheid opbouwen en korte wedstrijdscherpte behouden.",
      quality:"Korte scherpe prikkel, geen grote vermoeidheid"
    },
    race:{
      label:"Race",
      volumeFactor:.58,
      focus:"Wedstrijdweek: frisheid, routine en uitvoering van het raceplan.",
      quality:"Alleen korte activatie naast de wedstrijd"
    },
    recovery:{
      label:"Herstel",
      volumeFactor:.62,
      focus:"Vermoeidheid laten zakken met rustige beweging, mobiliteit en geleidelijke hervatting.",
      quality:"Geen verplichte zware kwaliteit"
    }
  };
  return map[phase]||map.base;
}

function pushSeasonBlock(blocks,phase,start,end,targetRace,provisional=false){
  if(!start || !end || start>end) return;
  const info=seasonPhaseInfo(phase);
  blocks.push({
    phase,
    start,
    end,
    targetRace,
    provisional,
    label:info.label,
    volumeFactor:info.volumeFactor,
    focus:info.focus,
    quality:info.quality
  });
}

function buildSeasonPlan(){
  const todayString=todayDateString();
  const upcoming=futureRacesSorted();
  const aRaces=upcoming.filter(race=>String(race.priority||"C").toUpperCase()==="A");
  const targets=aRaces.length?aRaces:(upcoming[0]?[upcoming[0]]:[]);
  const provisional=!aRaces.length && Boolean(targets.length);
  const blocks=[];
  let cursor=todayString;

  // Houd ook rekening met herstel van een wedstrijd die net geweest is.
  const recentPast=Object.values(races)
    .filter(race=>race.date<todayString)
    .map(race=>({
      race,
      age:Math.abs(signedDateGapDays(todayString,race.date)),
      recoveryDays:raceRecoveryDays(race)
    }))
    .filter(item=>item.age<=item.recoveryDays)
    .sort((a,b)=>b.race.date.localeCompare(a.race.date))[0]||null;

  if(recentPast){
    const recoveryEnd=addDays(recentPast.race.date,recentPast.recoveryDays);
    pushSeasonBlock(
      blocks,
      "recovery",
      todayString,
      recoveryEnd,
      recentPast.race,
      false
    );
    cursor=addDays(recoveryEnd,1);
  }

  targets.forEach((target,index)=>{
    if(target.date<cursor) return;

    const taperDays=raceTaperDays(target);
    const specificDays=seasonSpecificDaysForRace(target);
    const buildDays=seasonBuildDaysForRace(target);

    const raceDay=target.date;
    const taperStart=addDays(raceDay,-Math.max(1,taperDays));
    const specificStart=addDays(taperStart,-specificDays);
    const buildStart=addDays(specificStart,-buildDays);

    if(cursor<buildStart){
      pushSeasonBlock(
        blocks,"base",cursor,addDays(buildStart,-1),target,provisional
      );
    }

    const actualBuildStart=cursor>buildStart?cursor:buildStart;
    if(actualBuildStart<specificStart){
      pushSeasonBlock(
        blocks,"build",actualBuildStart,addDays(specificStart,-1),target,provisional
      );
    }

    const actualSpecificStart=cursor>specificStart?cursor:specificStart;
    if(actualSpecificStart<taperStart){
      pushSeasonBlock(
        blocks,"specific",actualSpecificStart,addDays(taperStart,-1),target,provisional
      );
    }

    const actualTaperStart=cursor>taperStart?cursor:taperStart;
    if(actualTaperStart<raceDay){
      pushSeasonBlock(
        blocks,"taper",actualTaperStart,addDays(raceDay,-1),target,provisional
      );
    }

    pushSeasonBlock(blocks,"race",raceDay,raceDay,target,provisional);

    const recoveryDays=raceRecoveryDays(target);
    const recoveryStart=addDays(raceDay,1);
    const recoveryEnd=addDays(raceDay,recoveryDays);
    pushSeasonBlock(
      blocks,"recovery",recoveryStart,recoveryEnd,target,provisional
    );

    cursor=addDays(recoveryEnd,1);

    const nextTarget=targets[index+1]||null;
    if(nextTarget && cursor>nextTarget.date){
      cursor=addDays(raceDay,1);
    }
  });

  const annotated=blocks.map(block=>({
    ...block,
    races:upcoming.filter(race=>race.date>=block.start && race.date<=block.end)
  }));

  return{
    blocks:annotated,
    targets,
    primaryTarget:targets[0]||null,
    provisional,
    upcoming
  };
}

function seasonBlockForDate(date=todayDateString()){
  const plan=buildSeasonPlan();
  return plan.blocks.find(block=>date>=block.start && date<=block.end)||null;
}

function seasonBlockForWeek(startDate){
  const dates=Array.from({length:7},(_,index)=>addDays(startDate,index));
  const blocks=dates
    .map(date=>seasonBlockForDate(date))
    .filter(Boolean);

  if(!blocks.length) return null;

  const priority={race:0,taper:1,recovery:2,specific:3,build:4,base:5};
  return [...blocks].sort(
    (a,b)=>(priority[a.phase]??9)-(priority[b.phase]??9)
  )[0];
}

function seasonBlockDays(block){
  if(!block) return 0;
  return Math.max(
    1,
    signedDateGapDays(block.end,block.start)+1
  );
}

function renderSeasonPlanner(){
  const currentElement=document.getElementById("seasonCurrentBlock");
  if(!currentElement) return;

  const plan=buildSeasonPlan();
  const current=seasonBlockForDate(todayDateString());
  const target=plan.primaryTarget;

  if(current){
    currentElement.textContent=current.label;
    document.getElementById("seasonCurrentBlockNote").textContent=
      `${current.start} t/m ${current.end}`;
    document.getElementById("seasonVolumeFactor").textContent=
      `${Math.round(current.volumeFactor*100)}%`;
    document.getElementById("seasonVolumeFactorNote").textContent=
      current.phase==="race"
        ?"wedstrijdweek"
        :`${current.quality}`;
    document.getElementById("seasonFocusHeadline").textContent=
      `${current.label} richting ${current.targetRace.name}`;
    document.getElementById("seasonFocusText").textContent=current.focus;
  }else{
    currentElement.textContent="—";
    document.getElementById("seasonCurrentBlockNote").textContent=
      target?"buiten huidig blok":"geen doelwedstrijd";
    document.getElementById("seasonVolumeFactor").textContent="—";
    document.getElementById("seasonVolumeFactorNote").textContent="—";
    document.getElementById("seasonFocusHeadline").textContent=
      target?"Plan start bij volgende trainingscyclus":"Nog geen seizoensplan";
    document.getElementById("seasonFocusText").textContent=
      target
        ?`De eerstvolgende cyclus is gekoppeld aan ${target.name}.`
        :"Voeg een toekomstige A-race toe om de trainingsblokken te bepalen.";
  }

  document.getElementById("seasonTargetRace").textContent=
    target?target.name:"—";
  document.getElementById("seasonTargetRaceNote").textContent=
    target
      ?`${target.priority}-race · ${formatRaceDistance(target.distanceKm)}${plan.provisional?" · voorlopig doel":""}`
      :"geen toekomstige race";

  document.getElementById("seasonWeeksToTarget").textContent=
    target
      ?Math.max(0,(daysUntil(target.date)/7)).toFixed(1)
      :"—";

  const signals=[];

  if(plan.provisional && target){
    signals.push({
      state:"warn",icon:"!",
      text:`${target.name} wordt voorlopig als hoofddoel gebruikt omdat er geen toekomstige A-race staat.`
    });
  }else if(target){
    signals.push({
      state:"good",icon:"A",
      text:`${target.name} is de eerstvolgende A-race en stuurt de hoofdpiek.`
    });
  }

  if(current){
    signals.push({
      state:"good",icon:"✓",
      text:`Huidige week valt in blok ${current.label}; doelvolume circa ${Math.round(current.volumeFactor*100)}% vóór herstel- en weekcorrecties.`
    });
  }

  const calendar=raceCalendarAnalysis();
  if(calendar.conflicts.length){
    signals.push({
      state:"warn",icon:"!",
      text:`${calendar.conflicts.length} wedstrijdkalenderconflict(en) blijven zichtbaar in de Race Calendar Optimizer.`
    });
  }

  document.getElementById("seasonPlannerSignals").innerHTML=
    signals.length
      ?signals.map(signal=>`
        <div class="reason-item">
          <div class="reason-icon ${signal.state}">${signal.icon}</div>
          <div>${safe(signal.text)}</div>
        </div>
      `).join("")
      :'<div class="reason-item"><div class="reason-icon warn">?</div><div>Geen toekomstige doelwedstrijd beschikbaar.</div></div>';

  document.getElementById("seasonRoadmap").innerHTML=
    plan.blocks.length
      ?plan.blocks.map(block=>{
        const isCurrent=current &&
          current.phase===block.phase &&
          current.start===block.start &&
          current.targetRace.id===block.targetRace.id;
        const raceText=block.races.length
          ?` · races: ${block.races.map(r=>`${r.priority} ${r.name}`).join(", ")}`
          :"";
        return`
          <div class="season-block-row ${isCurrent?"current":""}">
            <div class="season-block-phase ${block.phase}">${safe(block.label)}</div>
            <div>
              <strong>${safe(block.targetRace.name)}</strong>
              <small>
                ${safe(block.focus)}${safe(raceText)}
              </small>
            </div>
            <div class="season-block-meta">
              ${block.start}<br>
              t/m ${block.end}<br>
              ${seasonBlockDays(block)} d · ${Math.round(block.volumeFactor*100)}%
            </div>
          </div>`;
      }).join("")
      :'<p class="help">Nog geen trainingsblokken beschikbaar.</p>';
}

function seasonPhaseToLegacyPhase(block,race){
  if(!block) return classifyRacePhase(race);
  const days=race?daysUntil(race.date):null;
  if(block.phase==="race") return{phase:"race-week",days};
  if(block.phase==="taper") return{phase:"taper",days};
  if(block.phase==="specific") return{phase:"specific",days};
  if(block.phase==="recovery") return{phase:"general",days};
  return{phase:"build",days};
}


function racePriorityRank(priority){
  return({A:0,B:1,C:2})[String(priority||"C").toUpperCase()] ?? 3;
}

function futureRacesSorted(){
  return Object.values(races)
    .filter(race=>daysUntil(race.date)>=0)
    .sort((a,b)=>a.date.localeCompare(b.date));
}

function getPrimaryARace(){
  return futureRacesSorted().find(race=>String(race.priority).toUpperCase()==="A") || null;
}

function racesInRange(start,end){
  return futureRacesSorted().filter(race=>race.date>=start && race.date<=end);
}

function signedDateGapDays(dateA,dateB){
  const difference=calendarDayDifference(dateA,dateB);
  return difference===null?0:difference;
}

function raceRecoveryDays(race){
  const distance=Number(race?.distanceKm||0);
  let days=1;
  if(distance>5) days=2;
  if(distance>=15) days=3;
  if(distance>=30) days=5;
  if(distance>=42) days=7;

  if(String(race?.priority).toUpperCase()==="A" && distance>=15){
    days+=1;
  }
  return days;
}

function raceTaperDays(race){
  const priority=String(race?.priority||"C").toUpperCase();
  const distance=Number(race?.distanceKm||0);

  if(priority==="C") return 0;

  let days=4;
  if(distance>=10) days=5;
  if(distance>=15) days=8;
  if(distance>=30) days=12;

  if(priority==="B"){
    return Math.max(1,Math.round(days*.45));
  }

  return days;
}

function raceMinimumSpacingDays(a,b){
  const maxDistance=Math.max(Number(a?.distanceKm||0),Number(b?.distanceKm||0));
  const bothA=String(a?.priority).toUpperCase()==="A" &&
    String(b?.priority).toUpperCase()==="A";

  let spacing=maxDistance>=30?35:maxDistance>=15?21:maxDistance>=10?12:8;
  if(bothA) spacing+=maxDistance>=15?7:3;
  return spacing;
}

function raceCalendarAnalysis(){
  const upcoming=futureRacesSorted();
  const nextRace=upcoming[0]||null;
  const primaryA=getPrimaryARace();
  const signals=[];
  const conflicts=[];
  const priorityCounts={A:0,B:0,C:0};

  upcoming.forEach(race=>{
    const p=String(race.priority||"C").toUpperCase();
    if(priorityCounts[p]!==undefined) priorityCounts[p]++;
  });

  for(let i=0;i<upcoming.length-1;i++){
    const first=upcoming[i];
    const second=upcoming[i+1];
    const gap=signedDateGapDays(second.date,first.date);
    const minSpacing=raceMinimumSpacingDays(first,second);
    const recovery=raceRecoveryDays(first);
    const taper=raceTaperDays(second);
    const overlap=recovery+taper-gap;

    if(gap<Math.max(recovery,taper)){
      conflicts.push({
        severity:"bad",
        text:`${first.name} en ${second.name} liggen slechts ${gap} dagen uit elkaar; herstel/taper overlappen.`
      });
    }else if(overlap>0){
      conflicts.push({
        severity:"warn",
        text:`Tussen ${first.name} en ${second.name} blijft weinig normale trainingsruimte over (${gap} dagen).`
      });
    }

    if(
      String(first.priority).toUpperCase()==="A" &&
      String(second.priority).toUpperCase()==="A" &&
      gap<minSpacing
    ){
      conflicts.push({
        severity:"bad",
        text:`Twee A-wedstrijden staan ${gap} dagen uit elkaar; voor deze afstanden is circa ${minSpacing} dagen scheiding een conservatievere planning.`
      });
    }
  }

  if(primaryA){
    upcoming.forEach(race=>{
      if(race.id===primaryA.id) return;
      const gap=signedDateGapDays(primaryA.date,race.date);

      if(gap>0 && gap<=raceTaperDays(primaryA) &&
        String(race.priority).toUpperCase()!=="C"){
        conflicts.push({
          severity:"warn",
          text:`${race.name} valt binnen de taper richting A-race ${primaryA.name}. Overweeg deze wedstrijd als C-race te behandelen.`
        });
      }
    });
  }

  if(!upcoming.length){
    signals.push({
      state:"warn",
      icon:"?",
      text:"Nog geen toekomstige wedstrijden toegevoegd."
    });
  }else{
    if(primaryA){
      signals.push({
        state:"good",
        icon:"A",
        text:`Primaire piek: ${primaryA.name} op ${primaryA.date}.`
      });
    }else{
      signals.push({
        state:"warn",
        icon:"!",
        text:"Er staat geen toekomstige A-wedstrijd in de kalender; de eerstvolgende race wordt tijdelijk trainingsfocus."
      });
    }

    if(conflicts.length){
      conflicts.forEach(item=>signals.push({
        state:item.severity==="bad"?"bad":"warn",
        icon:item.severity==="bad"?"×":"!",
        text:item.text
      }));
    }else{
      signals.push({
        state:"good",
        icon:"✓",
        text:"Geen duidelijke overlap tussen taper- en herstelvensters gevonden."
      });
    }
  }

  let level="good";
  if(!upcoming.length) level="empty";
  else if(conflicts.some(item=>item.severity==="bad")) level="conflict";
  else if(conflicts.length) level="attention";

  const timeline=upcoming.map((race,index)=>{
    const previous=index>0?upcoming[index-1]:null;
    return{
      race,
      days:daysUntil(race.date),
      taperDays:raceTaperDays(race),
      recoveryDays:raceRecoveryDays(race),
      gapFromPrevious:previous?signedDateGapDays(race.date,previous.date):null
    };
  });

  return{
    upcoming,
    nextRace,
    primaryA,
    priorityCounts,
    conflicts,
    signals,
    level,
    timeline
  };
}

function raceCalendarStatusText(level){
  return({
    good:"Goed",
    attention:"Aandacht",
    conflict:"Conflict",
    empty:"Geen races"
  })[level]||"—";
}

function renderRaceCalendarOptimizer(){
  const status=document.getElementById("raceCalendarStatus");
  if(!status) return;

  const analysis=raceCalendarAnalysis();

  status.textContent=raceCalendarStatusText(analysis.level);
  document.getElementById("raceCalendarStatusNote").textContent=
    analysis.level==="good"
      ?"taper en herstel passen"
      :analysis.level==="attention"
        ?"controleer gemarkeerde overlap"
        :analysis.level==="conflict"
          ?"minstens één sterke kalenderbotsing"
          :"voeg wedstrijden toe";

  document.getElementById("raceCalendarNext").textContent=
    analysis.nextRace?analysis.nextRace.name:"—";
  document.getElementById("raceCalendarNextNote").textContent=
    analysis.nextRace
      ?`${analysis.nextRace.priority}-race · over ${daysUntil(analysis.nextRace.date)} d`
      :"—";

  document.getElementById("raceCalendarPrimary").textContent=
    analysis.primaryA?analysis.primaryA.name:"—";
  document.getElementById("raceCalendarPrimaryNote").textContent=
    analysis.primaryA
      ?`over ${daysUntil(analysis.primaryA.date)} d · ${formatRaceDistance(analysis.primaryA.distanceKm)}`
      :"geen A-race ingesteld";

  document.getElementById("raceCalendarCount").textContent=
    String(analysis.upcoming.length);
  document.getElementById("raceCalendarPriorityCount").textContent=
    `A ${analysis.priorityCounts.A} · B ${analysis.priorityCounts.B} · C ${analysis.priorityCounts.C}`;

  document.getElementById("raceCalendarSignals").innerHTML=
    analysis.signals.map(signal=>`
      <div class="reason-item">
        <div class="reason-icon ${signal.state}">${signal.icon}</div>
        <div>${safe(signal.text)}</div>
      </div>
    `).join("");

  let headline="Wedstrijdkalender is logisch opgebouwd";
  let conclusion=
    "A-races sturen de hoofdpiek. B-races krijgen beperkte taper en C-races worden zoveel mogelijk als trainingsprikkel verwerkt.";

  if(analysis.level==="attention"){
    headline="Kalender is bruikbaar, maar vraagt afstemming";
    conclusion=
      "Minstens één wedstrijd ligt dicht tegen een taper- of herstelvenster. De weekplanners beperken daar automatisch zware trainingsprikkels.";
  }
  if(analysis.level==="conflict"){
    headline="Wedstrijdkalender bevat een sterke botsing";
    conclusion=
      "De app beschermt de trainingsweken rond deze races, maar bekijk vooral de prioriteit van de gemarkeerde wedstrijden voordat je een volledig schema genereert.";
  }
  if(analysis.level==="empty"){
    headline="Nog geen seizoen om te optimaliseren";
    conclusion="Voeg eerst je komende wedstrijden toe en geef iedere race A-, B- of C-prioriteit.";
  }

  document.getElementById("raceCalendarHeadline").textContent=headline;
  document.getElementById("raceCalendarConclusion").textContent=conclusion;

  document.getElementById("raceCalendarTimeline").innerHTML=
    analysis.timeline.length
      ?analysis.timeline.map(item=>`
        <div class="race-timeline-row">
          <div class="race-timeline-priority ${String(item.race.priority).toLowerCase()}">
            ${safe(item.race.priority)}
          </div>
          <div>
            <strong>${safe(item.race.name)}</strong>
            <small>
              ${safe(item.race.date)} · ${formatRaceDistance(item.race.distanceKm)}
              · over ${item.days} dagen
              ${item.gapFromPrevious!==null?` · ${item.gapFromPrevious} d na vorige race`:""}
            </small>
          </div>
          <div class="race-window">
            taper ${item.taperDays} d<br>
            herstel ${item.recoveryDays} d
          </div>
        </div>
      `).join("")
      :'<p class="help">Nog geen komende wedstrijden.</p>';
}

function protectedEasyWorkout(workout,race,recovery=false){
  const originalKm=Number(workout?.distanceKm)||8;
  const km=Math.max(5,Math.min(recovery?7:9,originalKm));
  const copy={
    ...JSON.parse(JSON.stringify(workout)),
    type:"Run",
    distanceKm:km,
    durationMinutes:0,
    name:recovery?`Herstel na ${race.name}`:`Rustig richting ${race.name}`,
    uploadName:recovery?`Jaco - Herstel na ${race.name}`:`Jaco - Rustig richting ${race.name}`,
    rpe:recovery?"2/10":"3/10",
    planType:recovery?"recovery":"easy",
    displaySteps:[
      `${km} km ${recovery?"zeer rustig":"rustig in zone 2"}`,
      "Geen extra versnellingen of intensiteit"
    ],
    intervalsDescription:`${recovery?"Hersteltraining":"Rustige duurloop"} rond wedstrijdkalender.

Easy
- ${km}km ${recovery?"5:15-5:40/km":"5:00-5:25/km"} Pace`
  };
  return copy;
}

function applyRaceCalendarToWeek(context,workouts){
  const weekEnd=addDays(context.start,6);
  const protectedRaces=Object.values(races).filter(race=>
    race.date>=addDays(context.start,-10) &&
    race.date<=addDays(weekEnd,2)
  );

  if(!protectedRaces.length) return workouts;

  const adjusted=[];

  for(const source of workouts){
    let workout=JSON.parse(JSON.stringify(source));
    let skip=false;

    for(const race of protectedRaces){
      const delta=signedDateGapDays(workout.date,race.date);
      const priority=String(race.priority||"C").toUpperCase();

      if(delta===0){
        skip=true;
        break;
      }

      const preProtect=priority==="A"?2:priority==="B"?1:0;
      const recoveryDays=raceRecoveryDays(race);

      if(delta<0 && Math.abs(delta)<=preProtect &&
        (isHardWorkout(workout)||isLongWorkout(workout))){
        workout=protectedEasyWorkout(workout,race,false);
      }

      if(delta>0 && delta<=recoveryDays &&
        (isHardWorkout(workout)||isLongWorkout(workout))){
        workout=protectedEasyWorkout(workout,race,true);
      }
    }

    if(!skip) adjusted.push(workout);
  }

  return adjusted.sort((a,b)=>a.date.localeCompare(b.date));
}

function adjustWorkoutForRaceCalendar(workout,date,excludeRaceId=null){
  let adjusted=workout;

  for(const race of futureRacesSorted()){
    if(race.id===excludeRaceId) continue;

    const delta=signedDateGapDays(date,race.date);
    if(delta===0) return null;

    const priority=String(race.priority||"C").toUpperCase();
    const preProtect=priority==="A"?2:priority==="B"?1:0;

    if(delta<0 && Math.abs(delta)<=preProtect &&
      (isHardWorkout(adjusted)||isLongWorkout(adjusted))){
      adjusted=protectedEasyWorkout(adjusted,race,false);
    }

    if(delta>0 && delta<=raceRecoveryDays(race) &&
      (isHardWorkout(adjusted)||isLongWorkout(adjusted))){
      adjusted=protectedEasyWorkout(adjusted,race,true);
    }
  }

  return adjusted;
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
  const difference=calendarDayDifference(date,todayDateString());
  return difference===null?0:difference;
}

function selectedRaceDistance(){
  const value=document.getElementById("raceDistance").value;
  return value==="other"
    ? Number(document.getElementById("customRaceDistance").value)
    : Number(value);
}

function saveRace(event){
  event.preventDefault();

  const existingId=document.getElementById("raceOriginalId").value;
  const id=existingId || raceId();
  const previousRace=existingId?races[existingId]||null:null;
  const name=safe(document.getElementById("raceName").value).trim();
  const date=document.getElementById("raceDate").value;
  const distanceKm=selectedRaceDistance();
  const status=document.getElementById("raceFormStatus");

  if(!name || !date || !distanceKm){
    status.className="status error";
    status.textContent="Naam, datum en afstand zijn verplicht.";
    return;
  }

  const competingRace=Object.values(races).find(
    race=>race.id!==id && race.date===date
  );

  if(competingRace){
    status.className="status error";
    status.textContent=
      `Op ${date} staat al wedstrijd "${competingRace.name}". Jaco Performance bewaart één hoofdwedstrijd per dag.`;
    return;
  }

  const movingDate=Boolean(previousRace && previousRace.date!==date);
  const targetCustom=customWorkouts[date]||null;
  const targetServer=serverWorkouts[date]||null;
  const importedRaceFallback=
    targetCustom?.type==="Race" &&
    targetCustom?.importedPlan;

  if(
    (movingDate || !previousRace) &&
    ((targetCustom && !importedRaceFallback) || targetServer)
  ){
    const occupied=targetCustom && !importedRaceFallback
      ?targetCustom
      :targetServer;

    status.className="status error";
    status.textContent=
      `Op ${date} staat al "${occupied.name}". Verplaats die training eerst voordat je hier een wedstrijd zet.`;
    return;
  }

  let preserveCompletedRace=false;

  if(movingDate){
    const oldDate=previousRace.date;
    const oldRaceWorkout={
      ...previousRace,
      raceId:id,
      type:"Race"
    };

    preserveCompletedRace=
      completionMarkerMatches(doneWorkouts[oldDate],oldRaceWorkout);

    const hiddenOldCustom=customWorkouts[oldDate]||null;
    if(
      hiddenOldCustom?.type==="Race" &&
      hiddenOldCustom?.importedPlan
    ){
      delete customWorkouts[oldDate];
    }

    clearWorkoutMarkersForDate(oldDate);
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

  if(preserveCompletedRace){
    markWorkoutCompleted(date,{
      ...races[id],
      raceId:id,
      type:"Race"
    });
  }

  saveObject(RACES_KEY,races);
  saveObject(STORAGE_KEY,customWorkouts);
  saveObject(DONE_KEY,doneWorkouts);
  saveObject(UPLOAD_KEY,uploadedWorkouts);
  resetGeneratedPlannerPreviews();
  document.getElementById("raceFormStatus").className="status ok";
  document.getElementById("raceFormStatus").textContent=
    existingId ? "Wedstrijd bijgewerkt." : "Wedstrijd toegevoegd aan de kalender.";

  renderRaces();
  renderRaceOptions();
  renderRaceSimulator();
  renderRaceCalendarOptimizer();
  renderSeasonPlanner();
  renderFullSeasonTargetOptions();
  renderFullSeasonSchedulePreview();
  renderMonth();
  renderSelected();
  refreshDerivedCoachViews();
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

  const date=race.date;
  const visibleWorkout=allWorkouts()[date]||null;
  const hiddenCustom=customWorkouts[date]||null;

  delete races[id];

  // Een door een schema-import aangemaakte racefallback hoort bij dezelfde
  // racedag en mag na expliciet verwijderen niet opnieuw zichtbaar worden.
  if(
    hiddenCustom?.type==="Race" &&
    hiddenCustom?.importedPlan
  ){
    delete customWorkouts[date];
  }

  if(
    visibleWorkout?.type==="Race" &&
    completionMarkerMatches(doneWorkouts[date],visibleWorkout)
  ){
    delete doneWorkouts[date];
  }

  saveObject(RACES_KEY,races);
  saveObject(STORAGE_KEY,customWorkouts);
  saveObject(DONE_KEY,doneWorkouts);
  resetGeneratedPlannerPreviews();

  renderRaces();
  renderRaceOptions();
  renderRaceSimulator();
  renderRaceCalendarOptimizer();
  renderSeasonPlanner();
  renderFullSeasonTargetOptions();
  renderFullSeasonSchedulePreview();
  renderMonth();
  renderSelected();
  refreshDerivedCoachViews();
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
          <button class="secondary" type="button" onclick="openRace('${race.id}')">Open</button>
          <button class="secondary" type="button" onclick="editRace('${race.id}')">Bewerk</button>
          <button class="danger" type="button" onclick="deleteRace('${race.id}')">Verwijder</button>
        </div>
      </div>`;
  }).join("");
}


function renderRaceOptions(){
  const planSelect=document.getElementById("planRaceSelect");
  const simulatorSelect=document.getElementById("raceSimulatorSelect");

  const future=Object.values(races)
    .filter(r=>daysUntil(r.date)>=0)
    .sort((a,b)=>a.date.localeCompare(b.date));

  const options=future.length
    ?future.map(r=>`<option value="${r.id}">${safe(r.name)} — ${r.date}</option>`).join("")
    :'<option value="">Voeg eerst een wedstrijd toe</option>';

  if(planSelect){
    const previous=planSelect.value;
    planSelect.innerHTML=options;
    if(previous && races[previous] && daysUntil(races[previous].date)>=0){
      planSelect.value=previous;
    }
  }

  if(simulatorSelect){
    const previous=simulatorSelect.value;
    simulatorSelect.innerHTML=options;

    if(previous && races[previous] && daysUntil(races[previous].date)>=0){
      simulatorSelect.value=previous;
    }else{
      const focus=getRaceFocus();
      if(focus) simulatorSelect.value=focus.id;
    }
  }

  if(typeof renderRaceDebriefOptions==="function"){
    renderRaceDebriefOptions();
  }
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

  const start=document.getElementById("planStartDate").value || todayDateString();
  const weeklyKm=Number(document.getElementById("planWeeklyKm").value);
  const days=Number(document.getElementById("planDays").value);
  const overwrite=document.getElementById("overwritePlan").checked;
  const raceDate=new Date(race.date+"T12:00:00");
  const totalDays=signedDateGapDays(race.date,start);

  if(totalDays<7){
    status.className="status error";
    status.textContent="De wedstrijd is minder dan één week verwijderd.";
    return;
  }

  const weeks=Math.max(1,Math.ceil(totalDays/7));
  let created=0;
  let skipped=0;
  let replaced=0;
  const firstMonday=mondayOf(start);

  for(let week=0;week<weeks;week++){
    const weekStart=addDays(firstMonday,week*7);
    const daysToRace=signedDateGapDays(race.date,weekStart);
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

      const existing=allWorkouts()[date]||null;
      if(existing?.type==="Race"){
        skipped++;
        continue;
      }
      if(existing && !overwrite){
        skipped++;
        continue;
      }

      let workout;
      if(type==="quality") workout=createQualityWorkout(date,race,week,weeks);
      if(type==="easy") workout=createEasyWorkout(date,easyKm,false);
      if(type==="recovery") workout=createEasyWorkout(date,Math.max(6,easyKm-2),true);
      if(type==="long") workout=createLongRun(date,longKm,race);

      workout=adjustWorkoutForRaceCalendar(workout,date,race.id);
      if(!workout) continue;

      if(existing && overwrite){
        delete doneWorkouts[date];
        delete uploadedWorkouts[date];
        replaced++;
      }

      customWorkouts[date]=workout;
      created++;
    }
  }

  // Race day marker is already provided by races.
  saveObject(STORAGE_KEY,customWorkouts);
  saveObject(DONE_KEY,doneWorkouts);
  saveObject(UPLOAD_KEY,uploadedWorkouts);
  resetGeneratedPlannerPreviews();

  selectedDate=race.date;
  visibleMonth=new Date(raceDate.getFullYear(),raceDate.getMonth(),1);

  renderRaces();
  renderMonth();
  renderSelected();
  renderSaved();
  renderFullSeasonSchedulePreview();
  refreshDerivedCoachViews();

  status.className="status ok";
  status.textContent=
    `Schema aangemaakt: ${created} trainingen richting ${race.name}`+
    `${replaced?` · ${replaced} bestaande vervangen`:""}`+
    `${skipped?` · ${skipped} bestaande/racedagen behouden`:""}.`;
}


function numberOrNull(value){
  return finiteNumberOrNull(value);
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
  const difference=calendarDayDifference(todayDateString(),dateString);
  return difference===null?null:difference;
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
  const valid=items
    .map(item=>({
      value:finiteNumberOrNull(item?.value),
      weight:finiteNumberOrNull(item?.weight)
    }))
    .filter(item=>
      item.value!==null &&
      item.weight!==null &&
      item.weight>0
    );

  if(!valid.length) return null;

  const weight=valid.reduce((sum,item)=>sum+item.weight,0);
  const total=valid.reduce(
    (sum,item)=>sum+item.value*item.weight,
    0
  );

  return clampScore(total/weight);
}

function formatMetric(value,digits=0){
  const number=finiteNumberOrNull(value);
  return number===null ? "—" : number.toFixed(digits);
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


function resetGeneratedPlannerPreviews(){
  pendingWeekPlan=[];
  pendingAdaptiveWeek=[];
  pendingFullSeasonSchedule=null;

  aiWeekOptions=[];
  selectedAiWeekIndex=0;

  aiTrainingOptions=[];
  selectedAiTrainingIndex=0;

  smartWeekOptions=[];
  selectedSmartWeekIndex=0;
}

function refreshDerivedCoachViews(){
  // renderTodayCoach ververst ook Load Monitor, Performance Engine en AI-previews.
  // Houd die keten op één plek om dubbele DOM-renders op mobiel te voorkomen.
  renderTrainingQualityAnalyzer();
  renderTrainingResponseLearner();
  renderKeySessionProgression();
  renderTodayCoach();
  renderAdaptiveWeekReplanner();
  renderFullyAdaptiveCoach();
  renderCoachBrain();
  buildCoachHorizon();
  renderCoachIntelligence();
  renderPerformanceTrend(activeTrendDays);
  renderSmartWeekCoach();
  renderRaceSimulator();
}

function refreshAfterCalendarMutation({resetPlans=true}={}){
  if(resetPlans){
    resetGeneratedPlannerPreviews();
  }

  renderMonth();
  renderSelected();
  renderSaved();
  renderFullSeasonTargetOptions();
  renderFullSeasonSchedulePreview();
  refreshDerivedCoachViews();
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

  document.getElementById("dashboardUpdated").textContent=
    `Intervals.icu gecontroleerd t/m ${latest.id || latest.date || "onbekende datum"}.`;

  refreshDerivedCoachViews();

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

  const wellnessStatus=document.getElementById("wellnessStatus");
  if(wellnessStatus){
    wellnessStatus.className="status ok";
    wellnessStatus.textContent=
      dataSufficient
        ? "Actuele hersteldata geladen."
        : "Data geladen, maar onvoldoende actuele herstelmetingen voor een coachscore.";
  }
}

async function loadWellnessDashboard(){
  const error=document.getElementById("dashboardError");
  const success=document.getElementById("wellnessStatus");

  if(error) error.textContent="";
  if(success) success.textContent="";

  if(typeof navigator!=="undefined" && navigator.onLine===false){
    if(error) error.textContent="Je bent offline. Lokale planning blijft beschikbaar.";
    if(success){
      success.className="status";
      success.textContent="Offline modus · geen actuele Intervals.icu-data.";
    }
    document.getElementById("dashboardUpdated").textContent="Offline";
    refreshDerivedCoachViews();
    return{ok:false,error:new Error("Offline")};
  }

  document.getElementById("dashboardUpdated").textContent=
    "Intervals.icu-data wordt geladen…";

  try{
    const response=await fetchWithAppPin("/api/intervals-status");
    const data=await response.json();

    if(!response.ok){
      throw new Error(
        data.error || "Dashboarddata kon niet worden geladen."
      );
    }

    renderWellnessDashboard(data);
    return{ok:true,data};
  }catch(err){
    if(error) error.textContent=err.message;
    if(success){
      success.className="status error";
      success.textContent="Actuele Intervals.icu-data kon niet worden vernieuwd.";
    }

    document.getElementById("dashboardUpdated").textContent=
      "Data niet beschikbaar.";

    // De rest van de app blijft bruikbaar met eerder geladen of onbekende data.
    refreshDerivedCoachViews();
    return{ok:false,error:err};
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

function scheduleByAvailability(workouts,startDate=nextMonday(),daysOverride=null){
  const days=daysOverride || availableDaysForPlanner();
  if(!days.length) return [];

  const start=startDate;
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
  if(p.autoCore && !(typeof supportSettings==="function" && supportSettings().enabled)){
    const supportDay=days.find(d=>
      !used.has(d.index) &&
      ["core","mobiliteit","rustig"].includes(d.preference)
    );

    if(supportDay){
      const date=addDays(start,supportDay.index);
      const minutes=Math.min(20,Math.max(10,supportDay.maxMinutes||15));

      const supportWorkout=
        supportDay.preference==="mobiliteit"
          ?{
              date,
              type:"Mobility",
              distanceKm:0,
              durationMinutes:minutes,
              name:"Mobiliteit en herstel",
              uploadName:"Jaco - Mobiliteit en herstel",
              rpe:"2/10",
              status:"planned",
              priority:supportDay.priority||"could",
              planType:"mobility",
              displaySteps:[
                "Heupmobiliteit",
                "Enkelmobiliteit",
                "Hamstrings en bilspieren",
                "Borstrotaties"
              ],
              intervalsDescription:"Mobiliteit en herstel."
            }
          :makeCoreWorkout(
              date,
              minutes,
              supportDay.priority||"could"
            );

      scheduled.push(supportWorkout);
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
  const currentSeasonBlock=seasonBlockForDate(todayDateString());
  const phase=seasonPhaseToLegacyPhase(currentSeasonBlock,race);
  const availability=todayAvailabilityInfo();
  const existing=currentTodayWorkout();

  return{
    snapshot,
    readiness,
    race,
    phase,
    seasonBlock:currentSeasonBlock,
    availability,
    existing
  };
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
  const context=coachContext();

  if(context.existing?.type==="Race"){
    const raceWorkout=context.existing;

    document.getElementById("brainDecisionTitle").textContent=
      raceWorkout.name;
    document.getElementById("brainDecisionText").textContent=
      "Wedstrijddag is beschermd. Coach Brain maakt vandaag geen vervangende trainingssessie.";

    const factorRows=[
      {
        cls:"good",
        icon:"🏁",
        text:`Wedstrijd vandaag: ${raceWorkout.name}`
      },
      {
        cls:context.readiness.level==="unknown"
          ?"warn"
          :context.readiness.level==="good"
            ?"good"
            :context.readiness.level==="moderate"
              ?"warn"
              :"bad",
        icon:context.readiness.level==="unknown"?"?":"✓",
        text:context.readiness.level==="unknown"
          ?"Herstelstatus: onvoldoende actuele data"
          :`Herstelstatus: ${context.readiness.level} (${context.readiness.score}/100)`
      },
      {
        cls:"good",
        icon:"↗",
        text:context.seasonBlock
          ?`Seizoensblok: ${context.seasonBlock.label}`
          :"Wedstrijd blijft leidend"
      }
    ];

    document.getElementById("brainFactors").innerHTML=
      factorRows.map(row=>`
        <div class="reason-item">
          <div class="reason-icon ${row.cls}">${row.icon}</div>
          <div>${safe(row.text)}</div>
        </div>
      `).join("");

    return;
  }

  const decision=chooseCoachBrainSession();
  const workout=buildLibraryWorkout(decision);
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
  const baseKm=Math.min(
    Number(profileData.maxKm)||70,
    Number(profileData.weeklyKm)||60
  );

  const weeks=[0,1,2,3].map(offset=>{
    const start=addDays(nextMonday(),offset*7);
    const end=addDays(start,6);
    const block=seasonBlockForWeek(start);

    const fallbackPhase=horizonWeekPhase(raceDays,offset);
    const phaseLabelText=block?.label || fallbackPhase;

    let phaseFactor=block?.volumeFactor ?? 1;
    if(!block && fallbackPhase==="Taper") phaseFactor=.75;
    if(!block && fallbackPhase==="Wedstrijdweek") phaseFactor=.50;

    // Alleen de eerstvolgende week mag actuele hersteldata gebruiken.
    // Voor toekomstige weken wordt herstel niet voorspeld.
    const readinessFactor=
      offset===0
        ?readiness.level==="low"
          ?.78
          :readiness.level==="moderate"
            ?.90
            :1
        :1;

    const km=Math.max(
      20,
      Math.round(baseKm*readinessFactor*phaseFactor)
    );

    const focus=
      block?.quality ||
      horizonQualityFocus(race,fallbackPhase);

    const color=
      block?.phase==="race" || fallbackPhase==="Wedstrijdweek"
        ?"red"
        :block?.phase==="taper" || fallbackPhase==="Taper"
          ?"orange"
          :"green";

    return{
      offset,
      start,
      end,
      phase:phaseLabelText,
      km,
      focus,
      color,
      targetRace:block?.targetRace || race,
      usesCurrentRecovery:offset===0 && readiness.level!=="unknown"
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
        <strong>${safe(week.phase)}</strong>
        <small>${safe(week.focus)} · ${safe(week.targetRace.name)}${week.usesCurrentRecovery?" · actuele recovery meegewogen":""}</small>
      </div>
      <span class="adaptive-tag ${week.color}">
        ± ${week.km} km
      </span>
    </div>
  `).join("");
}





let activeTrendDays=7;

function trendNumber(value){
  return finiteNumberOrNull(value);
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

  const performanceInputs=[
    {value:fitness,weight:.40},
    {value:fatigue,weight:.22},
    {value:recovery,weight:.38}
  ];
  const availablePerformanceInputs=performanceInputs.filter(
    item=>item.value!==null && item.value!==undefined
  ).length;

  const performance=
    availablePerformanceInputs>=2
      ?weightedAvailableScore(performanceInputs)
      :null;

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

  const validPoints=points.filter(point=>
    point.performance!==null &&
    point.performance!==undefined &&
    Number.isFinite(Number(point.performance))
  );

  if(validPoints.length<2){
    chart.hidden=true;
    empty.hidden=false;
    line.setAttribute("points","");
    dots.innerHTML="";
    grid.innerHTML="";
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

  const coordinates=validPoints.map((point,index)=>{
    const x=left+(index/(validPoints.length-1))*width;
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


function workoutWasCompleted(date,workout){
  return completionMarkerMatches(doneWorkouts[date],workout) ||
    ["done","completed","voltooid"].includes(
      String(workout?.status||"").toLowerCase()
    );
}

function completedWorkoutEntriesBetween(minDaysAgo,maxDaysAgo){
  const entries=Object.entries(allWorkouts())
    .map(([date,workout])=>({date,workout}))
    .filter(item=>{
      if(!item.workout) return false;
      if(item.workout.type==="Rest") return false;
      if(!workoutWasCompleted(item.date,item.workout)) return false;

      const age=calendarDayDifference(todayDateString(),item.date);
      return age!==null && age>=minDaysAgo && age<=maxDaysAgo;
    });
  return typeof supportCompletedEntries==="function"
    ?entries.concat(supportCompletedEntries(minDaysAgo,maxDaysAgo)):entries;
}

function completedWorkoutEntries(days){
  return completedWorkoutEntriesBetween(0,Math.max(0,days-1));
}

function runKmFromEntries(entries){
  return entries
    .filter(item=>isRunLikeWorkout(item.workout))
    .reduce(
      (sum,item)=>sum+completedEntryRunDistanceKm(item),
      0
    );
}

function maxRunStreak(entries){
  const dates=[...new Set(
    entries
      .filter(item=>isRunLikeWorkout(item.workout))
      .map(item=>item.date)
  )].sort();

  if(!dates.length) return null;

  let best=1;
  let current=1;

  for(let i=1;i<dates.length;i++){
    const gap=dateGapDays(dates[i-1],dates[i]);

    if(gap===1){
      current++;
      best=Math.max(best,current);
    }else{
      current=1;
    }
  }

  return best;
}

function minimumHardSessionGap(entries){
  const hard=entries
    .filter(item=>
      isRunLikeWorkout(item.workout) &&
      isHardWorkout(item.workout)
    )
    .sort((a,b)=>a.date.localeCompare(b.date));

  if(hard.length<2){
    return{
      sessions:hard.length,
      minGapDays:null
    };
  }

  let minGap=Infinity;

  for(let i=1;i<hard.length;i++){
    minGap=Math.min(
      minGap,
      dateGapDays(hard[i-1].date,hard[i].date)
    );
  }

  return{
    sessions:hard.length,
    minGapDays:minGap
  };
}

function loadMonitorStatusLabel(level){
  const labels={
    stable:"Stabiel",
    attention:"Aandacht",
    elevated:"Verhoogd",
    unknown:"Onvoldoende data"
  };
  return labels[level]||level;
}

function buildLoadMonitor(){
  const snapshot=getWellnessSnapshot();
  const readiness=determineReadiness(snapshot);
  const diary=buildDiaryContext();

  const last7=completedWorkoutEntries(7);
  const last14=completedWorkoutEntries(14);
  const previous21=completedWorkoutEntriesBetween(7,27);

  const runKm7=runKmFromEntries(last7);
  const previous21Km=runKmFromEntries(previous21);
  const baselineWeeklyKm=
    previous21Km>0
      ? previous21Km/3
      : null;

  const volumeRatio=
    baselineWeeklyKm!==null && baselineWeeklyKm>=10
      ? runKm7/baselineWeeklyKm
      : null;

  const volumeDeltaPct=
    volumeRatio===null
      ? null
      : (volumeRatio-1)*100;

  const ctl=snapshot.ctl;
  const atl=snapshot.atl;
  const atlCtl=
    ctl!==null && ctl>0 && atl!==null
      ? atl/ctl
      : null;

  const hard=minimumHardSessionGap(last7);
  const streak=maxRunStreak(last14);

  const runEntries7=last7.filter(item=>isRunLikeWorkout(item.workout));
  const longestRunKm=runEntries7.length
    ?Math.max(...runEntries7.map(completedEntryRunDistanceKm))
    :null;

  const longRunShare=
    longestRunKm!==null && runKm7>0
      ?longestRunKm/runKm7
      :null;

  const signals=[];
  const highFlags=[];
  const attentionFlags=[];

  if(atlCtl!==null){
    if(atlCtl>1.5){
      highFlags.push("atlctl");
      signals.push({
        state:"bad",
        icon:"!",
        text:`ATL/CTL ${atlCtl.toFixed(2)}: acute belasting ligt duidelijk boven de chronische belasting.`
      });
    }else if(atlCtl>1.3){
      attentionFlags.push("atlctl");
      signals.push({
        state:"warn",
        icon:"!",
        text:`ATL/CTL ${atlCtl.toFixed(2)}: acute belasting is verhoogd ten opzichte van je chronische belasting.`
      });
    }else{
      signals.push({
        state:"good",
        icon:"✓",
        text:`ATL/CTL ${atlCtl.toFixed(2)} geeft geen extra belastingssignaal.`
      });
    }
  }else{
    signals.push({
      state:"warn",
      icon:"?",
      text:"Geen actuele combinatie van ATL en CTL beschikbaar."
    });
  }

  if(volumeRatio!==null){
    if(volumeRatio>1.5){
      highFlags.push("volume");
      signals.push({
        state:"bad",
        icon:"!",
        text:`Voltooid loopvolume ligt ${Math.round(volumeDeltaPct)}% boven het gemiddelde van de voorgaande drie weken.`
      });
    }else if(volumeRatio>1.25){
      attentionFlags.push("volume");
      signals.push({
        state:"warn",
        icon:"!",
        text:`Voltooid loopvolume ligt ${Math.round(volumeDeltaPct)}% boven je recente weekbasis.`
      });
    }else{
      signals.push({
        state:"good",
        icon:"✓",
        text:`7-daags loopvolume ligt binnen circa 25% van je recente weekbasis.`
      });
    }
  }else{
    signals.push({
      state:"warn",
      icon:"?",
      text:"Onvoldoende lokaal voltooide looptrainingen om een volumeverandering te bepalen."
    });
  }

  if(hard.sessions>=2){
    if(hard.minGapDays!==null && hard.minGapDays<=1){
      highFlags.push("hard-spacing");
      signals.push({
        state:"bad",
        icon:"!",
        text:`${hard.sessions} zware loopsessies in 7 dagen; de kleinste tussenruimte is slechts ${hard.minGapDays} dag.`
      });
    }else if(hard.sessions>=3 || (hard.minGapDays!==null && hard.minGapDays<2)){
      attentionFlags.push("hard-spacing");
      signals.push({
        state:"warn",
        icon:"!",
        text:`${hard.sessions} zware loopsessies in 7 dagen; bewaak minimaal één rustige dag tussen zware prikkels.`
      });
    }else{
      signals.push({
        state:"good",
        icon:"✓",
        text:`${hard.sessions} zware loopsessies zijn voldoende uit elkaar geplaatst.`
      });
    }
  }else if(hard.sessions===1){
    signals.push({
      state:"good",
      icon:"✓",
      text:"Eén zware loopsessie geregistreerd in de laatste 7 dagen."
    });
  }

  if(longRunShare!==null && runKm7>=25){
    if(longRunShare>0.45){
      attentionFlags.push("long-share");
      signals.push({
        state:"warn",
        icon:"!",
        text:`Je langste duurloop vormt ${Math.round(longRunShare*100)}% van het totale 7-daagse loopvolume.`
      });
    }
  }

  if(streak!==null && streak>=4){
    attentionFlags.push("streak");
    signals.push({
      state:"warn",
      icon:"!",
      text:`Maximaal ${streak} opeenvolgende loopdagen in de laatste 14 dagen.`
    });
  }

  if(readiness.sufficientData){
    if(readiness.level==="low"){
      highFlags.push("recovery");
      signals.push({
        state:"bad",
        icon:"!",
        text:`Actueel herstel is laag (${readiness.score}/100).`
      });
    }else if(readiness.level==="moderate"){
      attentionFlags.push("recovery");
      signals.push({
        state:"warn",
        icon:"!",
        text:`Actueel herstel is middelmatig (${readiness.score}/100).`
      });
    }else{
      signals.push({
        state:"good",
        icon:"✓",
        text:`Actueel herstel is goed (${readiness.score}/100).`
      });
    }
  }else{
    signals.push({
      state:"warn",
      icon:"?",
      text:"Herstel wordt niet meegewogen: onvoldoende actuele herstelsignalen."
    });
  }


  if(diary.level==="elevated"){
    highFlags.push("diary");
    signals.push({
      state:"bad",
      icon:"!",
      text:`Coachdagboek: ${diary.reasons.join(", ")}.`
    });
  }else if(diary.level==="attention"){
    attentionFlags.push("diary");
    signals.push({
      state:"warn",
      icon:"!",
      text:`Coachdagboek vraagt aandacht: ${diary.reasons.join(", ")}.`
    });
  }else if(diary.level==="stable"){
    signals.push({
      state:"good",
      icon:"✓",
      text:"Coachdagboek geeft geen terugkerend subjectief belastingssignaal."
    });
  }else{
    signals.push({
      state:"warn",
      icon:"?",
      text:"Coachdagboek niet meegewogen: geen recente check-in."
    });
  }

  const supplementary=typeof supportLoadSummary==="function"?supportLoadSummary():null;
  if(supplementary?.count){
    signals.push({state:supplementary.recentPain?"bad":supplementary.recentHard?"warn":"good",icon:"+",
      text:`Aanvullende sessies: ${supplementary.count} in 7 dagen; ${supplementary.measuredCount} met werkelijke duur (${Math.round(supplementary.minutes)} min). `+
        (supplementary.load===null?"sRPE onbekend.":`${Math.round(supplementary.load)} sRPE-eenheden uit ${supplementary.rpeCount} sessies; apart van CTL/ATL.`)});
    if(supplementary.recentPain) highFlags.push("support-pain");
    else if(supplementary.recentHard) attentionFlags.push("support-hard");
  }

  const availableSignals=[
    atlCtl!==null,
    volumeRatio!==null,
    hard.sessions>0,
    longRunShare!==null,
    readiness.sufficientData,
    diary.level!=="unknown",
    Boolean(supplementary?.rpeCount || supplementary?.recentPain)
  ].filter(Boolean).length;

  let level="stable";

  if(supplementary?.recentPain){
    level="elevated";
  }else if(availableSignals<2){
    level="unknown";
  }else if(highFlags.length){
    level="elevated";
  }else if(attentionFlags.length){
    level="attention";
  }

  let headline="Belasting oogt stabiel";
  let summary="De beschikbare signalen geven geen duidelijke reden om je trainingsbelasting extra te beperken.";
  let adviceTitle="Volg je normale planning";
  let adviceText="Voeg vandaag geen extra kilometers of extra intensiteit toe buiten het geplande schema.";

  if(level==="attention"){
    headline="Een of meer belastingssignalen vragen aandacht";
    summary="Je hoeft niet automatisch rust te nemen, maar extra volume of een extra zware prikkel is nu minder verstandig.";
    adviceTitle="Train gecontroleerd";
    adviceText="Houd de geplande training bij het afgesproken volume en herstel goed voordat je een volgende zware prikkel toevoegt.";
  }

  if(level==="elevated"){
    headline="Belasting is momenteel verhoogd";
    summary="Minstens één sterk belastings- of herstelsignaal is actief. De coach kiest daarom tijdelijk voor een conservatievere trainingsprikkel.";
    adviceTitle="Vandaag geen extra zware prikkel";
    adviceText="Kies rust, mobiliteit of een rustige duurtraining. Hervat intensiteit pas wanneer de sterke belastingssignalen zijn afgenomen.";
  }

  if(level==="unknown"){
    headline="Onvoldoende data voor belastbaarheidsadvies";
    summary="De app heeft te weinig bruikbare signalen om trainingsbelasting betrouwbaar te beoordelen.";
    adviceTitle="Geen automatische belastingcorrectie";
    adviceText="Gebruik je bestaande planning en eigen gevoel; de monitor doet geen aannames over ontbrekende data.";
  }

  return{
    level,
    headline,
    summary,
    adviceTitle,
    adviceText,
    signals,
    availableSignals,
    totalSignalSlots:7,
    metrics:{
      atlCtl,
      runKm7:Math.round(runKm7*10)/10,
      baselineWeeklyKm:
        baselineWeeklyKm===null
          ?null
          :Math.round(baselineWeeklyKm*10)/10,
      volumeDeltaPct,
      hardSessions:hard.sessions,
      hardGapDays:hard.minGapDays,
      recoveryScore:
        readiness.sufficientData
          ?readiness.score
          :null,
      streak,
      longestRunKm,
      longRunShare,
      diaryLevel:diary.level
    },
    highFlags,
    attentionFlags
  };
}

function renderLoadMonitor(prebuiltResult=null){
  const result=prebuiltResult || buildLoadMonitor();

  const badge=document.getElementById("loadMonitorBadge");
  if(!badge) return result;

  badge.className=`load-status ${result.level}`;
  badge.textContent=loadMonitorStatusLabel(result.level);

  document.getElementById("loadMonitorHeadline").textContent=
    result.headline;

  document.getElementById("loadMonitorSummary").textContent=
    result.summary;

  document.getElementById("loadMonitorAtlCtl").textContent=
    result.metrics.atlCtl===null
      ?"—"
      :result.metrics.atlCtl.toFixed(2);

  document.getElementById("loadMonitorAtlCtlNote").textContent=
    result.metrics.atlCtl===null
      ?"geen actuele CTL/ATL-combinatie"
      :"acute vs. chronische belasting";

  document.getElementById("loadMonitorVolume").textContent=
    result.metrics.runKm7>0
      ?`${result.metrics.runKm7} km`
      :"—";

  document.getElementById("loadMonitorVolumeNote").textContent=
    result.metrics.volumeDeltaPct===null
      ?"geen bruikbare 3-wekenbasis"
      :`${result.metrics.volumeDeltaPct>=0?"+":""}${Math.round(result.metrics.volumeDeltaPct)}% vs. eerdere 3 weken`;

  document.getElementById("loadMonitorHard").textContent=
    `${result.metrics.hardSessions}`;

  document.getElementById("loadMonitorHardNote").textContent=
    result.metrics.hardSessions<2
      ?"zware sessies in laatste 7 dagen"
      :`min. ${result.metrics.hardGapDays} dag tussen zwaar`;

  document.getElementById("loadMonitorRecovery").textContent=
    result.metrics.recoveryScore===null
      ?"—"
      :`${result.metrics.recoveryScore}/100`;

  document.getElementById("loadMonitorRecoveryNote").textContent=
    result.metrics.recoveryScore===null
      ?"onvoldoende actuele hersteldata"
      :"actuele coach-readiness";

  document.getElementById("loadMonitorSignals").innerHTML=
    result.signals.map(signal=>`
      <div class="reason-item">
        <div class="reason-icon ${signal.state}">${signal.icon}</div>
        <div>${safe(signal.text)}</div>
      </div>
    `).join("");

  document.getElementById("loadMonitorAdviceTitle").textContent=
    result.adviceTitle;

  document.getElementById("loadMonitorAdviceText").textContent=
    result.adviceText;

  document.getElementById("loadMonitorCoverage").textContent=
    `${result.availableSignals}/${result.totalSignalSlots} signalen`;

  document.getElementById("loadMonitorCoverageText").textContent=
    "Bronnen: actuele Intervals.icu CTL/ATL en hersteldata plus lokaal als voltooid gemarkeerde trainingen. Ontbrekende data wordt niet geschat.";

  return result;
}

function historicalWorkoutEntries(days){
  return completedWorkoutEntriesBetween(0,Math.max(0,days-1));
}

function historySummary(days){
  const entries=historicalWorkoutEntries(days);
  const runEntries=entries.filter(item=>isRunLikeWorkout(item.workout));
  const runKm=runEntries.reduce((sum,item)=>sum+(Number(item.workout.distanceKm)||0),0);

  const quality=runEntries.filter(item=>isHardWorkout(item.workout));

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

  // Met minder dan vier voltooide looptrainingen in 28 dagen is een
  // procentuele trainingsbalans te fragiel om inhoudelijke conclusies te trekken.
  const sufficientHistory=twentyEight.runSessions>=4;

  const easyPct=sufficientHistory
    ?percentage(twentyEight.easy,twentyEight.runSessions)
    :null;
  const qualityPct=sufficientHistory
    ?percentage(twentyEight.quality,twentyEight.runSessions)
    :null;
  const supportPct=sufficientHistory
    ?percentage(twentyEight.support,Math.max(1,twentyEight.sessions))
    :null;

  const signals=[];

  if(!sufficientHistory){
    signals.push({
      state:"warn",
      icon:"?",
      text:`Slechts ${twentyEight.runSessions} voltooide looptrainingen in de laatste 28 dagen; trainingsbalans wordt nog niet beoordeeld.`
    });
  }else{
    if(twentyEight.quality===0){
      signals.push({
        state:"warn",
        icon:"!",
        text:"De afgelopen 28 dagen staat lokaal geen voltooide kwaliteitstraining geregistreerd."
      });
    }else if(qualityPct>35){
      signals.push({
        state:"warn",
        icon:"!",
        text:`${qualityPct}% van je voltooide looptrainingen was kwaliteit; bewaak voldoende rustige dagen.`
      });
    }else{
      signals.push({
        state:"good",
        icon:"✓",
        text:`${twentyEight.quality} voltooide kwaliteitstrainingen in 28 dagen geven een bruikbare trainingsprikkel.`
      });
    }

    if(easyPct>=55){
      signals.push({
        state:"good",
        icon:"✓",
        text:`Rustige looptrainingen vormen ${easyPct}% van je voltooide loopfrequentie.`
      });
    }else{
      signals.push({
        state:"warn",
        icon:"!",
        text:`Rustige looptrainingen vormen ${easyPct}% van je voltooide loopfrequentie.`
      });
    }

    if(twentyEight.longRuns>=3){
      signals.push({
        state:"good",
        icon:"✓",
        text:`${twentyEight.longRuns} lange duurlopen in 28 dagen ondersteunen je duurvermogen.`
      });
    }else{
      signals.push({
        state:"warn",
        icon:"!",
        text:`${twentyEight.longRuns} lange duurlopen in 28 dagen geregistreerd.`
      });
    }

    if(twentyEight.support>=4){
      signals.push({
        state:"good",
        icon:"✓",
        text:`${twentyEight.support} core-, mobiliteits- of krachtsessies ondersteunen belastbaarheid.`
      });
    }else{
      signals.push({
        state:"warn",
        icon:"!",
        text:`${twentyEight.support} ondersteunende sessies in 28 dagen; regelmaat kan beter.`
      });
    }
  }

  const diary=buildDiaryContext();
  if(diary.level==="elevated"){
    signals.push({
      state:"bad",
      icon:"!",
      text:`Recente dagboekfeedback is verhoogd: ${diary.reasons.join(", ")}.`
    });
  }else if(diary.level==="attention"){
    signals.push({
      state:"warn",
      icon:"!",
      text:`Recente dagboekfeedback vraagt aandacht: ${diary.reasons.join(", ")}.`
    });
  }else if(diary.level==="stable"){
    signals.push({
      state:"good",
      icon:"✓",
      text:"Recente dagboekfeedback is stabiel."
    });
  }

  let headline="Trainingsbalans is bruikbaar";
  let conclusion=
    "Behoud de huidige verhouding en laat zware sessies volgen door rustige belasting.";

  if(!sufficientHistory){
    headline="Onvoldoende voltooide trainingshistorie";
    conclusion=
      "Markeer uitgevoerde trainingen als voltooid; vanaf vier voltooide looptrainingen in 28 dagen beoordeelt de coach de balans.";
  }else if(qualityPct>35 || easyPct<50){
    headline="Meer rustige training aanbevolen";
    conclusion=
      "De voltooide lokale geschiedenis bevat relatief veel kwaliteit. Verhoog het aandeel rustige duur en herstel.";
  }else if(twentyEight.quality===0){
    headline="Kwaliteitsprikkel ontbreekt";
    conclusion=
      "Wanneer je herstel het toelaat, plan één gerichte drempel- of VO₂max-training per week.";
  }else if(twentyEight.support<4){
    headline="Ondersteunende training kan consistenter";
    conclusion=
      "Plan regelmatig core en mobiliteit naast het lopen.";
  }else if(twentyEight.longRuns<3){
    headline="Lange duur verdient meer aandacht";
    conclusion=
      "Richting langere wedstrijden is regelmatige passende lange duur nuttig.";
  }

  return{
    seven,
    twentyEight,
    ninety,
    sufficientHistory,
    easyPct,
    qualityPct,
    supportPct,
    signals,
    headline,
    conclusion
  };
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

  const easyWidth=result.easyPct===null?0:result.easyPct;
  const qualityWidth=result.qualityPct===null?0:result.qualityPct;
  const supportWidth=result.supportPct===null?0:result.supportPct;

  document.getElementById("intelEasyBar").style.width=`${easyWidth}%`;
  document.getElementById("intelQualityBar").style.width=`${qualityWidth}%`;
  document.getElementById("intelSupportBar").style.width=`${supportWidth}%`;

  document.getElementById("intelEasyText").textContent=
    result.easyPct===null
      ?`${result.twentyEight.easy} voltooide rustige looptrainingen · onvoldoende data`
      :`${result.twentyEight.easy} rustige looptrainingen · ${result.easyPct}%`;
  document.getElementById("intelQualityText").textContent=
    result.qualityPct===null
      ?`${result.twentyEight.quality} voltooide kwaliteitstrainingen · onvoldoende data`
      :`${result.twentyEight.quality} kwaliteitstrainingen · ${result.qualityPct}%`;
  document.getElementById("intelSupportText").textContent=
    result.supportPct===null
      ?`${result.twentyEight.support} voltooide ondersteunende sessies · onvoldoende data`
      :`${result.twentyEight.support} ondersteunende sessies · ${result.supportPct}%`;

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

let pendingFullSeasonSchedule=null;
let aiWeekOptions=[];
let selectedAiWeekIndex=0;


function mondayOnOrAfter(dateString){
  const d=new Date(dateString+"T12:00:00");
  const mondayIndex=(d.getDay()+6)%7;
  if(mondayIndex===0) return ymd(d);
  d.setDate(d.getDate()+(7-mondayIndex));
  return ymd(d);
}

function fullSeasonTargetRaces(){
  const future=futureRacesSorted();
  const aRaces=future.filter(
    race=>String(race.priority||"C").toUpperCase()==="A"
  );
  return aRaces.length?aRaces:future.slice(0,1);
}

function countGeneratedSeasonWorkouts(){
  return Object.values(customWorkouts).filter(
    workout=>workout?.seasonGenerated && workout?.seasonPlanVersion==="8.2"
  ).length;
}

function renderFullSeasonTargetOptions(){
  const select=document.getElementById("fullSeasonTarget");
  if(!select) return;

  const targets=fullSeasonTargetRaces();
  const previous=select.value;

  select.innerHTML=targets.length
    ?targets.map(race=>
      `<option value="${race.id}">${safe(race.name)} — ${race.date}</option>`
    ).join("")
    :'<option value="">Voeg eerst een toekomstige wedstrijd toe</option>';

  if(previous && targets.some(race=>race.id===previous)){
    select.value=previous;
  }else if(targets.length){
    select.value=targets[targets.length-1].id;
  }

  const remove=document.getElementById("removeFullSeasonSchedule");
  if(remove){
    remove.disabled=countGeneratedSeasonWorkouts()===0;
  }
}

function fullSeasonRelevantRace(weekStart,weekEnd,seasonBlock,targetRace){
  const weekRaces=racesInRange(weekStart,weekEnd)
    .sort((a,b)=>{
      const priority=racePriorityRank(a.priority)-racePriorityRank(b.priority);
      return priority!==0?priority:a.date.localeCompare(b.date);
    });

  return weekRaces[0] || seasonBlock?.targetRace || targetRace;
}

function fullSeasonReadiness(weekIndex){
  if(weekIndex===0){
    return determineReadiness(getWellnessSnapshot());
  }

  return{
    level:"unknown",
    sufficientData:false,
    score:null,
    reasons:[],
    currentSignalCount:0,
    requiredSignals:2
  };
}

function fullSeasonDiary(weekIndex){
  return weekIndex===0
    ?buildDiaryContext()
    :{level:"unknown",entries:0,reasons:[]};
}

function fullSeasonWeekContext(weekStart,targetRace,weekIndex,cutbackEnabled){
  const weekEnd=addDays(weekStart,6);
  const seasonBlock=seasonBlockForWeek(weekStart);
  const race=fullSeasonRelevantRace(
    weekStart,
    weekEnd,
    seasonBlock,
    targetRace
  );
  const weekRaces=racesInRange(weekStart,weekEnd);

  const normalLoadPhase=
    seasonBlock &&
    ["base","build","specific"].includes(seasonBlock.phase);

  const cutback=
    Boolean(cutbackEnabled) &&
    normalLoadPhase &&
    weekIndex>0 &&
    (weekIndex+1)%4===0;

  return{
    profile:getProfile(),
    availability:availableDaysForPlanner(),
    readiness:fullSeasonReadiness(weekIndex),
    race,
    phase:seasonPhaseToLegacyPhase(seasonBlock,race),
    diary:fullSeasonDiary(weekIndex),
    start:weekStart,
    end:weekEnd,
    weekRaces,
    seasonBlock,
    forecast:weekIndex>0,
    seasonLoadFactor:cutback?.82:1,
    cutback
  };
}

function replaceRaceWeekQualityWhenNeeded(context,workouts){
  if(!context.weekRaces?.length) return workouts;

  const race=[...context.weekRaces].sort((a,b)=>{
    const priority=racePriorityRank(a.priority)-racePriorityRank(b.priority);
    return priority!==0?priority:a.date.localeCompare(b.date);
  })[0];

  const priority=String(race.priority||"C").toUpperCase();

  // Een B- of C-race telt als de zware trainingsprikkel van die week.
  // Een korte taper/sharpening (RPE <= 5) mag wel blijven staan.
  if(!["B","C"].includes(priority)) return workouts;

  const index=workouts.findIndex(workout=>{
    if(!isHardWorkout(workout)) return false;
    const rpe=Number(String(workout.rpe||"0").split("/")[0])||0;
    return rpe>5;
  });

  if(index<0) return workouts;

  const source=workouts[index];
  const km=Math.max(6,Math.min(9,Number(source.distanceKm)||8));
  workouts[index]=makeWeekEasySession(source.date,km,false);
  workouts[index].displaySteps.push(
    `${priority}-wedstrijd ${race.name} is deze week de kwaliteitsprikkel`
  );

  return workouts;
}

function existingNonSeasonWorkout(date){
  const custom=customWorkouts[date];
  if(custom && !custom.seasonGenerated) return custom;
  if(!custom && serverWorkouts[date]) return serverWorkouts[date];
  return null;
}

function buildFullSeasonSchedulePreview(){
  const status=document.getElementById("fullSeasonStatus");
  const targetId=document.getElementById("fullSeasonTarget").value;
  const target=races[targetId];
  const startInput=document.getElementById("fullSeasonStart").value ||
    nextMonday();
  const firstMonday=mondayOnOrAfter(startInput);
  const cutback=document.getElementById("fullSeasonCutback").checked;

  if(!target){
    status.className="status error";
    status.textContent="Voeg eerst een toekomstige A-wedstrijd toe.";
    return;
  }

  if(firstMonday>target.date){
    status.className="status error";
    status.textContent="De gekozen startdatum ligt na de doelwedstrijd.";
    return;
  }

  const endDate=addDays(target.date,raceRecoveryDays(target));
  const weeks=[];
  let weekStart=firstMonday;
  let weekIndex=0;

  while(weekStart<=endDate && weekIndex<60){
    const context=fullSeasonWeekContext(
      weekStart,
      target,
      weekIndex,
      cutback
    );

    const variant=weekIndex%2;
    const unscheduled=createUnscheduledAiWeek(context,variant);
    let assigned=assignAiWeekToAvailability(
      context,
      unscheduled,
      variant
    ).workouts;

    assigned=replaceRaceWeekQualityWhenNeeded(context,assigned);
    assigned=applyRaceCalendarToWeek(context,assigned);

    const annotated=assigned.map(workout=>({
      ...JSON.parse(JSON.stringify(workout)),
      seasonGenerated:true,
      seasonPlanVersion:"8.2",
      seasonTargetRaceId:target.id,
      seasonTargetRaceName:target.name,
      seasonWeekStart:weekStart,
      seasonBlock:context.seasonBlock?.phase||"general",
      seasonBlockLabel:context.seasonBlock?.label||"Algemeen",
      seasonCutback:Boolean(context.cutback)
    }));

    const conflictCount=annotated.filter(
      workout=>Boolean(existingNonSeasonWorkout(workout.date))
    ).length;

    const totalKm=annotated.reduce(
      (sum,workout)=>sum+(Number(workout.distanceKm)||0),
      0
    );

    weeks.push({
      weekStart,
      weekEnd:addDays(weekStart,6),
      block:context.seasonBlock,
      race:context.race,
      weekRaces:context.weekRaces,
      targetKm:weeklyTargetKm(context,variant),
      totalKm:Math.round(totalKm*10)/10,
      cutback:context.cutback,
      workouts:annotated,
      conflictCount
    });

    weekStart=addDays(weekStart,7);
    weekIndex++;
  }

  if(weekIndex>=60 && weekStart<=endDate){
    status.className="status error";
    status.textContent="Schema is langer dan 60 weken; kies een dichterbij gelegen doel.";
    return;
  }

  const workouts=weeks.flatMap(week=>week.workouts);
  const totalKm=workouts.reduce(
    (sum,workout)=>sum+(Number(workout.distanceKm)||0),
    0
  );
  const conflicts=workouts.filter(
    workout=>Boolean(existingNonSeasonWorkout(workout.date))
  ).length;

  pendingFullSeasonSchedule={
    targetRaceId:target.id,
    targetRaceName:target.name,
    start:firstMonday,
    end:endDate,
    cutback,
    weeks,
    workouts,
    totalKm:Math.round(totalKm*10)/10,
    conflicts,
    builtAt:new Date().toISOString()
  };

  renderFullSeasonSchedulePreview();

  status.className="status ok";
  status.textContent=
    `Preview gemaakt: ${weeks.length} weken en ${workouts.length} trainingen richting ${target.name}.`;
}

function renderFullSeasonSchedulePreview(){
  const plan=pendingFullSeasonSchedule;
  const preview=document.getElementById("fullSeasonPreview");
  if(!preview) return;

  const apply=document.getElementById("applyFullSeasonSchedule");

  if(!plan){
    document.getElementById("fullSeasonWeeks").textContent="—";
    document.getElementById("fullSeasonWorkouts").textContent="—";
    document.getElementById("fullSeasonKm").textContent="—";
    document.getElementById("fullSeasonConflicts").textContent="—";
    document.getElementById("fullSeasonHeadline").textContent="Nog geen preview";
    document.getElementById("fullSeasonExplanation").textContent=
      "Het schema gebruikt je Profiel, Planning, Seizoensplanner en wedstrijdkalender. Toekomstige hersteldata wordt niet voorspeld.";
    preview.innerHTML=
      '<p class="help">Tik op Bouw preview om alle trainingsweken te bekijken.</p>';
    apply.disabled=true;
    renderFullSeasonTargetOptions();
    return;
  }

  document.getElementById("fullSeasonWeeks").textContent=
    String(plan.weeks.length);
  document.getElementById("fullSeasonWorkouts").textContent=
    String(plan.workouts.length);
  document.getElementById("fullSeasonKm").textContent=
    `${Math.round(plan.totalKm)} km`;
  const overwrite=document.getElementById("fullSeasonOverwriteManual").checked;

  document.getElementById("fullSeasonConflicts").textContent=
    String(plan.conflicts);
  document.getElementById("fullSeasonConflictsNote").textContent=
    overwrite
      ?"bestaande plandagen worden vervangen"
      :"bestaande plandagen blijven staan";

  document.getElementById("fullSeasonHeadline").textContent=
    `${plan.weeks.length} weken richting ${plan.targetRaceName}`;

  document.getElementById("fullSeasonExplanation").textContent=
    plan.conflicts
      ?overwrite
        ?`${plan.conflicts} geplande dagen hebben al een bestaande training. Deze worden vervangen wanneer je het schema toepast.`
        :`${plan.conflicts} geplande dagen hebben al een bestaande training. Die blijven behouden.`
      :"Geen botsingen met bestaande trainingen gevonden. De preview kan direct worden toegepast.";

  preview.innerHTML=plan.weeks.map((week,index)=>{
    const blockLabel=week.block?.label||"Algemeen";
    const racesText=week.weekRaces?.length
      ?week.weekRaces.map(race=>
        `<span class="pill">${safe(race.priority)} · ${safe(race.name)}</span>`
      ).join("")
      :"";

    return`
      <details class="full-season-week" ${index<2?"open":""}>
        <summary>
          <div>
            <strong>Week ${index+1} · ${safe(blockLabel)}${week.cutback?" · ontlasting":""}</strong>
            <small>
              ${week.weekStart} t/m ${week.weekEnd}
              · doel circa ${week.targetKm} km
              ${week.conflictCount?` · ${week.conflictCount} bestaande dag(en)`:""}
            </small>
            ${racesText?`<div class="full-season-races">${racesText}</div>`:""}
          </div>
          <div class="full-season-week-total">
            ${Math.round(week.totalKm)} km<br>
            <span class="help">${week.workouts.length} sessies</span>
          </div>
        </summary>
        <div class="full-season-week-body">
          ${week.workouts.map(workout=>{
            const existing=existingNonSeasonWorkout(workout.date);
            return`
              <div class="full-season-workout-row ${existing?"existing":""}">
                <div class="date">${safe(workout.date)}</div>
                <div>
                  <strong>${safe(workout.name)}</strong>
                  <small>
                    ${safe(trainingVolumeLabel(workout))} · RPE ${safe(workout.rpe||"—")}
                    ${existing?` · ${overwrite?"wordt vervangen":"blijft staan"}: ${safe(existing.name)}`:""}
                  </small>
                </div>
                <span class="full-season-pill">
                  ${safe(workout.planType||workout.type)}
                </span>
              </div>`;
          }).join("")}
        </div>
      </details>`;
  }).join("");

  apply.disabled=false;
  renderFullSeasonTargetOptions();
}

function applyFullSeasonSchedule(){
  const plan=pendingFullSeasonSchedule;
  const status=document.getElementById("fullSeasonStatus");
  if(!plan?.workouts?.length) return;

  const overwrite=document.getElementById("fullSeasonOverwriteManual").checked;

  const confirmed=confirm(
    `Volledig schema toepassen: ${plan.workouts.length} trainingen van ${plan.start} t/m ${plan.end}?`
  );
  if(!confirmed) return;

  // Eerdere 8.2-versies binnen deze periode worden vervangen.
  Object.entries(customWorkouts).forEach(([date,workout])=>{
    if(
      workout?.seasonGenerated &&
      workout?.seasonPlanVersion==="8.2" &&
      date>=plan.start &&
      date<=plan.end
    ){
      delete customWorkouts[date];
      delete doneWorkouts[date];
      delete uploadedWorkouts[date];
    }
  });

  let added=0;
  let replaced=0;
  let skipped=0;
  let protectedRaces=0;

  for(const workout of plan.workouts){
    const visibleExisting=allWorkouts()[workout.date]||null;

    if(visibleExisting?.type==="Race"){
      protectedRaces++;
      skipped++;
      continue;
    }

    const customExisting=customWorkouts[workout.date];
    const serverExisting=!customExisting?serverWorkouts[workout.date]:null;
    const manualExisting=
      (customExisting && !customExisting.seasonGenerated)
        ?customExisting
        :serverExisting;

    if(manualExisting && !overwrite){
      skipped++;
      continue;
    }

    if(manualExisting && overwrite){
      delete doneWorkouts[workout.date];
      delete uploadedWorkouts[workout.date];
      replaced++;
    }

    customWorkouts[workout.date]=JSON.parse(JSON.stringify(workout));
    added++;
  }

  saveObject(STORAGE_KEY,customWorkouts);
  saveObject(DONE_KEY,doneWorkouts);
  saveObject(UPLOAD_KEY,uploadedWorkouts);
  refreshAfterCalendarMutation();

  status.className="status ok";
  status.textContent=
    `${added} trainingen ingepland`+
    `${replaced?` · ${replaced} bestaande vervangen`:""}`+
    `${skipped?` · ${skipped} bestaande behouden`:""}`+
    `${protectedRaces?` · ${protectedRaces} racedag(en) beschermd`:""}.`;
}

function removeFullSeasonSchedule(){
  const generated=Object.entries(customWorkouts).filter(
    ([,workout])=>
      workout?.seasonGenerated &&
      workout?.seasonPlanVersion==="8.2"
  );

  if(!generated.length) return;

  const confirmed=confirm(
    `${generated.length} door 8.2 gegenereerde trainingen verwijderen? Handmatige trainingen en wedstrijden blijven staan.`
  );
  if(!confirmed) return;

  generated.forEach(([date])=>{
    delete customWorkouts[date];
    clearWorkoutMarkersForDate(date);
  });

  saveObject(STORAGE_KEY,customWorkouts);
  saveObject(DONE_KEY,doneWorkouts);
  saveObject(UPLOAD_KEY,uploadedWorkouts);
  resetGeneratedPlannerPreviews();
  renderMonth();
  renderSelected();
  renderSaved();
  renderFullSeasonTargetOptions();
  renderFullSeasonSchedulePreview();
  refreshDerivedCoachViews();

  const status=document.getElementById("fullSeasonStatus");
  status.className="status ok";
  status.textContent=
    `${generated.length} gegenereerde 8.2-trainingen verwijderd.`;
}


function weekPlanningContext(){
  const profileData=getProfile();
  const availability=availableDaysForPlanner();
  const readiness=determineReadiness(getWellnessSnapshot());
  const race=getRaceFocus();
  const phase=classifyRacePhase(race);
  const diary=buildDiaryContext();
  const start=nextMonday();
  const end=addDays(start,6);
  const weekRaces=racesInRange(start,end);
  const seasonBlock=seasonBlockForWeek(start);
  const effectivePhase=seasonPhaseToLegacyPhase(seasonBlock,race);

  return{
    profile:profileData,
    availability,
    readiness,
    race,
    phase:effectivePhase,
    diary,
    start,
    end,
    weekRaces,
    seasonBlock
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

  if(context.diary?.level==="elevated") factor*=.80;
  else if(context.diary?.level==="attention") factor*=.92;

  if(Number(context.seasonLoadFactor)>0){
    factor*=Number(context.seasonLoadFactor);
  }

  if(context.seasonBlock){
    factor*=Number(context.seasonBlock.volumeFactor||1);
  }else{
    if(context.phase.phase==="taper") factor*=.78;
    if(context.phase.phase==="race-week") factor*=.52;
  }

  const weekPriorities=(context.weekRaces||[]).map(race=>String(race.priority||"C").toUpperCase());
  if(!context.seasonBlock){
    if(weekPriorities.includes("A")) factor*=.62;
    else if(weekPriorities.includes("B")) factor*=.78;
    else if(weekPriorities.includes("C")) factor*=.90;
  }else if(weekPriorities.includes("B")){
    factor*=.90;
  }else if(weekPriorities.includes("C")){
    factor*=.96;
  }

  if(variant===1) factor*=.92;
  if(variant===2) factor*=1.04;

  return Math.max(20,Math.round(base*factor));
}

function weekFocusLabel(context){
  if(context.seasonBlock){
    return `${context.seasonBlock.label} · ${context.seasonBlock.quality}`;
  }
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
  const seasonPhase=context.seasonBlock?.phase||null;

  if(seasonPhase==="recovery"){
    const workout=makeWeekWorkout(
      date,"recovery",7,"Herstelloop 7 km",
      ["7 km zeer rustig","10-15 min mobiliteit na afloop"],
      `Herstelblok na wedstrijd.

Recovery
- 7km 5:15-5:40/km Pace`,
      "2/10"
    );
    workout.planType="recovery";
    return workout;
  }

  if(seasonPhase==="base" && context.readiness.level!=="low"){
    const workout=makeWeekWorkout(
      date,"quality",11,"Aerobe drempel + strides",
      [
        "3 km rustig inlopen",
        "3 × 8 min gecontroleerd drempelgevoel",
        "2 min rustig dribbelen",
        "4 × 20 sec strides",
        "2 km uitlopen"
      ],
      `Basisblok met gecontroleerde drempel.

Warmup
- 3km Z1 Pace

Main set 3x
- 8m Z3 Pace
- 2m Z1 Pace

Strides 4x
- 20s Fast Pace
- 60s Z1 Pace

Cooldown
- 2km Z1 Pace`,
      "6/10"
    );
    workout.planType="quality";
    return workout;
  }

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

  if(context.phase.phase==="taper"){
    return makeTaperQualitySession(
      date,
      context.race,
      context.profile
    );
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
  const phase=context.phase?.phase||"";
  const allowProgression=
    Number(context.race?.distanceKm||0)>=21 &&
    km>=16 &&
    !["taper","race-week"].includes(phase);

  const workout=makeWeekWorkout(
    date,"long",km,`Lange duurloop ${km} km`,
    [
      `${km} km rustig`,
      `Hartslag bij voorkeur onder ${context.profile.z2Hr} bpm`,
      allowProgression
        ?"Laatste 3 km beheerst versnellen indien fris"
        :["taper","race-week"].includes(phase)
          ?"Volledig rustig houden; geen snelle finish"
          :"Volledig ontspannen houden"
    ],
    allowProgression
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

  const rawQuality=makeWeekQualitySession(
    context,
    context.start,
    variant
  );
  const quality=
    typeof applyKeySessionProgressionToWorkout==="function" &&
    context.allowKeySessionProgression!==false
      ?applyKeySessionProgressionToWorkout(
        rawQuality,
        context
      )
      :rawQuality;
  const qualityKm=Number(quality.distanceKm)||0;

  let longRatio=Number(context.race?.distanceKm||5)>=21?.30:.24;
  if(context.seasonBlock?.phase==="base") longRatio=.27;
  if(context.seasonBlock?.phase==="build") longRatio=Number(context.race?.distanceKm||5)>=21?.30:.26;
  if(context.seasonBlock?.phase==="specific") longRatio=Number(context.race?.distanceKm||5)>=21?.30:.24;
  if(context.seasonBlock?.phase==="recovery") longRatio=.14;
  if(context.phase.phase==="taper") longRatio=.20;
  if(context.phase.phase==="race-week") longRatio=.12;

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
    const recovery=isFinal ||
      (context.readiness.level!=="good" && !context.forecast);
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
  let scheduled=scheduleByAvailability(
    unscheduled.workouts,
    context.start,
    context.availability
  );

  scheduled=applyRaceCalendarToWeek(context,scheduled);
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

  const weekRaceText=(context.weekRaces||[]).length
    ? `deze week: ${context.weekRaces.map(r=>`${r.priority} ${r.name}`).join(", ")}`
    :context.race
      ? `${context.race.name} over ${context.phase.days} dagen`
      :"algemene opbouw";

  const seasonText=context.seasonBlock
    ?` Seizoensblok: ${context.seasonBlock.label} (${Math.round(context.seasonBlock.volumeFactor*100)}%).`
    :"";

  document.getElementById("aiWeekReason").textContent=
    (context.readiness.level==="unknown"
      ?`Gebaseerd op ${context.availability.length} beschikbare dagen en ${weekRaceText}; hersteldata is onvoldoende en daarom niet meegewogen.`
      :`Gebaseerd op herstelstatus ${context.readiness.level}, ${context.availability.length} beschikbare dagen en ${weekRaceText}.`) +
    seasonText;

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
    if(allWorkouts()[workout.date]){
      skipped++;
      continue;
    }

    customWorkouts[workout.date]=JSON.parse(JSON.stringify(workout));
    added++;
  }

  saveObject(STORAGE_KEY,customWorkouts);
  refreshAfterCalendarMutation();

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
  const seasonBlock=seasonBlockForDate(todayDateString());
  const phase=seasonPhaseToLegacyPhase(seasonBlock,race);
  const profileData=getProfile();
  const existing=currentTodayWorkout();

  return{
    availability,
    snapshot,
    readiness,
    race,
    phase,
    seasonBlock,
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
  if(context.seasonBlock?.phase==="recovery") return "Herstelblok";
  if(context.readiness.level==="moderate") return "Gecontroleerd";
  if(context.phase.phase==="race-week") return "Kort en scherp";
  if(context.seasonBlock?.phase==="base") return "Aerobe opbouw";
  if(context.seasonBlock?.phase==="specific") return "Wedstrijdspecifiek";
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

  if(context.seasonBlock?.phase==="recovery"){
    return["recovery","mobility","easy"];
  }
  if(context.seasonBlock?.phase==="base"){
    return["threshold","easy","long"];
  }
  if(context.seasonBlock?.phase==="taper" || context.seasonBlock?.phase==="race"){
    return["sharpen","easy","mobility"];
  }

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

  aiTrainingOptions=kinds.map((kind,index)=>{
    const generated=createGeneratorWorkout(
      kind,
      context,
      index===1?1:0
    );
    const progressed=
      typeof applyKeySessionProgressionToWorkout==="function"
        ?applyKeySessionProgressionToWorkout(
          generated,
          context
        )
        :generated;

    return fitGeneratedWorkout(
      progressed,
      context
    );
  });

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
    context.seasonBlock
      ? `seizoensblok ${context.seasonBlock.label.toLowerCase()} richting ${context.seasonBlock.targetRace.name}`
      :context.race
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
  const existing=currentTodayWorkout();

  if(existing?.type==="Race"){
    status.className="status error";
    status.textContent=
      "De AI Training Generator vervangt een wedstrijd niet automatisch.";
    return;
  }

  if(existing){
    const confirmed=confirm(
      `De bestaande training "${existing.name}" vervangen door "${workout.name}"?`
    );
    if(!confirmed) return;
  }

  const saved=JSON.parse(JSON.stringify(workout));
  saved.date=date;
  saved.status="planned";
  if(existing){
    clearWorkoutMarkersForDate(date);
  }

  customWorkouts[date]=saved;
  saveObject(STORAGE_KEY,customWorkouts);
  saveObject(DONE_KEY,doneWorkouts);
  saveObject(UPLOAD_KEY,uploadedWorkouts);

  refreshAfterCalendarMutation();

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

function calculateConsistencyScore(){
  const workouts=Object.entries(allWorkouts())
    .filter(([date,workout])=>{
      if(!workout || workout.type==="Rest") return false;

      const age=calendarDayDifference(todayDateString(),date);
      // Vandaag telt pas mee nadat de dag voorbij is; anders zou een nog
      // uit te voeren training je consistentie al verlagen.
      return age!==null && age>=1 && age<=28;
    });

  if(!workouts.length){
    return{
      score:null,
      completed:0,
      planned:0,
      explanation:"Nog onvoldoende lokale trainingshistorie"
    };
  }

  const completed=workouts.filter(([date,workout])=>
    workoutWasCompleted(date,workout)
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
  const seasonBlock=seasonBlockForDate(todayDateString());
  const phase=seasonPhaseToLegacyPhase(seasonBlock,race);
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

  const raceReadinessInputs=[
    {value:fitness,weight:.32},
    {value:recovery,weight:.30},
    {value:consistency.score,weight:.23},
    {value:phaseScore,weight:.15}
  ];
  const substantiveRaceInputs=[
    fitness,
    recovery,
    consistency.score
  ].filter(value=>value!==null && value!==undefined).length;

  let raceReadiness=
    race && substantiveRaceInputs>=1
      ?weightedAvailableScore(raceReadinessInputs)
      :null;

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

  const performanceInputs=[
    {value:fitness,weight:.23},
    {value:fatigue,weight:.17},
    {value:recovery,weight:.27},
    {value:consistency.score,weight:.16},
    {value:raceReadiness,weight:.12},
    {value:confidence,weight:.05}
  ];
  const substantivePerformanceInputs=[
    fitness,
    fatigue,
    recovery,
    consistency.score
  ].filter(value=>value!==null && value!==undefined).length;

  const performance=
    substantivePerformanceInputs>=2
      ?weightedAvailableScore(performanceInputs)
      :null;

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
    state:consistency.score===null
      ?"warn"
      :consistency.score>=75
        ?"good"
        :consistency.score>=55
          ?"warn"
          :"bad",
    icon:consistency.score===null
      ?"?"
      :consistency.score>=75
        ?"✓"
        :consistency.score>=55
          ?"!"
          :"×",
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

function createTodayRecommendation(readiness,race,phase,availability,currentWorkout,executionFeedback=null){
  const date=todayDateString();

  if(currentWorkout?.type==="Race"){
    return{
      kind:"keep",
      workout:currentWorkout,
      title:currentWorkout.name,
      text:"Vandaag is een wedstrijddag. De coach vervangt je wedstrijd niet automatisch door een andere training.",
      steps:currentWorkout.displaySteps||[]
    };
  }

  if(currentWorkout && !availability.available){
    return{
      kind:"keep",
      workout:currentWorkout,
      title:currentWorkout.name,
      text:"Je terugkerende beschikbaarheid staat vandaag op niet beschikbaar, maar er staat al expliciet een training in je kalender. De coach wijzigt die niet automatisch; verplaats hem als je vandaag echt niet kunt trainen.",
      steps:currentWorkout.displaySteps||[]
    };
  }

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



  const loadMonitor=buildLoadMonitor();
  const seasonBlock=seasonBlockForDate(date);

  if(seasonBlock?.phase==="recovery"){
    const currentIsEasy=
      currentWorkout &&
      !isHardWorkout(currentWorkout) &&
      !isLongWorkout(currentWorkout) &&
      Number(String(currentWorkout.rpe||"0").split("/")[0]||0)<=4;

    if(currentIsEasy){
      return{
        kind:"keep",
        workout:currentWorkout,
        title:currentWorkout.name,
        text:`Je zit in het herstelblok na ${seasonBlock.targetRace.name}. De geplande training is al rustig en kan zo blijven staan.`,
        steps:currentWorkout.displaySteps||[]
      };
    }

    const minutes=Math.min(availability.maxMinutes||40,40);
    const km=Math.max(5,Math.min(7,Math.round(minutes/5.6)));
    const recoveryWorkout=makeWeekWorkout(
      date,"recovery",km,`Herstelloop ${km} km`,
      [`${km} km zeer rustig`,"Geen tempo- of intervalwerk","10 min mobiliteit indien prettig"],
      `Herstelblok na wedstrijd.

Recovery
- ${km}km 5:15-5:40/km Pace`,
      "2/10"
    );
    recoveryWorkout.planType="recovery";

    return{
      kind:currentWorkout?"replace":"new",
      workout:recoveryWorkout,
      title:recoveryWorkout.name,
      text:`Seizoensplanner: herstel na ${seasonBlock.targetRace.name} heeft prioriteit. Zware kwaliteit wordt tijdelijk niet toegevoegd.`,
      steps:recoveryWorkout.displaySteps
    };
  }

  if(loadMonitor.level==="elevated" || executionFeedback?.level==="elevated"){
    const currentIsLowLoad=
      currentWorkout &&
      !isHardWorkout(currentWorkout) &&
      !isLongWorkout(currentWorkout) &&
      Number(String(currentWorkout.rpe||"0").split("/")[0]||0)<=4;

    if(currentIsLowLoad){
      return{
        kind:"keep",
        workout:currentWorkout,
        title:currentWorkout.name,
        text:"De belastbaarheid staat verhoogd door de monitor of Training Sync, maar je geplande training is al rustig. Houd hem bewust gemakkelijk en voeg geen extra volume toe.",
        steps:currentWorkout.displaySteps||[]
      };
    }

    const minutes=Math.min(availability.maxMinutes||40,40);
    const km=Math.max(5,Math.min(7,Math.round(minutes/5.6)));
    const workout=makeWeekWorkout(
      date,
      "recovery",
      km,
      `Herstelloop ${km} km`,
      [
        `${km} km zeer rustig`,
        `Hartslag onder ${getProfile().z2Hr} bpm`,
        "Geen versnellingen of extra kilometers"
      ],
      `Hersteltraining.

Recovery
- ${km}km 5:15-5:40/km Pace`,
      "2/10"
    );
    workout.planType="recovery";

    return{
      kind:currentWorkout?"replace":"new",
      workout,
      title:`Herstelloop ${km} km`,
      text:"De belastbaarheidsmonitor of Training Sync geeft een verhoogd signaal. Daarom wordt een zware trainingsprikkel vandaag vervangen door een rustige herstelprikkel.",
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
      text:executionFeedback?.level==="attention"
        ?`De geplande training blijft staan. Training Sync geeft wel aandacht: ${executionFeedback.text}`
        :"De geplande training past bij je herstelstatus. Voer hem uit zoals gepland en gebruik je gevoel als laatste controle.",
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

function todayWeekStartDate(){
  const todayString=todayDateString();
  const date=new Date(todayString+"T12:00:00");
  const mondayOffset=(date.getDay()+6)%7;
  return addDays(todayString,-mondayOffset);
}

function openTodayWeekDate(date){
  selectedDate=date;
  const parsed=new Date(date+"T12:00:00");
  visibleMonth=new Date(parsed.getFullYear(),parsed.getMonth(),1);
  switchView("calendar");
  renderMonth();
  renderSelected();
}

function renderTodayWeekStrip(){
  const strip=document.getElementById("todayWeekStrip");
  if(!strip) return;

  const start=todayWeekStartDate();
  const todayString=todayDateString();
  const workouts=allWorkouts();
  const shortDay=new Intl.DateTimeFormat("nl-NL",{weekday:"short"});

  strip.innerHTML=Array.from({length:7},(_,index)=>{
    const date=addDays(start,index);
    const workout=workouts[date]||null;
    const parsed=new Date(date+"T12:00:00");
    const done=workout ? workoutWasCompleted(date,workout) : false;
    const race=workout?.type==="Race";
    const classes=[
      "today-week-day",
      date===todayString?"today":"",
      workout?"has-workout":"",
      done?"done":"",
      race?"race":""
    ].filter(Boolean).join(" ");

    return`
      <button type="button" class="${classes}" onclick="openTodayWeekDate('${date}')"
        aria-label="${escapeHtmlAttribute(fullDate.format(parsed))}${workout?` · ${escapeHtmlAttribute(workout.name)}`:""}">
        <small>${safe(shortDay.format(parsed).replace(".",""))}</small>
        <strong>${parsed.getDate()}</strong>
        <span class="week-dot"></span>
      </button>`;
  }).join("");
}

function dailyTrainingIcon(type){
  const paths={
    Run:'<circle cx="13" cy="5" r="2"/><path d="m7 20 3-5 2-4 4 2 3 4M4 12l5-3 3 2 3-4 4 1M9 15l-4 5"/>',
    Race:'<path d="M5 21V3m1 1h13l-3 4 3 4H6"/>',
    Core:'<path d="M12 2 5 6v12l7 4 7-4V6Z"/><path d="M12 7v10M8 12h8"/>',
    Mobility:'<path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4"/>',
    Strength:'<path d="M3 9v6m3-8v10m3-6h6m3-4v10m3-8v6M6 12h3m6 0h3"/>',
    Swim:'<path d="M2 16c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2M4 11l4-3 4 3 4-5 3 3"/>',
    Rest:'<path d="M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5Z"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[type]||paths.Run}</svg>`;
}

function dailyTrainingSourceLabel(date,workout){
  if(
    workout?.type==="Race" &&
    Object.values(races).some(race=>race.date===date)
  ){
    return "Wedstrijd";
  }
  if(customWorkouts[date]){
    if(workout?.importedPlan) return "Schema-import";
    if(workout?.seasonGenerated) return "Seizoensschema";
    return "Eigen";
  }
  if(serverWorkouts[date]) return "Vast schema";
  return "Planning";
}

function renderCurrentTodayWorkout(workout){
  if(typeof renderSupportTraining==="function") renderSupportTraining();
  renderTodayWeekStrip();

  const statusBadge=document.getElementById("todayTrainingStatus");
  const icon=document.getElementById("todayTrainingIcon");
  const type=document.getElementById("todayTrainingType");
  const title=document.getElementById("todayTrainingTitle");
  const subtitle=document.getElementById("todayTrainingSubtitle");
  const volume=document.getElementById("todayTrainingVolume");
  const rpe=document.getElementById("todayTrainingRpe");
  const source=document.getElementById("todayTrainingSource");
  const steps=document.getElementById("todayTrainingSteps");
  const startButton=document.getElementById("startTodayTraining");
  const completeButton=document.getElementById("completeTodayTraining");
  const statusText=document.getElementById("todayTrainingStatusText");

  if(!statusBadge || !title) return;

  statusText.className="status";
  statusText.textContent="";

  if(!workout){
    statusBadge.className="daily-training-status rest";
    statusBadge.textContent="Geen training";
    icon.innerHTML=dailyTrainingIcon("Rest");
    icon.dataset.type="Rest";
    type.textContent="Vrije dag";
    title.textContent="Geen training gepland";
    subtitle.textContent="Je kalender is vandaag leeg. Gebruik de coach als je een passende training wilt plannen.";
    volume.textContent="—";
    rpe.textContent="—";
    source.textContent="—";
    steps.innerHTML="";
    startButton.disabled=true;
    startButton.textContent="Geen training";
    completeButton.disabled=true;
    completeButton.textContent="Markeer voltooid";
    return;
  }

  const date=todayDateString();
  const done=workoutWasCompleted(date,workout);
  const uploaded=workoutUploadIsCurrent(date,workout);
  const isRace=workout.type==="Race";
  const isRest=workout.type==="Rest";
  const typeInfo=trainingTypeInfo(workout.type);

  statusBadge.className=`daily-training-status ${done?"done":isRace?"race":isRest?"rest":"planned"}`;
  statusBadge.textContent=done?"Voltooid":isRace?"Wedstrijd":isRest?"Rustdag":"Gepland";

  icon.innerHTML=dailyTrainingIcon(workout.type);
  icon.dataset.type=workout.type;
  type.textContent=typeInfo.label;
  title.textContent=workout.name;
  subtitle.textContent=
    uploaded
      ?"Gesynchroniseerd met Intervals.icu."
      :done
        ?"Training afgerond. Je check-in kan nog worden bijgewerkt."
        :isRest
          ?"Herstel staat vandaag centraal."
          :"Klaar om te starten wanneer jij dat bent.";

  volume.textContent=trainingVolumeLabel(workout);
  rpe.textContent=workout.rpe||"—";
  source.textContent=dailyTrainingSourceLabel(date,workout);

  const workoutSteps=Array.isArray(workout.displaySteps)
    ?workout.displaySteps.filter(Boolean)
    :[];

  steps.innerHTML=workoutSteps.map((step,index)=>`
    <li><span class="step-number">${index+1}</span><span>${safe(step)}</span></li>
  `).join("");

  startButton.disabled=done || isRest;
  startButton.textContent=
    done
      ?"Training voltooid"
      :isRest
        ?"Rustdag"
        :isRace
          ?"Start wedstrijddag"
          :"Start training";

  completeButton.disabled=isRest && done;
  completeButton.textContent=
    done && !isRest
      ?"Bekijk check-in"
      :done
        ?"Voltooid"
        :"Markeer voltooid";
}

let guidedTrainingSession={
  date:null,
  workout:null,
  steps:[],
  index:0,
  startedAt:null,
  pauseStartedAt:null,
  pausedMs:0,
  intervalId:null,
  wakeLock:null,
  wakeLockRequest:null,
  returnFocus:null
};

function guidedSessionElapsedSeconds(){
  if(!guidedTrainingSession.startedAt) return 0;
  const now=guidedTrainingSession.pauseStartedAt || Date.now();
  return Math.max(
    0,
    Math.floor((now-guidedTrainingSession.startedAt-guidedTrainingSession.pausedMs)/1000)
  );
}

function formatGuidedElapsed(seconds){
  const value=Math.max(0,Math.floor(Number(seconds)||0));
  const hours=Math.floor(value/3600);
  const minutes=Math.floor((value%3600)/60);
  const secs=value%60;
  if(hours){
    return `${hours}:${String(minutes).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
  }
  return `${minutes}:${String(secs).padStart(2,"0")}`;
}

async function requestGuidedWakeLock(){
  if(!("wakeLock" in navigator)) return;

  const player=document.getElementById("guidedTrainingPlayer");
  if(
    !player?.classList.contains("active") ||
    guidedTrainingSession.pauseStartedAt ||
    guidedTrainingSession.wakeLock?.released===false
  ){
    return;
  }

  if(guidedTrainingSession.wakeLockRequest){
    return guidedTrainingSession.wakeLockRequest;
  }

  let request=null;
  try{
    request=navigator.wakeLock.request("screen");
    guidedTrainingSession.wakeLockRequest=request;

    const sentinel=await request;
    const requestIsCurrent=guidedTrainingSession.wakeLockRequest===request;
    const sessionIsActive=
      player.classList.contains("active") &&
      !guidedTrainingSession.pauseStartedAt;

    if(!requestIsCurrent || !sessionIsActive){
      await sentinel.release().catch(()=>{});
      return;
    }

    guidedTrainingSession.wakeLock=sentinel;
    sentinel.addEventListener("release",()=>{
      if(guidedTrainingSession.wakeLock===sentinel){
        guidedTrainingSession.wakeLock=null;
      }
    });
  }catch(error){
    console.warn("Scherm actief houden lukte niet:",error);
  }finally{
    if(guidedTrainingSession.wakeLockRequest===request){
      guidedTrainingSession.wakeLockRequest=null;
    }
  }
}

function releaseGuidedWakeLock(){
  const sentinel=guidedTrainingSession.wakeLock;
  guidedTrainingSession.wakeLock=null;
  guidedTrainingSession.wakeLockRequest=null;

  if(sentinel && !sentinel.released){
    Promise.resolve(sentinel.release()).catch(()=>{
      // Browser kan de wake lock zelf al hebben vrijgegeven.
    });
  }
}

function renderGuidedTrainingSession(){
  const session=guidedTrainingSession;
  const workout=session.workout;
  if(!workout) return;

  const steps=session.steps.length
    ?session.steps
    :["Voer de training volgens plan uit"];
  const index=Math.min(session.index,steps.length-1);

  document.getElementById("guidedTrainingType").textContent=
    `${trainingTypeInfo(workout.type).label} · ${trainingVolumeLabel(workout)}`;
  document.getElementById("guidedTrainingName").textContent=workout.name;
  document.getElementById("guidedTrainingStepLabel").textContent=
    `Onderdeel ${index+1}/${steps.length}`;
  document.getElementById("guidedTrainingCurrentStep").textContent=steps[index];
  document.getElementById("guidedTrainingNextStep").textContent=
    index<steps.length-1
      ?`Hierna: ${steps[index+1]}`
      :"Laatste onderdeel · rond daarna de training af.";

  document.getElementById("guidedTrainingProgressBar").style.width=
    `${Math.round(((index+1)/steps.length)*100)}%`;

  document.getElementById("guidedTrainingStepList").innerHTML=
    steps.map((step,stepIndex)=>`
      <div class="guided-step-row ${stepIndex===index?"active":stepIndex<index?"done":""}">
        <span class="guided-step-index">${stepIndex<index?"✓":stepIndex+1}</span>
        <span>${safe(step)}</span>
      </div>
    `).join("");

  document.getElementById("guidedTrainingPrevious").disabled=index===0;
  document.getElementById("guidedTrainingNext").disabled=index===steps.length-1;
}

function startGuidedTrainingClock(){
  clearInterval(guidedTrainingSession.intervalId);
  guidedTrainingSession.intervalId=setInterval(()=>{
    const elapsed=document.getElementById("guidedTrainingElapsed");
    if(elapsed){
      elapsed.textContent=formatGuidedElapsed(guidedSessionElapsedSeconds());
    }
  },1000);
}

function startTodayTrainingExperience(){
  const workout=currentTodayWorkout();
  const status=document.getElementById("todayTrainingStatusText");
  if(!workout) return;

  if(workoutWasCompleted(todayDateString(),workout)){
    status.className="status ok";
    status.textContent="Deze training is al als voltooid gemarkeerd.";
    return;
  }

  if(workout.type==="Rest"){
    status.className="status";
    status.textContent="Vandaag staat als rustdag gepland; er is geen sessie om te starten.";
    return;
  }

  guidedTrainingSession.date=todayDateString();
  guidedTrainingSession.workout=clone(workout);
  guidedTrainingSession.steps=Array.isArray(workout.displaySteps)
    ?workout.displaySteps.filter(Boolean)
    :[];
  guidedTrainingSession.index=0;
  guidedTrainingSession.startedAt=Date.now();
  guidedTrainingSession.pauseStartedAt=null;
  guidedTrainingSession.pausedMs=0;
  guidedTrainingSession.returnFocus=
    document.activeElement instanceof HTMLElement
      ?document.activeElement
      :null;

  const player=document.getElementById("guidedTrainingPlayer");
  player.classList.add("active");
  player.setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";

  document.getElementById("guidedTrainingElapsed").textContent="0:00";
  document.getElementById("guidedTrainingPause").textContent="Pauze";

  renderGuidedTrainingSession();
  startGuidedTrainingClock();
  requestGuidedWakeLock();

  requestAnimationFrame(()=>{
    document.getElementById("closeGuidedTraining")?.focus({
      preventScroll:true
    });
  });
}

function closeGuidedTrainingSession(force=false){
  const player=document.getElementById("guidedTrainingPlayer");
  if(!player?.classList.contains("active")) return;

  const elapsed=guidedSessionElapsedSeconds();
  if(!force && elapsed>30){
    const confirmed=confirm(
      "Training sluiten zonder hem als voltooid te markeren? Je sessietimer wordt gestopt."
    );
    if(!confirmed) return;
  }

  clearInterval(guidedTrainingSession.intervalId);
  guidedTrainingSession.intervalId=null;
  releaseGuidedWakeLock();

  player.classList.remove("active");
  player.setAttribute("aria-hidden","true");
  document.body.style.overflow="";

  const returnFocus=guidedTrainingSession.returnFocus;
  guidedTrainingSession.date=null;
  guidedTrainingSession.workout=null;
  guidedTrainingSession.steps=[];
  guidedTrainingSession.index=0;
  guidedTrainingSession.startedAt=null;
  guidedTrainingSession.pauseStartedAt=null;
  guidedTrainingSession.pausedMs=0;
  guidedTrainingSession.returnFocus=null;

  if(returnFocus?.isConnected){
    requestAnimationFrame(()=>{
      try{
        returnFocus.focus({preventScroll:true});
      }catch{
        returnFocus.focus();
      }
    });
  }
}

function previousGuidedTrainingStep(){
  guidedTrainingSession.index=Math.max(0,guidedTrainingSession.index-1);
  renderGuidedTrainingSession();
}

function nextGuidedTrainingStep(){
  const max=Math.max(0,guidedTrainingSession.steps.length-1);
  if(guidedTrainingSession.index<max){
    guidedTrainingSession.index++;
    renderGuidedTrainingSession();
  }
}

function toggleGuidedTrainingPause(){
  const button=document.getElementById("guidedTrainingPause");
  if(guidedTrainingSession.pauseStartedAt){
    guidedTrainingSession.pausedMs+=Date.now()-guidedTrainingSession.pauseStartedAt;
    guidedTrainingSession.pauseStartedAt=null;
    button.textContent="Pauze";
    requestGuidedWakeLock();
  }else{
    guidedTrainingSession.pauseStartedAt=Date.now();
    button.textContent="Hervat";
    releaseGuidedWakeLock();
  }

  document.getElementById("guidedTrainingElapsed").textContent=
    formatGuidedElapsed(guidedSessionElapsedSeconds());
}

function completeTodayTrainingFromCard(){
  const date=todayDateString();
  const workout=currentTodayWorkout();
  if(!workout) return;

  if(workoutWasCompleted(date,workout)){
    if(workout.type!=="Rest"){
      openDiaryForDate(date);
    }
    return;
  }

  const confirmed=confirm(`"${workout.name}" als voltooid markeren?`);
  if(!confirmed) return;

  markWorkoutCompleted(date,workout);
  saveObject(DONE_KEY,doneWorkouts);
  refreshAfterCalendarMutation();

  if(workout.type!=="Rest"){
    openDiaryForDate(date);
  }
}

function finishGuidedTrainingSession(){
  const date=guidedTrainingSession.date;
  const sessionWorkout=guidedTrainingSession.workout;
  const current=date ? allWorkouts()[date] : null;

  if(!date || !sessionWorkout){
    alert("Deze begeleide sessie heeft geen geldige trainingskoppeling meer. Niets is als voltooid gemarkeerd.");
    return;
  }

  if(
    !current ||
    workoutCompletionIdentity(current)!==workoutCompletionIdentity(sessionWorkout)
  ){
    alert(
      "De training in je kalender is intussen gewijzigd. Niets is als voltooid gemarkeerd. Sluit deze sessie en start de actuele training opnieuw."
    );
    return;
  }

  const confirmed=confirm(`"${sessionWorkout.name}" afronden en als voltooid markeren?`);
  if(!confirmed) return;

  const elapsedMinutes=Math.max(
    1,
    Math.round(guidedSessionElapsedSeconds()/60)
  );

  markWorkoutCompleted(date,current);
  saveObject(DONE_KEY,doneWorkouts);
  closeGuidedTrainingSession(true);
  refreshAfterCalendarMutation();

  selectedDate=date;
  openDiaryForDate(date);

  const durationField=document.getElementById("diaryActualDuration");
  if(durationField && !durationField.value){
    durationField.value=String(elapsedMinutes);
  }
}

function openTodayTrainingCalendar(){
  openTodayWeekDate(todayDateString());
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
  const currentSeasonBlock=seasonBlockForDate(todayDateString());
  const phase=seasonPhaseToLegacyPhase(currentSeasonBlock,race);
  const availability=todayAvailabilityInfo();
  const existing=currentTodayWorkout();
  const executionFeedback=buildAdaptiveExecutionFeedback();
  const loadMonitor=buildLoadMonitor();

  pendingTodayAdvice=createTodayRecommendation(
    readiness,
    race,
    phase,
    availability,
    existing,
    executionFeedback
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
    currentSeasonBlock
      ?currentSeasonBlock.label
      :phaseLabel(phase.phase);

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


  if(executionFeedback.level!=="unknown"){
    reasonRows.push({
      cls:executionFeedback.level==="stable"
        ?"good"
        :executionFeedback.level==="attention"
          ?"warn"
          :"bad",
      icon:executionFeedback.level==="stable"
        ?"✓"
        :executionFeedback.level==="attention"
          ?"!"
          :"×",
      text:`Training Sync: ${executionFeedback.text}`
    });
  }

  const diary=buildDiaryContext();
  if(diary.level!=="unknown"){
    reasonRows.push({
      cls:diary.level==="stable"?"good":diary.level==="attention"?"warn":"bad",
      icon:diary.level==="stable"?"✓":diary.level==="attention"?"!":"×",
      text:`Coachdagboek: ${diaryStatusLabel(diary.level)} · ${diary.reasons.join(", ")}.`
    });
  }

  if(currentSeasonBlock){
    reasonRows.push({
      cls:"good",
      icon:"↗",
      text:`Seizoensblok: ${currentSeasonBlock.label}. Focus: ${currentSeasonBlock.quality}.`
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

  renderDailyDecisionEngine({
    readiness,
    race,
    phase,
    availability,
    existing,
    recommendation:pendingTodayAdvice,
    executionFeedback,
    loadMonitor
  });

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
  renderActivitySyncStatus();
  renderPerformanceEngine();
  renderPerformanceModel();
  renderAiTrainingGenerator();
  renderAiWeekPlanner();
  renderLoadMonitor(loadMonitor);
}

function applyTodayRecommendation(){
  if(!pendingTodayAdvice?.workout) return;

  const date=todayDateString();
  const existing=currentTodayWorkout();
  const status=document.getElementById("todayStatus");

  if(existing?.type==="Race"){
    status.className="status error";
    status.textContent="Een wedstrijd wordt niet automatisch vervangen door coachadvies.";
    return;
  }

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
  if(existing){
    clearWorkoutMarkersForDate(date);
  }

  customWorkouts[date]=workout;
  saveObject(STORAGE_KEY,customWorkouts);
  saveObject(DONE_KEY,doneWorkouts);
  saveObject(UPLOAD_KEY,uploadedWorkouts);

  refreshAfterCalendarMutation();

  status.className="status ok";
  status.textContent=`${workout.name} is toegevoegd aan vandaag.`;
}

async function refreshTodayCoach(){
  const status=document.getElementById("todayStatus");
  status.className="status";
  status.textContent="Hersteldata wordt vernieuwd…";

  const wellnessResult=await loadWellnessDashboard();
  const activityResult=await syncCompletedActivities({
    silent:true,
    render:true
  });

  if(wellnessResult.ok && activityResult.ok){
    status.className="status ok";
    status.textContent="Coachadvies, hersteldata en uitgevoerde trainingen zijn bijgewerkt.";
    return;
  }

  if(wellnessResult.ok || activityResult.ok){
    status.className="status";
    status.textContent=
      wellnessResult.ok
        ?"Hersteldata is bijgewerkt; Training Sync kon niet worden vernieuwd."
        :"Training Sync is bijgewerkt; actuele wellnessdata kon niet worden vernieuwd.";
    return;
  }

  status.className="status error";
  status.textContent=
    `Coachdata kon niet worden vernieuwd. Wellness: ${wellnessResult.error?.message || "onbekend"} · Training Sync: ${activityResult.error?.message || "onbekend"}. Lokale planning blijft beschikbaar.`;
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
  const future=futureRacesSorted();
  if(!future.length) return null;

  const nextRace=future[0];
  const primaryA=getPrimaryARace();

  // Een race binnen 14 dagen beïnvloedt de actuele trainingsweek altijd,
  // ook wanneer een A-race verder in de toekomst de hoofdpiek blijft.
  if(daysUntil(nextRace.date)<=14){
    return nextRace;
  }

  return primaryA || nextRace;
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

  const optimizedReference=
    typeof optimizedRaceReferenceSeconds==="function"
      ?optimizedRaceReferenceSeconds(race)
      :null;

  if(
    optimizedReference!==null &&
    Number(race?.distanceKm)>0
  ){
    racePace=
      optimizedReference/Number(race.distanceKm);
  }else if(race?.targetTime){
    racePace=racePaceSeconds(race);
  }

  if(!racePace){
    const distance=Number(race?.distanceKm || 5);
    if(distance<=5) racePace=parseTimeToSeconds(p.fiveKGoal)/5;
    else if(distance<=10) racePace=parseTimeToSeconds(p.tenKPr)/10;
    else racePace=parseTimeToSeconds(p.halfGoal)/21.0975;
  }

  const thresholdAdjustment=
    typeof learnedTrainingPaceAdjustment==="function"
      ?learnedTrainingPaceAdjustment("threshold")
      :0;
  const vo2Adjustment=
    typeof learnedTrainingPaceAdjustment==="function"
      ?learnedTrainingPaceAdjustment("vo2")
      :0;

  return{
    race:racePace,
    easy:"5:00-5:25/km",
    recovery:"5:10-5:35/km",
    threshold:racePace
      ?`${formatPace(racePace+8+thresholdAdjustment)}-${formatPace(racePace+15+thresholdAdjustment)}/km`
      :"3:42-3:48/km",
    vo2:racePace
      ?`${formatPace(racePace-8+vo2Adjustment)}-${formatPace(racePace-3+vo2Adjustment)}/km`
      :"3:28-3:30/km"
  };
}

function makeTaperQualitySession(date,race,profileData=getProfile()){
  const paces=targetPacesForRace(race,profileData);
  const targetPace=paces.race
    ? `${formatPace(paces.race)}/km`
    : paces.threshold;

  const workout=makeWeekWorkout(
    date,
    "quality",
    8,
    "Taperprikkel · 3 × 1 km doeltempo",
    [
      "2 km rustig inlopen",
      `3 × 1 km @ ${targetPace}`,
      "2 min rustig dribbelen",
      "2 km rustig uitlopen",
      "Stop met frisse benen; geen extra herhalingen"
    ],
    `Taperprikkel met lage vermoeidheidskosten.

Warmup
- 2km Z1 Pace

Main set 3x
- 1km ${targetPace} Pace
- 2m Z1 Pace

Cooldown
- 2km Z1 Pace`,
    "5/10"
  );

  workout.planType="quality";
  return workout;
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

  if(phase.phase==="taper"){
    return makeTaperQualitySession(date,race,getProfile());
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

function buildAdaptiveWeek(){
  const context=weekPlanningContext();
  const option=assignAiWeekToAvailability(
    context,
    createUnscheduledAiWeek(context,0),
    0
  );

  pendingAdaptiveWeek=option.workouts.map(workout=>
    JSON.parse(JSON.stringify(workout))
  );

  const readiness=context.readiness;
  const race=context.race;
  const phase=context.phase;
  const seasonBlock=context.seasonBlock;

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

  const raceText=seasonBlock
    ? `${seasonBlock.label} richting ${seasonBlock.targetRace.name}`
    :race
      ? `${race.name} over ${phase.days} dagen (${phase.phase})`
      : "geen komende wedstrijd gevonden";

  reason.textContent=
    `${readiness.level==="unknown"
      ?"Herstel is niet meegewogen wegens onvoldoende actuele data"
      :readiness.reasons.length
        ?readiness.reasons.join(", ")
        :"geen duidelijke negatieve herstelsignalen"}. `+
    `Focus: ${raceText}. Dezelfde fase-, taper-, wedstrijd- en beschikbaarheidsregels als de AI Week Planner zijn toegepast.`;

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
    const duration=trainingVolumeLabel(w);

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
    if(allWorkouts()[workout.date]){
      skipped++;
      continue;
    }
    customWorkouts[workout.date]=JSON.parse(JSON.stringify(workout));
    added++;
  }

  saveObject(STORAGE_KEY,customWorkouts);
  refreshAfterCalendarMutation();

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

  resetGeneratedPlannerPreviews();
  renderPlanningPreview();
  renderProfileSummary();
  renderFullSeasonSchedulePreview();
  refreshDerivedCoachViews();
}

function renderPlanningPreview(){
  if(typeof renderSupportTraining==="function") renderSupportTraining();
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

function fillProfileForm(){
  const p=getProfile();
  document.getElementById("profileName").value=p.name;
  document.getElementById("profileDays").value=String(p.days);
  document.getElementById("profileWeeklyKm").value=p.weeklyKm;
  document.getElementById("profileMaxKm").value=p.maxKm;
  document.getElementById("profileFiveKPr").value=p.fiveKPr;
  document.getElementById("profileFiveKGoal").value=p.fiveKGoal;
  document.getElementById("profileTenKPr").value=p.tenKPr;
  document.getElementById("profileHalfGoal").value=p.halfGoal;
  document.getElementById("profileMaxHr").value=p.maxHr;
  document.getElementById("profileZ2Hr").value=p.z2Hr;
  renderProfileSummary();
}
function saveProfile(e){
  e.preventDefault();

  const weeklyKm=Number(document.getElementById("profileWeeklyKm").value);
  const maxKm=Number(document.getElementById("profileMaxKm").value);
  const maxHr=Number(document.getElementById("profileMaxHr").value);
  const z2Hr=Number(document.getElementById("profileZ2Hr").value);
  const status=document.getElementById("profileStatus");

  if(
    !Number.isFinite(weeklyKm) ||
    !Number.isFinite(maxKm) ||
    maxKm<weeklyKm
  ){
    status.className="status error";
    status.textContent=
      "Maximale weekomvang moet minimaal gelijk zijn aan je gewenste weekomvang.";
    return;
  }

  if(
    !Number.isFinite(maxHr) ||
    !Number.isFinite(z2Hr) ||
    z2Hr>=maxHr
  ){
    status.className="status error";
    status.textContent=
      "Zone 2-bovengrens moet lager zijn dan je maximale hartslag.";
    return;
  }

  const current=getProfile();
  profile={
    ...current,
    name:safe(document.getElementById("profileName").value).trim()||"Jaco",
    days:Number(document.getElementById("profileDays").value),
    weeklyKm,
    maxKm,
    fiveKPr:safe(document.getElementById("profileFiveKPr").value).trim(),
    fiveKGoal:safe(document.getElementById("profileFiveKGoal").value).trim(),
    tenKPr:safe(document.getElementById("profileTenKPr").value).trim(),
    halfGoal:safe(document.getElementById("profileHalfGoal").value).trim(),
    maxHr,
    z2Hr
  };
  saveObject(PROFILE_KEY,profile);

  resetGeneratedPlannerPreviews();
  renderProfileSummary();
  renderFullSeasonSchedulePreview();
  refreshDerivedCoachViews();

  status.className="status ok";
  status.textContent="Profiel opgeslagen en coach/planners bijgewerkt.";
}
function renderProfileSummary(){
  const p=getProfile();
  document.getElementById("summaryDays").textContent=p.days;
  document.getElementById("summaryKm").textContent=`${p.weeklyKm} km`;
  document.getElementById("summaryFiveK").textContent=p.fiveKGoal||"—";
  document.getElementById("summaryHalf").textContent=p.halfGoal||"—";
}
function nextMonday(){const d=new Date();const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day+7);return ymd(d);}
function raceForPlanner(){return getRaceFocus();}
function plannerReduced(){
  const form=finiteNumberOrNull(document.getElementById("metricForm")?.textContent);
  return form!==null && form<-15;
}
function makeWeekWorkout(date,arg2,arg3,arg4,arg5,arg6,arg7){
  // Ondersteunt zowel de oude 6-argument vorm als de nieuwere
  // (date, planType, km, name, steps, description, rpe) vorm.
  if(arg7!==undefined){
    const planType=arg2;
    const km=arg3;
    const name=arg4;
    const steps=arg5;
    const desc=arg6;
    const rpe=arg7;
    return{
      date,
      name,
      uploadName:`Jaco - ${name}`,
      type:"Run",
      distanceKm:Math.round(Number(km||0)*10)/10,
      rpe,
      status:"planned",
      planType,
      displaySteps:steps,
      intervalsDescription:desc
    };
  }

  const name=arg2;
  const km=arg3;
  const rpe=arg4;
  const steps=arg5;
  const desc=arg6;

  return{
    date,
    name,
    uploadName:`Jaco - ${name}`,
    type:"Run",
    distanceKm:Math.round(Number(km||0)*10)/10,
    rpe,
    status:"planned",
    displaySteps:steps,
    intervalsDescription:desc
  };
}
function generatePersonalWeek(){
  const reduced=plannerReduced();
  const context=weekPlanningContext();

  if(reduced && context.readiness.level==="unknown"){
    context.seasonLoadFactor=.80;
  }

  const option=assignAiWeekToAvailability(
    context,
    createUnscheduledAiWeek(context,0),
    0
  );

  pendingWeekPlan=option.workouts.map(workout=>
    JSON.parse(JSON.stringify(workout))
  );

  renderWeekPlan(
    reduced,
    context.race,
    option.targetKm
  );
}

function renderWeekPlan(reduced,race,target){
  const seasonBlock=seasonBlockForWeek(nextMonday());
  const plan=document.getElementById("weekPlan");
  const saveButton=document.getElementById("saveWeekPlan");
  const status=document.getElementById("weekPlanStatus");

  plan.innerHTML=pendingWeekPlan.map(workout=>`
    <div class="week-plan-row">
      <div>
        <strong>${new Intl.DateTimeFormat("nl-NL",{weekday:"short",day:"numeric"}).format(new Date(workout.date+"T12:00:00"))}</strong>
        <small>${trainingVolumeLabel(workout)}</small>
      </div>
      <div>
        <strong>${safe(workout.name)}</strong>
        <small>${safe(workout.displaySteps?.[0]||"")}</small>
      </div>
      <span class="readiness-badge">${safe(workout.rpe)}</span>
    </div>
  `).join("");

  saveButton.disabled=false;
  status.className="status";
  status.textContent=
    `${target} km gepland${race?` richting ${race.name}`:""}${seasonBlock?` · blok ${seasonBlock.label}`:""}${reduced?" · volume verlaagd door herstelsignalen":""}.`;
}
function savePersonalWeek(){
  if(!pendingWeekPlan.length) return;

  let added=0;
  let skipped=0;

  for(const workout of pendingWeekPlan){
    if(allWorkouts()[workout.date]){
      skipped++;
      continue;
    }
    customWorkouts[workout.date]=JSON.parse(JSON.stringify(workout));
    added++;
  }

  saveObject(STORAGE_KEY,customWorkouts);
  refreshAfterCalendarMutation();

  const status=document.getElementById("weekPlanStatus");
  status.className="status ok";
  status.textContent=
    `${added} trainingen toegevoegd${skipped?` · ${skipped} bestaande dagen behouden`:""}.`;
}

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
