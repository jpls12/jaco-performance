const KEY_SESSION_PROGRESSION_MIN_SESSIONS=3;
const KEY_SESSION_PROGRESSION_MAX_THRESHOLD_WORK_KM=10;
const KEY_SESSION_PROGRESSION_MAX_VO2_WORK_KM=6;

function keySessionAverage(values){
  const usable=(values||[])
    .map(finiteNumberOrNull)
    .filter(value=>value!==null);
  if(!usable.length) return null;
  return usable.reduce((sum,value)=>sum+value,0)/usable.length;
}

function keySessionProgressionContext(){
  const race=getRaceFocus();
  const seasonBlock=seasonBlockForDate(todayDateString());
  const phase=seasonPhaseToLegacyPhase(seasonBlock,race);

  return{
    race,
    seasonBlock,
    phase,
    readiness:determineReadiness(getWellnessSnapshot()),
    load:buildLoadMonitor(),
    execution:buildAdaptiveExecutionFeedback()
  };
}

function keySessionProgressionCategoryLabel(category){
  return({
    threshold:"Drempel",
    vo2:"VO₂",
    hm:"HM-specifiek"
  })[category]||category;
}

function keySessionProgressionModel(category,context=keySessionProgressionContext()){
  const response=
    typeof trainingResponseCategoryModel==="function"
      ?trainingResponseCategoryModel(category)
      :null;

  const sessions=(response?.sessions||[]).slice(0,3);
  const averageQuality=keySessionAverage(
    sessions.map(item=>item.quality)
  );
  const averageCompletion=keySessionAverage(
    sessions.map(item=>item.completion)
  );
  const paceAdjustment=
    typeof learnedTrainingPaceAdjustment==="function"
      ?learnedTrainingPaceAdjustment(category)
      :0;

  const phaseName=
    context.seasonBlock?.phase ||
    context.phase?.phase ||
    "general";
  const raceDays=finiteNumberOrNull(context.phase?.days);

  const blockedPhase=
    ["recovery","taper","race","race-week"].includes(phaseName) ||
    (raceDays!==null&&raceDays<=10);

  let state="learning";
  const missing=Math.max(
    0,
    KEY_SESSION_PROGRESSION_MIN_SESSIONS-(response?.count||0)
  );
  let reason=
    `Nog ${missing} vergelijkbare sessie${missing===1?"":"s"} nodig.`;

  if((response?.count||0)>=KEY_SESSION_PROGRESSION_MIN_SESSIONS){
    const stressHigh=
      context.readiness?.level==="low" ||
      context.load?.level==="elevated" ||
      context.execution?.level==="elevated" ||
      (averageQuality!==null&&averageQuality<70);

    const stressAttention=
      context.readiness?.level==="moderate" ||
      context.readiness?.level==="unknown" ||
      context.load?.level==="attention" ||
      context.execution?.level==="attention";

    if(stressHigh){
      state="deload";
      reason=
        "Recente belasting of trainingskwaliteit vraagt om een kleinere sleutelprikkel.";
    }else if(blockedPhase){
      state="consolidate";
      reason=
        "Wedstrijd-/tapercontext blokkeert automatische opbouw van de trainingsdosis.";
    }else if(paceAdjustment!==0){
      state="consolidate";
      reason=
        `10.6 past het tempo al ${Math.abs(paceAdjustment)} sec/km ${paceAdjustment<0?"sneller":"rustiger"} aan; tempo en dosis worden niet tegelijk opgehoogd.`;
    }else if(
      response?.direction==="slower" &&
      (response?.confidenceScore||0)>=70
    ){
      state="deload";
      reason=
        "Meerdere vergelijkbare sessies wijzen op een te zware huidige prikkel.";
    }else if(
      category!=="hm" &&
      context.readiness?.level==="good" &&
      context.load?.level==="stable" &&
      context.execution?.level!=="elevated" &&
      !stressAttention &&
      (response?.confidenceScore||0)>=70 &&
      averageQuality!==null &&
      averageQuality>=84 &&
      averageCompletion!==null &&
      averageCompletion>=.90 &&
      ["stable","faster"].includes(response?.direction)
    ){
      state="progress";
      reason=
        "Minstens drie consistente sterke uitvoeringen ondersteunen één kleine volumestap.";
    }else{
      state="consolidate";
      reason=
        category==="hm"
          ?"HM-specifieke dosis wordt voorlopig alleen bewaakt; geen automatische volumeverhoging."
          :"Bewijs is bruikbaar, maar nog niet sterk genoeg om de trainingsdosis te verhogen.";
    }
  }

  if(category==="hm"&&state==="progress"){
    state="consolidate";
    reason=
      "HM-specifieke dosis wordt voorlopig alleen bewaakt; geen automatische volumeverhoging.";
  }

  return{
    category,
    label:keySessionProgressionCategoryLabel(category),
    state,
    response,
    count:response?.count||0,
    confidenceScore:response?.confidenceScore||0,
    confidenceLabel:response?.confidenceLabel||"Laag",
    averageQuality,
    averageCompletion,
    paceAdjustment,
    phaseName,
    raceDays,
    reason
  };
}

function buildKeySessionProgression(){
  const context=keySessionProgressionContext();
  const models=["threshold","vo2","hm"].map(category=>
    keySessionProgressionModel(category,context)
  );
  const active=models.filter(model=>
    ["progress","deload"].includes(model.state)
  );

  return{
    createdAt:new Date().toISOString(),
    context,
    models,
    active,
    status:
      active.some(model=>model.state==="deload")
        ?"protect"
        :active.some(model=>model.state==="progress")
          ?"progress"
          :models.some(model=>model.state==="consolidate")
            ?"consolidate"
            :"learning"
  };
}

function keySessionWorkoutCategory(workout,context=null){
  if(!workout||workout.type!=="Run") return null;

  const text=[
    workout.name||"",
    ...(Array.isArray(workout.displaySteps)?workout.displaySteps:[]),
    workout.intervalsDescription||""
  ].join(" ").toLowerCase();

  if(
    /\bdrempel\b|threshold|cruise/.test(text)
  ){
    const raceDistance=Number(context?.race?.distanceKm||0);
    if(
      raceDistance>=15 &&
      /wedstrijdspecifiek|halve|half[\s-]?marathon|\bhm\b/.test(text)
    ){
      return"hm";
    }
    return"threshold";
  }

  if(
    /\bvo2\b|vo₂|vo2max|1000\s*m|1000m|400\s*m\s*snelheid/.test(text)
  ){
    return"vo2";
  }

  if(
    /wedstrijdspecifiek|halve|half[\s-]?marathon|\bhm\b/.test(text)
  ){
    return"hm";
  }

  return null;
}

function keySessionRepSpec(workout){
  const name=String(workout?.name||"");
  const match=name.match(
    /(\d+)\s*[×xX]\s*(\d+(?:[.,]\d+)?)\s*(km|m)\b/i
  );
  if(!match) return null;

  const reps=Number(match[1]);
  const amount=Number(String(match[2]).replace(",","."));
  const unit=String(match[3]).toLowerCase();
  const repKm=unit==="km"?amount:amount/1000;

  if(
    !Number.isFinite(reps) ||
    !Number.isFinite(repKm) ||
    reps<=0 ||
    repKm<=0
  ){
    return null;
  }

  return{
    reps,
    amountText:match[2],
    unit:match[3],
    repKm,
    workKm:reps*repKm
  };
}

function keySessionNextReps(spec,model){
  if(!spec||!model) return spec?.reps||null;

  let delta=0;

  if(model.state==="progress"){
    if(model.category==="vo2"){
      delta=spec.repKm<=.5?2:1;
    }else if(model.category==="threshold"){
      delta=1;
    }
  }else if(model.state==="deload"){
    if(model.category==="vo2"){
      delta=spec.repKm<=.5?-2:-1;
    }else{
      delta=-1;
    }
  }

  let next=Math.max(1,spec.reps+delta);

  if(model.category==="vo2"){
    const maxReps=Math.floor(
      KEY_SESSION_PROGRESSION_MAX_VO2_WORK_KM/spec.repKm
    );
    const minReps=Math.max(
      3,
      Math.ceil(3.2/spec.repKm)
    );
    next=Math.max(
      Math.min(next,maxReps),
      Math.min(spec.reps,minReps)
    );
  }

  if(model.category==="threshold"){
    const maxReps=Math.floor(
      KEY_SESSION_PROGRESSION_MAX_THRESHOLD_WORK_KM/spec.repKm
    );
    const minReps=Math.max(
      2,
      Math.ceil(4/spec.repKm)
    );
    next=Math.max(
      Math.min(next,maxReps),
      Math.min(spec.reps,minReps)
    );
  }

  if(model.category==="hm"&&model.state!=="deload"){
    next=spec.reps;
  }

  return Math.max(1,next);
}

function keySessionReplaceRepCount(text,spec,nextReps){
  if(typeof text!=="string"||!text) return text;

  const escapedAmount=String(spec.amountText)
    .replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const escapedUnit=String(spec.unit)
    .replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

  const pattern=new RegExp(
    `\\b${spec.reps}(\\s*[×xX]\\s*${escapedAmount}\\s*${escapedUnit})`,
    "gi"
  );

  let result=text.replace(
    pattern,
    `${nextReps}$1`
  );

  result=result.replace(
    new RegExp(`\\bMain set\\s+${spec.reps}x\\b`,"gi"),
    `Main set ${nextReps}x`
  );

  return result;
}

function applyKeySessionProgressionToWorkout(
  workout,
  context=keySessionProgressionContext()
){
  if(!workout||workout.type!=="Run") return workout;

  const category=keySessionWorkoutCategory(workout,context);
  if(!category) return workout;

  const model=keySessionProgressionModel(category,context);
  const spec=keySessionRepSpec(workout);

  const copy=JSON.parse(JSON.stringify(workout));
  copy.progressionV107={
    category,
    state:model.state,
    reason:model.reason,
    evidenceCount:model.count,
    confidenceScore:model.confidenceScore,
    averageQuality:model.averageQuality,
    averageCompletion:model.averageCompletion,
    applied:false
  };

  if(!spec) return copy;

  const nextReps=keySessionNextReps(spec,model);
  if(nextReps===spec.reps) return copy;

  const workKmDelta=(nextReps-spec.reps)*spec.repKm;

  copy.name=keySessionReplaceRepCount(
    copy.name,
    spec,
    nextReps
  );
  copy.uploadName=`Jaco - ${copy.name}`;
  copy.displaySteps=(copy.displaySteps||[]).map(step=>
    keySessionReplaceRepCount(
      step,
      spec,
      nextReps
    )
  );
  copy.intervalsDescription=
    keySessionReplaceRepCount(
      copy.intervalsDescription||"",
      spec,
      nextReps
    );

  copy.distanceKm=Math.max(
    0,
    Math.round(
      (Number(copy.distanceKm||0)+workKmDelta)*10
    )/10
  );

  const direction=
    nextReps>spec.reps
      ?"opgebouwd"
      :"teruggebracht";

  copy.displaySteps.push(
    `10.7 adaptieve dosis: ${spec.reps} → ${nextReps} herhalingen (${direction})`
  );

  copy.progressionV107={
    ...copy.progressionV107,
    applied:true,
    previousReps:spec.reps,
    nextReps,
    previousWorkKm:
      Math.round(spec.workKm*10)/10,
    nextWorkKm:
      Math.round(nextReps*spec.repKm*10)/10
  };

  return copy;
}

function keySessionProgressionStateLabel(state){
  return({
    learning:"Leren",
    consolidate:"Consolideren",
    progress:"Opbouwen",
    deload:"Terugschakelen"
  })[state]||state;
}

function keySessionProgressionDirection(model){
  if(model.state==="progress"){
    return"Volgende geschikte sessie: één kleine volumestap.";
  }
  if(model.state==="deload"){
    return"Volgende gegenereerde sessie: één kleine dosisstap terug.";
  }
  if(model.state==="consolidate"){
    return"Zelfde dosis behouden; eerst bewijs bevestigen.";
  }
  return`${model.count}/${KEY_SESSION_PROGRESSION_MIN_SESSIONS} vergelijkbare sessies beschikbaar.`;
}

function renderKeySessionProgression(){
  const root=document.getElementById(
    "keySessionProgressionCard"
  );
  if(!root) return null;

  const result=buildKeySessionProgression();

  root.className=
    `key-session-progression-card ${result.status}`;

  document.getElementById(
    "keySessionProgressionStatus"
  ).textContent=
    result.status==="progress"
      ?"Kleine opbouw mogelijk"
      :result.status==="protect"
        ?"Dosis beschermen"
        :result.status==="consolidate"
          ?"Consolideren"
          :"Nog aan het leren";

  document.getElementById(
    "keySessionProgressionSummary"
  ).textContent=
    result.status==="progress"
      ?"Minstens één categorie heeft voldoende consistent bewijs voor een kleine volumestap in een nieuw gegenereerde sessie."
      :result.status==="protect"
        ?"Recente signalen vragen om een kleinere sleutelprikkel; bestaande kalendertrainingen blijven onaangeroerd."
        :"Tempo- en dosisleren worden gescheiden: eerst stabiel uitvoeren, daarna pas de hoeveelheid werk verhogen.";

  document.getElementById(
    "keySessionProgressionModels"
  ).innerHTML=result.models.map(model=>`
    <div class="key-session-progression-model ${model.state}">
      <div class="key-session-progression-model-head">
        <strong>${safe(model.label)}</strong>
        <span>${safe(keySessionProgressionStateLabel(model.state))}</span>
      </div>
      <p>${safe(keySessionProgressionDirection(model))}</p>
      <small>${safe(model.reason)}</small>
      <div class="key-session-progression-mini">
        <span>bewijs ${model.count}/${KEY_SESSION_PROGRESSION_MIN_SESSIONS}</span>
        <span>${model.averageQuality===null?"kwaliteit —":`kwaliteit ${Math.round(model.averageQuality)}/100`}</span>
        <span>${model.averageCompletion===null?"voltooiing —":`voltooiing ${Math.round(model.averageCompletion*100)}%`}</span>
      </div>
    </div>
  `).join("");

  return result;
}

function refreshKeySessionProgression(){
  const result=renderKeySessionProgression();

  if(typeof resetGeneratedPlannerPreviews==="function"){
    resetGeneratedPlannerPreviews();
  }

  const status=document.getElementById(
    "keySessionProgressionRefreshStatus"
  );
  if(status){
    status.className="status ok";
    status.textContent=
      "Dosisprofiel opnieuw berekend. Alleen nieuwe trainingsvoorstellen gebruiken deze uitkomst.";
  }

  return result;
}
