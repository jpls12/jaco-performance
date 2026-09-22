let pendingWeekReplan=null;

function weekReplanClone(workout,date=null){
  if(!workout) return null;
  const copy=JSON.parse(JSON.stringify(workout));
  if(date) copy.date=date;
  return copy;
}

function weekReplanWeekBounds(){
  const today=todayDateString();
  const start=mondayOf(today);
  const end=addDays(start,6);
  return{today,start,end};
}

function weekReplanDateList(from,to){
  const dates=[];
  let cursor=from;
  let guard=0;
  while(cursor<=to && guard<14){
    dates.push(cursor);
    cursor=addDays(cursor,1);
    guard++;
  }
  return dates;
}

function weekReplanIsDone(date,workout){
  if(!workout) return false;
  const marker=doneWorkouts[date];
  if(completionMarkerMatches(marker,workout)) return true;

  if(typeof trainingExecutionForDate==="function"){
    const execution=trainingExecutionForDate(date,workout);
    if(execution?.matched) return true;
  }

  return false;
}

function weekReplanRecentMissed(bounds){
  const workouts=allWorkouts();
  return Object.entries(workouts)
    .map(([date,workout])=>({date,workout}))
    .filter(item=>
      item.date>=bounds.start &&
      item.date<bounds.today &&
      item.workout &&
      !["Rest","Race"].includes(item.workout.type) &&
      !weekReplanIsDone(item.date,item.workout)
    )
    .sort((a,b)=>b.date.localeCompare(a.date));
}

function weekReplanProtection(date){
  const allRaces=Object.values(races||{});

  for(const race of allRaces){
    if(!race?.date) continue;

    const delta=signedDateGapDays(date,race.date);

    if(delta===0){
      return{
        protected:true,
        kind:"race",
        race,
        text:`Wedstrijddag ${race.name}`
      };
    }

    if(delta<0 && Math.abs(delta)<=raceTaperDays(race)){
      return{
        protected:true,
        kind:"taper",
        race,
        text:`Taper richting ${race.name}`
      };
    }

    if(delta>0 && delta<=raceRecoveryDays(race)){
      return{
        protected:true,
        kind:"recovery",
        race,
        text:`Herstel na ${race.name}`
      };
    }
  }

  return{protected:false,kind:null,race:null,text:""};
}

function weekReplanAvailability(date){
  const p=getProfile();
  const availability={...defaultAvailability(),...(p.availability||{})};
  const index=weekdayIndexFromDate(date);
  const key=DAY_KEYS[index];
  return{
    key,
    index,
    ...(availability[key]||{
      available:false,
      maxMinutes:0,
      preference:"rust",
      priority:"could",
      daypart:"flexibel"
    })
  };
}

function weekReplanFitsAvailability(workout,date){
  if(!workout || ["Rest","Race"].includes(workout.type)) return true;

  const day=weekReplanAvailability(date);
  if(!day.available) return false;

  return fitsTime(workout,day);
}

function weekReplanIsStressWorkout(workout){
  return Boolean(
    workout &&
    workout.type!=="Race" &&
    (isHardWorkout(workout)||isLongWorkout(workout))
  );
}

function weekReplanStressLevel(){
  const readiness=determineReadiness(getWellnessSnapshot());
  const load=buildLoadMonitor();
  const execution=buildAdaptiveExecutionFeedback();

  let level="stable";
  const reasons=[];

  if(readiness.sufficientData){
    if(readiness.level==="low"){
      level="elevated";
      reasons.push(`herstel laag (${readiness.score}/100)`);
    }else if(readiness.level==="moderate"){
      if(level!=="elevated") level="attention";
      reasons.push(`herstel middelmatig (${readiness.score}/100)`);
    }
  }else{
    reasons.push("hersteldata onvolledig");
  }

  if(load.level==="elevated"){
    level="elevated";
    reasons.push("belastbaarheidsmonitor verhoogd");
  }else if(load.level==="attention"){
    if(level!=="elevated") level="attention";
    reasons.push("belastbaarheidsmonitor vraagt aandacht");
  }

  if(execution.level==="elevated"){
    level="elevated";
    reasons.push("laatste uitvoering zwaarder dan gepland");
  }else if(execution.level==="attention"){
    if(level!=="elevated") level="attention";
    reasons.push("laatste uitvoering wijkt af van planning");
  }

  return{level,reasons,readiness,load,execution};
}

function weekReplanRecoveryWorkout(original,date,reason){
  const originalKm=Number(original?.distanceKm)||8;
  const km=Math.max(5,Math.min(8,Math.round(originalKm*.62)));

  if(original?.type==="Run"){
    return{
      ...weekReplanClone(original,date),
      name:`Herstelloop ${km} km`,
      uploadName:`Jaco - Herstelloop ${km} km`,
      type:"Run",
      planType:"recovery",
      priority:"should",
      distanceKm:km,
      durationMinutes:0,
      rpe:"2/10",
      displaySteps:[
        `${km} km zeer rustig`,
        `Hartslag bij voorkeur onder ${getProfile().z2Hr} bpm`,
        "Geen versnellingen of extra kilometers"
      ],
      intervalsDescription:`Adaptief herstel na gewijzigde belasting.

Recovery
- ${km}km Z1 Pace`,
      sourceReplanner:"9.5",
      replanReason:reason
    };
  }

  return{
    date,
    name:"Mobiliteit en herstel 20 min",
    uploadName:"Jaco - Mobiliteit en herstel 20 min",
    type:"Mobility",
    planType:"mobility",
    priority:"could",
    distanceKm:0,
    durationMinutes:20,
    rpe:"2/10",
    status:"planned",
    displaySteps:[
      "20 minuten rustige mobiliteit",
      "Geen extra trainingsbelasting"
    ],
    intervalsDescription:"Mobiliteit en herstel.",
    sourceReplanner:"9.5",
    replanReason:reason
  };
}

function weekReplanRestWorkout(date,reason){
  return{
    date,
    name:"Rust · adaptief herschikt",
    uploadName:"Jaco - Rust adaptief herschikt",
    type:"Rest",
    planType:"rest",
    priority:"could",
    distanceKm:0,
    durationMinutes:0,
    rpe:"1/10",
    status:"planned",
    displaySteps:[
      "Rust",
      "Normaal bewegen mag",
      "Gemiste kilometers niet inhalen"
    ],
    intervalsDescription:"",
    sourceReplanner:"9.5",
    replanReason:reason
  };
}

function weekReplanCanPlaceStress(workout,date,schedule,ignoreDate=null){
  if(!weekReplanFitsAvailability(workout,date)) return false;

  const protection=weekReplanProtection(date);
  if(protection.protected) return false;

  for(const [otherDate,other] of Object.entries(schedule)){
    if(otherDate===date || otherDate===ignoreDate || !other) continue;

    if(other.type==="Race"){
      const raceDistance=Number(other.distanceKm)||0;
      const raceBuffer=raceDistance>=15?2:1;
      if(dateGapDays(otherDate,date)<=raceBuffer){
        return false;
      }
      continue;
    }

    if(
      weekReplanIsStressWorkout(other) &&
      dateGapDays(otherDate,date)<2
    ){
      return false;
    }
  }

  return true;
}

function weekReplanFindLaterSwap(date,workout,schedule,bounds){
  const dates=weekReplanDateList(addDays(date,1),bounds.end);

  for(const targetDate of dates){
    const target=schedule[targetDate];

    if(!target) continue;
    if(target.type==="Race") continue;

    const targetType=String(target.planType||target.type||"").toLowerCase();
    const isEasyTarget=
      target.type==="Rest" ||
      ["easy","recovery","mobility"].includes(targetType);

    if(!isEasyTarget) continue;
    if(!weekReplanCanPlaceStress(workout,targetDate,schedule,date)) continue;

    if(
      target.type!=="Rest" &&
      !weekReplanFitsAvailability(target,date)
    ){
      continue;
    }

    return{targetDate,target};
  }

  return null;
}

function weekReplanFindEmptyMove(date,workout,schedule,bounds){
  const dates=weekReplanDateList(addDays(bounds.today,1),bounds.end);

  for(const targetDate of dates){
    if(targetDate===date) continue;
    const target=schedule[targetDate];

    if(target && target.type!=="Rest") continue;
    if(!weekReplanFitsAvailability(workout,targetDate)) continue;

    if(
      weekReplanIsStressWorkout(workout) &&
      !weekReplanCanPlaceStress(workout,targetDate,schedule,date)
    ){
      continue;
    }

    return targetDate;
  }

  return null;
}

function weekReplanMove(schedule,fromDate,toDate,reason){
  const from=weekReplanClone(schedule[fromDate]);
  const to=weekReplanClone(schedule[toDate]);

  schedule[toDate]={
    ...from,
    date:toDate,
    sourceReplanner:"9.5",
    replanReason:reason
  };

  if(to && to.type!=="Rest"){
    schedule[fromDate]={
      ...to,
      date:fromDate,
      sourceReplanner:"9.5",
      replanReason:`Omgewisseld met ${from.name}`
    };
  }else{
    schedule[fromDate]=weekReplanRestWorkout(
      fromDate,
      `Verplaatst naar ${toDate}`
    );
  }
}

function weekReplanRescheduleMissedQuality(missed,schedule,bounds,stress){
  if(!missed || !isHardWorkout(missed.workout)) return null;
  if(stress.level!=="stable") return null;
  if(!stress.readiness.sufficientData || stress.readiness.level!=="good"){
    return null;
  }

  const race=getRaceFocus();
  const phase=classifyRacePhase(race);
  if(["race-week","taper"].includes(phase.phase)) return null;

  const futureQuality=Object.entries(schedule)
    .filter(([,workout])=>workout && isHardWorkout(workout));

  if(futureQuality.length) return null;

  const candidateDates=weekReplanDateList(
    addDays(bounds.today,1),
    bounds.end
  );

  for(const date of candidateDates){
    const current=schedule[date];
    if(!current || current.type==="Race") continue;

    const type=String(current.planType||current.type||"").toLowerCase();
    if(!["easy","recovery"].includes(type)) continue;

    const replacement=weekReplanClone(missed.workout,date);
    replacement.sourceReplanner="9.5";
    replacement.replanReason=`Veilig doorgeschoven na gemiste kwaliteit op ${missed.date}`;

    if(!weekReplanCanPlaceStress(replacement,date,schedule,null)){
      continue;
    }

    schedule[date]=replacement;
    return{
      date,
      fromDate:missed.date,
      missedWorkout:missed.workout,
      replaced:current
    };
  }

  return null;
}

function weekReplanWorkoutSignature(workout){
  if(!workout) return "empty";
  return JSON.stringify([
    workout.type||"",
    workout.name||"",
    finiteNumberOrNull(workout.distanceKm),
    finiteNumberOrNull(workout.durationMinutes),
    workout.planType||"",
    workout.rpe||""
  ]);
}

function buildAdaptiveWeekReplan(){
  const bounds=weekReplanWeekBounds();
  const workouts=allWorkouts();
  const stress=weekReplanStressLevel();
  const missed=weekReplanRecentMissed(bounds);
  const futureDates=weekReplanDateList(
    addDays(bounds.today,1),
    bounds.end
  );

  const original={};
  const schedule={};

  futureDates.forEach(date=>{
    const workout=workouts[date]||null;
    original[date]=weekReplanClone(workout,date);
    schedule[date]=weekReplanClone(workout,date);
  });

  const notes=[];
  const triggers=[];

  if(stress.reasons.length){
    triggers.push(...stress.reasons);
  }

  const missedEasy=missed.filter(item=>
    !isHardWorkout(item.workout) &&
    !isLongWorkout(item.workout)
  );
  const missedHard=missed.find(item=>isHardWorkout(item.workout))||null;
  const missedLong=missed.find(item=>isLongWorkout(item.workout))||null;

  if(missedEasy.length){
    notes.push(
      missedEasy.length===1
      ?"1 gemiste rustige training wordt niet ingehaald."
      :`${missedEasy.length} gemiste rustige trainingen worden niet ingehaald.`
    );
    triggers.push("gemiste rustige training");
  }

  if(missedLong){
    notes.push(
      `Gemiste lange duurloop "${missedLong.workout.name}" wordt niet automatisch later in dezelfde week ingehaald.`
    );
    triggers.push("gemiste lange duurloop");
  }

  const rescheduled=weekReplanRescheduleMissedQuality(
    missedHard,
    schedule,
    bounds,
    stress
  );

  if(missedHard){
    triggers.push("gemiste kwaliteitstraining");
    if(rescheduled){
      notes.push(
        `Gemiste kwaliteit van ${missedHard.date} is veilig doorgeschoven naar ${rescheduled.date}.`
      );
    }else{
      notes.push(
        `Gemiste kwaliteit "${missedHard.workout.name}" wordt niet ingehaald: herstel, wedstrijdfase of de resterende week biedt onvoldoende veilige ruimte.`
      );
    }
  }

  // Bestaande zware sessies in taper/herstelvensters altijd conservatiever maken.
  futureDates.forEach(date=>{
    const workout=schedule[date];
    if(!weekReplanIsStressWorkout(workout)) return;

    const protection=weekReplanProtection(date);
    if(
      protection.protected &&
      ["taper","recovery"].includes(protection.kind)
    ){
      schedule[date]=weekReplanRecoveryWorkout(
        workout,
        date,
        protection.text
      );
      triggers.push(protection.text);
    }
  });

  // Als belasting verhoogd is, geef de eerste nabije zware prikkel meer ruimte.
  if(["attention","elevated"].includes(stress.level)){
    const stressEntries=Object.entries(schedule)
      .filter(([,workout])=>weekReplanIsStressWorkout(workout))
      .sort((a,b)=>a[0].localeCompare(b[0]));

    const first=stressEntries[0]||null;

    if(first){
      const [date,workout]=first;
      const daysAway=signedDateGapDays(date,bounds.today);
      const threshold=stress.level==="elevated"?2:1;

      if(daysAway>0 && daysAway<=threshold){
        const swap=weekReplanFindLaterSwap(
          date,
          workout,
          schedule,
          bounds
        );

        if(swap){
          weekReplanMove(
            schedule,
            date,
            swap.targetDate,
            `Meer herstelruimte door ${stress.level==="elevated"?"verhoogde belasting":"een belastingssignaal met aandacht"}`
          );
        }else if(stress.level==="elevated"){
          schedule[date]=weekReplanRecoveryWorkout(
            workout,
            date,
            "Verhoogde actuele belasting"
          );
        }else{
          notes.push(
            `${workout.name} staat dichtbij, maar er is geen veiligere plek in deze week; voer hem alleen gecontroleerd uit.`
          );
        }
      }
    }
  }

  // Corrigeer niet-beschikbare toekomstige dagen zonder races aan te raken.
  futureDates.forEach(date=>{
    const workout=schedule[date];
    if(
      !workout ||
      ["Rest","Race"].includes(workout.type) ||
      weekReplanFitsAvailability(workout,date)
    ){
      return;
    }

    const target=weekReplanFindEmptyMove(
      date,
      workout,
      schedule,
      bounds
    );

    if(target){
      weekReplanMove(
        schedule,
        date,
        target,
        "Verplaatst naar beschikbare dag"
      );
      triggers.push("beschikbaarheid gewijzigd");
    }else{
      notes.push(
        `${workout.name} past niet in je ingestelde beschikbaarheid op ${date}; geen veilige lege plek gevonden.`
      );
      triggers.push("beschikbaarheidsconflict");
    }
  });

  // Laat twee zware/lange prikkels niet op opeenvolgende dagen staan.
  const stressDates=Object.entries(schedule)
    .filter(([,workout])=>weekReplanIsStressWorkout(workout))
    .sort((a,b)=>a[0].localeCompare(b[0]));

  for(let i=1;i<stressDates.length;i++){
    const [previousDate]=stressDates[i-1];
    const [date,workout]=stressDates[i];

    if(dateGapDays(previousDate,date)>=2) continue;

    const swap=weekReplanFindLaterSwap(
      date,
      workout,
      schedule,
      bounds
    );

    if(swap){
      weekReplanMove(
        schedule,
        date,
        swap.targetDate,
        "Zware prikkels verder uit elkaar"
      );
      triggers.push("zware sessies te dicht op elkaar");
    }else{
      schedule[date]=weekReplanRecoveryWorkout(
        workout,
        date,
        "Zware prikkels te dicht op elkaar"
      );
      triggers.push("zware sessies te dicht op elkaar");
    }
  }

  const changes=futureDates
    .filter(date=>
      weekReplanWorkoutSignature(original[date])!==
      weekReplanWorkoutSignature(schedule[date])
    )
    .map(date=>({
      date,
      before:original[date],
      after:schedule[date],
      reason:schedule[date]?.replanReason||"Adaptieve weekcorrectie"
    }));

  const raceDates=futureDates.filter(date=>
    workouts[date]?.type==="Race"
  );

  pendingWeekReplan={
    createdAt:new Date().toISOString(),
    bounds,
    stress,
    missed,
    triggers:[...new Set(triggers)],
    notes,
    original,
    schedule,
    changes,
    raceDates
  };

  return pendingWeekReplan;
}

function weekReplanActionLabel(change){
  const before=change.before;
  const after=change.after;

  if(!before && after) return "Toevoegen";
  if(before?.type==="Rest" && after?.type!=="Rest") return "Verplaatsen";
  if(before?.type!=="Rest" && after?.type==="Rest") return "Vrijmaken";
  if(
    before &&
    after &&
    before.name!==after.name &&
    (
      String(after.planType||"")==="recovery" ||
      after.type==="Mobility"
    )
  ){
    return "Lichter";
  }

  return "Herschikken";
}

function weekReplanStatusMeta(proposal){
  if(!proposal) return{label:"Nog niet berekend",cls:"control"};

  if(proposal.stress.level==="elevated"){
    return{label:"Aanpassen aanbevolen",cls:"recover"};
  }

  if(proposal.changes.length){
    return{label:"Week kan slimmer",cls:"adjust"};
  }

  if(proposal.triggers.length){
    return{label:"Aandacht · plan behouden",cls:"control"};
  }

  return{label:"Week staat goed",cls:"execute"};
}

function renderAdaptiveWeekReplanner(){
  const root=document.getElementById("weekReplannerCard");
  if(!root) return null;

  const proposal=buildAdaptiveWeekReplan();
  const meta=weekReplanStatusMeta(proposal);

  root.className=`week-replanner-card ${meta.cls}`;
  document.getElementById("weekReplannerStatus").textContent=meta.label;
  document.getElementById("weekReplannerStress").textContent=
    proposal.stress.level==="elevated"
      ?"Verhoogd"
      :proposal.stress.level==="attention"
        ?"Aandacht"
        :proposal.stress.level==="stable"
          ?"Stabiel"
          :"Onbekend";

  document.getElementById("weekReplannerChanges").textContent=
    String(proposal.changes.length);

  document.getElementById("weekReplannerRaces").textContent=
    proposal.raceDates.length
      ?`${proposal.raceDates.length} beschermd`
      :"Geen deze week";

  const triggers=proposal.triggers.length
    ?proposal.triggers.join(" · ")
    :"Geen afwijking die om herschikking vraagt.";

  document.getElementById("weekReplannerSummary").textContent=
    proposal.changes.length
      ?`${proposal.changes.length} toekomstige dag${proposal.changes.length===1?"":"en"} wijzigen. ${triggers}`
      :`Geen kalenderwijziging nodig. ${triggers}`;

  const list=document.getElementById("weekReplannerPlan");

  const rows=proposal.changes.map(change=>{
    const before=change.before
      ?change.before.name
      :"Lege dag";
    const after=change.after
      ?change.after.name
      :"Lege dag";

    return`
      <div class="week-replanner-row">
        <div>
          <strong>${safe(change.date)}</strong>
          <small>${safe(weekReplanActionLabel(change))}</small>
        </div>
        <div>
          <span>${safe(before)}</span>
          <strong>→ ${safe(after)}</strong>
          <small>${safe(change.reason)}</small>
        </div>
      </div>
    `;
  });

  const noteRows=proposal.notes.map(note=>`
    <div class="week-replanner-note">
      <span>i</span>
      <div>${safe(note)}</div>
    </div>
  `);

  list.innerHTML=[...rows,...noteRows].join("") ||
    '<div class="week-replanner-note"><span>✓</span><div>De resterende week hoeft op basis van de huidige data niet te worden aangepast.</div></div>';

  const apply=document.getElementById("applyWeekReplan");
  apply.disabled=!proposal.changes.length;
  apply.textContent=proposal.changes.length
    ?`Pas ${proposal.changes.length} wijziging${proposal.changes.length===1?"":"en"} toe`
    :"Week staat al goed";

  return proposal;
}

function refreshAdaptiveWeekReplanner(){
  const status=document.getElementById("weekReplannerApplyStatus");
  try{
    const proposal=renderAdaptiveWeekReplanner();
    if(status){
      status.className="status";
      status.textContent=proposal?.changes.length
        ?"Voorstel opnieuw berekend. Er is nog niets gewijzigd."
        :"Voorstel opnieuw berekend; geen wijziging nodig.";
    }
    return proposal;
  }catch(error){
    if(status){
      status.className="status error";
      status.textContent=`Weekanalyse mislukt: ${error.message}`;
    }
    return null;
  }
}

function applyAdaptiveWeekReplan(){
  const status=document.getElementById("weekReplannerApplyStatus");
  const proposal=pendingWeekReplan || buildAdaptiveWeekReplan();

  if(!proposal.changes.length){
    status.className="status";
    status.textContent="Er zijn geen toekomstige weekwijzigingen om toe te passen.";
    return;
  }

  if(proposal.changes.some(change=>change.before?.type==="Race")){
    status.className="status error";
    status.textContent="Veiligheidsstop: een wedstrijd zou worden gewijzigd. Er is niets toegepast.";
    return;
  }

  const confirmed=confirm(
    `${proposal.changes.length} toekomstige kalenderwijziging${proposal.changes.length===1?"":"en"} toepassen? Wedstrijden blijven beschermd.`
  );
  if(!confirmed) return;

  proposal.changes.forEach(change=>{
    const next=weekReplanClone(change.after,change.date);
    if(!next) return;

    clearWorkoutMarkersForDate(change.date);
    customWorkouts[change.date]=next;
  });

  saveObject(STORAGE_KEY,customWorkouts);
  saveObject(DONE_KEY,doneWorkouts);
  saveObject(UPLOAD_KEY,uploadedWorkouts);

  pendingWeekReplan=null;
  refreshAfterCalendarMutation();

  status.className="status ok";
  status.textContent=
    `${proposal.changes.length} toekomstige dag${proposal.changes.length===1?"":"en"} aangepast. Wedstrijddagen zijn niet gewijzigd.`;
}
