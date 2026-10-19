/* Rolling orchestration around buildAdaptiveWeekReplan. No server/background scheduler.
   Calendar writes use the existing compare-before-apply transaction and undo log. */
const ROLLING_COACH_KEY="jp_rolling_coach_v1";
const ROLLING_SETTINGS_KEY="jp_rolling_settings_v1";
let rollingCoachQueued=false;
let rollingCoachRunning=false;
let rollingCoachStale=false;
let rollingCoachMessage="";

function rollingCoachSettings(){
  const s=loadObject(ROLLING_SETTINGS_KEY);
  const bounded=(v,f,min,max)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):f;
  return {mode:s.mode==="triathlon"?"triathlon":"run",
    growth:bounded(s.growth,5,0,10),gap:bounded(s.gap,2,2,4),
    runDays:Math.round(bounded(s.runDays,Number(getProfile().days)||4,1,6)),
    rideDays:Math.round(bounded(s.rideDays,2,0,4)),swimDays:Math.round(bounded(s.swimDays,1,0,4))};
}
function rollingCoachStable(value){
  if(Array.isArray(value)) return value.map(rollingCoachStable);
  if(value && typeof value==="object")return Object.fromEntries(Object.keys(value).sort()
    .filter(k=>!['fetchedAt','updatedAt','savedAt','createdAt','recordedAt','blockGeneratedAt'].includes(k))
    .map(k=>[k,rollingCoachStable(value[k])]));
  return value;
}
function rollingCoachSignature(){
  return JSON.stringify(rollingCoachStable({date:todayDateString(),enabled:autoWeekReplanEnabled(),settings:rollingCoachSettings(),
    profile:getProfile(),races,workouts:allWorkouts(),done:doneWorkouts,uploads:uploadedWorkouts,
    activities:syncedActivities,matches:activityPlanAssignments,reviews:activityReviews,
    wellness:getWellnessSnapshot(),recovery:loadObject(RECOVERY_CHECK_KEY),
    diary:latestDiaryRecoverySignal(),support:loadObject(SUPPORT_DONE_KEY),
    supportSettings:loadObject(SUPPORT_SETTINGS_KEY),zones:calibrationState().values}));
}
function rollingCoachMinutes(w){
  return !w||w.type==="Rest"?0:Math.max(0,Number(estimatedWorkoutMinutes(w))||0);
}
function rollingCoachHistory(start){
  const from=addDays(start,-21);
  const activities=Object.values(syncedActivities).filter(a=>a.date>=from&&a.date<start);
  const totals={run:0,ride:0,swim:0},counts={run:0,ride:0,swim:0};
  const recent={run:0,ride:0,swim:0};
  for(const a of activities){
    const sport=syncedSportFamily(a.type),n=finiteNumberOrNull(a.durationMinutes);
    if(!(sport in totals)||n===null||n<=0)continue;
    totals[sport]+=n;counts[sport]++;
    if(a.date>=addDays(start,-7))recent[sport]+=n;
  }
  const coverage=activitySyncMeta?.oldest&&activitySyncMeta.oldest<=from;
  const budgets={};
  for(const sport of Object.keys(totals)){
    // No imported activity is not evidence for zero capacity. Use a disclosed low starting dose.
    if(!counts[sport]){budgets[sport]={minutes:{run:90,ride:60,swim:30}[sport],known:false};continue;}
    const mean=totals[sport]/3;
    const baseline=coverage?Math.min(mean,recent[sport]>0?recent[sport]:mean*.7):mean;
    budgets[sport]={minutes:Math.round(baseline*(1+rollingCoachSettings().growth/100)),known:Boolean(coverage&&counts[sport]>=3)};
  }
  return {budgets,activities,coverage};
}
function rollingCoachWeekReview(start){
  const from=addDays(start,-7),to=addDays(start,-1),plan=allWorkouts();
  const planned=Object.entries(plan).filter(([d,w])=>d>=from&&d<=to&&w.type!=="Rest");
  const actual=Object.values(syncedActivities).filter(a=>a.date>=from&&a.date<=to);
  const outcomes={complete:0,partial:0,replaced:0,unknown:0};
  for(const [d,w] of planned){
    const e=trainingExecutionForDate(d,w);
    const status=e?.status;
    if(status && status in outcomes)outcomes[status]++;
    else if(weekReplanIsDone(d,w))outcomes.complete++;
    else outcomes.unknown++;
  }
  const plannedLoad=planned.map(([,w])=>({minutes:rollingCoachMinutes(w),rpe:finiteNumberOrNull(String(w.rpe||"").split("/")[0])}));
  const actualLoad=actual.map(a=>({minutes:finiteNumberOrNull(a.durationMinutes),rpe:finiteNumberOrNull(activityReviews[a.id]?.sessionRpe??a.perceivedExertion)}));
  const load=rows=>rows.length&&rows.every(r=>r.minutes!==null&&r.rpe>=1&&r.rpe<=10)?Math.round(rows.reduce((n,r)=>n+r.minutes*r.rpe,0)):null;
  return {from,to,plannedRpeLoad:load(plannedLoad),actualRpeLoad:load(actualLoad),plannedMinutes:Math.round(planned.reduce((n,[,w])=>n+rollingCoachMinutes(w),0)),
    actualMinutes:Math.round(actual.reduce((n,a)=>n+(finiteNumberOrNull(a.durationMinutes)||0),0)),
    outcomes,activityCount:actual.length,feedback:latestDiaryRecoverySignal().level||"unknown",
    note:"Niet gekoppeld betekent onbekend; gemiste trainingen worden niet ingehaald. Minuten per sport blijven apart van providerbelasting."};
}
function rollingCoachSession(type,date,minutes,kind="easy"){
  minutes=Math.floor(minutes);
  const labels={Run:"Hardlopen",Ride:"Fietsen",Swim:"Zwemmen"};
  const sport=syncedSportFamily(type);
  const ref=type==="Ride"?calibrationValue("ftp","ride"):type==="Swim"?calibrationValue("css","swim"):calibrationValue("thresholdPace","run");
  const w={date,type,planType:kind,priority:kind==="easy"?"should":"must",distanceKm:0,durationMinutes:minutes,
    name:`${labels[type]} · ${kind==="long"?"lange duur":kind==="quality"?"gecontroleerde blokken":"rustig"} ${minutes} min`,
    rpe:kind==="quality"?"6/10":"3/10",status:"planned",rollingGenerated:true,
    replanReason:"Nieuwe sessie op basis van recente omvang, beschikbare tijd en wedstrijdfase",zoneReference:ref||null};
  if(kind==="quality"&&minutes>=35){
    const reps=Math.min(4,Math.floor((minutes-15)/7));
    w.rollingDose={warmup:10,reps,work:5,recovery:2,cooldown:5};
    rollingCoachWriteDose(w);
  }else{
    w.displaySteps=[`${minutes} minuten ontspannen, praattempo (RPE 2–3/10)`,"Geen gemiste training inhalen"];
    w.intervalsDescription=`${w.name}\n\n- ${minutes}m Z2${sport==="run"?" Pace":""}`;
  }
  return w;
}
function rollingCoachWriteDose(w){
  const d=w.rollingDose;
  w.durationMinutes=d.warmup+d.cooldown+d.reps*(d.work+d.recovery);
  w.name=`${w.type==="Ride"?"Fietsen":"Hardlopen"} · ${d.reps} × ${d.work} min gecontroleerd`;
  w.displaySteps=[`${d.warmup} min rustig inlopen/inrijden`,`${d.reps} × ${d.work} min beheerst, RPE 6/10`,`${d.recovery} min rustig tussen de blokken`,`${d.cooldown} min rustig uitlopen/uitrijden`];
  w.intervalsDescription=`${w.name}\n\nWarmup\n- ${d.warmup}m Z1\n\nMain set ${d.reps}x\n- ${d.work}m Z3\n- ${d.recovery}m Z1\n\nCooldown\n- ${d.cooldown}m Z1`;
}
function rollingCoachShortenIntervals(workout,date,day){
  if(!workout.rollingDose||!day.available)return null;
  const w=weekReplanClone(workout,date),d=w.rollingDose;
  const count=Math.min(d.reps,Math.floor((day.maxMinutes-d.warmup-d.cooldown)/(d.work+d.recovery)));
  if(count<1||count>=d.reps)return null;
  d.reps=count;rollingCoachWriteDose(w);
  w.replanReason=`Minder herhalingen: ${workout.durationMinutes} naar ${w.durationMinutes} minuten binnen je beschikbare tijd`;
  return w;
}
function rollingCoachSeedWeek(start){
  const settings=rollingCoachSettings(),history=rollingCoachHistory(mondayOf(todayDateString()));
  const plan=allWorkouts(),seeds={};
  const dates=Array.from({length:7},(_,i)=>addDays(start,i));
  const counts={run:settings.runDays,ride:settings.mode==="triathlon"?settings.rideDays:0,swim:settings.mode==="triathlon"?settings.swimDays:0};
  // Respect one main session per day and leave at least one recovery day in each week.
  let total=dates.filter(d=>plan[d]&&plan[d].type!=="Rest").length;
  let hard=dates.some(d=>weekReplanIsStressWorkout(plan[d]));
  const protectedWeek=dates.some(d=>weekReplanProtection(d).protected);
  const phase=seasonBlockForWeek(start);
  const phaseFactor=protectedWeek ? .65 :Math.min(1,Number(phase?.volumeFactor)||1);
  const weekIndex=Math.floor(Math.abs(signedDateGapDays(start,mondayOf(todayDateString())))/7);
  const futureFactor=[1,1,1,.85][Math.min(3,weekIndex)];
  // Round-robin gives each sport a place before filling the preferred frequency.
  for(let round=0;round<6;round++)for(const [sport,type] of [['run','Run'],['ride','Ride'],['swim','Swim']]){
    if(total>=6||round>=counts[sport])continue;
    const current={...plan,...seeds};
    const existing=dates.filter(d=>current[d]&&syncedSportFamily(current[d].type)===sport);
    if(existing.length>=counts[sport])continue;
    const budget=history.budgets[sport].minutes*phaseFactor*futureFactor;
    const used=existing.reduce((n,d)=>n+rollingCoachMinutes(current[d]),0);
    const left=budget-used,min={run:20,ride:20,swim:15}[sport];
    if(left<min)continue;
    const candidates=dates.filter(d=>d>=todayDateString()&&!current[d]&&weekReplanProtection(d).kind!=="race"&&
      !doneWorkouts[d]&&!Object.values(syncedActivities).some(a=>a.date===d)&&availabilityForDate(d).available);
    candidates.sort((a,b)=>availabilityForDate(b).maxMinutes-availabilityForDate(a).maxMinutes||a.localeCompare(b));
    const date=candidates[0];if(!date)continue;
    const remainingCount=Math.max(1,counts[sport]-existing.length);
    const day=availabilityForDate(date);
    let minutes=Math.floor(Math.min(day.maxMinutes,left/remainingCount,{run:120,ride:180,swim:60}[sport]));
    if(minutes<min)continue;
    let kind="easy";
    if(sport!=="swim"&&history.budgets[sport].known&&!protectedWeek&&!hard&&minutes>=40){
      kind="quality";hard=true;
    }else if(sport==="run"&&history.budgets.run.known&&!protectedWeek&&minutes>=65)kind="long";
    const w=rollingCoachSession(type,date,minutes,kind);
    seeds[date]=w;total++;
  }
  return {seeds,history,phase:phase?.label||"Basis",start,end:addDays(start,6)};
}
function rollingCoachConstrain(schedule,original,bounds,stress,notes){
  const settings=rollingCoachSettings();
  const dates=Object.keys(schedule).sort();
  let previous=weekReplanLatestActualStressDate(bounds);
  for(const date of dates){
    const w=schedule[date];if(!w)continue;
    if(weekReplanLocked(date)){
      if(!weekReplanFitsAvailability(w,date)||stress.diary?.complaint){
        notes.push(`${date}: ${w.name} blijft beschermd. Geef deze sessie vrij of pas je beschikbare tijd aan; bij pijn eerst rust kiezen.`);
      }
      if(weekReplanIsStressWorkout(w)){
        if(previous&&dateGapDays(previous,date)<settings.gap)notes.push(`${date}: vastgezette zware sessies staan te dicht bij elkaar. Geef ${w.name} vrij of verplaats deze naar een dag met ${settings.gap} dagen tussenruimte.`);
        previous=date;
      }
      continue;
    }
    if(stress.diary?.complaint&&date<=addDays(bounds.today,1)&&w.type!=="Rest"){
      schedule[date]=weekReplanRestWorkout(date,"Pijn gemeld: geen training; hervat pas na beoordeling van je klachten");continue;
    }
    if(weekReplanIsStressWorkout(w)){
      if(previous&&dateGapDays(previous,date)<settings.gap){
        schedule[date]=weekReplanRecoveryWorkout(w,date,`${settings.gap} dagen herstelruimte tussen zware sessies`);
      }else previous=date;
    }
    const current=schedule[date],day=weekReplanAvailability(date);
    if(!weekReplanFitsAvailability(current,date))schedule[date]=weekReplanShortenToAvailability(current,date,day)||weekReplanRestWorkout(date,"Training past niet binnen beschikbare tijd");
  }
  // New sessions already have a historical budget. Cap existing mutable future volume too,
  // but only with sufficient historical coverage: missing imports must not erase a plan.
  const history=rollingCoachHistory(mondayOf(bounds.today));
  for(const start of [...new Set(dates.map(mondayOf))])for(const sport of ['run','ride','swim']){
    const budget=history.budgets[sport];if(!budget.known)continue;
    const end=addDays(start,6);
    let used=Object.values(syncedActivities).filter(a=>a.date>=start&&a.date<=end&&a.date<=bounds.today&&syncedSportFamily(a.type)===sport)
      .reduce((n,a)=>n+(finiteNumberOrNull(a.durationMinutes)||0),0);
    const entries=dates.filter(d=>d>=start&&d<=end&&syncedSportFamily(schedule[d]?.type)===sport);
    for(const d of entries.filter(d=>weekReplanLocked(d))){
      if(!Object.values(syncedActivities).some(a=>a.date===d&&syncedSportFamily(a.type)===sport))used+=rollingCoachMinutes(schedule[d]);
    }
    for(const [d,w] of Object.entries(allWorkouts())){
      if(d>=start&&d<=end&&d>=bounds.today&&!dates.includes(d)&&syncedSportFamily(w.type)===sport)used+=rollingCoachMinutes(w);
    }
    for(const d of entries.filter(d=>!weekReplanLocked(d)).sort((a,b)=>weekReplanImportance(schedule[b])-weekReplanImportance(schedule[a])||a.localeCompare(b))){
      const w=schedule[d],minutes=rollingCoachMinutes(w),left=Math.floor(Math.max(0,budget.minutes-used));
      if(minutes>left+2){
        schedule[d]=weekReplanShortenToAvailability(w,d,{available:left>0,maxMinutes:left})||weekReplanRestWorkout(d,"Weekomvang begrensd op recent uitgevoerde trainingen; niet inhalen");
        notes.push(`${d}: omvang begrensd op recent uitgevoerde ${sport}-trainingen (+maximaal ${settings.growth}%).`);
      }
      used+=rollingCoachMinutes(schedule[d]);
    }
  }
}
function rollingCoachBuild(){
  const today=todayDateString(),start=mondayOf(today),end=addDays(today,6);
  const weeks=Array.from({length:4},(_,i)=>rollingCoachSeedWeek(addDays(start,i*7)));
  const seeds=Object.fromEntries(weeks.flatMap(w=>Object.entries(w.seeds)).filter(([d])=>d>=today&&d<=end));
  const proposal=buildAdaptiveWeekReplan({includeToday:true,bounds:{today,start,weekEnd:addDays(start,6),end},seeds});
  const existing=allWorkouts()[today];
  // The existing daily coach is an input into the same transaction, never a second writer.
  if(existing&&!weekReplanLocked(today)&&!weekReplanCompletedEarly(today,existing)){
    const readiness=determineReadiness(getWellnessSnapshot()),race=getRaceFocus();
    const advice=createTodayRecommendation(readiness,race,classifyRacePhase(race),todayAvailabilityInfo(),existing,buildAdaptiveExecutionFeedback(),latestDiaryRecoverySignal());
    if(['rest','replace'].includes(advice?.kind)&&advice.workout&&proposal.schedule[today]?.type!=="Rest"){
      proposal.schedule[today]=weekReplanClone(advice.workout,today);
      proposal.schedule[today].replanReason=advice.text||"Dagadvies op basis van herstel en beschikbaarheid";
      rollingCoachConstrain(proposal.schedule,proposal.original,proposal.bounds,proposal.stress,proposal.notes);
    }
  }
  proposal.changes=Object.keys(proposal.schedule).filter(d=>weekReplanWorkoutSignature(proposal.original[d])!==weekReplanWorkoutSignature(proposal.schedule[d]))
    .map(d=>({date:d,before:proposal.original[d],after:proposal.schedule[d],reason:proposal.schedule[d]?.replanReason||"Doorlopende planning"}));
  return {proposal,weeks,review:rollingCoachWeekReview(start)};
}
function requestRollingCoachUpdate(){
  if(rollingCoachQueued||rollingCoachRunning||rollingCoachStale||!autoWeekReplanReady)return;
  rollingCoachQueued=true;
  Promise.resolve().then(async()=>{
    rollingCoachQueued=false;
    if(rollingCoachStale||!autoWeekReplanReady)return;
    if(typeof navigator!=="undefined"&&navigator.locks){
      await navigator.locks.request("jaco-rolling-coach",{ifAvailable:true},lock=>{if(lock)rollingCoachRun();});
    }else rollingCoachRun();
  }).catch(error=>{rollingCoachMessage=`Planning niet bijgewerkt: ${error.message}`;renderRollingCoach();});
}
function rollingCoachRun(){
  if(rollingCoachRunning||rollingCoachStale||!autoWeekReplanReady)return false;
  if(document.getElementById("editor")?.classList.contains("active"))return false;
  // Read again inside the Web Lock: a storage event from another tab may still be queued.
  for(const [key,value] of [[STORAGE_KEY,customWorkouts],[DONE_KEY,doneWorkouts],[UPLOAD_KEY,uploadedWorkouts]]){
    const saved=localStorage.getItem(key);
    if(saved && JSON.stringify(rollingCoachStable(JSON.parse(saved)))!==JSON.stringify(rollingCoachStable(value))){
      rollingCoachStale=true;autoWeekReplanReady=false;renderRollingCoach();return false;
    }
  }
  rollingCoachRunning=true;
  try{
    const before=rollingCoachSignature(),stored=loadObject(ROLLING_COACH_KEY);
    if(stored.signature===before)return false;
    const result=rollingCoachBuild();
    if(rollingCoachSignature()!==before)return false;
    const applied=applyAutomaticWeekReplan(result.proposal);
    const week=mondayOf(todayDateString());
    const reviews=Array.isArray(stored.reviews)?stored.reviews:[];
    if(stored.reviewWeek!==week){reviews.push(result.review);recordCoachChange("Weekevaluatie",{reason:`${result.review.from}–${result.review.to}: ${result.review.actualMinutes} minuten geregistreerd versus ${result.review.plannedMinutes} gepland. ${result.review.note}`});}
    const conflicts=result.proposal.notes.filter(n=>/beschermd|vrij|vast/.test(n));
    saveObject(ROLLING_COACH_KEY,{signature:rollingCoachSignature(),reviewWeek:week,reviews:reviews.slice(-16),
      updatedAt:new Date().toISOString(),conflicts,
      forecast:result.weeks.slice(1).map(w=>({start:w.start,end:w.end,phase:w.phase,workouts:Object.values(w.seeds)})),
      confidence:result.weeks[0].history.coverage?"Gebaseerd op beschikbare trainingshistorie":"Beperkt: trainingshistorie onvolledig; voorzichtige startomvang",
      lastChanges:applied?result.proposal.changes.map(c=>({date:c.date,before:c.before?.name||"Vrij",after:c.after?.name||"Rust",reason:c.reason})):stored.lastChanges||[]});
    rollingCoachMessage=autoWeekReplanEnabled()?"Planning gecontroleerd. Updates vinden plaats bij openen, synchroniseren en nieuwe input.":"Automatisch aanpassen staat uit. Bestaande planning blijft staan.";
    renderRollingCoach();return applied;
  }finally{rollingCoachRunning=false;}
}
function rollingCoachQuickFeedback(kind){
  const checks=loadObject(RECOVERY_CHECK_KEY),date=todayDateString();
  checks[date]={...checks[date],...(kind==="pain"?{complaintSeverity:2}:{energy:2,legs:4}),savedAt:new Date().toISOString()};
  saveObject(RECOVERY_CHECK_KEY,checks);refreshDerivedCoachViews();
}
function rollingCoachDone(){
  const date=todayDateString(),w=allWorkouts()[date];if(!w||w.type==="Rest")return;
  markWorkoutCompleted(date,w);saveObject(DONE_KEY,doneWorkouts);refreshAfterCalendarMutation();
  openCompletedWorkoutReview(date,w);
  rollingCoachMessage="Als gedaan gemarkeerd. Synchroniseer voor de werkelijke duur en belasting; feedback blijft optioneel.";renderRollingCoach();
}
function rollingCoachMove(){
  editWorkout(todayDateString());
  rollingCoachMessage="Open de training in de kalender om de datum te wijzigen.";
}
function renderRollingCoach(){
  const host=document.getElementById("rollingCoachStatus");if(!host)return;
  const s=loadObject(ROLLING_COACH_KEY);
  host.textContent=rollingCoachStale?"Gegevens gewijzigd in een ander tabblad. Herlaad voordat de coach verder plant.":rollingCoachMessage||"De coach controleert je planning zodra de gegevens zijn geladen.";
  const summary=document.getElementById("rollingCoachSummary");
  if(summary)summary.textContent=s.reviews?.length?`${s.confidence}. Vorige week: ${s.reviews.at(-1).actualMinutes} min geregistreerd / ${s.reviews.at(-1).plannedMinutes} min gepland. Belasting (min × ervaren zwaarte): ${s.reviews.at(-1).actualRpeLoad??"onbekend"} uitgevoerd / ${s.reviews.at(-1).plannedRpeLoad??"onbekend"} gepland.`:"Nog geen weekevaluatie beschikbaar.";
  const changes=document.getElementById("rollingCoachChanges");
  if(changes){changes.replaceChildren();for(const c of (s.lastChanges||[])){const p=document.createElement("p");p.textContent=`${c.date}: ${c.before} → ${c.after}. ${c.reason}`;changes.append(p);}for(const conflict of s.conflicts||[]){const p=document.createElement("p");p.textContent=conflict;changes.append(p);}}
  const future=document.getElementById("rollingCoachForecast");
  if(future){future.replaceChildren();for(const w of s.forecast||[]){const p=document.createElement("p");p.textContent=`${w.start} – ${w.end} · ${w.phase}: ${w.workouts.length} aanvullende sessies, ${w.workouts.reduce((n,s)=>n+rollingCoachMinutes(s),0)} min. Flexibel; herbeoordeling bij dichterbij komen.`;future.append(p);}}
}
function rollingCoachSaveSettings(event){
  event.preventDefault();const f=event.target;
  saveObject(ROLLING_SETTINGS_KEY,{mode:f.elements.mode.value,growth:Number(f.elements.growth.value),gap:Number(f.elements.gap.value),runDays:Number(f.elements.runDays.value),rideDays:Number(f.elements.rideDays.value),swimDays:Number(f.elements.swimDays.value)});
  refreshDerivedCoachViews();
}
function initializeRollingCoach(){
  const form=document.getElementById("rollingCoachSettings");
  if(form){const s=rollingCoachSettings();for(const [k,v] of Object.entries(s))if(form.elements[k])form.elements[k].value=String(v);form.addEventListener("submit",rollingCoachSaveSettings);}
  window.addEventListener("storage",event=>{
    if(event.key&&(event.key.startsWith("jp_")||event.key===STORAGE_KEY||event.key===DONE_KEY||event.key===UPLOAD_KEY)){
      rollingCoachStale=true;autoWeekReplanReady=false;renderRollingCoach();
    }
  });
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")requestRollingCoachUpdate();});
  setInterval(()=>{if(document.visibilityState==="visible")requestRollingCoachUpdate();},60000);
}
