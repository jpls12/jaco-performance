const TRAINING_QUALITY_KEY="jp_training_quality_v1";
let trainingQualityCache=loadObject(TRAINING_QUALITY_KEY);
if(!isPlainBackupObject(trainingQualityCache)){
  trainingQualityCache={results:{},latestActivityId:null};
}
if(!isPlainBackupObject(trainingQualityCache.results)){
  trainingQualityCache.results={};
}

function saveTrainingQualityCache(){
  const entries=Object.entries(trainingQualityCache.results)
    .sort((a,b)=>
      String(b[1]?.analyzedAt||"")
        .localeCompare(String(a[1]?.analyzedAt||""))
    )
    .slice(0,12);

  trainingQualityCache.results=Object.fromEntries(entries);
  saveObject(TRAINING_QUALITY_KEY,trainingQualityCache);
}

function qualityClamp(value,min=0,max=100){
  return Math.max(min,Math.min(max,Number(value)||0));
}

function qualityPaceSeconds(text){
  const match=String(text||"").match(/(\d{1,2}):(\d{2})/);
  if(!match) return null;
  const minutes=Number(match[1]);
  const seconds=Number(match[2]);
  if(!Number.isFinite(minutes)||!Number.isFinite(seconds)||seconds>59){
    return null;
  }
  return minutes*60+seconds;
}

function qualityPlanSpec(workout){
  if(!workout) return null;

  const text=[
    workout.name||"",
    ...(Array.isArray(workout.displaySteps)?workout.displaySteps:[]),
    workout.intervalsDescription||""
  ].join("\n");

  const repetitions=text.match(
    /(\d+)\s*[×xX]\s*(\d+(?:[.,]\d+)?)\s*(km|m|mtr)\b/i
  );

  const paceRange=text.match(
    /(?:@|pace\s*)?\s*[±~]?\s*(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})\s*\/?\s*km/i
  );
  const singlePace=!paceRange
    ?text.match(/(?:@|pace\s*)\s*[±~]?\s*(\d{1,2}:\d{2})\s*\/?\s*km/i)
    :null;

  let expectedReps=null;
  let repDistanceKm=null;
  if(repetitions){
    expectedReps=Number(repetitions[1]);
    const amount=Number(String(repetitions[2]).replace(",","."));
    const unit=String(repetitions[3]).toLowerCase();
    repDistanceKm=unit.startsWith("k")?amount:amount/1000;
  }

  if(!repDistanceKm){
    const segment=text.match(
      /(?:laatste\s+)?(\d+(?:[.,]\d+)?)\s*km[^@\n]{0,60}@\s*[±~]?\s*(\d{1,2}:\d{2})/i
    );
    if(segment){
      expectedReps=1;
      repDistanceKm=Number(String(segment[1]).replace(",","."));
    }
  }

  let paceA=null;
  let paceB=null;
  if(paceRange){
    paceA=qualityPaceSeconds(paceRange[1]);
    paceB=qualityPaceSeconds(paceRange[2]);
  }else if(singlePace){
    paceA=qualityPaceSeconds(singlePace[1]);
    paceB=paceA;
  }

  const paceFast=
    paceA===null||paceB===null
      ?null
      :Math.min(paceA,paceB);
  const paceSlow=
    paceA===null||paceB===null
      ?null
      :Math.max(paceA,paceB);

  const planType=String(workout.planType||"").toLowerCase();
  const kind=
    isHardWorkout(workout)
      ?"quality"
      :isLongWorkout(workout)
        ?"long"
        :planType==="recovery"
          ?"recovery"
          :"easy";

  return{
    kind,
    expectedReps,
    repDistanceKm,
    paceFast,
    paceSlow,
    hasPaceTarget:paceFast!==null&&paceSlow!==null,
    text
  };
}

function qualityRecentCandidate(){
  const today=todayDateString();

  return Object.entries(allWorkouts())
    .map(([date,workout])=>({
      date,
      workout,
      age:calendarDayDifference(today,date)
    }))
    .filter(item=>
      item.age!==null &&
      item.age>=0 &&
      item.age<=21 &&
      item.workout &&
      item.workout.type==="Run" &&
      (isHardWorkout(item.workout)||isLongWorkout(item.workout))
    )
    .map(item=>({
      ...item,
      execution:trainingExecutionForDate(item.date,item.workout)
    }))
    .filter(item=>
      item.execution?.matched &&
      item.execution?.actual?.id
    )
    .sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
}

function qualityIntervalPace(interval){
  const pace=finiteNumberOrNull(interval?.paceSecondsPerKm);
  if(pace!==null&&pace>0) return pace;

  const distance=finiteNumberOrNull(interval?.distanceKm);
  const moving=finiteNumberOrNull(interval?.movingSeconds);
  if(distance!==null&&distance>0&&moving!==null&&moving>0){
    return moving/distance;
  }
  return null;
}

function qualitySelectWorkIntervals(intervals,plan){
  const all=(Array.isArray(intervals)?intervals:[])
    .map(interval=>({
      ...interval,
      paceSecondsPerKm:qualityIntervalPace(interval)
    }))
    .filter(interval=>
      finiteNumberOrNull(interval.distanceKm)!==null &&
      finiteNumberOrNull(interval.distanceKm)>0 &&
      finiteNumberOrNull(interval.movingSeconds)!==null &&
      finiteNumberOrNull(interval.movingSeconds)>20
    );

  if(!plan?.repDistanceKm){
    return all.filter(interval=>
      String(interval.type||"").toUpperCase()==="WORK"
    );
  }

  const repDistance=plan.repDistanceKm;
  let candidates=all.filter(interval=>{
    const distance=Number(interval.distanceKm);
    const ratio=distance/repDistance;
    return ratio>=0.55&&ratio<=1.55;
  });

  const workOnly=candidates.filter(interval=>
    String(interval.type||"").toUpperCase()==="WORK"
  );

  if(
    workOnly.length &&
    (!plan.expectedReps||workOnly.length>=Math.min(plan.expectedReps,2))
  ){
    candidates=workOnly;
  }

  candidates=candidates
    .map(interval=>({
      interval,
      closeness:Math.abs(Number(interval.distanceKm)-repDistance)/repDistance
    }))
    .sort((a,b)=>a.closeness-b.closeness);

  if(plan.expectedReps&&plan.expectedReps>0){
    candidates=candidates.slice(0,plan.expectedReps);
  }

  return candidates
    .map(item=>item.interval)
    .sort((a,b)=>
      (finiteNumberOrNull(a.startTime)||0)-
      (finiteNumberOrNull(b.startTime)||0)
    );
}

function qualityVolumeScore(ratio){
  if(ratio===null) return null;
  if(ratio<1){
    return qualityClamp(100-(1-ratio)*145,25,100);
  }
  return qualityClamp(100-(ratio-1)*55,45,100);
}

function qualityPaceScore(pace,fast,slow){
  if(pace===null||fast===null||slow===null) return null;
  if(pace>=fast&&pace<=slow) return 100;

  const deviation=pace<fast
    ?fast-pace
    :pace-slow;

  return qualityClamp(100-deviation*4.2,30,100);
}

function qualityConsistencyScore(paces){
  const values=paces.filter(value=>value!==null);
  if(values.length<2) return null;

  const mean=values.reduce((sum,value)=>sum+value,0)/values.length;
  const variance=values.reduce(
    (sum,value)=>sum+Math.pow(value-mean,2),
    0
  )/values.length;
  const sd=Math.sqrt(variance);

  if(sd<=2) return 100;
  if(sd<=4) return 94;
  if(sd<=7) return 85;
  if(sd<=10) return 74;
  return qualityClamp(100-(sd-2)*4.2,35,100);
}

function qualityHeartRateScore(plan,activity,selected){
  const profile=getProfile();
  const maxHr=finiteNumberOrNull(profile.maxHr);
  const z2Hr=finiteNumberOrNull(profile.z2Hr);

  const selectedHr=selected
    .map(interval=>finiteNumberOrNull(interval.averageHeartRate))
    .filter(value=>value!==null);

  const workHr=selectedHr.length
    ?selectedHr.reduce((sum,value)=>sum+value,0)/selectedHr.length
    :finiteNumberOrNull(activity.averageHeartRate);

  if(workHr===null) return null;

  if(plan.kind==="quality"&&maxHr!==null&&maxHr>0){
    const ratio=workHr/maxHr;
    if(ratio>=.82&&ratio<=.97) return 96;
    if(ratio>=.77&&ratio<.82) return 82;
    if(ratio>.97&&ratio<=1.01) return 78;
    return 62;
  }

  if(
    ["easy","recovery","long"].includes(plan.kind)&&
    z2Hr!==null
  ){
    if(workHr<=z2Hr) return 100;
    if(workHr<=z2Hr+5) return 90;
    if(workHr<=z2Hr+10) return 75;
    return 55;
  }

  return null;
}

function qualityRpeScore(workout,activity){
  const planned=finiteNumberOrNull(
    String(workout?.rpe||"").split("/")[0]
  );
  const actual=finiteNumberOrNull(activity?.perceivedExertion);
  if(planned===null||actual===null) return null;

  const delta=Math.abs(actual-planned);
  if(delta<=1) return 100;
  if(delta<=2) return 82;
  if(delta<=3) return 68;
  return 50;
}

function qualityWeightedScore(parts){
  const available=parts.filter(part=>
    part.score!==null&&Number.isFinite(part.score)
  );
  if(!available.length) return null;

  const totalWeight=available.reduce(
    (sum,part)=>sum+part.weight,
    0
  );
  if(totalWeight<=0) return null;

  return Math.round(
    available.reduce(
      (sum,part)=>sum+part.score*part.weight,
      0
    )/totalWeight
  );
}

function qualityConfidence(plan,selected,detail){
  const intervalCount=Array.isArray(detail?.intervals)
    ?detail.intervals.length
    :0;

  if(
    plan.hasPaceTarget &&
    plan.expectedReps &&
    selected.length>=plan.expectedReps
  ){
    return{label:"Hoog",score:94};
  }

  if(plan.hasPaceTarget&&selected.length){
    return{label:"Goed",score:82};
  }

  if(intervalCount&&selected.length){
    return{label:"Redelijk",score:68};
  }

  return{label:"Laag",score:45};
}

function qualityVerdict(score){
  if(score===null){
    return{
      label:"Onvoldoende data",
      cls:"control",
      text:"Er zijn te weinig bruikbare gegevens voor een trainingskwaliteitscore."
    };
  }

  if(score>=90){
    return{
      label:"Uitstekend uitgevoerd",
      cls:"execute",
      text:"De sleutelonderdelen sluiten zeer goed aan op de geplande training."
    };
  }
  if(score>=80){
    return{
      label:"Goed uitgevoerd",
      cls:"execute",
      text:"De training is inhoudelijk goed geraakt met beperkte afwijkingen."
    };
  }
  if(score>=70){
    return{
      label:"Gecontroleerd",
      cls:"control",
      text:"De training is bruikbaar uitgevoerd, maar één of meer onderdelen weken merkbaar af."
    };
  }

  return{
    label:"Controleren",
    cls:"adjust",
    text:"De uitvoering week duidelijk af van het beoogde trainingsdoel."
  };
}

function qualityAverage(values){
  const usable=values.filter(value=>value!==null);
  if(!usable.length) return null;
  return usable.reduce((sum,value)=>sum+value,0)/usable.length;
}

function qualityFormatPace(seconds){
  if(seconds===null) return "—";
  return `${formatPace(seconds)}/km`;
}

function analyzeTrainingQuality(candidate,detail){
  const workout=candidate.workout;
  const activity=candidate.execution.actual;
  const plan=qualityPlanSpec(workout);
  const intervals=Array.isArray(detail?.intervals)
    ?detail.intervals
    :[];
  const selected=qualitySelectWorkIntervals(intervals,plan);
  const paces=selected.map(qualityIntervalPace);
  const averagePace=qualityAverage(paces);
  const averageWorkHr=qualityAverage(
    selected.map(interval=>
      finiteNumberOrNull(interval.averageHeartRate)
    )
  );

  const volumeRatio=executionVolumeRatio(workout,activity);
  const volumeScore=qualityVolumeScore(volumeRatio);

  const completionScore=
    plan.expectedReps
      ?qualityClamp(
        Math.min(selected.length/plan.expectedReps,1)*100,
        0,
        100
      )
      :null;

  const paceScores=
    plan.hasPaceTarget
      ?paces.map(pace=>
        qualityPaceScore(
          pace,
          plan.paceFast,
          plan.paceSlow
        )
      )
      :[];

  const paceScore=paceScores.length
    ?Math.round(qualityAverage(paceScores))
    :null;
  const consistencyScore=qualityConsistencyScore(paces);
  const heartRateScore=qualityHeartRateScore(plan,activity,selected);
  const rpeScore=qualityRpeScore(workout,activity);

  const structured=
    Boolean(plan.expectedReps&&plan.repDistanceKm);

  const parts=structured
    ?[
      {key:"completion",label:"Blokken voltooid",score:completionScore,weight:25},
      {key:"pace",label:"Tempodoel",score:paceScore,weight:35},
      {key:"consistency",label:"Consistentie",score:consistencyScore,weight:15},
      {key:"volume",label:"Totaalvolume",score:volumeScore,weight:15},
      {key:"hr",label:"HR-belasting",score:heartRateScore,weight:7},
      {key:"rpe",label:"RPE",score:rpeScore,weight:3}
    ]
    :[
      {key:"volume",label:"Totaalvolume",score:volumeScore,weight:45},
      {key:"hr",label:"HR-belasting",score:heartRateScore,weight:30},
      {key:"rpe",label:"RPE",score:rpeScore,weight:15},
      {key:"consistency",label:"Intervalconsistentie",score:consistencyScore,weight:10}
    ];

  let score=qualityWeightedScore(parts);

  if(structured && !intervals.length){
    score=null;
  }

  if(
    score!==null &&
    plan.expectedReps &&
    selected.length<plan.expectedReps
  ){
    const completionRatio=selected.length/plan.expectedReps;
    const completionCap=Math.round(55+completionRatio*35);
    score=Math.min(score,completionCap);
  }

  if(score!==null && paceScore!==null && paceScore<70){
    score=Math.min(score,79);
  }

  const confidence=qualityConfidence(plan,selected,detail);
  const verdict=qualityVerdict(score);

  const signals=[];

  if(plan.expectedReps){
    signals.push({
      state:selected.length>=plan.expectedReps?"good":"warn",
      icon:selected.length>=plan.expectedReps?"✓":"!",
      text:`Herkenbare werkblokken: ${selected.length}/${plan.expectedReps}.`
    });
  }

  if(plan.hasPaceTarget&&averagePace!==null){
    const inRange=
      averagePace>=plan.paceFast &&
      averagePace<=plan.paceSlow;
    signals.push({
      state:inRange?"good":"warn",
      icon:inRange?"✓":"!",
      text:`Gemiddeld werktempo ${qualityFormatPace(averagePace)} tegenover doel ${qualityFormatPace(plan.paceFast)}–${qualityFormatPace(plan.paceSlow)}.`
    });
  }

  if(volumeRatio!==null){
    const pct=Math.round(volumeRatio*100);
    signals.push({
      state:volumeRatio>=.85&&volumeRatio<=1.20?"good":"warn",
      icon:volumeRatio>=.85&&volumeRatio<=1.20?"✓":"!",
      text:`Totaalvolume ${pct}% van gepland.`
    });
  }

  if(averageWorkHr!==null){
    const maxHr=finiteNumberOrNull(getProfile().maxHr);
    const pct=maxHr
      ?` · ${Math.round(averageWorkHr/maxHr*100)}% HFmax`
      :"";
    signals.push({
      state:"good",
      icon:"♥",
      text:`Gemiddelde hartslag werkblokken ${Math.round(averageWorkHr)} bpm${pct}.`
    });
  }else if(finiteNumberOrNull(activity.averageHeartRate)!==null){
    signals.push({
      state:"good",
      icon:"♥",
      text:`Gemiddelde hartslag hele training ${Math.round(activity.averageHeartRate)} bpm.`
    });
  }

  if(consistencyScore!==null){
    signals.push({
      state:consistencyScore>=80?"good":"warn",
      icon:consistencyScore>=80?"✓":"!",
      text:`Tempo-consistentie ${Math.round(consistencyScore)}/100.`
    });
  }

  const load=finiteNumberOrNull(activity.trainingLoad);
  if(load!==null){
    signals.push({
      state:"good",
      icon:"L",
      text:`Intervals.icu training load ${Math.round(load)}.`
    });
  }

  return{
    version:"9.6",
    activityId:activity.id,
    activityDate:activity.date,
    activityName:activity.name,
    workoutIdentity:workoutCompletionIdentity(workout),
    workoutName:workout.name,
    plan,
    score,
    confidence,
    verdict,
    volumeRatio,
    selectedIntervals:selected.map((interval,index)=>({
      index:index+1,
      type:interval.type||"",
      distanceKm:finiteNumberOrNull(interval.distanceKm),
      movingSeconds:finiteNumberOrNull(interval.movingSeconds),
      paceSecondsPerKm:qualityIntervalPace(interval),
      averageHeartRate:finiteNumberOrNull(interval.averageHeartRate),
      maxHeartRate:finiteNumberOrNull(interval.maxHeartRate),
      trainingLoad:finiteNumberOrNull(interval.trainingLoad)
    })),
    components:parts,
    signals,
    analyzedAt:new Date().toISOString()
  };
}

function trainingQualityHistory({limit=12}={}){
  return Object.values(trainingQualityCache.results||{})
    .filter(result=>result&&typeof result==="object")
    .sort((a,b)=>
      String(b.activityDate||b.analyzedAt||"")
        .localeCompare(
          String(a.activityDate||a.analyzedAt||"")
        )
    )
    .slice(0,Math.max(1,Number(limit)||12));
}

function latestTrainingQualityResult(){
  const id=trainingQualityCache.latestActivityId;
  return id?trainingQualityCache.results[id]||null:null;
}

function latestTrainingQualityFeedback(activityId=null){
  const result=activityId
    ?trainingQualityCache.results[activityId]||null
    :latestTrainingQualityResult();

  if(!result||result.score===null){
    return{level:"unknown",text:"Geen recente trainingskwaliteitsanalyse beschikbaar."};
  }

  if(result.volumeRatio!==null&&result.volumeRatio>=1.35){
    return{
      level:"elevated",
      text:`${result.workoutName}: ${Math.round(result.volumeRatio*100)}% van gepland volume, kwaliteit ${result.score}/100.`
    };
  }

  if(result.score<68){
    return{
      level:"attention",
      text:`${result.workoutName}: trainingskwaliteit ${result.score}/100 (${result.verdict.label.toLowerCase()}).`
    };
  }

  return{
    level:"stable",
    text:`${result.workoutName}: trainingskwaliteit ${result.score}/100.`
  };
}

async function syncTrainingQualityLatest({silent=false,render=true,force=false}={}){
  const status=document.getElementById("trainingQualityStatus");
  const candidate=qualityRecentCandidate();

  if(!candidate){
    if(status&&!silent){
      status.className="status";
      status.textContent="Nog geen betrouwbaar gekoppelde sleuteltraining in de laatste 21 dagen.";
    }
    if(render) renderTrainingQualityAnalyzer();
    return{ok:false,reason:"no-candidate"};
  }

  const activityId=candidate.execution.actual.id;
  const cached=trainingQualityCache.results[activityId];

  if(
    cached &&
    cached.workoutIdentity===workoutCompletionIdentity(candidate.workout) &&
    !force
  ){
    trainingQualityCache.latestActivityId=activityId;
    saveTrainingQualityCache();
    if(render) renderTrainingQualityAnalyzer();
    return{ok:true,cached:true,result:cached};
  }

  if(status&&!silent){
    status.className="status";
    status.textContent=`${candidate.workout.name} wordt blok voor blok geanalyseerd…`;
  }

  try{
    const response=await fetchWithAppPin(
      `/api/intervals-activity-detail?activityId=${encodeURIComponent(activityId)}`
    );
    const data=await response.json();

    if(!response.ok){
      throw new Error(data.error||"Activiteitsdetails konden niet worden geladen.");
    }

    const result=analyzeTrainingQuality(candidate,data);
    trainingQualityCache.results[activityId]=result;
    trainingQualityCache.latestActivityId=activityId;
    saveTrainingQualityCache();

    if(render) renderTrainingQualityAnalyzer();

    if(status&&!silent){
      status.className=result.score!==null&&result.score>=70
        ?"status ok"
        :"status";
      status.textContent=
        `${result.workoutName}: ${result.score===null?"geen score":result.score+"/100"} · ${result.confidence.label} vertrouwen.`;
    }

    return{ok:true,result};
  }catch(error){
    if(status&&!silent){
      status.className="status error";
      status.textContent=`Training Quality mislukt: ${error.message}`;
    }
    if(render) renderTrainingQualityAnalyzer();
    return{ok:false,error};
  }
}

function renderTrainingQualityAnalyzer(){
  const root=document.getElementById("trainingQualityCard");
  if(!root) return null;

  const candidate=qualityRecentCandidate();
  const result=candidate
    ?trainingQualityCache.results[candidate.execution.actual.id]||null
    :latestTrainingQualityResult();

  const title=document.getElementById("trainingQualityTitle");
  const score=document.getElementById("trainingQualityScore");
  const confidence=document.getElementById("trainingQualityConfidence");
  const verdict=document.getElementById("trainingQualityVerdict");
  const summary=document.getElementById("trainingQualitySummary");
  const components=document.getElementById("trainingQualityComponents");
  const intervals=document.getElementById("trainingQualityIntervals");
  const signals=document.getElementById("trainingQualitySignals");

  if(!result){
    root.className="training-quality-card control";
    title.textContent=candidate
      ?candidate.workout.name
      :"Nog geen sleuteltraining";
    score.textContent="—";
    confidence.textContent="—";
    verdict.textContent=candidate
      ?"Nog niet geanalyseerd"
      :"Geen analyse beschikbaar";
    summary.textContent=candidate
      ?"Tik op Analyseer laatste training om intervaldetails op te halen."
      :"Zodra een sleuteltraining betrouwbaar is gekoppeld, verschijnt hier de uitvoering.";
    components.innerHTML="";
    intervals.innerHTML="";
    signals.innerHTML="";
    return null;
  }

  root.className=`training-quality-card ${result.verdict.cls}`;
  title.textContent=
    `${result.workoutName} · ${result.activityDate}`;
  score.textContent=result.score===null?"—":`${result.score}/100`;
  confidence.textContent=result.confidence.label;
  verdict.textContent=result.verdict.label;
  summary.textContent=result.verdict.text;

  components.innerHTML=result.components
    .filter(part=>part.score!==null)
    .map(part=>`
      <div class="training-quality-component">
        <span>${safe(part.label)}</span>
        <strong>${Math.round(part.score)}/100</strong>
      </div>
    `).join("");

  intervals.innerHTML=result.selectedIntervals.length
    ?result.selectedIntervals.map(interval=>`
      <div class="training-quality-interval">
        <strong>#${interval.index}</strong>
        <span>${interval.distanceKm===null?"—":interval.distanceKm.toFixed(interval.distanceKm>=1?2:3)+" km"}</span>
        <span>${qualityFormatPace(interval.paceSecondsPerKm)}</span>
        <span>${interval.averageHeartRate===null?"—":Math.round(interval.averageHeartRate)+" bpm"}</span>
      </div>
    `).join("")
    :'<p class="help">Geen afzonderlijke werkblokken betrouwbaar herkend; score gebruikt alleen beschikbare samenvattingsdata.</p>';

  signals.innerHTML=result.signals.map(signal=>`
    <div class="reason-item">
      <div class="reason-icon ${signal.state}">${signal.icon}</div>
      <div>${safe(signal.text)}</div>
    </div>
  `).join("");

  return result;
}
