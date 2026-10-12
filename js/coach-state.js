// UI and persistent evidence for the existing daily decision / central week engine.
// This module does not generate an independent calendar.
const RECOVERY_CHECK_KEY="jp_recovery_checks_v1";
const COACH_HISTORY_KEY="jp_coach_history_v1";
const EXPORT_ATTEMPTS_KEY="jp_export_attempts_v1";

function recordCoachChange(kind,record){
  const stored=loadObject(COACH_HISTORY_KEY);
  const entries=Array.isArray(stored.entries)?stored.entries:[];
  entries.push({kind,...record,createdAt:new Date().toISOString()});
  saveObject(COACH_HISTORY_KEY,{entries:entries.slice(-100)});
}

function dailyRecoveryEvidence(date=todayDateString()){
  const entry=loadObject(RECOVERY_CHECK_KEY)[date];
  if(!entry) return null;
  const valid=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max?v:null;
  const sleep=valid(entry.sleepHours,0,24),energy=valid(entry.energy,1,5);
  const legs=valid(entry.legs,1,5),pain=valid(entry.complaintSeverity,0,3);
  const flags=[sleep!==null&&sleep<6,energy!==null&&energy<=2,legs!==null&&legs>=4].filter(Boolean).length;
  const known=[sleep,energy,legs,pain].filter(v=>v!==null).length;
  return {date,energy,legs,complaintSeverity:pain,sleepHours:sleep,
    level:pain>=2?"elevated":flags>=2||pain===1?"attention":known?"stable":"unknown",
    complaint:pain>=2,reason:pain>=2?"duidelijke klachten bij de herstelcheck":flags>=2?"meerdere ongunstige signalen bij de herstelcheck":pain===1?"lichte klachten bij de herstelcheck":"",
    known,flags};
}

function renderRecoveryCheck(){
  const host=document.getElementById("dailyRecoveryCheck");
  if(!host || host.contains(document.activeElement)) return;
  const entry=loadObject(RECOVERY_CHECK_KEY)[todayDateString()]||{};
  const options=(name,label,min,max)=>`<label>${label}<select name="${name}"><option value="">Onbekend</option>${Array.from({length:max-min+1},(_,i)=>i+min).map(n=>`<option value="${n}"${entry[name]===n?" selected":""}>${n}</option>`).join("")}</select></label>`;
  host.innerHTML=`<summary>Hoe herstel je vandaag? · optioneel${entry.savedAt?" · opgeslagen":""}</summary>
    <form id="recoveryCheckForm"><div class="form-grid">
      <label>Slaap (uren)<input name="sleepHours" type="number" inputmode="decimal" min="0" max="24" step="0.5" value="${safe(entry.sleepHours??"")}"></label>
      ${options("energy","Energie · 1 laag, 5 hoog",1,5)}
      ${options("legs","Spiervermoeidheid · 1 licht, 5 zwaar",1,5)}
      ${options("complaintSeverity","Klachten · 0 geen, 3 sterk",0,3)}
    </div><p class="help">Lege velden blijven onbekend. Eén afwijkende slaap- of vermoeidheidswaarde verandert je week niet meteen.</p>
    <button type="submit">Herstelcheck opslaan</button><p id="recoveryCheckStatus" role="status"></p></form>`;
  host.querySelector("form").addEventListener("submit",event=>{
    event.preventDefault();
    const values={};
    for(const [name,min,max] of [["sleepHours",0,24],["energy",1,5],["legs",1,5],["complaintSeverity",0,3]]){
      const raw=event.target.elements[name].value;
      const value=raw===""?null:Number(raw);
      if(value!==null&&(!Number.isFinite(value)||value<min||value>max)) return;
      values[name]=value;
    }
    const checks=loadObject(RECOVERY_CHECK_KEY);
    checks[todayDateString()]={...values,savedAt:new Date().toISOString()};
    saveObject(RECOVERY_CHECK_KEY,checks);
    refreshDerivedCoachViews();
    document.getElementById("recoveryCheckStatus").textContent="Opgeslagen. Dagadvies en weekplanning zijn opnieuw beoordeeld.";
  });
}

function renderCoachHistory(){
  const host=document.getElementById("coachChangeHistory");
  if(!host) return;
  const records=loadObject(COACH_HISTORY_KEY).entries||[];
  host.innerHTML=records.slice(-20).reverse().map(record=>`<div class="status"><strong>${safe(new Date(record.createdAt).toLocaleString("nl-NL"))} · ${safe(({week:"Week aangepast",undo:"Teruggezet",lock:"Vastzetten",link:"Koppeling gecorrigeerd"})[record.kind]||record.kind)}</strong>
    ${(record.changes||[]).map(c=>`<p>${safe(c.date)}: ${safe(c.beforeSnapshot?.name||"Vrij")} → ${safe(c.afterSnapshot?.name||"Vrij")}<br>${safe(c.reason||"")}</p>`).join("")}
    ${record.reason?`<p>${safe(record.reason)}</p>`:""}</div>`).join("")||'<p class="help">Nog geen wijzigingen vastgelegd.</p>';
}

function toggleWorkoutLock(date){
  const workout=allWorkouts()[date];
  if(!workout||workout.type==="Race"||workoutWasCompleted(date,workout)) return;
  customWorkouts[date]={...workout,locked:!workout.locked};
  saveObject(STORAGE_KEY,customWorkouts);
  recordCoachChange("lock",{reason:`${date} · ${workout.name}: ${workout.locked?"vrijgegeven":"vastgezet"}`});
  refreshAfterCalendarMutation();
}

function exportStateText(date,workout){
  const stored=loadObject(EXPORT_ATTEMPTS_KEY)[date];
  const attempt=stored?.fingerprint===workoutUploadFingerprint(workout)?stored:null;
  if(attempt?.state==="failed") return `Export mislukt: ${attempt.error}. Probeer opnieuw; dezelfde Intervals-identiteit wordt bijgewerkt.`;
  if(attempt?.state==="pending") return "Export nog niet bevestigd. Je kunt dezelfde training opnieuw versturen.";
  if(workoutUploadIsCurrent(date,workout)) return "Succesvol opgeslagen in Intervals.icu. Ontvangst op je horloge is niet bevestigd.";
  return uploadedWorkouts[date]?"Lokaal gewijzigd; Intervals.icu is nog niet bijgewerkt.":"Alleen lokaal opgeslagen.";
}

function renderTodayPurpose(){
  const host=document.getElementById("todayTrainingPurpose");
  if(!host) return;
  const workout=allWorkouts()[todayDateString()];
  if(!workout||workout.type==="Rest"){host.textContent="Vandaag is er ruimte voor herstel.";return;}
  const purpose=workout.type==="Race"?"Wedstrijddag":isHardWorkout(workout)?"Wedstrijdspecifieke snelheid en uithoudingsvermogen":isLongWorkout(workout)?"Duurvermogen opbouwen":"Rustige aerobe belasting en herstelruimte";
  const minutes=finiteNumberOrNull(workout.durationMinutes);
  host.innerHTML=`<strong>Doel: ${safe(purpose)}</strong><p>${minutes!==null?`${safe(minutes)} minuten`:`Tijdsduur niet vastgelegd · ${safe(trainingVolumeLabel(workout))}`} · ${safe(workout.replanReason||"Past in het bestaande schema richting je wedstrijddoel. Het dagadvies hieronder weegt herstel en beschikbaarheid mee.")}</p><p class="help">${safe(exportStateText(todayDateString(),workout))}</p>
    ${workout.type!=="Race"&&!workoutWasCompleted(todayDateString(),workout)?'<button type="button" class="secondary" onclick="openTodayTimeAlternative()">Ik heb minder tijd</button>':""}`;
}

function openTodayTimeAlternative(){
  // Update the same availability input used by the daily decision engine.
  if(typeof openWeeklyAvailabilityEditor==="function") openWeeklyAvailabilityEditor();
  else {
    const button=document.getElementById("editTodayWeekAvailability");
    if(button) button.click();
  }
}

function renderResultMatchCorrection(activity){
  const assignment=assignmentForActivity(activity.id);
  const used=new Set(Object.values(activityPlanAssignments).filter(a=>a.activityId!==activity.id&&a.status!=="extra").map(a=>`${a.workoutDate}|${a.workoutIdentity}`));
  const candidates=activityPlanCandidates(activity,{excludeWorkoutKeys:used});
  const current=assignment&&assignment.status!=="extra"?`${assignment.workoutDate}|${assignment.workoutIdentity}`:"extra";
  return `<details class="activity-result-more"><summary>Koppeling controleren · ${safe(assignment?.confidence|| (assignment?.source==="manual"?"bevestigd":"onbekend"))}</summary>
    <p class="help">${safe(assignment?.reason||"Nog geen zekere koppeling")}</p>
    <label>Uitgevoerde training<select id="resultMatchChoice">
      ${assignment?.workoutSnapshot&&!candidates.some(c=>c.key===current)?`<option value="${safe(current)}">${safe(assignment.workoutDate)} · ${safe(assignment.workoutSnapshot.name)} (bewaarde planning)</option>`:""}
      ${candidates.map(c=>`<option value="${safe(c.key)}"${c.key===current?" selected":""}>${safe(c.date)} · ${safe(c.workout.name)}</option>`).join("")}
      <option value="extra"${current==="extra"?" selected":""}>Extra training</option>
    </select></label><button type="button" id="saveResultMatch">Koppeling opslaan</button></details>`;
}

function correctResultMatch(activityId){
  const activity=syncedActivities[activityId];
  const choice=document.getElementById("resultMatchChoice")?.value;
  if(!activity||!choice) return;
  const previous=assignmentForActivity(activityId);
  if(choice===`${previous?.workoutDate}|${previous?.workoutIdentity}`) return;
  const used=new Set(Object.values(activityPlanAssignments).filter(a=>a.activityId!==activityId&&a.status!=="extra").map(a=>`${a.workoutDate}|${a.workoutIdentity}`));
  const candidate=activityPlanCandidates(activity,{excludeWorkoutKeys:used}).find(c=>c.key===choice);
  if(choice!=="extra"&&!candidate) return;
  activityPlanAssignments[activityId]=makeActivityAssignment(activity,candidate||null,{source:"manual",status:choice==="extra"?"extra":null,reason:"Door jou gecorrigeerd bij het resultaat."});
  saveActivityPlanAssignments();
  reconcileSyncedCompletions({oldest:activitySyncMeta.oldest,newest:activitySyncMeta.newest});
  recordCoachChange("link",{reason:`${activity.name}: ${previous?.workoutSnapshot?.name||"extra"} → ${candidate?.workout.name||"extra"}. Eerdere kalenderwijzigingen blijven in de historie.`});
  refreshAfterCalendarMutation();
  renderActivityResultDetail(activity);
}
