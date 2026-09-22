const PERFORMANCE_MODEL_TARGETS=[
  {key:"5k",label:"5 km",distance:5},
  {key:"10k",label:"10 km",distance:10},
  {key:"hm",label:"Halve marathon",distance:21.0975},
  {key:"marathon",label:"Marathon",distance:42.195}
];

function performanceModelPaceSeconds(seconds,distance){
  const total=finiteNumberOrNull(seconds);
  const km=finiteNumberOrNull(distance);
  if(total===null || km===null || km<=0) return null;
  return total/km;
}

function performanceModelDistanceRatio(a,b){
  const x=Number(a);
  const y=Number(b);
  if(!x || !y) return Infinity;
  return Math.max(x/y,y/x);
}

function performanceModelRaceForActivity(activity){
  const date=String(activity?.date||"");
  const distance=finiteNumberOrNull(activity?.distanceKm);
  if(!date || distance===null) return null;

  const calendarRace=allWorkouts()[date];
  if(
    calendarRace?.type==="Race" &&
    finiteNumberOrNull(calendarRace.distanceKm)!==null &&
    performanceModelDistanceRatio(
      distance,
      calendarRace.distanceKm
    )<=1.12
  ){
    return{
      name:calendarRace.name||"Wedstrijd",
      distanceKm:Number(calendarRace.distanceKm),
      source:"kalender"
    };
  }

  const race=Object.values(races||{}).find(item=>
    item?.date===date &&
    finiteNumberOrNull(item.distanceKm)!==null &&
    performanceModelDistanceRatio(distance,item.distanceKm)<=1.12
  );

  return race
    ?{
      name:race.name||"Wedstrijd",
      distanceKm:Number(race.distanceKm),
      source:"wedstrijdkalender"
    }
    :null;
}

function performanceModelProfileEvidence(){
  return profilePerformanceSources(getProfile()).map((source,index)=>({
    id:`profile-${index}-${source.distance}`,
    kind:"profile",
    trusted:true,
    distance:Number(source.distance),
    seconds:Number(source.seconds),
    date:null,
    ageDays:null,
    name:source.label,
    source:source.label,
    confidence:"Goed",
    weightBase:1
  }));
}

function performanceModelSyncedRunEvidence(){
  const today=todayDateString();
  const all=Object.values(syncedActivities||{})
    .filter(activity=>
      syncedSportFamily(activity?.type)==="run" &&
      finiteNumberOrNull(activity?.distanceKm)!==null &&
      finiteNumberOrNull(activity?.durationMinutes)!==null
    )
    .map(activity=>{
      const distance=Number(activity.distanceKm);
      const seconds=Number(activity.durationMinutes)*60;
      const pace=distance>0?seconds/distance:null;
      const ageDays=calendarDayDifference(today,activity.date);
      const race=performanceModelRaceForActivity(activity);
      const profileData=getProfile();
      const maxHr=finiteNumberOrNull(profileData.maxHr);
      const averageHr=finiteNumberOrNull(activity.averageHeartRate);
      const rpe=finiteNumberOrNull(activity.perceivedExertion);
      const name=String(activity.name||"").toLowerCase();
      const namedEffort=
        /race|wedstrijd|parkrun|time trial|\btt\b|5\s?k|10\s?k|halve|half marathon|marathon/.test(name);
      const highHr=
        maxHr!==null &&
        averageHr!==null &&
        averageHr>=maxHr*.86;
      const hardRpe=rpe!==null && rpe>=8;

      return{
        activity,
        distance,
        seconds,
        pace,
        ageDays,
        race,
        performanceLike:Boolean(race||namedEffort||highHr||hardRpe)
      };
    })
    .filter(item=>
      item.distance>=4 &&
      item.distance<=44.5 &&
      item.seconds>0 &&
      item.pace>=135 &&
      item.pace<=720 &&
      item.ageDays!==null &&
      item.ageDays>=0 &&
      item.ageDays<=120
    );

  const trusted=all
    .filter(item=>Boolean(item.race))
    .map(item=>({
      id:`activity-${item.activity.id}`,
      kind:"race",
      trusted:true,
      distance:item.distance,
      seconds:item.seconds,
      date:item.activity.date,
      ageDays:item.ageDays,
      name:item.race.name,
      source:`${item.race.name} · ${item.activity.date}`,
      confidence:"Hoog",
      weightBase:1.35
    }));

  const standardFallbacks=[];
  PERFORMANCE_MODEL_TARGETS.forEach(target=>{
    const tolerance=
      target.distance<=5?0.35:
      target.distance<=10?0.65:
      target.distance<=22?1.25:
      2.0;

    const candidates=all
      .filter(item=>
        !item.race &&
        item.performanceLike &&
        Math.abs(item.distance-target.distance)<=tolerance
      )
      .sort((a,b)=>{
        const normalizedA=riegelPrediction(
          a.seconds,
          a.distance,
          target.distance
        );
        const normalizedB=riegelPrediction(
          b.seconds,
          b.distance,
          target.distance
        );
        return normalizedA-normalizedB;
      });

    const best=candidates[0];
    if(best){
      standardFallbacks.push({
        id:`fallback-${target.key}-${best.activity.id}`,
        kind:"training",
        trusted:false,
        distance:best.distance,
        seconds:best.seconds,
        date:best.activity.date,
        ageDays:best.ageDays,
        name:best.activity.name||"Training",
        source:`Recente training · ${best.activity.date}`,
        confidence:"Laag",
        weightBase:.35
      });
    }
  });

  return[
    ...trusted,
    ...standardFallbacks
  ];
}

function performanceModelEvidence(){
  const evidence=[
    ...performanceModelProfileEvidence(),
    ...performanceModelSyncedRunEvidence()
  ];

  const unique=new Map();
  evidence.forEach(item=>{
    if(!unique.has(item.id)) unique.set(item.id,item);
  });

  return [...unique.values()];
}

function performanceModelRecencyWeight(evidence){
  if(evidence.ageDays===null || evidence.ageDays===undefined){
    return .92;
  }

  if(evidence.ageDays<=14) return 1;
  if(evidence.ageDays<=35) return .92;
  if(evidence.ageDays<=60) return .82;
  if(evidence.ageDays<=90) return .72;
  return .62;
}

function performanceModelProximityWeight(sourceDistance,targetDistance){
  const ratio=performanceModelDistanceRatio(
    sourceDistance,
    targetDistance
  );

  if(ratio<=1.08) return 1.25;
  if(ratio<=1.35) return 1;
  if(ratio<=1.8) return .82;
  if(ratio<=2.5) return .64;
  if(ratio<=4.5) return .48;
  return .34;
}

function performanceModelMarathonDurabilityFactor(sourceDistance,targetDistance){
  const source=Number(sourceDistance);
  const target=Number(targetDistance);
  if(target<40 || source>=30) return 1;

  const ratio=target/source;
  if(ratio<=1.45) return 1.006;
  if(ratio<=2.2) return 1.015;
  if(ratio<=3.2) return 1.024;
  return 1.034;
}

function performanceModelEstimateFromEvidence(evidence,targetDistance){
  const base=riegelPrediction(
    evidence.seconds,
    evidence.distance,
    targetDistance
  );
  if(!base) return null;

  const durability=performanceModelMarathonDurabilityFactor(
    evidence.distance,
    targetDistance
  );

  const seconds=base*durability;
  const weight=
    Number(evidence.weightBase||1)*
    performanceModelRecencyWeight(evidence)*
    performanceModelProximityWeight(
      evidence.distance,
      targetDistance
    );

  return{
    evidence,
    seconds,
    weight,
    durability
  };
}

function performanceModelWeightedMedian(estimates){
  if(!estimates.length) return null;

  const sorted=[...estimates].sort((a,b)=>a.seconds-b.seconds);
  const total=sorted.reduce((sum,item)=>sum+item.weight,0);
  if(total<=0) return sorted[Math.floor(sorted.length/2)].seconds;

  let cumulative=0;
  for(const item of sorted){
    cumulative+=item.weight;
    if(cumulative>=total/2){
      return item.seconds;
    }
  }

  return sorted[sorted.length-1].seconds;
}

function performanceModelConfidence(targetDistance,estimates){
  if(!estimates.length){
    return{
      level:"Onvoldoende",
      margin:.07,
      score:0
    };
  }

  const trusted=estimates.filter(item=>item.evidence.trusted);
  const exactTrusted=trusted.filter(item=>
    performanceModelDistanceRatio(
      item.evidence.distance,
      targetDistance
    )<=1.08
  );
  const raceExact=exactTrusted.filter(item=>
    item.evidence.kind==="race"
  );

  if(raceExact.length){
    return{
      level:"Hoog",
      margin:targetDistance>=40?.022:.012,
      score:95
    };
  }

  if(exactTrusted.length || trusted.length>=2){
    const marathonDurabilityMissing=
      targetDistance>=40 &&
      !trusted.some(item=>item.evidence.distance>=30);

    if(marathonDurabilityMissing){
      return{
        level:"Redelijk",
        margin:.045,
        score:68
      };
    }

    return{
      level:"Goed",
      margin:targetDistance>=40?.032:.02,
      score:82
    };
  }

  if(trusted.length===1){
    const ratio=performanceModelDistanceRatio(
      trusted[0].evidence.distance,
      targetDistance
    );
    return{
      level:ratio<=2.2?"Redelijk":"Laag",
      margin:targetDistance>=40?.05:ratio<=2.2?.032:.045,
      score:ratio<=2.2?68:52
    };
  }

  return{
    level:"Laag",
    margin:targetDistance>=40?.065:.05,
    score:42
  };
}

function performanceModelPredictionForDistance(targetDistance){
  const target=Number(targetDistance);
  if(!target) return{
    seconds:null,
    source:"Geen geldige afstand",
    confidence:"Onvoldoende",
    independent:false,
    range:null,
    evidence:[]
  };

  const allEvidence=performanceModelEvidence();
  const trusted=allEvidence.filter(item=>item.trusted);
  const workingEvidence=trusted.length
    ?trusted
    :allEvidence.filter(item=>!item.trusted);

  const estimates=workingEvidence
    .map(item=>performanceModelEstimateFromEvidence(item,target))
    .filter(Boolean)
    .filter(item=>Number.isFinite(item.seconds)&&item.seconds>0);

  if(!estimates.length){
    return{
      seconds:null,
      source:"Nog geen bruikbare prestatiebenchmark",
      confidence:"Onvoldoende",
      independent:false,
      range:null,
      evidence:[]
    };
  }

  const seconds=performanceModelWeightedMedian(estimates);
  const confidence=performanceModelConfidence(
    target,
    estimates
  );

  const ranked=[...estimates].sort((a,b)=>b.weight-a.weight);
  const primary=ranked[0];
  const sourceParts=ranked
    .slice(0,2)
    .map(item=>item.evidence.source);

  return{
    seconds,
    source:`Performance Model · ${sourceParts.join(" + ")}`,
    confidence:confidence.level,
    confidenceScore:confidence.score,
    independent:true,
    range:{
      low:seconds*(1-confidence.margin),
      high:seconds*(1+confidence.margin),
      margin:confidence.margin
    },
    primaryEvidence:primary?.evidence||null,
    evidence:ranked.map(item=>({
      ...item.evidence,
      estimateSeconds:item.seconds,
      weight:item.weight,
      durability:item.durability
    }))
  };
}

function buildPerformanceModel(){
  const predictions=PERFORMANCE_MODEL_TARGETS.map(target=>({
    ...target,
    prediction:performanceModelPredictionForDistance(
      target.distance
    )
  }));

  const evidence=performanceModelEvidence();
  const trusted=evidence.filter(item=>item.trusted);
  const recentRace=trusted
    .filter(item=>item.kind==="race")
    .sort((a,b)=>
      String(b.date||"").localeCompare(String(a.date||""))
    )[0]||null;

  const confidenceScores=predictions
    .map(item=>finiteNumberOrNull(item.prediction.confidenceScore))
    .filter(value=>value!==null);
  const overallConfidence=confidenceScores.length
    ?Math.round(
      confidenceScores.reduce((sum,value)=>sum+value,0)/
      confidenceScores.length
    )
    :0;

  return{
    createdAt:new Date().toISOString(),
    evidence,
    trustedEvidence:trusted,
    recentRace,
    predictions,
    overallConfidence,
    syncedAt:activitySyncMeta?.fetchedAt||null
  };
}

function performanceModelConfidenceLabel(score){
  const value=Number(score)||0;
  if(value>=88) return "Hoog";
  if(value>=72) return "Goed";
  if(value>=55) return "Redelijk";
  if(value>0) return "Laag";
  return "Onvoldoende";
}

function performanceModelRangeText(prediction){
  if(!prediction?.range) return "Geen bandbreedte";
  return `${formatRaceTime(prediction.range.low)} – ${formatRaceTime(prediction.range.high)}`;
}

function performanceModelEvidenceText(evidence){
  if(!evidence) return "Geen primaire benchmark";

  const time=formatRaceTime(evidence.seconds);
  const date=evidence.date
    ?` · ${evidence.date}`
    :"";

  return`${evidence.source}${time?` · ${time}`:""}${date}`;
}

function renderPerformanceModel(){
  const root=document.getElementById("performanceModelPredictions");
  if(!root) return null;

  const model=buildPerformanceModel();

  document.getElementById("performanceModelConfidence").textContent=
    `${performanceModelConfidenceLabel(model.overallConfidence)} · ${model.overallConfidence||0}/100`;

  document.getElementById("performanceModelEvidenceCount").textContent=
    `${model.trustedEvidence.length} sterke bron${model.trustedEvidence.length===1?"":"nen"}`;

  const recent=document.getElementById("performanceModelRecentBenchmark");
  if(model.recentRace){
    recent.textContent=
      `${model.recentRace.name} · ${formatRaceTime(model.recentRace.seconds)} · ${model.recentRace.date}`;
  }else{
    recent.textContent="Nog geen recente wedstrijdactiviteit";
  }

  root.innerHTML=model.predictions.map(item=>{
    const prediction=item.prediction;
    const time=prediction.seconds
      ?formatRaceTime(prediction.seconds)
      :"—";
    const pace=prediction.seconds
      ?`${formatPace(prediction.seconds/item.distance)}/km`
      :"—";
    const range=prediction.seconds
      ?performanceModelRangeText(prediction)
      :"Nog onvoldoende data";
    const primary=prediction.primaryEvidence
      ?performanceModelEvidenceText(prediction.primaryEvidence)
      :prediction.source;

    return`
      <div class="performance-model-prediction">
        <div class="performance-model-distance">${safe(item.label)}</div>
        <strong>${safe(time)}</strong>
        <span>${safe(pace)}</span>
        <small>${safe(prediction.confidence)} · ${safe(range)}</small>
        <em>${safe(primary)}</em>
      </div>
    `;
  }).join("");

  const evidenceTarget=document.getElementById("performanceModelEvidence");
  if(evidenceTarget){
    const strong=model.trustedEvidence
      .sort((a,b)=>{
        if(a.kind!==b.kind){
          return a.kind==="race"?-1:1;
        }
        return String(b.date||"").localeCompare(String(a.date||""));
      })
      .slice(0,5);

    evidenceTarget.innerHTML=strong.length
      ?strong.map(item=>`
        <div class="reason-item">
          <div class="reason-icon ${item.kind==="race"?"good":"warn"}">${item.kind==="race"?"🏁":"PR"}</div>
          <div>
            <strong>${safe(item.source)}</strong>
            <div>${safe(formatRaceTime(item.seconds))} · ${Number(item.distance).toFixed(item.distance>=20?1:0)} km</div>
          </div>
        </div>
      `).join("")
      :'<div class="reason-item"><div class="reason-icon warn">?</div><div>Nog geen sterke prestatiebenchmark beschikbaar.</div></div>';
  }

  return model;
}
