function raceGoalGapText(seconds){
  const value=Math.abs(Math.round(Number(seconds)||0));
  const minutes=Math.floor(value/60);
  const secs=value%60;
  return minutes
    ?`${minutes}:${String(secs).padStart(2,"0")}`
    :`${secs} sec`;
}

function raceGoalLatestQuality(){
  const result=
    typeof latestTrainingQualityResult==="function"
      ?latestTrainingQualityResult()
      :null;

  if(!result?.activityDate) return null;

  const age=calendarDayDifference(
    todayDateString(),
    result.activityDate
  );

  if(age===null||age<0||age>35) return null;
  return{...result,ageDays:age};
}

function raceGoalTargetAssessment(race,prediction){
  const target=parseTimeToSeconds(race?.targetTime);
  const predicted=finiteNumberOrNull(prediction?.seconds);
  const fast=finiteNumberOrNull(prediction?.range?.low);
  const slow=finiteNumberOrNull(prediction?.range?.high);

  if(predicted===null){
    return{
      state:"unknown",
      target,
      referenceSeconds:target||null,
      text:"Nog onvoldoende onafhankelijke prestatiegegevens voor doeloptimalisatie."
    };
  }

  if(target===null){
    return{
      state:"neutral",
      target:null,
      referenceSeconds:predicted,
      text:`Nog geen streeftijd. Modelreferentie: ${formatRaceTime(predicted)}.`
    };
  }

  const fastest=fast!==null?fast:predicted*.985;
  const slowest=slow!==null?slow:predicted*1.025;

  if(target<fastest){
    return{
      state:"aggressive",
      target,
      referenceSeconds:fastest,
      text:`Doel ${race.targetTime} ligt ${raceGoalGapText(fastest-target)} sneller dan de snelste geloofwaardige modelrand ${formatRaceTime(fastest)}.`
    };
  }

  if(target>slowest){
    return{
      state:"conservative",
      target,
      referenceSeconds:target,
      text:`Doel ${race.targetTime} is conservatiever dan de huidige modelband en blijft volledig gerespecteerd.`
    };
  }

  return{
    state:"aligned",
    target,
    referenceSeconds:target,
    text:`Doel ${race.targetTime} past binnen de actuele modelband ${formatRaceTime(fastest)}–${formatRaceTime(slowest)}.`
  };
}

function raceGoalStatusLabel(status){
  return({
    ready:"Sterk klaar",
    "on-track":"Op schema",
    controlled:"Gecontroleerd",
    attention:"Aandacht"
  })[status]||"Onvoldoende data";
}

function raceGoalModelScore(prediction){
  const score=finiteNumberOrNull(prediction?.confidenceScore);
  if(score!==null) return score;

  const label=String(prediction?.confidence||"").toLowerCase();
  if(label==="hoog") return 94;
  if(label==="goed") return 82;
  if(label==="redelijk") return 68;
  if(label==="laag") return 48;
  return 35;
}

function raceGoalLoadScore(load){
  if(load?.level==="stable") return 88;
  if(load?.level==="attention") return 68;
  if(load?.level==="elevated") return 42;
  return 58;
}

function raceGoalExecutionScore(execution){
  if(execution?.level==="stable") return 90;
  if(execution?.level==="attention") return 67;
  if(execution?.level==="elevated") return 42;
  return 60;
}

function raceGoalQualityScore(quality){
  const score=finiteNumberOrNull(quality?.score);
  if(score===null) return 58;
  const penalty=quality.ageDays<=10?0:quality.ageDays<=21?5:10;
  return Math.max(35,score-penalty);
}

function raceGoalAssessmentScore(assessment){
  if(assessment.state==="aligned") return 92;
  if(assessment.state==="conservative") return 86;
  if(assessment.state==="aggressive") return 55;
  if(assessment.state==="neutral") return 78;
  return 55;
}

function raceGoalRecoveryScore(readiness,days){
  if(days>10) return 72;
  if(!readiness?.sufficientData) return 58;
  return Math.max(35,Math.min(100,Number(readiness.score)||0));
}

function buildRaceReadinessGoalOptimizer(race){
  if(!race){
    return{
      race:null,
      score:null,
      status:"empty",
      confidence:{score:0,label:"Onvoldoende"},
      band:{fast:null,slow:null},
      referenceSeconds:null,
      referencePaceSeconds:null,
      signals:[]
    };
  }

  const prediction=
    typeof performanceModelPredictionForDistance==="function"
      ?performanceModelPredictionForDistance(Number(race.distanceKm||0))
      :null;
  const quality=raceGoalLatestQuality();
  const readiness=determineReadiness(getWellnessSnapshot());
  const load=buildLoadMonitor();
  const execution=buildAdaptiveExecutionFeedback();
  const assessment=raceGoalTargetAssessment(race,prediction);
  const days=daysUntil(race.date);

  const components={
    model:raceGoalModelScore(prediction),
    quality:raceGoalQualityScore(quality),
    load:raceGoalLoadScore(load),
    execution:raceGoalExecutionScore(execution),
    recovery:raceGoalRecoveryScore(readiness,days),
    goal:raceGoalAssessmentScore(assessment)
  };

  const weights=
    days<=7
      ?{model:.28,quality:.20,load:.14,execution:.12,recovery:.18,goal:.08}
      :{model:.34,quality:.23,load:.16,execution:.14,recovery:.05,goal:.08};

  const score=Math.round(
    Object.entries(weights).reduce(
      (sum,[key,weight])=>sum+components[key]*weight,
      0
    )
  );

  const predicted=finiteNumberOrNull(prediction?.seconds);
  let fast=finiteNumberOrNull(prediction?.range?.low);
  let slow=finiteNumberOrNull(prediction?.range?.high);

  if(predicted!==null){
    if(fast===null) fast=predicted*.985;
    if(slow===null) slow=predicted*1.025;

    const q=finiteNumberOrNull(quality?.score);
    if(q!==null&&q>=88){
      fast=predicted-(predicted-fast)*.85;
      slow=predicted+(slow-predicted)*.85;
    }else if(q!==null&&q<70){
      fast=predicted-(predicted-fast)*1.1;
      slow=predicted+(slow-predicted)*1.2;
    }
  }

  let referenceSeconds=finiteNumberOrNull(
    assessment.referenceSeconds
  );

  if(
    referenceSeconds!==null &&
    days<=5 &&
    readiness?.sufficientData &&
    readiness.level==="low" &&
    predicted!==null
  ){
    referenceSeconds=Math.max(
      referenceSeconds,
      predicted*1.01
    );
  }

  let confidenceScore=Math.round(components.model*.50)+20;
  if(quality?.score!==null&&quality?.score!==undefined){
    confidenceScore+=25;
  }else{
    confidenceScore+=10;
  }
  if(days<=7){
    confidenceScore+=readiness?.sufficientData?25:8;
  }else{
    confidenceScore+=20;
  }
  confidenceScore=Math.max(0,Math.min(100,confidenceScore));

  const confidenceLabel=
    confidenceScore>=86
      ?"Hoog"
      :confidenceScore>=70
        ?"Goed"
        :confidenceScore>=52
          ?"Redelijk"
          :"Laag";

  const status=
    assessment.state==="aggressive"
      ?score>=58
        ?"controlled"
        :"attention"
      :score>=86
        ?"ready"
        :score>=72
          ?"on-track"
          :score>=58
            ?"controlled"
            :"attention";

  const signals=[
    {
      state:assessment.state==="aggressive"?"warn":"good",
      icon:assessment.state==="aggressive"?"!":"✓",
      text:assessment.text
    },
    quality
      ?{
        state:finiteNumberOrNull(quality.score)!==null&&quality.score>=80?"good":"warn",
        icon:finiteNumberOrNull(quality.score)!==null&&quality.score>=80?"✓":"!",
        text:quality.score===null
          ?`${quality.workoutName}: onvoldoende intervaldata voor kwaliteitsscore.`
          :`${quality.workoutName}: ${quality.score}/100 trainingskwaliteit (${quality.ageDays} d geleden).`
      }
      :{
        state:"warn",
        icon:"?",
        text:"Geen recente sleuteltraining binnen 35 dagen als wedstrijdspecifieke bevestiging."
      },
    {
      state:load.level==="elevated"?"bad":load.level==="attention"?"warn":"good",
      icon:load.level==="elevated"?"×":load.level==="attention"?"!":"✓",
      text:`Belastbaarheid: ${load.level||"onbekend"}.`
    }
  ];

  if(days<=7){
    signals.push({
      state:readiness.level==="good"?"good":readiness.level==="low"?"bad":"warn",
      icon:readiness.level==="good"?"✓":readiness.level==="low"?"×":"!",
      text:readiness.sufficientData
        ?`Actueel herstel ${readiness.score}/100 · ${readiness.level}.`
        :"Actuele hersteldata is onvoldoende voor raceweeksturing."
    });
  }

  return{
    race,
    days,
    prediction,
    assessment,
    quality,
    readiness,
    load,
    execution,
    components,
    score,
    status,
    confidence:{
      score:confidenceScore,
      label:confidenceLabel
    },
    band:{fast,slow},
    referenceSeconds,
    referencePaceSeconds:
      referenceSeconds!==null&&Number(race.distanceKm)>0
        ?referenceSeconds/Number(race.distanceKm)
        :null,
    signals
  };
}

function optimizedRaceReferenceSeconds(race){
  return finiteNumberOrNull(
    buildRaceReadinessGoalOptimizer(race).referenceSeconds
  );
}

function renderRaceReadinessGoalOptimizer(race){
  const root=document.getElementById("raceGoalOptimizer");
  if(!root) return null;

  if(!race){
    root.className="race-readiness-optimizer control";
    document.getElementById("raceGoalOptimizerStatus").textContent="Geen wedstrijd";
    document.getElementById("raceGoalOptimizerScore").textContent="—";
    document.getElementById("raceGoalOptimizerConfidence").textContent="—";
    document.getElementById("raceGoalOptimizerBand").textContent="—";
    document.getElementById("raceGoalOptimizerReferencePace").textContent="—";
    document.getElementById("raceGoalOptimizerAssessment").textContent=
      "Selecteer eerst een toekomstige wedstrijd.";
    document.getElementById("raceGoalOptimizerSignals").innerHTML="";
    return null;
  }

  const result=buildRaceReadinessGoalOptimizer(race);
  const cls=
    ["ready","on-track"].includes(result.status)
      ?"execute"
      :result.status==="attention"
        ?"adjust"
        :"control";

  root.className=`race-readiness-optimizer ${cls}`;
  document.getElementById("raceGoalOptimizerStatus").textContent=
    raceGoalStatusLabel(result.status);
  document.getElementById("raceGoalOptimizerScore").textContent=
    `${result.score}/100`;
  document.getElementById("raceGoalOptimizerConfidence").textContent=
    `${result.confidence.label} · ${result.confidence.score}/100`;
  document.getElementById("raceGoalOptimizerBand").textContent=
    result.band.fast!==null&&result.band.slow!==null
      ?`${formatRaceTime(result.band.fast)} – ${formatRaceTime(result.band.slow)}`
      :"—";
  document.getElementById("raceGoalOptimizerReferencePace").textContent=
    result.referencePaceSeconds!==null
      ?`${formatPace(result.referencePaceSeconds)}/km`
      :"—";
  document.getElementById("raceGoalOptimizerAssessment").textContent=
    result.assessment?.text||"Nog geen doelanalyse.";
  document.getElementById("raceGoalOptimizerSignals").innerHTML=
    result.signals.map(signal=>`
      <div class="reason-item">
        <div class="reason-icon ${signal.state}">${signal.icon}</div>
        <div>${safe(signal.text)}</div>
      </div>
    `).join("");

  return result;
}
