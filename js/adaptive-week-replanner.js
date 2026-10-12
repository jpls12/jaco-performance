let pendingWeekReplan=null;
const AUTO_WEEK_REPLAN_KEY="jaco_auto_week_replan_v1";
const AUTO_WEEK_REPLAN_UNDO_KEY="jaco_auto_week_replan_undo_v1";
let autoWeekReplanReady=false;
let autoWeekReplanApplying=false;

function autoWeekReplanEnabled(){
  try{return localStorage.getItem(AUTO_WEEK_REPLAN_KEY)!=="off";}
  catch{return false;}
}

function autoWeekReplanUndoRecord(){
  try{
    const record=JSON.parse(localStorage.getItem(AUTO_WEEK_REPLAN_UNDO_KEY)||"null");
    return record && Array.isArray(record.changes) && record.changes.length<=7
      ?record:null;
  }catch{return null;}
}

function autoWeekReplanSafety(proposal){
  if(!proposal?.changes?.length) return "";
  for(const change of proposal.changes){
    const current=allWorkouts()[change.date]||null;
    const done=weekReplanIsDone(change.date,current);
    const completedEarly=weekReplanCompletedEarly(change.date,current);
    const safeEarlyReplacement=
      completedEarly &&
      (
        change.after?.type==="Rest" ||
        String(change.after?.planType||"").toLowerCase()==="recovery" ||
        change.after?.type==="Mobility"
      );
    if(change.date<=todayDateString() || change.date>proposal.bounds.end ||
      !change.after || current?.locked===true || current?.type==="Race" || change.after.type==="Race" ||
      weekReplanProtection(change.date).kind==="race" ||
      (done && !safeEarlyReplacement)){
      return "Een wedstrijddag of afgeronde training is betrokken. Bekijk het voorstel handmatig.";
    }
    if(weekReplanWorkoutSignature(current)!==weekReplanWorkoutSignature(change.before)){
      return "De kalender is intussen gewijzigd. Herbereken het voorstel.";
    }
    if(uploadedWorkouts[change.date]){
      return "Een betrokken training is al naar Intervals verstuurd. Controleer de wijziging en synchroniseer die zelf.";
    }
  }
  return "";
}

function renderAutoWeekReplanControls(message=""){
  const toggle=document.getElementById("autoWeekReplan");
  const status=document.getElementById("autoWeekReplanStatus");
  const undo=document.getElementById("undoAutoWeekReplan");
  if(!toggle || !status || !undo) return;
  toggle.checked=autoWeekReplanEnabled();
  const record=autoWeekReplanUndoRecord();
  undo.hidden=!record;
  if(message) status.textContent=message;
  else if(record) status.textContent=
    `Laatste automatische aanpassing: ${record.changes.length} dag(en) op ${new Date(record.createdAt).toLocaleString("nl-NL")}.`;
  else status.textContent=toggle.checked
    ?"Automatisch actief zodra de actuele gegevens zijn geladen."
    :"Automatisch aanpassen staat uit; je kunt het voorstel zelf toepassen.";
}

function setAutoWeekReplanEnabled(){
  localStorage.setItem(AUTO_WEEK_REPLAN_KEY,
    document.getElementById("autoWeekReplan").checked?"on":"off");
  renderAutoWeekReplanControls();
  if(autoWeekReplanEnabled()) refreshDerivedCoachViews();
}

function applyAutomaticWeekReplan(proposal){
  if(!autoWeekReplanReady || autoWeekReplanApplying || !autoWeekReplanEnabled() ||
    !proposal?.changes?.length) return false;
  const reason=autoWeekReplanSafety(proposal);
  if(reason){renderAutoWeekReplanControls(reason);return false;}

  const changes=proposal.changes.map(change=>({
    date:change.date,
    hadCustom:Object.hasOwn(customWorkouts,change.date),
    beforeSnapshot:weekReplanClone(change.before,change.date),
    previousCustom:weekReplanClone(customWorkouts[change.date]),
    previousDone:weekReplanClone(doneWorkouts[change.date]),
    previousUpload:weekReplanClone(uploadedWorkouts[change.date]),
    afterSignature:weekReplanWorkoutSignature(change.after),
    afterSnapshot:weekReplanClone(change.after,change.date),
    reason:change.reason
  }));
  const record={createdAt:new Date().toISOString(),changes};
  autoWeekReplanApplying=true;
  try{
    // Save the recovery point before changing the calendar.
    saveObject(AUTO_WEEK_REPLAN_UNDO_KEY,record);
    if(typeof recordCoachChange==="function") recordCoachChange("week",record);
    proposal.changes.forEach(change=>{
      clearWorkoutMarkersForDate(change.date);
      customWorkouts[change.date]=weekReplanClone(change.after,change.date);
    });
    saveObject(STORAGE_KEY,customWorkouts);
    saveObject(DONE_KEY,doneWorkouts);
    saveObject(UPLOAD_KEY,uploadedWorkouts);
    pendingWeekReplan=null;
    refreshAfterCalendarMutation();
    renderAutoWeekReplanControls(
      `${changes.length} toekomstige dag(en) automatisch aangepast. Je kunt de laatste aanpassing terugzetten.`);
    return true;
  }finally{autoWeekReplanApplying=false;}
}

function undoAutomaticWeekReplan(){
  const record=autoWeekReplanUndoRecord();
  if(!record) return;
  const conflict=record.changes.some(change=>{
    const current=allWorkouts()[change.date]||null;
    return change.date<=todayDateString() || current?.type==="Race" ||
      weekReplanIsDone(change.date,current) || uploadedWorkouts[change.date] ||
      weekReplanWorkoutSignature(current)!==change.afterSignature ||
      JSON.stringify(customWorkouts[change.date])!==JSON.stringify(change.afterSnapshot);
  });
  if(conflict){
    renderAutoWeekReplanControls("Terugzetten gestopt: een betrokken training is intussen gewijzigd, voltooid of verstuurd.");
    return;
  }
  autoWeekReplanApplying=true;
  try{
    record.changes.forEach(change=>{
      if(change.hadCustom) customWorkouts[change.date]=change.previousCustom;
      else delete customWorkouts[change.date];
      if(change.previousDone) doneWorkouts[change.date]=change.previousDone;
      else delete doneWorkouts[change.date];
      if(change.previousUpload) uploadedWorkouts[change.date]=change.previousUpload;
      else delete uploadedWorkouts[change.date];
    });
    saveObject(STORAGE_KEY,customWorkouts);
    saveObject(DONE_KEY,doneWorkouts);
    saveObject(UPLOAD_KEY,uploadedWorkouts);
    localStorage.setItem(AUTO_WEEK_REPLAN_KEY,"off");
    localStorage.removeItem(AUTO_WEEK_REPLAN_UNDO_KEY);
    if(typeof recordCoachChange==="function") recordCoachChange("undo",record);
    pendingWeekReplan=null;
    refreshAfterCalendarMutation();
    renderAutoWeekReplanControls("Laatste wijziging teruggezet. Automatisch aanpassen staat uit; zet het weer aan wanneer je wilt.");
  }finally{autoWeekReplanApplying=false;}
}

function weekReplanClone(workout,date=null){
  if(!workout) return null;
  const copy=JSON.parse(JSON.stringify(workout));
  if(date) copy.date=date;
  return copy;
}

function weekReplanWeekBounds(){
  const today=todayDateString();
  const start=mondayOf(today);
  const weekEnd=addDays(start,6);
  const end=addDays(today,7);
  return{today,start,weekEnd,end};
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

function weekReplanExecution(date,workout){
  if(!workout || typeof trainingExecutionForDate!=="function") return null;
  return trainingExecutionForDate(date,workout);
}

function weekReplanCompletedEarly(date,workout){
  const execution=weekReplanExecution(date,workout);
  return Boolean(
    execution?.matched &&
    execution.actual?.date &&
    execution.actual.date<date
  );
}

function weekReplanImportance(workout){
  if(!workout) return 0;
  if(workout.type==="Race") return 100;
  if(isHardWorkout(workout)) return 85;
  if(isLongWorkout(workout)) return 75;
  const type=String(workout.planType||workout.type||"").toLowerCase();
  if(type==="easy") return 40;
  if(type==="recovery") return 20;
  if(["mobility","core","strength"].includes(type)) return 15;
  if(workout.type==="Rest") return 0;
  return 35;
}

function weekReplanLocked(date){
  const workout=allWorkouts()[date];
  return workout?.type==="Race" || workout?.locked===true ||
    (typeof uploadedWorkouts!=="undefined" && Boolean(uploadedWorkouts[date])) ||
    (weekReplanIsDone(date,workout) && !weekReplanCompletedEarly(date,workout));
}

function weekReplanShortenToAvailability(workout,date,availability=null){
  if(!workout || isHardWorkout(workout)) return null;
  const day=availability || weekReplanAvailability(date);
  const maxMinutes=Number(day?.maxMinutes)||0;
  if(workout.type!=="Run"){
    const minimum={Ride:20,Swim:15,Strength:15,Core:10,Mobility:5}[workout.type];
    const duration=finiteNumberOrNull(workout.durationMinutes);
    if(!minimum || !day?.available || maxMinutes<minimum ||
      duration===null || duration<=maxMinutes) return null;
    // Structured intervals cannot safely be truncated as a continuous session.
    if(!["easy","recovery","endurance","mobility"].includes(workout.planType)) return null;
    const copy=weekReplanClone(workout,date);
    copy.durationMinutes=maxMinutes;
    copy.distanceKm=0;
    copy.name=`${workout.type==="Ride"?"Rustig fietsen":workout.type==="Swim"?"Rustig zwemmen":"Mobiliteit"} ${maxMinutes} min`;
    copy.uploadName=`Jaco - ${copy.name}`;
    copy.displaySteps=[`${maxMinutes} minuten rustig, zonder intensieve blokken`];
    copy.intervalsDescription=`${copy.name}\n\n- ${maxMinutes}m Z1`;
    copy.replanReason="Ingekort om binnen je actuele beschikbaarheid te passen";
    return copy;
  }
  if(!day?.available || maxMinutes<25) return null;
  const type=String(workout.planType||"").toLowerCase();
  const paceMinutes=
    type==="recovery"?5.6:
      isLongWorkout(workout)?5.2:5.3;
  const possibleKm=Math.floor(maxMinutes/paceMinutes);
  const minimumKm=isLongWorkout(workout)?10:5;
  const currentKm=finiteNumberOrNull(workout.distanceKm);
  if(possibleKm<minimumKm || currentKm===null || possibleKm>=currentKm){
    return null;
  }
  const km=Math.max(minimumKm,possibleKm);
  const copy=weekReplanClone(workout,date);
  copy.distanceKm=km;
  copy.durationMinutes=0;
  copy.name=isLongWorkout(workout)
    ?`Lange duurloop ${km} km · ingekort`
    :type==="recovery"
      ?`Herstelloop ${km} km`
      :`Rustige duurloop ${km} km`;
  copy.uploadName=`Jaco - ${copy.name}`;
  copy.displaySteps=[
    `${km} km ${type==="recovery"?"zeer rustig":"rustig"}`,
    `Ingekort naar maximaal ${maxMinutes} minuten beschikbare tijd`,
    "Geen gemiste kilometers later inhalen"
  ];
  copy.intervalsDescription=`${copy.name}\n\n- ${km}km Z1 Pace`;
  copy.sourceReplanner="11.4";
  copy.replanReason="Ingekort om binnen je actuele beschikbaarheid te passen";
  return copy;
}

function weekReplanFindLowerPrioritySlot(date,workout,schedule,bounds){
  const importance=weekReplanImportance(workout);
  const dates=weekReplanDateList(addDays(bounds.today,1),bounds.end);
  const candidates=[];
  for(const targetDate of dates){
    if(targetDate===date) continue;
    const target=schedule[targetDate];
    if(!target || target.type==="Race") continue;
    if(weekReplanLocked(targetDate)) continue;
    if(weekReplanImportance(target)>=importance) continue;
    if(!weekReplanFitsAvailability(workout,targetDate)) continue;
    if(
      weekReplanIsStressWorkout(workout) &&
      !weekReplanCanPlaceStress(workout,targetDate,schedule,date)
    ) continue;
    candidates.push({
      targetDate,
      target,
      importance:weekReplanImportance(target),
      distance:dateGapDays(date,targetDate)
    });
  }
  return candidates.sort((a,b)=>
    a.importance-b.importance ||
    a.distance-b.distance ||
    a.targetDate.localeCompare(b.targetDate)
  )[0]||null;
}

function weekReplanReplaceLowerPriority(schedule,fromDate,targetDate,reason){
  const source=weekReplanClone(schedule[fromDate],targetDate);
  const replaced=weekReplanClone(schedule[targetDate],targetDate);
  source.sourceReplanner="11.4";
  source.replanReason=reason;
  schedule[targetDate]=source;
  schedule[fromDate]=weekReplanRestWorkout(
    fromDate,
    `Verplaatst naar ${targetDate}; lagere prioriteit ${replaced?.name||"training"} vervalt`
  );
  schedule[fromDate].sourceReplanner="11.4";
  return replaced;
}

function weekReplanLatestActualStressDate(bounds){
  if(
    typeof syncedActivities==="undefined" ||
    typeof activityEffortClass!=="function"
  ) return null;

  return Object.values(syncedActivities)
    .filter(activity=>{
      if(!activity?.date || activity.date>bounds.today) return false;
      const age=dateGapDays(activity.date,bounds.today);
      if(age>2) return false;

      const assignment=typeof assignmentForActivity==="function"
        ?assignmentForActivity(activity.id)
        :null;
      const planned=assignment?.workoutSnapshot||null;

      return(
        activityEffortClass(activity)==="hard" ||
        (typeof activityStressSignal==="function" &&
          activityStressSignal(activity).level!=="stable") ||
        (Number(activity.durationMinutes)>=120 && syncedSportFamily(activity.type)==="ride") ||
        (planned && weekReplanIsStressWorkout(planned)) ||
        (
          syncedSportFamily(activity.type)==="run" &&
          Number(activity.distanceKm||0)>=16
        )
      );
    })
    .sort((a,b)=>String(b.startDateLocal||b.date)
      .localeCompare(String(a.startDateLocal||a.date)))[0]?.date || null;
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
      !weekReplanIsDone(item.date,item.workout) &&
      !Object.values(workouts).some(workout=>workout?.replanOriginDate===item.date) &&
      !(typeof activityPlanAssignments!=="undefined" &&
        Object.values(activityPlanAssignments).some(assignment=>
          assignment?.workoutSnapshot?.replanOriginDate===item.date))
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
  if(typeof availabilityForDate==="function") return availabilityForDate(date);
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
    (isHardWorkout(workout)||isLongWorkout(workout) ||
      Number(String(workout.rpe||"").split("/")[0])>=7 ||
      (workout.type==="Ride" && Number(workout.durationMinutes)>=120))
  );
}

function weekReplanRaceConflict(date,workouts){
  return Object.entries(workouts).find(([raceDate,workout])=>{
    if(workout?.type!=="Race" || raceDate===date) return false;
    const buffer=Number(workout.distanceKm)>=15?2:1;
    return dateGapDays(raceDate,date)<=buffer;
  })||null;
}

function weekReplanStressLevel(){
  const readiness=determineReadiness(getWellnessSnapshot());
  const load=buildLoadMonitor();
  const execution=buildAdaptiveExecutionFeedback();
  const diary={...latestDiaryRecoverySignal()};

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

  if(diary.level==="elevated"){
    level="elevated";
    reasons.push(`trainingsfeedback: ${diary.reason}`);
  }else if(diary.level==="attention"){
    if(level!=="elevated") level="attention";
    reasons.push(`trainingsfeedback: ${diary.reason}`);
  }

  const support=typeof supportLoadSummary==="function"?supportLoadSummary(3):null;
  if(support?.recentPain){
    level="elevated";
    reasons.push("klachten bij aanvullende kracht of mobiliteit");
    diary.complaint=true;
    diary.reason=diary.reason||"klachten bij aanvullende training";
  }else if(support?.recentHard){
    if(level!=="elevated") level="attention";
    reasons.push("recente zware krachtsessie");
  }

  return{level,reasons,readiness,load,execution,diary};
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

  if(["Ride","Swim"].includes(original?.type)){
    const minutes=Math.min(original.type==="Ride"?40:25,
      Math.max(10,Math.floor((Number(original.durationMinutes)||30)*.6)));
    const name=`${original.type==="Ride"?"Herstelfietsen":"Herstelzwemmen"} ${minutes} min`;
    return{...weekReplanClone(original,date),name,uploadName:`Jaco - ${name}`,
      distanceKm:0,durationMinutes:minutes,planType:"recovery",rpe:"2/10",
      displaySteps:[`${minutes} minuten zeer rustig, geen intensieve blokken`],
      intervalsDescription:`${name}\n\n- ${minutes}m Z1`,replanReason:reason};
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
  if(weekReplanLocked(date)) return false;
  if(!weekReplanFitsAvailability(workout,date)) return false;

  const protection=weekReplanProtection(date);
  if(protection.protected) return false;

  const today=todayDateString();
  const actual=weekReplanLatestActualStressDate({today});
  if(actual && dateGapDays(actual,date)<2) return false;
  const outside=allWorkouts();
  for(const adjacent of [addDays(date,-1),addDays(date,1)]){
    if(adjacent!==today && adjacent<today) continue;
    if(Object.prototype.hasOwnProperty.call(schedule,adjacent)) continue;
    const other=outside[adjacent];
    if(other && (other.type==="Race" || weekReplanIsStressWorkout(other))){
      return false;
    }
  }
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
    if(weekReplanLocked(targetDate)) continue;
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
    if(weekReplanLocked(targetDate)) continue;
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

// Beschikbaarheidswijzigingen lopen vanaf 11.4 uitsluitend via buildAdaptiveWeekReplan().

function weekReplanRescheduleMissedQuality(missed,schedule,bounds,stress){
  // Missed work is never automatically made up. Current goals guide future sessions.
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
    workout.rpe||"",
    workout.displaySteps||[],
    workout.intervalsDescription||"",
    workout.locked===true,
    workout.replanOriginDate||null
  ]);
}

function buildAdaptiveWeekReplan(){
  const bounds=weekReplanWeekBounds();
  const workouts=allWorkouts();
  const stress=weekReplanStressLevel();
  const focusRace=getRaceFocus();
  const primaryGoal=getPrimaryARace();
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
  futureDates.filter(weekReplanLocked).forEach(date=>{
    const workout=original[date];
    if(workout?.type!=="Race") notes.push(
      `${date}: ${workout?.name||"Training"} is beschermd (afgerond, vastgezet of naar Intervals verstuurd). Controleer deze training zelf bij gewijzigde belasting of beschikbaarheid.`);
  });

  // Een sessie die al op een eerdere dag is uitgevoerd, blijft verwerkt
  // maar wordt niet nogmaals aangeboden op de oorspronkelijke plandatum.
  futureDates.forEach(date=>{
    const planned=original[date];
    if(weekReplanLocked(date)) return;
    if(!planned || ["Rest","Race"].includes(planned.type)) return;
    if(!weekReplanCompletedEarly(date,planned)) return;

    const execution=weekReplanExecution(date,planned);
    const actualDate=execution?.actual?.date||"een eerdere dag";
    schedule[date]=weekReplanRestWorkout(
      date,
      `Al uitgevoerd op ${actualDate}: ${planned.name}`
    );
    schedule[date].sourceReplanner="11.4";
    triggers.push("training eerder uitgevoerd");
    notes.push(
      `${planned.name} stond op ${date}, maar is al op ${actualDate} uitgevoerd. De sessie wordt niet opnieuw ingepland.`
    );
  });

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
      `Gemiste lange duurloop "${missedLong.workout.name}" wordt niet automatisch ingehaald.`
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
        `Gemiste kwaliteit "${missedHard.workout.name}" wordt niet ingehaald: herstel, wedstrijdfase of de lopende week biedt onvoldoende veilige ruimte.`
      );
    }
  }

  // Bescherm ook de dagen direct rond een C-race, inclusief over de weekgrens.
  futureDates.forEach(date=>{
    const workout=schedule[date];
    if(weekReplanLocked(date)) return;
    if(!weekReplanIsStressWorkout(workout)) return;

    const protection=weekReplanProtection(date);
    const nearbyRace=weekReplanRaceConflict(date,workouts);
    if(
      (protection.protected && ["taper","recovery"].includes(protection.kind)) ||
      nearbyRace
    ){
      const reason=protection.protected && ["taper","recovery"].includes(protection.kind)
        ?protection.text
        :`Ruimte rond wedstrijd ${nearbyRace[1].name}`;
      schedule[date]=weekReplanRecoveryWorkout(
        workout,
        date,
        reason
      );
      triggers.push(reason);
    }
  });

  // Als belasting verhoogd is, geef de eerste nabije zware prikkel meer ruimte.
  if(["attention","elevated"].includes(stress.level)){
    const stressEntries=Object.entries(schedule)
      .filter(([date,workout])=>!weekReplanLocked(date) && weekReplanIsStressWorkout(workout))
      .sort((a,b)=>a[0].localeCompare(b[0]));

    const first=stressEntries[0]||null;

    if(first){
      const [date,workout]=first;
      const daysAway=signedDateGapDays(date,bounds.today);
      const threshold=stress.level==="elevated"?2:1;

      if(daysAway>0 && daysAway<=threshold){
        const swap=stress.diary?.complaint
          ?null
          :weekReplanFindLaterSwap(date,workout,schedule,bounds);

        if(stress.diary?.complaint){
          schedule[date]=weekReplanRestWorkout(
            date,
            `Klachten gemeld: ${stress.diary.reason}`
          );
          notes.push("De zware training wordt bij duidelijke klachten niet binnen dit venster ingehaald.");
        }else if(swap){
          weekReplanMove(
            schedule,
            date,
            swap.targetDate,
            stress.diary?.reason && ["attention","elevated"].includes(stress.diary.level)
              ?`Meer herstelruimte door trainingsfeedback: ${stress.diary.reason}`
              :`Meer herstelruimte door ${stress.level==="elevated"?"verhoogde belasting":"een belastingssignaal met aandacht"}`
          );
        }else if(stress.level==="elevated"){
          schedule[date]=weekReplanRecoveryWorkout(
            workout,
            date,
            stress.diary?.level==="elevated"
              ?`Trainingsfeedback: ${stress.diary.reason}`
              :"Verhoogde actuele belasting"
          );
        }else{
          notes.push(
            `${workout.name} staat dichtbij, maar er is geen veiligere plek in de komende zeven dagen; voer hem alleen gecontroleerd uit.`
          );
        }
      }
    }
  }

  // Bij minder tijd behoudt de coach eerst de belangrijkste haalbare sessies.
  // Rustige/recovery-sessies mogen daarvoor wijken; gemist volume wordt niet ingehaald.
  [...futureDates].sort((a,b)=>weekReplanImportance(schedule[b])-weekReplanImportance(schedule[a]) ||
    a.localeCompare(b)).forEach(date=>{
    const workout=schedule[date];
    if(
      weekReplanLocked(date) ||
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
      return;
    }

    const importance=weekReplanImportance(workout);

    if(importance>=70){
      const lower=weekReplanFindLowerPrioritySlot(
        date,
        workout,
        schedule,
        bounds
      );

      if(lower){
        const dropped=weekReplanReplaceLowerPriority(
          schedule,
          date,
          lower.targetDate,
          `Belangrijkere sessie behouden binnen beschikbare tijd; ${lower.target?.name||"rustige training"} vervalt`
        );
        notes.push(
          `${workout.name} is verplaatst naar ${lower.targetDate}. ${dropped?.name||"Een lagere-prioriteitssessie"} vervalt en wordt niet ingehaald.`
        );
        triggers.push("belangrijkste training behouden");
        return;
      }
    }

    const shortened=weekReplanShortenToAvailability(workout,date);
    if(shortened){
      schedule[date]=shortened;
      notes.push(
        `${workout.name} is ingekort zodat de training binnen je beschikbare tijd past.`
      );
      triggers.push("training ingekort op beschikbare tijd");
      return;
    }

    schedule[date]=weekReplanRestWorkout(
      date,
      "Training vervalt: geen veilige plek binnen je beschikbare tijd"
    );
    schedule[date].sourceReplanner="11.4.1";
    notes.push(
      `${workout.name} vervalt op ${date}: er is geen veilige beschikbare plek. Dit volume wordt niet ingehaald.`
    );
    triggers.push("onhaalbare training geschrapt");
  });

  // Laat zware/lange prikkels ook rond de grens van het venster niet opeenvolgen.
  const todayWorkout=workouts[bounds.today];
  let previousDate=weekReplanLatestActualStressDate(bounds);

  if(!previousDate && weekReplanIsStressWorkout(todayWorkout)){
    previousDate=bounds.today;
  }

  const yesterday=addDays(bounds.today,-1);
  if(!previousDate && weekReplanIsStressWorkout(workouts[yesterday]) &&
    weekReplanIsDone(yesterday,workouts[yesterday])){
    previousDate=yesterday;
  }

  for(const date of futureDates){
    const workout=schedule[date];
    if(!weekReplanIsStressWorkout(workout)) continue;
    if(weekReplanLocked(date)){previousDate=date;continue;}
    if(!previousDate){
      previousDate=date;
      continue;
    }
    if(dateGapDays(previousDate,date)>=2){
      previousDate=date;
      continue;
    }

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

  // A recovery substitution must also fit the remaining time. Re-check after swaps.
  for(const date of futureDates){
    if(weekReplanLocked(date) || weekReplanFitsAvailability(schedule[date],date)) continue;
    const shorter=weekReplanShortenToAvailability(schedule[date],date);
    schedule[date]=shorter && weekReplanFitsAvailability(shorter,date)?shorter:
      weekReplanRestWorkout(date,"Geen passende training binnen je beschikbare tijd");
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
    focusRace,
    primaryGoal,
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

function weekReplanRecentChanges(proposal){
  const record=autoWeekReplanUndoRecord();
  if(!record) return new Map();
  return new Map(record.changes.filter(change=>
    change?.date>proposal.bounds.today && change.date<=proposal.bounds.end &&
    weekReplanWorkoutSignature(allWorkouts()[change.date]||null)===change.afterSignature
  ).map(change=>[change.date,change]));
}

function weekReplanDayRows(proposal,recent){
  const changed=new Map(proposal.changes.map(change=>[change.date,change]));
  return weekReplanDateList(addDays(proposal.bounds.today,1),proposal.bounds.end)
    .map(date=>{
      const pending=changed.get(date);
      const applied=recent.get(date);
      const workout=proposal.schedule[date];
      const previous=pending?.before||applied?.beforeSnapshot;
      const reason=pending?.reason||applied?.reason;
      const dateLabel=new Date(date+"T12:00:00").toLocaleDateString("nl-NL",
        {weekday:"short",day:"numeric",month:"short"});
      const label=pending?"Voorgesteld":applied?"Automatisch aangepast":
        workout?.type==="Race"?"Wedstrijd":workout?.type==="Rest"?"Rustdag":workout?"Gepland":"Vrij";
      const name=workout?.name||"Geen training gepland";
      const volume=workout?.type==="Rest"?"Herstelmoment":workout
        ?trainingVolumeLabel(workout):"Geen training ingepland";
      return `<button type="button" class="week-replanner-day${pending||applied?" changed":""}"
        onclick="openTodayWeekDate('${date}')">
        <span class="week-replanner-day-head"><strong>${safe(dateLabel)}</strong><small>${safe(label)}</small></span>
        <span class="week-replanner-day-main"><strong>${safe(name)}</strong>
          <small>${safe(volume)} · Open dag →</small></span>
        ${reason?`<span class="week-replanner-day-reason">${previous?`Was: ${safe(previous.name||"Lege dag")}. `:""}${applied?"Reden bij wijziging":"Waarom"}: ${safe(reason)}</span>`:""}
      </button>`;
    }).join("");
}

function weekReplanHasPlanned(proposal){
  return Object.values(proposal?.original||{}).some(workout=>
    workout && workout.type!=="Rest"
  );
}

function weekReplanStatusMeta(proposal){
  if(!proposal) return{label:"Nog niet berekend",cls:"control"};

  if(!weekReplanHasPlanned(proposal)) return{label:"Nog geen planning",cls:"control"};

  if(proposal.stress.level==="elevated" && proposal.changes.length){
    return{label:"Aanpassen aanbevolen",cls:"recover"};
  }

  if(proposal.changes.length){
    return{label:"Planning kan slimmer",cls:"adjust"};
  }

  if(proposal.stress.level==="elevated"){
    return{label:"Herstel vraagt aandacht",cls:"control"};
  }

  if(proposal.triggers.length){
    return{label:"Aandacht · plan behouden",cls:"control"};
  }

  return{label:"Planning staat goed",cls:"execute"};
}

function renderAdaptiveWeekReplanner(){
  const root=document.getElementById("weekReplannerCard");
  if(!root) return null;

  const proposal=buildAdaptiveWeekReplan();
  const meta=weekReplanStatusMeta(proposal);
  const recent=weekReplanRecentChanges(proposal);

  root.className=`week-replanner-card ${recent.size && !proposal.changes.length?"adjust":meta.cls}`;
  document.getElementById("weekReplannerStatus").textContent=
    recent.size && !proposal.changes.length?"Recent bijgestuurd":meta.label;
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
      :"Geen komende 7 dagen";

  const focus=proposal.focusRace;
  const primary=proposal.primaryGoal;
  document.getElementById("weekReplannerGoal").textContent=focus
    ?`Wedstrijdfocus: ${focus.name} · ${focus.date} · prioriteit ${focus.priority||"C"}.`+
      (primary && primary.date!==focus.date
        ?` Hoofddoel: ${primary.name} · ${primary.date}.`
        :"")
    :"Nog geen doelwedstrijd ingesteld; het voorstel volgt herstel en de bestaande planning.";

  const triggers=proposal.triggers.length
    ?proposal.triggers.join(" · ")
    :"Geen afwijking die om herschikking vraagt.";

  document.getElementById("weekReplannerSummary").textContent=
    !weekReplanHasPlanned(proposal)
      ?"Er staan geen trainingen in de komende 7 dagen. Voeg eerst een planning toe; zonder sessies wordt geen nieuwe trainingsbelasting verzonnen."
      :proposal.changes.length
      ?`${proposal.changes.length} toekomstige dag${proposal.changes.length===1?"":"en"} wijzigen. ${triggers}`
      :recent.size
      ?`${recent.size} automatische wijziging${recent.size===1?"":"en"} verwerkt. Bekijk per dag wat veranderde en waarom.`
      :`Geen kalenderwijziging nodig. ${triggers}`;

  const list=document.getElementById("weekReplannerPlan");
  list.innerHTML=weekReplanDayRows(proposal,recent);
  const recentBox=document.getElementById("weekReplannerRecent");
  if(recentBox){
    recentBox.hidden=!proposal.notes.length;
    recentBox.innerHTML=proposal.notes.map(note=>
      `<div class="week-replanner-note"><span>i</span><div>${safe(note)}</div></div>`).join("");
  }

  const apply=document.getElementById("applyWeekReplan");
  apply.disabled=!proposal.changes.length;
  apply.textContent=proposal.changes.length
    ?`Pas ${proposal.changes.length} wijziging${proposal.changes.length===1?"":"en"} toe`
    :weekReplanHasPlanned(proposal)?"Planning staat goed":"Nog geen planning";

  renderAutoWeekReplanControls();

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
        :weekReplanHasPlanned(proposal)
          ?"Voorstel opnieuw berekend; geen wijziging nodig."
          :"Er staan nog geen trainingen in de komende zeven dagen.";
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
  const shown=pendingWeekReplan;
  const proposal=buildAdaptiveWeekReplan();
  const signature=plan=>JSON.stringify((plan?.changes||[]).map(change=>[
    change.date,
    weekReplanWorkoutSignature(change.before),
    weekReplanWorkoutSignature(change.after),
    change.reason
  ]));

  if(!shown || shown.bounds.today!==proposal.bounds.today ||
    shown.stress.level!==proposal.stress.level ||
    signature(shown)!==signature(proposal)){
    renderAdaptiveWeekReplanner();
    status.className="status";
    status.textContent="Het weekvoorstel is veranderd door nieuwe gegevens. Bekijk de actuele wijzigingen en pas ze daarna toe.";
    return;
  }

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

  if(proposal.changes.some(change=>
    weekReplanIsDone(change.date,change.before) &&
    !weekReplanCompletedEarly(change.date,change.before)
  )){
    status.className="status error";
    status.textContent="Een betrokken training is inmiddels voltooid. Herbereken de week voordat je wijzigingen toepast.";
    return;
  }

  if(proposal.changes.some(change=>uploadedWorkouts[change.date])){
    status.className="status error";
    status.textContent="Een betrokken training staat al in Intervals.icu. Pas die eerst daar handmatig aan en herbereken daarna de week.";
    return;
  }

  const confirmed=confirm(
    `${proposal.changes.length} toekomstige kalenderwijziging${proposal.changes.length===1?"":"en"} toepassen? Wedstrijden blijven beschermd.`
  );
  if(!confirmed) return;

  const record={createdAt:new Date().toISOString(),changes:proposal.changes.map(change=>({
    date:change.date,hadCustom:Object.hasOwn(customWorkouts,change.date),
    beforeSnapshot:weekReplanClone(change.before,change.date),previousCustom:weekReplanClone(customWorkouts[change.date]),
    previousDone:weekReplanClone(doneWorkouts[change.date]),previousUpload:weekReplanClone(uploadedWorkouts[change.date]),
    afterSignature:weekReplanWorkoutSignature(change.after),afterSnapshot:weekReplanClone(change.after,change.date),reason:change.reason
  }))};
  saveObject(AUTO_WEEK_REPLAN_UNDO_KEY,record);
  if(typeof recordCoachChange==="function") recordCoachChange("week",record);
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
