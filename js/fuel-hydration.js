function defaultFuelHydrationProfile(){
  return{
    carbTargetGPerHour:null,
    carbMaxGPerHour:null,
    gelCarbsG:null,
    drinkCarbsGPerHour:null,
    sweatRateMlPerHour:null,
    fluidTargetMlPerHour:null,
    sweatSodiumMgPerL:null,
    sodiumTargetMgPerHour:null,
    sodiumCapsuleMg:null,
    aidStationEveryKm:null
  };
}

function fuelHydrationOptionalNumber(value){
  if(value===null||value===undefined||String(value).trim()===""){
    return null;
  }
  const number=Number(String(value).replace(",","."));
  return Number.isFinite(number)?number:null;
}

function getFuelHydrationProfile(){
  const stored=getProfile().fuelHydration;
  return{
    ...defaultFuelHydrationProfile(),
    ...(isPlainBackupObject(stored)?stored:{})
  };
}

function fuelHydrationProfileCompleteness(profileData=getFuelHydrationProfile()){
  const keys=[
    "carbTargetGPerHour",
    "carbMaxGPerHour",
    "gelCarbsG",
    "sweatRateMlPerHour",
    "fluidTargetMlPerHour",
    "sodiumTargetMgPerHour",
    "aidStationEveryKm"
  ];
  const known=keys.filter(key=>
    fuelHydrationOptionalNumber(profileData[key])!==null
  ).length;
  const score=Math.round(known/keys.length*100);

  return{
    known,
    total:keys.length,
    score,
    label:
      score>=85
        ?"Volledig"
        :score>=55
          ?"Grotendeels"
          :score>=30
            ?"Deels"
            :"Basis"
  };
}

function fillFuelHydrationForm(){
  const form=document.getElementById("fuelHydrationForm");
  if(!form) return;

  const p=getFuelHydrationProfile();
  const set=(id,value)=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.value=value===null||value===undefined?"":String(value);
  };

  set("fuelCarbTarget",p.carbTargetGPerHour);
  set("fuelCarbMax",p.carbMaxGPerHour);
  set("fuelGelCarbs",p.gelCarbsG);
  set("fuelDrinkCarbs",p.drinkCarbsGPerHour);
  set("fuelSweatRate",p.sweatRateMlPerHour);
  set("fuelFluidTarget",p.fluidTargetMlPerHour);
  set("fuelSweatSodium",p.sweatSodiumMgPerL);
  set("fuelSodiumTarget",p.sodiumTargetMgPerHour);
  set("fuelSodiumCapsule",p.sodiumCapsuleMg);
  set("fuelAidStationKm",p.aidStationEveryKm);

  renderFuelHydrationProfileSummary();
}

function saveFuelHydrationProfile(event){
  event?.preventDefault();

  const read=id=>
    fuelHydrationOptionalNumber(
      document.getElementById(id)?.value
    );

  const next={
    carbTargetGPerHour:read("fuelCarbTarget"),
    carbMaxGPerHour:read("fuelCarbMax"),
    gelCarbsG:read("fuelGelCarbs"),
    drinkCarbsGPerHour:read("fuelDrinkCarbs"),
    sweatRateMlPerHour:read("fuelSweatRate"),
    fluidTargetMlPerHour:read("fuelFluidTarget"),
    sweatSodiumMgPerL:read("fuelSweatSodium"),
    sodiumTargetMgPerHour:read("fuelSodiumTarget"),
    sodiumCapsuleMg:read("fuelSodiumCapsule"),
    aidStationEveryKm:read("fuelAidStationKm")
  };

  const status=document.getElementById("fuelHydrationStatus");

  if(
    next.carbTargetGPerHour!==null &&
    next.carbMaxGPerHour!==null &&
    next.carbTargetGPerHour>next.carbMaxGPerHour
  ){
    status.className="status error";
    status.textContent=
      "Koolhydraatdoel per uur mag niet hoger zijn dan je ingestelde maximale tolerantie.";
    return;
  }

  if(
    next.drinkCarbsGPerHour!==null &&
    next.carbMaxGPerHour!==null &&
    next.drinkCarbsGPerHour>next.carbMaxGPerHour
  ){
    status.className="status error";
    status.textContent=
      "Koolhydraten uit drank alleen zijn al hoger dan je maximale tolerantie.";
    return;
  }

  const ranges=[
    ["carbTargetGPerHour",0,150],
    ["carbMaxGPerHour",0,160],
    ["gelCarbsG",5,80],
    ["drinkCarbsGPerHour",0,120],
    ["sweatRateMlPerHour",100,2500],
    ["fluidTargetMlPerHour",100,1500],
    ["sweatSodiumMgPerL",100,2500],
    ["sodiumTargetMgPerHour",0,2000],
    ["sodiumCapsuleMg",50,1500],
    ["aidStationEveryKm",0.5,15]
  ];

  for(const [key,min,max] of ranges){
    const value=next[key];
    if(value!==null && (value<min || value>max)){
      status.className="status error";
      status.textContent=
        `Waarde voor ${key} valt buiten de toegestane invoergrenzen.`;
      return;
    }
  }

  const current=getProfile();
  profile={
    ...current,
    fuelHydration:next
  };
  saveObject(PROFILE_KEY,profile);

  renderFuelHydrationProfileSummary();
  renderRaceSimulator();
  refreshDerivedCoachViews();
  renderBackupManager();

  status.className="status ok";
  status.textContent=
    "Voedings- en hydratatieprofiel opgeslagen. Race Strategy is opnieuw berekend.";
}

function renderFuelHydrationProfileSummary(){
  const target=document.getElementById("fuelProfileSummary");
  if(!target) return;

  const p=getFuelHydrationProfile();
  const completeness=fuelHydrationProfileCompleteness(p);

  document.getElementById("fuelProfileCompleteness").textContent=
    `${completeness.label} · ${completeness.score}%`;

  document.getElementById("fuelProfileCarbs").textContent=
    p.carbTargetGPerHour!==null
      ?`${p.carbTargetGPerHour} g/uur`
      :"Nog niet ingesteld";

  document.getElementById("fuelProfileFluid").textContent=
    p.fluidTargetMlPerHour!==null
      ?`${p.fluidTargetMlPerHour} ml/uur`
      :"Nog niet ingesteld";

  const sodiumRate=fuelHydrationResolvedSodiumRate(p);
  document.getElementById("fuelProfileSodium").textContent=
    sodiumRate!==null
      ?`${Math.round(sodiumRate)} mg/uur`
      :"Nog niet ingesteld";
}

function fuelHydrationResolvedSodiumRate(p){
  const explicit=fuelHydrationOptionalNumber(
    p.sodiumTargetMgPerHour
  );
  if(explicit!==null) return explicit;

  const sweatSodium=fuelHydrationOptionalNumber(
    p.sweatSodiumMgPerL
  );
  const fluid=fuelHydrationOptionalNumber(
    p.fluidTargetMlPerHour
  );

  if(sweatSodium===null||fluid===null) return null;
  return sweatSodium*(fluid/1000);
}

function fuelHydrationGenericCarbTarget(distance,durationSeconds){
  const d=Number(distance)||0;
  const minutes=Number(durationSeconds||0)/60;

  if(d<=5.5||minutes<=35) return 0;
  if(d<=10.5||minutes<=70) return 25;
  if(d<=23) return 70;
  return 85;
}

function fuelHydrationRound(value,step=1){
  if(!Number.isFinite(value)) return null;
  return Math.round(value/step)*step;
}

function fuelHydrationGelSchedule({
  durationMinutes,
  carbTarget,
  maxCarbs,
  drinkCarbsPerHour,
  gelCarbs
}){
  if(
    !Number.isFinite(durationMinutes) ||
    durationMinutes<=40 ||
    !Number.isFinite(carbTarget) ||
    carbTarget<=0 ||
    !Number.isFinite(gelCarbs) ||
    gelCarbs<=0
  ){
    return{
      count:0,
      times:[],
      actualCarbsPerHour:
        Number.isFinite(drinkCarbsPerHour)
          ?drinkCarbsPerHour
          :0
    };
  }

  const hours=durationMinutes/60;
  const drinkRate=Math.max(
    0,
    Math.min(
      Number(drinkCarbsPerHour)||0,
      carbTarget
    )
  );
  const gelRate=Math.max(0,carbTarget-drinkRate);
  const requiredGelCarbs=gelRate*hours;

  let count=Math.max(
    0,
    Math.round(requiredGelCarbs/gelCarbs)
  );

  if(requiredGelCarbs>=gelCarbs*.45 && count===0){
    count=1;
  }

  const effectiveMax=
    Number.isFinite(maxCarbs)&&maxCarbs>0
      ?maxCarbs
      :null;

  while(count>0 && effectiveMax!==null){
    const actualRate=
      (count*gelCarbs)/hours + drinkRate;
    if(actualRate<=effectiveMax*1.02) break;
    count--;
  }

  if(count===0){
    return{
      count:0,
      times:[],
      actualCarbsPerHour:drinkRate
    };
  }

  const firstMinute=
    durationMinutes>60
      ?20
      :Math.min(
        20,
        Math.max(12,Math.round(durationMinutes/(count+1)))
      );
  const lastMinute=Math.max(
    firstMinute,
    durationMinutes-8
  );

  const times=[];
  for(let index=0;index<count;index++){
    const minute=
      count===1
        ?firstMinute
        :firstMinute+
          (lastMinute-firstMinute)*
          (index/(count-1));
    const rounded=Math.max(
      10,
      Math.min(
        Math.round(durationMinutes-5),
        Math.round(minute)
      )
    );
    if(!times.includes(rounded)){
      times.push(rounded);
    }
  }

  const actualCount=times.length;
  const actualRate=
    hours>0
      ?(actualCount*gelCarbs)/hours + drinkRate
      :0;

  return{
    count:actualCount,
    times,
    actualCarbsPerHour:actualRate
  };
}

function fuelHydrationStationSchedule({
  distanceKm,
  paceSeconds,
  durationHours,
  fluidTargetMlPerHour,
  aidStationEveryKm
}){
  if(
    !Number.isFinite(fluidTargetMlPerHour) ||
    fluidTargetMlPerHour<=0
  ){
    return{
      stations:[],
      totalFluidMl:null,
      mlPerStation:null
    };
  }

  const totalFluidMl=
    fluidTargetMlPerHour*durationHours;

  if(
    !Number.isFinite(aidStationEveryKm) ||
    aidStationEveryKm<=0 ||
    !Number.isFinite(distanceKm) ||
    distanceKm<=0
  ){
    return{
      stations:[],
      totalFluidMl,
      mlPerStation:null
    };
  }

  const stations=[];
  for(
    let km=aidStationEveryKm;
    km<distanceKm-.25;
    km+=aidStationEveryKm
  ){
    stations.push({
      km:Math.round(km*10)/10,
      minute:
        Number.isFinite(paceSeconds)
          ?Math.round(km*paceSeconds/60)
          :null
    });
  }

  if(!stations.length){
    return{
      stations:[],
      totalFluidMl,
      mlPerStation:null
    };
  }

  const mlPerStation=fuelHydrationRound(
    totalFluidMl/stations.length,
    10
  );

  return{
    stations,
    totalFluidMl,
    mlPerStation
  };
}

function buildPersonalFuelHydrationPlan(
  race,
  durationSeconds,
  paceSeconds=null
){
  const p=getFuelHydrationProfile();
  const duration=finiteNumberOrNull(durationSeconds);
  const durationHours=
    duration!==null&&duration>0
      ?duration/3600
      :null;
  const durationMinutes=
    durationHours!==null
      ?durationHours*60
      :null;

  if(durationHours===null){
    return{
      level:"basis",
      personalized:false,
      fuel:null,
      hydration:null,
      gelSchedule:[],
      stationSchedule:[],
      warnings:["Geen geldige raceduur beschikbaar."]
    };
  }

  const genericCarbs=fuelHydrationGenericCarbTarget(
    race?.distanceKm,
    duration
  );

  const storedTarget=fuelHydrationOptionalNumber(
    p.carbTargetGPerHour
  );
  const maxCarbs=fuelHydrationOptionalNumber(
    p.carbMaxGPerHour
  );

  let carbTarget=
    storedTarget!==null
      ?storedTarget
      :genericCarbs;

  if(maxCarbs!==null){
    carbTarget=Math.min(carbTarget,maxCarbs);
  }

  const gelCarbs=
    fuelHydrationOptionalNumber(p.gelCarbsG);
  const rawDrinkCarbs=
    fuelHydrationOptionalNumber(
      p.drinkCarbsGPerHour
    );
  const drinkCarbs=rawDrinkCarbs??0;

  const gel=fuelHydrationGelSchedule({
    durationMinutes,
    carbTarget,
    maxCarbs,
    drinkCarbsPerHour:drinkCarbs,
    gelCarbs
  });

  const sweatRate=fuelHydrationOptionalNumber(
    p.sweatRateMlPerHour
  );
  const enteredFluid=fuelHydrationOptionalNumber(
    p.fluidTargetMlPerHour
  );

  let fluidTarget=enteredFluid;
  const warnings=[];

  if(
    fluidTarget!==null &&
    sweatRate!==null &&
    fluidTarget>sweatRate
  ){
    fluidTarget=sweatRate;
    warnings.push(
      `Drinkdoel begrensd op gemeten zweetverlies (${Math.round(sweatRate)} ml/uur).`
    );
  }

  const station=fuelHydrationStationSchedule({
    distanceKm:Number(race?.distanceKm)||0,
    paceSeconds:
      finiteNumberOrNull(paceSeconds),
    durationHours,
    fluidTargetMlPerHour:fluidTarget,
    aidStationEveryKm:
      fuelHydrationOptionalNumber(
        p.aidStationEveryKm
      )
  });

  const sodiumRate=fuelHydrationResolvedSodiumRate({
    ...p,
    fluidTargetMlPerHour:fluidTarget
  });

  const totalSodium=
    sodiumRate!==null
      ?sodiumRate*durationHours
      :null;

  const capsuleMg=fuelHydrationOptionalNumber(
    p.sodiumCapsuleMg
  );
  const capsuleEquivalent=
    totalSodium!==null &&
    capsuleMg!==null &&
    capsuleMg>0
      ?Math.max(0,Math.round(totalSodium/capsuleMg))
      :null;

  const replacementPct=
    fluidTarget!==null &&
    sweatRate!==null &&
    sweatRate>0
      ?Math.round(fluidTarget/sweatRate*100)
      :null;

  if(
    station.mlPerStation!==null &&
    station.mlPerStation>350
  ){
    warnings.push(
      `${station.mlPerStation} ml per drankpost is veel in één keer; kleinere/frequentere drinkmomenten zijn praktischer.`
    );
  }

  const personalizedFields=[
    storedTarget!==null,
    maxCarbs!==null,
    gelCarbs!==null,
    rawDrinkCarbs!==null,
    enteredFluid!==null,
    sweatRate!==null,
    sodiumRate!==null,
    fuelHydrationOptionalNumber(
      p.aidStationEveryKm
    )!==null
  ].filter(Boolean).length;

  const level=
    personalizedFields>=5
      ?"persoonlijk"
      :personalizedFields>=2
        ?"hybride"
        :"basis";

  const exactCarbProducts=
    carbTarget<=drinkCarbs ||
    gelCarbs!==null;

  const actualCarbsPerHour=
    exactCarbProducts
      ?Math.round(gel.actualCarbsPerHour)
      :Math.round(carbTarget);

  return{
    level,
    personalized:level!=="basis",
    durationHours,
    durationMinutes,
    carbTarget,
    actualCarbsPerHour,
    gelCarbs,
    drinkCarbsPerHour:drinkCarbs,
    gelSchedule:gel.times.map((minute,index)=>({
      index:index+1,
      minute,
      carbs:gelCarbs
    })),
    fluidTargetMlPerHour:fluidTarget,
    sweatRateMlPerHour:sweatRate,
    replacementPct,
    totalFluidMl:station.totalFluidMl,
    stationSchedule:station.stations.map(item=>({
      ...item,
      ml:station.mlPerStation
    })),
    mlPerStation:station.mlPerStation,
    sodiumMgPerHour:sodiumRate,
    totalSodiumMg:totalSodium,
    sodiumCapsuleMg:capsuleMg,
    capsuleEquivalent,
    warnings,
    fuel:{
      gramsPerHour:actualCarbsPerHour,
      text:
        storedTarget!==null
          ?`Persoonlijk doel ${Math.round(carbTarget)} g/uur; gepland komt uit op ongeveer ${actualCarbsPerHour} g/uur.`
          :`Basisrichtpunt ${Math.round(carbTarget)} g/uur; vul je persoonlijke tolerantie in voor volledige personalisatie.`,
      timing:
        gel.times.length
          ?`${gel.times.length} gel${gel.times.length===1?"":"s"} van ${Math.round(gelCarbs)} g rond minuut ${gel.times.join(", ")}.`
          :carbTarget>0 && gelCarbs===null && carbTarget>drinkCarbs
            ?"Vul koolhydraten per gel in voor een exact gelschema."
            :carbTarget>0
              ?"Geen afzonderlijke gels nodig op basis van de huidige drankinvoer."
              :"Geen koolhydraten tijdens de race nodig."
    },
    hydration:{
      fluid:
        fluidTarget!==null
          ?`${Math.round(fluidTarget)} ml/uur`
          :race?.distanceKm<=10.5
            ?"Naar dorst / kleine slokken"
            :"Persoonlijk drinkdoel nog niet ingesteld",
      sodium:
        sodiumRate!==null
          ?`${Math.round(sodiumRate)} mg natrium/uur`
          :"Persoonlijk natriumdoel nog niet ingesteld",
      text:
        station.mlPerStation!==null
          ?`Bij posten iedere ${p.aidStationEveryKm} km: ongeveer ${station.mlPerStation} ml per post.`
          :fluidTarget!==null
            ?`Totaal ongeveer ${Math.round(station.totalFluidMl)} ml; vul afstand tussen drankposten in voor ml per post.`
            :"Gebruik de basisrange totdat je persoonlijk drinkdoel is ingevuld."
    }
  };
}

function fuelHydrationPlanSummary(plan){
  if(!plan) return"Geen persoonlijk racevoedingsplan.";

  const parts=[
    plan.level==="persoonlijk"
      ?"Persoonlijk profiel"
      :plan.level==="hybride"
        ?"Hybride profiel"
        :"Basisprofiel",
    `${Math.round(plan.actualCarbsPerHour||0)} g koolhydraten/uur`
  ];

  if(plan.fluidTargetMlPerHour!==null){
    parts.push(`${Math.round(plan.fluidTargetMlPerHour)} ml/uur`);
  }
  if(plan.sodiumMgPerHour!==null){
    parts.push(`${Math.round(plan.sodiumMgPerHour)} mg natrium/uur`);
  }

  return parts.join(" · ");
}
