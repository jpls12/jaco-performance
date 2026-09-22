const TRAINING_RESPONSE_WINDOW_DAYS=63;
const TRAINING_RESPONSE_MIN_SESSIONS=3;
const TRAINING_RESPONSE_MAX_SESSIONS=6;
const TRAINING_RESPONSE_MAX_ADJUSTMENT=4;

function trainingResponseAverage(values){
  const usable=values.filter(value=>
    value!==null &&
    Number.isFinite(Number(value))
  ).map(Number);
  if(!usable.length) return null;
  return usable.reduce((sum,value)=>sum+value,0)/usable.length;
}

function trainingResponseMedian(values){
  const usable=values
    .filter(value=>value!==null&&Number.isFinite(Number(value)))
    .map(Number)
    .sort((a,b)=>a-b);

  if(!usable.length) return null;

  const middle=Math.floor(usable.length/2);
  return usable.length%2
    ?usable[middle]
    :(usable[middle-1]+usable[middle])/2;
}

function trainingResponseStdDev(values){
  const usable=values
    .filter(value=>value!==null&&Number.isFinite(Number(value)))
    .map(Number);

  if(usable.length<2) return null;

  const mean=trainingResponseAverage(usable);
  const variance=usable.reduce(
    (sum,value)=>sum+Math.pow(value-mean,2),
    0
  )/usable.length;

  return Math.sqrt(variance);
}

function trainingResponseComponent(result,key){
  const item=(result?.components||[]).find(component=>
    component?.key===key
  );
  return finiteNumberOrNull(item?.score);
}

function trainingResponseTargetMid(result){
  const fast=finiteNumberOrNull(result?.plan?.paceFast);
  const slow=finiteNumberOrNull(result?.plan?.paceSlow);

  if(fast===null||slow===null) return null;
  return (fast+slow)/2;
}

function trainingResponseActualPace(result){
  const values=(result?.selectedIntervals||[])
    .map(interval=>
      finiteNumberOrNull(interval?.paceSecondsPerKm)
    )
    .filter(value=>value!==null&&value>0);

  return trainingResponseAverage(values);
}

function trainingResponseCompletionRatio(result){
  const expected=finiteNumberOrNull(
    result?.plan?.expectedReps
  );
  const actual=(result?.selectedIntervals||[]).length;

  if(expected===null||expected<=0){
    const completion=trainingResponseComponent(
      result,
      "completion"
    );
    return completion===null
      ?null
      :completion/100;
  }

  return Math.max(
    0,
    Math.min(1.25,actual/expected)
  );
}

function trainingResponseModelPaces(){
  const prediction=distance=>{
    if(typeof performanceModelPredictionForDistance!=="function"){
      return null;
    }
    const result=performanceModelPredictionForDistance(distance);
    const seconds=finiteNumberOrNull(result?.seconds);
    return seconds===null?null:seconds/distance;
  };

  return{
    fiveK:prediction(5),
    tenK:prediction(10),
    half:prediction(21.0975)
  };
}

function trainingResponseCategory(result){
  const text=[
    result?.workoutName||"",
    result?.plan?.text||""
  ].join(" ").toLowerCase();

  if(
    /\bhalve\b|half[\s-]?marathon|\bhm\b|hm[\s-]?tempo/.test(text)
  ){
    return"hm";
  }

  if(
    /\bmarathon\b|marathonpace|marathontempo|\bmp\b/.test(text)
  ){
    return"marathon";
  }

  if(
    /drempel|threshold|cruise/.test(text)
  ){
    return"threshold";
  }

  if(
    /\bvo2\b|vo₂|maximaal aeroob|5[\s-]?km[\s-]?tempo|5k[\s-]?pace/.test(text)
  ){
    return"vo2";
  }

  const rep=finiteNumberOrNull(
    result?.plan?.repDistanceKm
  );
  const target=trainingResponseTargetMid(result);
  const model=trainingResponseModelPaces();

  if(target!==null){
    if(
      model.fiveK!==null &&
      target<=model.fiveK+8
    ){
      return"vo2";
    }

    if(
      model.tenK!==null &&
      target<=model.tenK+10
    ){
      return"threshold";
    }

    if(
      model.half!==null &&
      Math.abs(target-model.half)<=12
    ){
      return"hm";
    }
  }

  if(rep!==null){
    if(rep<=1.2) return"vo2";
    if(rep>=1.5&&rep<=4) return"threshold";
  }

  return null;
}

function trainingResponseSessionEvidence(result){
  if(!result?.activityDate) return null;

  const age=calendarDayDifference(
    todayDateString(),
    result.activityDate
  );

  if(
    age===null ||
    age<0 ||
    age>TRAINING_RESPONSE_WINDOW_DAYS
  ){
    return null;
  }

  const category=trainingResponseCategory(result);
  const targetPace=trainingResponseTargetMid(result);
  const actualPace=trainingResponseActualPace(result);

  if(
    !category ||
    targetPace===null ||
    actualPace===null
  ){
    return null;
  }

  const completion=trainingResponseCompletionRatio(result);
  const consistency=trainingResponseComponent(
    result,
    "consistency"
  );
  const hr=trainingResponseComponent(result,"hr");
  const rpe=trainingResponseComponent(result,"rpe");
  const quality=finiteNumberOrNull(result.score);

  const executionStrong=
    (completion===null||completion>=.90) &&
    (consistency===null||consistency>=80) &&
    (hr===null||hr>=75) &&
    (rpe===null||rpe>=68);

  const deviation=actualPace-targetPace;

  const fasterSignal=
    deviation<=-3 &&
    executionStrong;

  const slowerSignal=
    (
      deviation>=3 &&
      (completion===null||completion>=.80)
    ) ||
    (
      completion!==null &&
      completion<.75
    );

  const stableSignal=
    Math.abs(deviation)<3 &&
    (completion===null||completion>=.90);

  return{
    activityId:result.activityId,
    date:result.activityDate,
    ageDays:age,
    workoutName:result.workoutName,
    category,
    targetPace,
    actualPace,
    deviation,
    completion,
    consistency,
    hr,
    rpe,
    quality,
    confidence:
      finiteNumberOrNull(
        result?.confidence?.score
      ),
    fasterSignal,
    slowerSignal,
    stableSignal,
    executionStrong
  };
}

function trainingResponseHistory(){
  if(typeof trainingQualityHistory!=="function"){
    return[];
  }

  return trainingQualityHistory({
    limit:12
  })
    .map(trainingResponseSessionEvidence)
    .filter(Boolean)
    .sort((a,b)=>b.date.localeCompare(a.date));
}

function trainingResponseCategoryLabel(category){
  return({
    threshold:"Drempel",
    vo2:"VO₂",
    hm:"HM-specifiek",
    marathon:"Marathon-specifiek"
  })[category]||category;
}

function trainingResponseCategoryModel(category){
  const sessions=trainingResponseHistory()
    .filter(item=>item.category===category)
    .slice(0,TRAINING_RESPONSE_MAX_SESSIONS);

  const count=sessions.length;
  const deviations=sessions.map(item=>item.deviation);
  const median=trainingResponseMedian(deviations);
  const spread=trainingResponseStdDev(deviations);

  const faster=sessions.filter(item=>
    item.fasterSignal
  ).length;
  const slower=sessions.filter(item=>
    item.slowerSignal
  ).length;
  const stable=sessions.filter(item=>
    item.stableSignal
  ).length;

  const supportNeeded=Math.max(
    2,
    Math.ceil(count*.60)
  );

  let direction="learning";

  if(count>=TRAINING_RESPONSE_MIN_SESSIONS){
    if(
      faster>=supportNeeded &&
      slower<=1 &&
      median!==null &&
      median<=-3
    ){
      direction="faster";
    }else if(
      slower>=supportNeeded &&
      faster<=1 &&
      median!==null &&
      median>=2
    ){
      direction="slower";
    }else{
      direction="stable";
    }
  }

  let adjustmentSec=0;

  if(direction==="faster"&&median!==null){
    adjustmentSec=
      -Math.min(
        TRAINING_RESPONSE_MAX_ADJUSTMENT,
        Math.max(
          1,
          Math.round(Math.abs(median)*.45)
        )
      );
  }else if(direction==="slower"&&median!==null){
    adjustmentSec=
      Math.min(
        TRAINING_RESPONSE_MAX_ADJUSTMENT,
        Math.max(
          1,
          Math.round(Math.abs(median)*.45)
        )
      );
  }

  let confidenceScore=
    count===0
      ?0
      :count===1
        ?36
        :count===2
          ?54
          :count===3
            ?72
            :count===4
              ?80
              :88;

  if(
    spread!==null &&
    spread>5
  ){
    confidenceScore-=10;
  }else if(
    spread!==null &&
    spread<=3 &&
    count>=3
  ){
    confidenceScore+=5;
  }

  const dominant=Math.max(faster,slower,stable);
  if(count>=3&&dominant/count>=.8){
    confidenceScore+=4;
  }

  confidenceScore=Math.max(
    0,
    Math.min(96,confidenceScore)
  );

  const confidenceLabel=
    confidenceScore>=86
      ?"Hoog"
      :confidenceScore>=70
        ?"Goed"
        :confidenceScore>=50
          ?"Redelijk"
          :"Laag";

  const active=
    count>=TRAINING_RESPONSE_MIN_SESSIONS &&
    confidenceScore>=70 &&
    adjustmentSec!==0 &&
    ["threshold","vo2"].includes(category);

  const latestDate=sessions[0]?.date||null;
  const averageQuality=trainingResponseAverage(
    sessions.map(item=>item.quality)
  );

  let headline="Nog aan het leren";
  let text=
    `${count}/${TRAINING_RESPONSE_MIN_SESSIONS} vergelijkbare sessies beschikbaar.`;

  if(count>=TRAINING_RESPONSE_MIN_SESSIONS){
    if(direction==="faster"){
      headline="Doeltempo lijkt conservatief";
      text=
        `Meerdere sterke uitvoeringen waren gemiddeld sneller dan gepland. ${active?`Nieuwe ${trainingResponseCategoryLabel(category)}-trainingen worden ${Math.abs(adjustmentSec)} sec/km sneller gegenereerd.`:`Voor deze categorie wordt alleen een leeradvies getoond.`}`;
    }else if(direction==="slower"){
      headline="Doeltempo lijkt te scherp";
      text=
        `Meerdere uitvoeringen wijzen op een te agressieve pace. ${active?`Nieuwe ${trainingResponseCategoryLabel(category)}-trainingen worden ${Math.abs(adjustmentSec)} sec/km rustiger gegenereerd.`:`Voor deze categorie wordt alleen een leeradvies getoond.`}`;
    }else{
      headline="Doeltempo staat goed";
      text=
        "De recente uitvoeringen geven geen consistent signaal om de pace te verschuiven.";
    }
  }

  return{
    category,
    label:trainingResponseCategoryLabel(category),
    sessions,
    count,
    required:TRAINING_RESPONSE_MIN_SESSIONS,
    medianDeviation:median,
    spread,
    faster,
    slower,
    stable,
    direction,
    adjustmentSec,
    active,
    confidenceScore,
    confidenceLabel,
    latestDate,
    averageQuality,
    headline,
    text
  };
}

function buildTrainingResponseLearner(){
  const categories=["threshold","vo2","hm"];
  const models=categories.map(
    trainingResponseCategoryModel
  );

  const active=models.filter(model=>model.active);
  const totalSessions=new Set(
    trainingResponseHistory().map(item=>item.activityId)
  ).size;

  const overallScore=models.length
    ?Math.round(
      trainingResponseAverage(
        models.map(model=>model.confidenceScore)
      )||0
    )
    :0;

  const status=
    active.length
      ?"adapt"
      :models.some(model=>
        model.count>=TRAINING_RESPONSE_MIN_SESSIONS
      )
        ?"stable"
        :"learning";

  return{
    createdAt:new Date().toISOString(),
    totalSessions,
    models,
    active,
    overallScore,
    status
  };
}

function learnedTrainingPaceAdjustment(category){
  const model=trainingResponseCategoryModel(category);
  return model.active
    ?model.adjustmentSec
    :0;
}

function trainingResponseDirectionText(model){
  if(model.direction==="faster"){
    return `${Math.abs(model.adjustmentSec)} sec/km sneller`;
  }
  if(model.direction==="slower"){
    return `${Math.abs(model.adjustmentSec)} sec/km rustiger`;
  }
  if(model.direction==="stable"){
    return"Geen aanpassing";
  }
  return `${model.count}/${model.required} sessies`;
}

function trainingResponseEvidenceRows(learner){
  return learner.models
    .flatMap(model=>
      model.sessions.slice(0,3).map(session=>({
        ...session,
        label:model.label
      }))
    )
    .sort((a,b)=>b.date.localeCompare(a.date))
    .slice(0,8);
}

function renderTrainingResponseLearner(){
  const root=document.getElementById("trainingResponseCard");
  if(!root) return null;

  const learner=buildTrainingResponseLearner();
  const status=document.getElementById(
    "trainingResponseStatus"
  );
  const summary=document.getElementById(
    "trainingResponseSummary"
  );

  root.className=
    `training-response-card ${learner.status}`;

  status.textContent=
    learner.status==="adapt"
      ?"Actief leren"
      :learner.status==="stable"
        ?"Paces stabiel"
        :"Nog aan het leren";

  document.getElementById(
    "trainingResponseEvidenceCount"
  ).textContent=
    String(learner.totalSessions);

  document.getElementById(
    "trainingResponseConfidence"
  ).textContent=
    `${learner.overallScore}/100`;

  summary.textContent=
    learner.active.length
      ?`${learner.active.length} pace-aanpassing${learner.active.length===1?"":"en"} actief voor toekomstige gegenereerde trainingen. Bestaande kalendertrainingen en racepace blijven ongewijzigd.`
      :learner.totalSessions
        ?"Nog geen automatische paceverschuiving nodig. De learner blijft recente sleuteltrainingen verzamelen."
        :"Nog geen bruikbare sleuteltrainingen met tempo-doel beschikbaar.";

  const grid=document.getElementById(
    "trainingResponseModels"
  );

  grid.innerHTML=learner.models.map(model=>`
    <div class="training-response-model ${model.active?"active":""}">
      <div class="training-response-model-head">
        <strong>${safe(model.label)}</strong>
        <span>${safe(model.confidenceLabel)}</span>
      </div>
      <div class="training-response-model-value">
        ${safe(trainingResponseDirectionText(model))}
      </div>
      <small>${safe(model.headline)}</small>
      <p>${safe(model.text)}</p>
      <div class="training-response-mini">
        <span>bewijs ${model.count}/${model.required}</span>
        <span>${model.medianDeviation===null?"mediaan —":`mediaan ${model.medianDeviation>0?"+":""}${model.medianDeviation.toFixed(1)} s/km`}</span>
      </div>
    </div>
  `).join("");

  const evidence=document.getElementById(
    "trainingResponseEvidence"
  );
  const rows=trainingResponseEvidenceRows(learner);

  evidence.innerHTML=rows.length
    ?rows.map(item=>`
      <div class="training-response-evidence-row">
        <div>
          <strong>${safe(item.date)}</strong>
          <small>${safe(item.label)}</small>
        </div>
        <div>
          <span>${safe(item.workoutName)}</span>
          <small>
            ${item.deviation>0?"+":""}${item.deviation.toFixed(1)} s/km vs doel
            ${item.quality===null?"":` · kwaliteit ${Math.round(item.quality)}/100`}
          </small>
        </div>
      </div>
    `).join("")
    :'<p class="help">Nog geen vergelijkbare sessies met bruikbaar doeltempo en herkende werkblokken.</p>';

  return learner;
}

function refreshTrainingResponseLearner(){
  const learner=renderTrainingResponseLearner();
  const status=document.getElementById(
    "trainingResponseRefreshStatus"
  );

  if(status){
    status.className="status ok";
    status.textContent=
      learner?.active?.length
        ?`Leerprofiel opnieuw berekend; ${learner.active.length} toekomstige pace-aanpassing${learner.active.length===1?"":"en"} actief.`
        :"Leerprofiel opnieuw berekend; geen automatische pace-aanpassing nodig.";
  }

  if(typeof renderRaceSimulator==="function"){
    renderRaceSimulator();
  }

  return learner;
}
