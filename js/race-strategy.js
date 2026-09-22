function raceStrategyClamp(value,min,max){
  return Math.max(min,Math.min(max,Number(value)||0));
}

function raceStrategyReference(race,optimizer=null){
  const result=
    optimizer ||
    (typeof buildRaceReadinessGoalOptimizer==="function"
      ?buildRaceReadinessGoalOptimizer(race)
      :null);

  const seconds=
    finiteNumberOrNull(result?.referenceSeconds) ||
    finiteNumberOrNull(
      typeof optimizedRaceReferenceSeconds==="function"
        ?optimizedRaceReferenceSeconds(race)
        :null
    ) ||
    finiteNumberOrNull(
      parseTimeToSeconds(race?.targetTime)
    );

  return{
    optimizer:result,
    seconds,
    paceSeconds:
      seconds!==null && Number(race?.distanceKm)>0
        ?seconds/Number(race.distanceKm)
        :null
  };
}

function raceStrategyGuardrailAdjustment(optimizer){
  if(!optimizer) return 0;

  if(optimizer.status==="attention") return 4;
  if(optimizer.status==="controlled") return 2;

  if(
    optimizer.readiness?.sufficientData &&
    optimizer.readiness.level==="low"
  ){
    return 3;
  }

  return 0;
}

function raceStrategySegmentTemplates(distance){
  const d=Number(distance)||0;

  if(d<=5.5){
    return[
      {label:"Start",from:0,to:1,offset:3,hr:[.86,.91],decision:"Controleer na 1 km: als je duidelijk sneller zit dan plan, direct 2–4 sec/km terug."},
      {label:"Ritme",from:1,to:4,offset:0,hr:[.91,.95],decision:"Rond 3 km: alleen versnellen als ademhaling en pasritme nog beheerst zijn."},
      {label:"Finish",from:4,to:d,offset:-4,hr:[.95,1],decision:"Vanaf ongeveer 800 m te gaan: vrijgeven als vorm en benen nog goed zijn."}
    ];
  }

  if(d<=10.5){
    return[
      {label:"Start",from:0,to:2,offset:3,hr:[.84,.89],decision:"Na 2 km: tempo moet gecontroleerd voelen; geen tijd terugpakken."},
      {label:"Midden",from:2,to:7,offset:0,hr:[.89,.93],decision:"Rond 6 km: houd plan vast als ademhaling stabiel blijft."},
      {label:"Commit",from:7,to:9,offset:-1,hr:[.92,.96],decision:"Na 8 km: alleen versnellen als pasvorm en ademhaling niet wegzakken."},
      {label:"Finish",from:9,to:d,offset:-4,hr:[.95,1],decision:"Laatste kilometer progressief naar maximaal haalbare inspanning."}
    ];
  }

  if(d<=23){
    return[
      {label:"Openen",from:0,to:3,offset:4,hr:[.82,.87],decision:"Na 3 km: te snelle start corrigeren; dit is nog geen beslismoment om te versnellen."},
      {label:"Cruise",from:3,to:12,offset:0,hr:[.86,.90],decision:"Rond 10–12 km: check benen, ademhaling en maag; bij groen plan vasthouden."},
      {label:"Vasthouden",from:12,to:17,offset:0,hr:[.88,.92],decision:"Bij 16 km: alleen 1–2 sec/km opschuiven als alles stabiel is."},
      {label:"Commit",from:17,to:20,offset:-2,hr:[.91,.95],decision:"Bij 18–19 km: nu pas bewust druk opbouwen."},
      {label:"Finish",from:20,to:d,offset:-5,hr:[.94,1],decision:"Laatste 1,1 km: tempo vrijgeven op gevoel."}
    ];
  }

  return[
    {label:"Openen",from:0,to:5,offset:5,hr:[.76,.82],decision:"Na 5 km: alleen controleren of je níét te hard bent gestart."},
    {label:"Settelen",from:5,to:20,offset:0,hr:[.80,.85],decision:"Rond 15 km: voeding, maag en pasritme moeten voorspelbaar aanvoelen."},
    {label:"Midden",from:20,to:30,offset:-1,hr:[.82,.87],decision:"Bij 25 km: geen kleine achterstand forceren; voeding en soepelheid prioriteit."},
    {label:"Waarheid",from:30,to:37,offset:0,hr:[.84,.89],decision:"Bij 30–32 km: als hartslag stijgt maar tempo niet, niet versnellen; efficiëntie bewaken."},
    {label:"Finish",from:37,to:d,offset:-3,hr:[.88,.94],decision:"Vanaf 37 km: alleen versnellen als benen, maag en energie nog stabiel zijn."}
  ];
}

function raceStrategyHrText(range,maxHr){
  if(!maxHr || !Array.isArray(range)) return "HR: op gevoel";

  const low=Math.round(maxHr*range[0]);
  const high=Math.min(
    Math.round(maxHr*range[1]),
    Math.round(maxHr)
  );

  return `${low}–${high} bpm`;
}

function raceStrategySegmentPlan(race,referencePace,optimizer){
  if(referencePace===null){
    return[];
  }

  const maxHr=finiteNumberOrNull(getProfile().maxHr);
  const guard=raceStrategyGuardrailAdjustment(optimizer);
  const templates=raceStrategySegmentTemplates(race.distanceKm);
  let cumulativeSeconds=0;

  return templates
    .filter(segment=>segment.to>segment.from)
    .map((segment,index)=>{
      const distance=Math.max(0,segment.to-segment.from);
      const adjustedOffset=
        segment.offset +
        (
          index===0
            ?guard
            :optimizer?.status==="attention" && index<2
              ?Math.ceil(guard/2)
              :0
        );

      const pace=referencePace+adjustedOffset;
      const segmentSeconds=distance*pace;
      cumulativeSeconds+=segmentSeconds;

      return{
        ...segment,
        distance,
        paceSeconds:pace,
        paceText:`${formatPace(pace)}/km`,
        hrText:raceStrategyHrText(segment.hr,maxHr),
        segmentSeconds,
        cumulativeSeconds,
        cumulativeText:formatRaceTime(cumulativeSeconds)
      };
    });
}

function raceStrategyCarbs(distance,durationSeconds){
  const d=Number(distance)||0;
  const minutes=
    finiteNumberOrNull(durationSeconds)!==null
      ?Number(durationSeconds)/60
      :null;

  if(d<=5.5 || (minutes!==null&&minutes<=35)){
    return{
      gramsPerHour:0,
      text:"Geen koolhydraten tijdens de race nodig; normale pre-race voeding volstaat.",
      timing:"Geen gel nodig tijdens de race."
    };
  }

  if(d<=10.5 || (minutes!==null&&minutes<=70)){
    return{
      gramsPerHour:25,
      text:"Tijdens de race meestal 0–30 g totaal; een gel vlak voor de start alleen als dit jouw vaste routine is.",
      timing:"Tijdens de race meestal niet nodig."
    };
  }

  if(d<=23){
    return{
      gramsPerHour:70,
      text:"Richt op ongeveer 60–75 g koolhydraten per uur, alleen met producten die je in training verdraagt.",
      timing:"Begin vroeg; eerste koolhydraten rond 20–25 min, daarna regelmatig."
    };
  }

  return{
    gramsPerHour:85,
    text:"Richt op ongeveer 75–90 g koolhydraten per uur; alleen hoger als dat herhaaldelijk in lange trainingen is getest.",
    timing:"Start binnen 20–25 min en voer zonder grote gaten door."
  };
}

function raceStrategyHydration(distance,durationSeconds){
  const d=Number(distance)||0;
  const minutes=
    finiteNumberOrNull(durationSeconds)!==null
      ?Number(durationSeconds)/60
      :null;

  if(d<=10.5 && (minutes===null||minutes<=70)){
    return{
      fluid:"Naar dorst / kleine slokken",
      sodium:"Geen vast getal zonder zweetdata",
      text:"Start goed gehydrateerd. Bij koel weer is drinken tijdens een korte race vaak beperkt nodig."
    };
  }

  if(d<=23){
    return{
      fluid:"Ca. 400–700 ml/uur",
      sodium:"Ca. 300–700 mg natrium/uur",
      text:"Pas aan op temperatuur en persoonlijk zweetverlies; test dit vooraf."
    };
  }

  return{
    fluid:"Ca. 450–750 ml/uur",
    sodium:"Ca. 400–800 mg natrium/uur",
    text:"Gebruik alleen een hogere vocht- of natriuminname als jouw eigen zweetdata en training dat ondersteunen."
  };
}

function raceStrategyDecisionGates(segments){
  return segments.map(segment=>({
    label:
      segment.to>=42
        ?`${segment.label} · ${Number(segment.from).toFixed(0)} km+`
        :`${segment.label} · rond ${Number(segment.to).toFixed(segment.to%1?1:0)} km`,
    text:segment.decision
  }));
}

function raceStrategyRpePlan(distance){
  const d=Number(distance)||0;
  if(d<=5.5) return "Start 7/10 → midden 8–9/10 → laatste km 10/10.";
  if(d<=10.5) return "Start 6–7/10 → midden 7–8/10 → laatste 2 km 9–10/10.";
  if(d<=23) return "Start 5–6/10 → midden 6–7/10 → km 16+ 8/10 → finish 9–10/10.";
  return "Start 4–5/10 → midden 5–6/10 → km 30+ 7/10 → alleen laat richting 8–9/10.";
}

function buildRaceStrategyEngine(race,optimizer=null){
  if(!race){
    return{
      race:null,
      reference:null,
      segments:[],
      fuel:null,
      hydration:null,
      decisions:[],
      headline:"Geen wedstrijd geselecteerd",
      summary:"Selecteer eerst een wedstrijd."
    };
  }

  const reference=raceStrategyReference(race,optimizer);
  const segments=raceStrategySegmentPlan(
    race,
    reference.paceSeconds,
    reference.optimizer
  );
  const expectedSeconds=
    reference.seconds ||
    finiteNumberOrNull(parseTimeToSeconds(race.targetTime));
  const genericFuel=raceStrategyCarbs(
    race.distanceKm,
    expectedSeconds
  );
  const genericHydration=raceStrategyHydration(
    race.distanceKm,
    expectedSeconds
  );

  const personalFuel=
    typeof buildPersonalFuelHydrationPlan==="function"
      ?buildPersonalFuelHydrationPlan(
        race,
        expectedSeconds,
        reference.paceSeconds
      )
      :null;

  const fuel=personalFuel?.fuel||genericFuel;
  const hydration=personalFuel?.hydration||genericHydration;

  let headline="Voer gecontroleerd uit";
  let summary="Gebruik de race-referentie als anker en verdien versnelling pas in het laatste deel.";

  if(reference.optimizer?.status==="ready"){
    headline="Sterke uitgangspositie";
    summary="Open behoudend, stabiliseer op referentiepace en versnel alleen op de geplande beslismomenten.";
  }else if(reference.optimizer?.status==="attention"){
    headline="Conservatieve uitvoering";
    summary="Maak de openingsfase rustiger en gebruik HR/RPE als plafond; geen vroege tijd terugpakken.";
  }else if(reference.optimizer?.assessment?.state==="aggressive"){
    headline="Doel niet forceren";
    summary="Je opgeslagen doel blijft staan, maar deze strategie volgt de geloofwaardige 10.1-referentie.";
  }

  return{
    race,
    reference,
    segments,
    fuel,
    hydration,
    personalFuel,
    decisions:raceStrategyDecisionGates(segments),
    rpe:raceStrategyRpePlan(race.distanceKm),
    headline,
    summary
  };
}

function raceStrategyPacingRows(strategy){
  return strategy.segments.map(segment=>({
    label:`${segment.from.toFixed(segment.from%1?1:0)}–${segment.to.toFixed(segment.to%1?1:0)} km`,
    text:`${segment.paceText} · ${segment.hrText} · cumulatief ca. ${segment.cumulativeText}`
  }));
}

function raceStrategyFuelRows(strategy){
  if(!strategy?.fuel||!strategy?.hydration) return[];

  const plan=strategy.personalFuel;

  return[
    {
      label:"Koolhydraten",
      text:strategy.fuel.text
    },
    {
      label:"Gels",
      text:strategy.fuel.timing
    },
    {
      label:"Drinken",
      text:`${strategy.hydration.fluid}. ${strategy.hydration.text}`
    },
    {
      label:"Natrium",
      text:
        plan?.totalSodiumMg!==null &&
        plan?.totalSodiumMg!==undefined
          ?`${strategy.hydration.sodium} · totaal ca. ${Math.round(plan.totalSodiumMg)} mg`
          :strategy.hydration.sodium
    }
  ];
}

function renderRaceStrategyEngine(strategy){
  const root=document.getElementById("raceStrategyEngine");
  if(!root) return null;

  if(!strategy?.race){
    document.getElementById("raceStrategyHeadline").textContent=
      "Geen strategie beschikbaar";
    document.getElementById("raceStrategySummary").textContent=
      "Selecteer eerst een wedstrijd.";
    document.getElementById("raceStrategyReference").textContent="—";
    document.getElementById("raceStrategyCarbs").textContent="—";
    document.getElementById("raceStrategyRpe").textContent="—";
    document.getElementById("raceStrategySplits").innerHTML="";
    document.getElementById("raceStrategyDecisions").innerHTML="";
    if(document.getElementById("raceFuelPersonalStatus")){
      document.getElementById("raceFuelPersonalStatus").textContent="—";
      document.getElementById("raceFuelPersonalSummary").textContent=
        "Vul eerst je voedingsprofiel en selecteer een wedstrijd.";
      document.getElementById("raceFuelGelSchedule").innerHTML="";
      document.getElementById("raceFuelDrinkSchedule").innerHTML="";
      document.getElementById("raceFuelSodiumPlan").textContent="—";
      document.getElementById("raceFuelWarnings").innerHTML="";
    }
    return null;
  }

  document.getElementById("raceStrategyHeadline").textContent=
    strategy.headline;
  document.getElementById("raceStrategySummary").textContent=
    strategy.summary;
  document.getElementById("raceStrategyReference").textContent=
    strategy.reference?.paceSeconds
      ?`${formatPace(strategy.reference.paceSeconds)}/km`
      :"—";
  document.getElementById("raceStrategyCarbs").textContent=
    strategy.fuel?.gramsPerHour
      ?`${strategy.fuel.gramsPerHour} g/uur richtpunt`
      :"Geen tijdens-race koolhydraten nodig";
  document.getElementById("raceStrategyRpe").textContent=
    strategy.rpe;

  document.getElementById("raceStrategySplits").innerHTML=
    strategy.segments.map(segment=>`
      <div class="race-strategy-split">
        <strong>${safe(segment.label)}</strong>
        <span>${safe(segment.from.toFixed(segment.from%1?1:0))}–${safe(segment.to.toFixed(segment.to%1?1:0))} km</span>
        <span>${safe(segment.paceText)}</span>
        <span>${safe(segment.hrText)}</span>
        <small>${safe(segment.cumulativeText)}</small>
      </div>
    `).join("");

  document.getElementById("raceStrategyDecisions").innerHTML=
    strategy.decisions.map(item=>`
      <div class="race-strategy-decision">
        <strong>${safe(item.label)}</strong>
        <span>${safe(item.text)}</span>
      </div>
    `).join("");

  const plan=strategy.personalFuel;
  if(document.getElementById("raceFuelPersonalStatus")){
    document.getElementById("raceFuelPersonalStatus").textContent=
      plan
        ?plan.level==="persoonlijk"
          ?"Persoonlijk"
          :plan.level==="hybride"
            ?"Hybride"
            :"Basis"
        :"Basis";

    document.getElementById("raceFuelPersonalSummary").textContent=
      typeof fuelHydrationPlanSummary==="function"
        ?fuelHydrationPlanSummary(plan)
        :"Persoonlijk profiel niet beschikbaar.";

    document.getElementById("raceFuelGelSchedule").innerHTML=
      plan?.gelSchedule?.length
        ?plan.gelSchedule.map(gel=>`
          <div class="race-fuel-event">
            <strong>Gel ${gel.index}</strong>
            <span>min ${gel.minute}</span>
            <small>${Math.round(gel.carbs)} g koolhydraten</small>
          </div>
        `).join("")
        :'<div class="race-fuel-event"><strong>Geen gels</strong><span>—</span><small>Volgens huidig profiel niet nodig of onvoldoende ingevuld.</small></div>';

    document.getElementById("raceFuelDrinkSchedule").innerHTML=
      plan?.stationSchedule?.length
        ?plan.stationSchedule.map(station=>`
          <div class="race-fuel-event">
            <strong>${station.km} km</strong>
            <span>${station.minute===null?"—":`min ${station.minute}`}</span>
            <small>${station.ml===null?"—":`${station.ml} ml`}</small>
          </div>
        `).join("")
        :'<div class="race-fuel-event"><strong>Drinkposten</strong><span>—</span><small>Vul drinkdoel en afstand tussen posten in voor een exact schema.</small></div>';

    document.getElementById("raceFuelSodiumPlan").textContent=
      plan?.sodiumMgPerHour!==null &&
      plan?.sodiumMgPerHour!==undefined
        ?`${Math.round(plan.sodiumMgPerHour)} mg/uur · totaal ca. ${Math.round(plan.totalSodiumMg||0)} mg${plan.capsuleEquivalent!==null&&plan.capsuleEquivalent!==undefined?` · equivalent ${plan.capsuleEquivalent} capsule${plan.capsuleEquivalent===1?"":"s"}`:""}`
        :"Persoonlijk natriumdoel nog niet ingesteld";

    document.getElementById("raceFuelWarnings").innerHTML=
      plan?.warnings?.length
        ?plan.warnings.map(warning=>`
          <div class="reason-item">
            <div class="reason-icon warn">!</div>
            <div>${safe(warning)}</div>
          </div>
        `).join("")
        :"";
  }

  return strategy;
}
