/* Recurring supplementary sessions: never replace a calendar workout. */
const SUPPORT_SETTINGS_KEY="jp_support_settings_v1";
const SUPPORT_DONE_KEY="jp_support_done_v1";
const SUPPORT_SKIP_KEY="jp_support_skip_v1";
const SUPPORT_UPLOAD_KEY="jp_support_upload_v1";
const SUPPORT_ACTIVE_KEY="jaco_support_active_v1";
const supportEscape=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let supportPlayer=null;
let supportClock=null;
let supportReturnFocus=null;
let supportToastTimer=null;
const supportExportPending=new Set();
const SUPPORT_ROUTINES={
  strength:{name:"Kracht voor hardlopers",minutes:22,rounds:2,exercises:[
    ["Squat","10 herhalingen","Zak rustig, houd je voeten op de grond en kom gecontroleerd omhoog."],
    ["Achterwaartse lunge","8 per been","Stap naar achteren; houd je voorste knie in lijn met je voet. Gebruik zo nodig een muur voor balans."],
    ["Heupbrug","12 herhalingen","Lig op je rug, knieën gebogen. Til je heupen op zonder je onderrug te overstrekken."],
    ["Kuitheffen","12 herhalingen","Sta op beide voeten op een vlakke vloer. Kom langzaam omhoog en zak beheerst terug."],
    ["Dead bug","8 per zijde","Beweeg arm en tegenovergesteld been rustig weg; houd je onderrug stabiel."],
    ["Zijplank op knieën","20 seconden per zijde","Steun op onderarm en knieën en houd romp en heupen in één lijn."]
  ]},
  mobility:{name:"Mobiliteit & herstel",minutes:9,rounds:1,exercises:[
    ["Enkelmobiliteit","60 seconden per zijde","Beweeg je knie rustig naar voren terwijl je hiel op de vloer blijft."],
    ["90/90 heuprotatie","90 seconden","Wissel zittend rustig tussen beide kanten; help met je handen waar nodig."],
    ["Bovenrugrotatie","60 seconden per zijde","Lig op je zij met gebogen knieën en draai je bovenste arm rustig open."],
    ["Dynamische hamstring","45 seconden per zijde","Beweeg vanuit je heup met een lange rug, zonder te veren of te forceren."],
    ["Rustige ademhaling","2 minuten","Adem ontspannen en laat je schouders zakken."]
  ]}
};

function supportSettings(){
  const raw=loadObject(SUPPORT_SETTINGS_KEY);
  const days=(key,fallback)=>Array.isArray(raw[key])
    ?[...new Set(raw[key].filter(n=>Number.isInteger(n)&&n>=0&&n<=6))]
    :fallback;
  return {enabled:raw.enabled!==false,strength:days("strength",[2,6]),mobility:days("mobility",[1,4,5]),
    level:["start","standard","extended"].includes(raw.level)?raw.level:"standard",
    autoPlace:raw.autoPlace!==false};
}

function validateSupportBackup(key,value){
  if([SUPPORT_SKIP_KEY,SUPPORT_UPLOAD_KEY].includes(key)){
    for(const [id,entry] of Object.entries(value)){
      const [date,kind]=id.split(":");
      if(id!==`${date}:${kind}` || !Object.hasOwn(SUPPORT_ROUTINES,kind) || calendarDayNumber(date)===null || !entry || typeof entry!=="object" || Array.isArray(entry)) throw new Error("Ongeldige aanvullende sessie in backup.");
      for(const field of ["skippedAt","exportedAt","externalId"]){
        if(entry[field]!==undefined && typeof entry[field]!=="string") throw new Error("Ongeldige sessiemetadata.");
      }
    }
    return;
  }
  if(key===SUPPORT_SETTINGS_KEY){
    if(typeof value.enabled!=="boolean" || ["strength","mobility"].some(kind=>
      !Array.isArray(value[kind]) || value[kind].some(day=>!Number.isInteger(day)||day<0||day>6)
    )) throw new Error("Ongeldige kracht- en mobiliteitsinstellingen in backup.");
    if(value.level!==undefined && !["start","standard","extended"].includes(value.level)) throw new Error("Ongeldig krachtniveau.");
    if(value.autoPlace!==undefined && typeof value.autoPlace!=="boolean") throw new Error("Ongeldige planningsinstelling.");
    return;
  }
  for(const [id,entry] of Object.entries(value)){
    const [date,kind]=id.split(":");
    const r=entry?.routine;
    if(id!==`${date}:${kind}` || !Object.hasOwn(SUPPORT_ROUTINES,kind) || calendarDayNumber(date)===null ||
      entry?.done!==true || !r || typeof r.name!=="string" ||
      !Number.isFinite(r.minutes) || r.minutes<=0 || r.minutes>90 ||
      !Number.isInteger(r.rounds) || r.rounds<1 || r.rounds>5 ||
      !Array.isArray(r.exercises) || r.exercises.length<1 || r.exercises.length>20 ||
      r.exercises.some(e=>!Array.isArray(e)||e.length!==3||e.some(v=>typeof v!=="string"))
    ) throw new Error("Ongeldige voltooide kracht- of mobiliteitssessie in backup.");
    for(const field of ["actualMinutes","rpe","pain"]){
      if(entry[field]!==undefined && entry[field]!==null && typeof entry[field]!=="number") throw new Error("Ongeldige numerieke sessiefeedback.");
    }
    if(entry.rpe!=null && (!Number.isInteger(entry.rpe)||entry.rpe<1||entry.rpe>10)) throw new Error("Ongeldige RPE.");
    if(entry.pain!=null && ![0,1,2,3].includes(entry.pain)) throw new Error("Ongeldige klachtenscore.");
    if(entry.completion!==undefined && !["partial","complete"].includes(entry.completion)) throw new Error("Ongeldige uitvoering.");
    if(entry.actualMinutes!==undefined) supportFeedback(entry.actualMinutes,entry.rpe,entry.pain,entry.note,entry.completion);
    if(entry.note!==undefined && typeof entry.note!=="string") throw new Error("Ongeldige sessienotitie.");
  }
}

function supportSessionsForDate(date,settings,workouts,raceList,availability){
  const index=(new Date(date+"T12:00:00").getDay()+6)%7;
  const sessions=[];
  let remaining=Number(availability[DAY_KEYS[index]]?.maxMinutes)||0;
  const main=workouts[date];
  if(main && main.type!=="Rest"){
    remaining-=typeof estimatedWorkoutMinutes==="function"?estimatedWorkoutMinutes(main):(Number(main.durationMinutes)||workoutDurationEstimate(main.planType||"easy",Number(main.distanceKm)||0));
  }
  for(const kind of ["strength","mobility"]){
    const saved=loadObject(SUPPORT_DONE_KEY)[`${date}:${kind}`];
    if(saved?.done && saved.routine){
      sessions.push({date,kind,routine:saved.routine,done:true,reason:""});
      remaining-=Number(saved.routine.minutes)||0;
      continue;
    }
    if(!settings.enabled || !settings[kind].includes(index)) continue;
    const routine=supportRoutine(kind,settings,date);
    let reason="";
    const raceDay=raceList.some(r=>r.date===date)||main?.type==="Race";
    const nearbyRace=[-2,-1,1,2].some(offset=>{
      const d=addDays(date,offset);
      return workouts[d]?.type==="Race" || raceList.some(r=>r.date===d);
    });
    const next=workouts[addDays(date,1)];
    const previous=workouts[addDays(date,-1)];
    const nextHard=next && (typeof isHardWorkout==="function"?isHardWorkout(next):["long","quality","threshold","interval","vo2"].includes(next.planType));
    const previousLong=previous && (typeof isLongWorkout==="function"?isLongWorkout(previous):previous.planType==="long");
    if((kind==="strength" && ["Strength","Core"].includes(main?.type)) || (kind==="mobility" && main?.type==="Mobility")) reason="Dit onderdeel staat al als hoofdtraining gepland.";
    else if(raceDay) reason="Wedstrijddag: geen aanvullende sessie.";
    else if(kind==="strength" && nearbyRace) reason="Rond je wedstrijd: kracht overslaan.";
    else if(kind==="strength" && (nextHard || next?.planType==="long")) reason="Morgen een lange of intensieve training: kracht overslaan.";
    else if(kind==="strength" && [-1,1].some(offset=>{
      const adjacent=addDays(date,offset);
      return ["Core","Strength"].includes(workouts[adjacent]?.type) || loadObject(SUPPORT_DONE_KEY)[`${adjacent}:strength`]?.done;
    })) reason="Minimaal één dag tussen krachtsessies.";
    else if(kind==="strength" && previousLong) reason="Herstel na je lange duurloop: kracht overslaan.";
    else if(kind==="strength" && date===todayDateString() && supportRecoveryBlocked()) reason="Actueel herstel of klachten: vandaag geen extra kracht.";
    else if(loadObject(SUPPORT_SKIP_KEY)[`${date}:${kind}`]) reason="Door jou overgeslagen.";
    else if(!availability[DAY_KEYS[index]]?.available) reason="Deze dag is niet beschikbaar in je weekplanning.";
    else if(remaining<routine.minutes) reason="Onvoldoende tijd naast je hoofdtraining; pas dagen of beschikbare minuten aan.";
    if(!reason) remaining-=routine.minutes;
    sessions.push({date,kind,routine,done:false,reason});
  }
  return sessions;
}

function supportRoutine(kind,settings,date){
  const routine=JSON.parse(JSON.stringify(SUPPORT_ROUTINES[kind]));
  if(kind==="strength"){
    routine.rounds=settings.level==="start"?1:settings.level==="extended"?3:2;
    routine.minutes=2+routine.rounds*10;
    const variant=(new Date(date+"T12:00:00").getDay()+6)%7>=4;
    routine.name+=variant?" · B (stabiliteit)":" · A (basis)";
    if(variant){
      routine.exercises[0]=["Heupscharnier","10 herhalingen","Duw je heupen naar achteren met licht gebogen knieën en een lange rug. Kom rustig rechtop."];
      routine.exercises[4]=["Bird dog","8 per zijde","Strek vanuit handen en knieën een arm en het tegenovergestelde been. Houd je bekken stil."];
    }
  }
  return routine;
}

function supportRecoveryBlocked(){
  const recent=supportCompletedEntries(0,2).some(s=>Number(s.entry.pain)>0);
  const diary=typeof buildDiaryContext==="function"?buildDiaryContext():null;
  const recovery=typeof determineReadiness==="function" && typeof getWellnessSnapshot==="function"
    ?determineReadiness(getWellnessSnapshot()):null;
  return recent || diary?.level==="elevated" || (recovery?.sufficientData && recovery.level==="low");
}

function supportWeekPlan(anchor){
  const index=(new Date(anchor+"T12:00:00").getDay()+6)%7;
  const monday=addDays(anchor,-index);
  const dates=Array.from({length:7},(_,i)=>addDays(monday,i));
  const settings=supportSettings(),workouts=allWorkouts(),raceList=Object.values(races);
  const availability={...defaultAvailability(),...(getProfile().availability||{})};
  const plan=Object.fromEntries(dates.map(date=>[date,supportSessionsForDate(date,settings,workouts,raceList,availability)]));
  // Fixed mode still prevents consecutive heavy supplementary days.
  const accepted=[addDays(monday,-1),addDays(monday,7)].filter(date=>
    supportSessionsForDate(date,settings,workouts,raceList,availability).some(s=>s.kind==="strength"&&!s.reason));
  const outsideStrength=[...accepted];
  for(const date of dates){
    const session=plan[date].find(s=>s.kind==="strength");
    const adjacent=accepted.some(d=>Math.abs(calendarDayDifference(date,d))<2);
    if(session && !session.reason && !session.done && adjacent) session.reason="Minimaal één dag tussen krachtsessies.";
    if(session && !session.reason) accepted.push(date);
  }
  if(!settings.autoPlace || !settings.enabled) return plan;
  for(const kind of ["strength","mobility"]){
    for(const from of dates){
      const blocked=plan[from].find(s=>s.kind===kind && s.reason && !s.done);
      if(!blocked || from<todayDateString() || loadObject(SUPPORT_SKIP_KEY)[`${from}:${kind}`]) continue;
      for(const date of dates){
        if(date<todayDateString() || plan[date].some(s=>s.kind===kind) || loadObject(SUPPORT_SKIP_KEY)[`${date}:${kind}`]) continue;
        if(kind==="strength" && (outsideStrength.some(d=>Math.abs(calendarDayDifference(date,d))<2) || dates.some(d=>plan[d].some(s=>s.kind===kind&&!s.reason)&&Math.abs(calendarDayDifference(date,d))<2))) continue;
        const day=(new Date(date+"T12:00:00").getDay()+6)%7;
        const trial={...settings,[kind]:[day]};
        // Budget includes any session already allocated on the alternative day.
        const used=plan[date].filter(s=>!s.reason).reduce((n,s)=>n+s.routine.minutes,0);
        const dayKey=DAY_KEYS[day];
        const adjusted={...availability,[dayKey]:{...availability[dayKey],maxMinutes:Math.max(0,Number(availability[dayKey]?.maxMinutes||0)-used)}};
        trial[kind==="strength"?"mobility":"strength"]=[];
        const candidate=supportSessionsForDate(date,trial,workouts,raceList,adjusted).find(s=>s.kind===kind);
        if(!candidate || candidate.reason) continue;
        plan[from]=plan[from].filter(s=>s!==blocked);
        candidate.movedFrom=from;
        plan[date].push(candidate);
        break;
      }
    }
  }
  return plan;
}

function currentSupportSessions(date){return supportWeekPlan(date)[date]||[];}

function supportSessionMarkup(session){
  const {date,kind,routine,done,reason}=session;
  const escape=supportEscape;
  const exercises=Array.isArray(routine.exercises)?routine.exercises:[];
  const exported=loadObject(SUPPORT_UPLOAD_KEY)[`${date}:${kind}`];
  return `<div class="support-session ${done?"is-done":reason?"is-blocked":""}">
    <div class="support-session-head"><span class="pill">${kind==="strength"?"KRACHT":"MOBILITEIT"}</span><span>${done?"✓ Voltooid":reason?"Overgeslagen":"Gepland"}</span></div>
    <h3>${escape(routine.name)}</h3><p class="help">±${escape(routine.minutes)} min · ${escape(routine.rounds)} ronde(n) · Geen materiaal</p>
    ${session.movedFrom?`<p class="help">Verplaatst vanaf ${escape(session.movedFrom)} naar een passende dag.</p>`:""}
    ${reason?`<p class="support-notice">${escape(reason)}</p>`:""}
    <details><summary>Oefeningen en uitvoering</summary>
      <p class="help">${kind==="strength"?"2 minuten rustig opwarmen. Neem 30–45 seconden rust tussen oefeningen en 60 seconden tussen rondes. Houd 2–3 herhalingen over; kies Start als dit nieuw is.":"Beweeg rustig binnen een comfortabele bewegingsuitslag."} Stop bij pijn.</p>
      <ol>${exercises.map(e=>`<li><strong>${escape(e[0])} — ${escape(e[1])}</strong><p class="help">${escape(e[2])}</p></li>`).join("")}</ol>
    </details>
    <div class="support-actions">
    ${!reason&&!done&&date===todayDateString()?`<button type="button" onclick="openSupportPlayer('${date}','${kind}')">Start begeleide sessie</button>`:""}
    ${!reason&&date<=todayDateString()?`<button type="button" class="secondary" onclick="toggleSupportCompletion('${date}','${kind}')">${done?"Bekijk / wijzig logboek":"Al gedaan? Registreer"}</button>`:""}
    ${!reason&&!done?`<button type="button" class="secondary" onclick="skipSupportSession('${date}','${kind}')">Sla deze sessie over</button>`:""}
    ${loadObject(SUPPORT_SKIP_KEY)[`${date}:${kind}`]?`<button type="button" class="secondary" onclick="skipSupportSession('${date}','${kind}',true)">Weer inplannen</button>`:""}
    ${!reason?`<button type="button" class="secondary" onclick="downloadSupportRecipe('${date}','${kind}')">Download recept</button>
      <button type="button" class="secondary" onclick="exportSupportSession('${date}','${kind}')">${exported?"Bijwerken":"Exporteren"} naar Intervals.icu</button>`:""}
    </div>${exported?`<small>Laatste export: ${escape(exported.exportedAt?.slice(0,10))}. Wijzigingen worden pas na opnieuw exporteren verstuurd.</small>`:""}
    </div>`;
}

function toggleSupportCompletion(date,kind){
  const session=currentSupportSessions(date).find(s=>s.kind===kind);
  if(!session || session.reason || date>todayDateString()) return;
  openSupportLog(session);
}

function skipSupportSession(date,kind,undo=false){
  if(!Object.hasOwn(SUPPORT_ROUTINES,kind) || calendarDayNumber(date)===null) return;
  const skips=loadObject(SUPPORT_SKIP_KEY);
  if(undo) delete skips[`${date}:${kind}`];
  else skips[`${date}:${kind}`]={skippedAt:new Date().toISOString()};
  try{saveObject(SUPPORT_SKIP_KEY,skips);renderSupportTraining();}
  catch{alert("Opslaan mislukt. Je planning is niet gewijzigd.");}
}

function saveSupportSettings(event){
  event.preventDefault();
  const settings={enabled:document.getElementById("supportEnabled").checked,
    autoPlace:document.getElementById("supportAutoPlace").checked,
    level:document.getElementById("supportLevel").value};
  for(const kind of ["strength","mobility"]){
    settings[kind]=DAY_KEYS.flatMap((key,i)=>document.getElementById(`support-${kind}-${key}`).checked?[i]:[]);
  }
  const status=document.getElementById("supportSettingsStatus");
  try{
    saveObject(SUPPORT_SETTINGS_KEY,settings);
    renderSupportTraining();
    status.textContent="Opgeslagen. Je voorkeuren keren wekelijks terug. Bekijk hieronder de passende dagen en eventuele tekorten.";
  }catch{status.textContent="Opslaan mislukt. Probeer opnieuw; controleer je beschikbare opslagruimte.";}
}

function renderSupportSettings(){
  const settings=supportSettings();
  const form=document.getElementById("supportSettingsForm");
  form.innerHTML=`<label class="switchrow"><span>Iedere week kracht en mobiliteit meenemen</span><input id="supportEnabled" type="checkbox" ${settings.enabled?"checked":""}></label>
    <div class="grid2"><label>Krachtniveau<select id="supportLevel">${[["start","Start · 1 ronde · ±12 min"],["standard","Basis · 2 rondes · ±22 min"],["extended","Uitgebreid · 3 rondes · ±32 min"]].map(([v,l])=>`<option value="${v}" ${settings.level===v?"selected":""}>${l}</option>`).join("")}</select></label>
    <label class="switchrow"><span>Zoek een alternatief binnen dezelfde week</span><input id="supportAutoPlace" type="checkbox" ${settings.autoPlace?"checked":""}></label></div>
    <p class="help">Verhoog je niveau zelf als de huidige sessies goed gaan. De app verhoogt je belasting nooit automatisch.</p>
    ${["strength","mobility"].map(kind=>`<fieldset class="support-days"><legend>${kind==="strength"?"Kracht (standaard 2× per week)":"Mobiliteit (standaard 3× per week)"}</legend>
      ${DAY_KEYS.map((key,i)=>`<label class="switchrow"><span>${DAY_NAMES[i]}</span><input type="checkbox" id="support-${kind}-${key}" ${settings[kind].includes(i)?"checked":""}></label>`).join("")}</fieldset>`).join("")}
    <button type="submit">Kracht en mobiliteit opslaan</button>`;
  form.onsubmit=saveSupportSettings;
}

function renderSupportTraining(){
  renderSupportHistory();
  const resume=document.getElementById("supportResume");
  if(resume) resume.hidden=!supportPlayer;
  for(const [id,date] of [["supportToday",todayDateString()],["supportCalendar",selectedDate]]){
    const element=document.getElementById(id);
    if(element) element.innerHTML=currentSupportSessions(date).map(supportSessionMarkup).join("")||'<p class="help">Geen aanvullende sessie gepland.</p>';
  }
  const week=document.getElementById("supportWeek");
  if(week){
    const anchor=document.getElementById("supportWeekDate").value||todayDateString();
    const index=(new Date(anchor+"T12:00:00").getDay()+6)%7;
    const monday=addDays(anchor,-index);
    const weekPlan=supportWeekPlan(monday);
    const flat=Object.values(weekPlan).flat();
    const planned=flat.filter(s=>!s.reason);
    const settings=supportSettings();
    const target=settings.enabled?settings.strength.length+settings.mobility.length:0;
    week.innerHTML=`<div class="support-summary"><strong>${planned.length} / ${target} sessies passend</strong><span>${planned.reduce((n,s)=>n+s.routine.minutes,0)} min gepland · ${planned.filter(s=>s.done).length} voltooid</span></div>`+Array.from({length:7},(_,i)=>{
      const date=addDays(monday,i);
      return `<h3>${DAY_NAMES[i]} · ${date}</h3>`+((weekPlan[date]||[]).map(supportSessionMarkup).join("")||'<p class="help">Geen aanvullende sessie.</p>');
    }).join("");
  }
}

document.addEventListener("DOMContentLoaded",()=>{
  document.getElementById("supportWeekDate").value=todayDateString();
  document.getElementById("supportWeekDate").onchange=renderSupportTraining;
  const dialog=supportDialog();
  dialog.addEventListener("cancel",()=>pauseSupportPlayer());
  dialog.addEventListener("close",()=>{pauseSupportPlayer();if(supportReturnFocus?.isConnected && !supportReturnFocus.disabled) supportReturnFocus.focus();});
  try{
    const stored=JSON.parse(sessionStorage.getItem(SUPPORT_ACTIVE_KEY)||"null");
    if(stored && calendarDayNumber(stored.date)!==null && Object.hasOwn(SUPPORT_ROUTINES,stored.kind) && stored.date<=todayDateString()){
      validateSupportBackup(SUPPORT_DONE_KEY,{[`${stored.date}:${stored.kind}`]:{done:true,routine:stored.routine}});
      if(Number.isFinite(stored.elapsedMs) && stored.elapsedMs>=0 && Number.isInteger(stored.index) && stored.index>=0 && stored.index<supportSequence(stored.routine).length){
        // Reopening always resumes paused; time outside the page is not invented.
        supportPlayer={...stored,resumedAt:null,restUntil:null};
      }
    }
  }catch{supportToast("Bewaarde sessie kon niet worden hervat. Start opnieuw; je voltooide sessies zijn behouden.");}
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="hidden" && supportPlayer){
      const elapsed=supportElapsedMs();
      supportPlayer.elapsedMs=elapsed;
      if(supportPlayer.resumedAt) supportPlayer.resumedAt=Date.now();
      saveSupportPlayer();
    }
  });
  renderSupportSettings();
  renderSupportTraining();
});

function supportCompletedEntries(minAge=0,maxAge=27){
  return Object.entries(loadObject(SUPPORT_DONE_KEY)).flatMap(([id,entry])=>{
    const [date,kind]=id.split(":");
    const age=calendarDayDifference(todayDateString(),date);
    if(age===null || age<minAge || age>maxAge || !entry?.done || !SUPPORT_ROUTINES[kind] || !entry.routine) return [];
    return [{id,date,kind,entry,workout:{type:kind==="strength"?"Strength":"Mobility",name:entry.routine.name,
      durationMinutes:finiteNumberOrNull(entry.actualMinutes),distanceKm:0,status:"done",supplementary:true}}];
  }).sort((a,b)=>b.date.localeCompare(a.date));
}

function supportLoadSummary(days=7){
  const entries=supportCompletedEntries(0,days-1);
  const measured=entries.filter(s=>finiteNumberOrNull(s.entry.actualMinutes)!==null);
  const withRpe=measured.filter(s=>finiteNumberOrNull(s.entry.rpe)!==null);
  return {count:entries.length,measuredCount:measured.length,rpeCount:withRpe.length,
    minutes:measured.reduce((n,s)=>n+Number(s.entry.actualMinutes),0),
    load:withRpe.length?withRpe.reduce((n,s)=>n+s.entry.actualMinutes*s.entry.rpe,0):null,
    recentPain:supportCompletedEntries(0,2).some(s=>Number(s.entry.pain)>0),
    recentHard:supportCompletedEntries(0,1).some(s=>s.kind==="strength" && Number(s.entry.rpe)>=8)};
}

function renderSupportHistory(date=null){
  const entries=supportCompletedEntries(0,365).filter(s=>!date || s.date===date);
  const summary=supportLoadSummary();
  for(const id of ["supportHistory","supportDiary"]){
    const element=document.getElementById(id);
    if(!element) continue;
    element.innerHTML=`<div class="support-summary"><strong>${summary.count} sessies in 7 dagen</strong><span>${summary.measuredCount?`${Math.round(summary.minutes)} min geregistreerd`:"Duur nog niet geregistreerd"}</span></div>
      <p class="help">${summary.rpeCount?`${Math.round(summary.load)} sRPE-eenheden (${summary.rpeCount}/${summary.count} sessies met duur én RPE).`:"sRPE onbekend: vul werkelijke duur en RPE in."} sRPE = minuten × ervaren zwaarte. Dit staat los van Intervals.icu CTL/ATL en wordt daar niet bij opgeteld.</p>
      ${entries.slice(0,12).map(s=>`<button class="support-history-row secondary" type="button" onclick="toggleSupportCompletion('${s.date}','${s.kind}')"><strong>${supportEscape(s.entry.routine.name)}</strong><span>${s.date} · ${supportEscape(s.entry.actualMinutes??"—")} min · RPE ${supportEscape(s.entry.rpe??"—")}${s.entry.completion==="partial"?" · gedeeltelijk":""}</span><small>${supportEscape(s.entry.note||"")}${Number(s.entry.pain)>0?" · Klachten geregistreerd":""}</small></button>`).join("")||'<p class="help">Nog geen kracht- of mobiliteitssessies geregistreerd.</p>'}`;
  }
}

function supportDialog(){return document.getElementById("supportDialog");}
function showSupportDialog(){
  const dialog=supportDialog();
  if(!dialog.open){supportReturnFocus=document.activeElement;dialog.showModal();}
}
function closeSupportDialog(){
  pauseSupportPlayer();
  supportDialog().close();
  if(supportReturnFocus?.isConnected && !supportReturnFocus.disabled) supportReturnFocus.focus();
}
function supportToast(text){
  const box=document.getElementById("supportActionStatus");
  box.textContent=text;
  box.hidden=false;
  clearTimeout(supportToastTimer);supportToastTimer=setTimeout(()=>{box.hidden=true;},9000);
}
function supportElapsedMs(){
  if(!supportPlayer) return 0;
  return supportPlayer.elapsedMs+(supportPlayer.resumedAt?Math.max(0,Date.now()-supportPlayer.resumedAt):0);
}
function saveSupportPlayer(){
  try{sessionStorage.setItem(SUPPORT_ACTIVE_KEY,JSON.stringify(supportPlayer));}
  catch{supportToast("Je sessie loopt, maar kan niet worden hervat na herladen: opslag is niet beschikbaar.");}
}
function pauseSupportPlayer(){
  if(!supportPlayer) return;
  supportPlayer.elapsedMs=supportElapsedMs();
  supportPlayer.resumedAt=null;
  if(supportPlayer.restUntil){supportPlayer.restRemaining=Math.max(0,supportPlayer.restUntil-Date.now());supportPlayer.restUntil=null;}
  clearInterval(supportClock);supportClock=null;saveSupportPlayer();
}
function supportSequence(routine){
  return Array.from({length:routine.rounds},(_,i)=>routine.exercises.map(exercise=>({exercise,round:i+1}))).flat();
}
function openSupportPlayer(date,kind){
  const session=currentSupportSessions(date).find(s=>s.kind===kind);
  if(!session || session.reason || session.done || date!==todayDateString()) return;
  if(supportPlayer && (supportPlayer.date!==date || supportPlayer.kind!==kind)){
    supportToast("Er staat nog een sessie klaar. Hervat of beëindig die eerst.");return;
  }
  if(!supportPlayer) supportPlayer={date,kind,routine:JSON.parse(JSON.stringify(session.routine)),index:0,elapsedMs:0,resumedAt:null,restRemaining:0};
  saveSupportPlayer();renderSupportTraining();showSupportDialog();renderSupportPlayer();
}
function resumeSupportPlayer(){
  if(!supportPlayer) return;
  if(supportPlayer.date!==todayDateString()){
    openSupportLog({...supportPlayer,done:false});return;
  }
  showSupportDialog();renderSupportPlayer();
}
function toggleSupportPause(){
  if(!supportPlayer) return;
  if(supportPlayer.resumedAt) pauseSupportPlayer();
  else{
    supportPlayer.resumedAt=Date.now();
    if(supportPlayer.restRemaining>0) supportPlayer.restUntil=Date.now()+supportPlayer.restRemaining;
    supportClock=setInterval(updateSupportClock,500);saveSupportPlayer();
  }
  renderSupportPlayer();
}
function updateSupportClock(){
  const clock=document.getElementById("supportClock");
  if(clock) clock.textContent=formatGuidedElapsed(Math.floor(supportElapsedMs()/1000));
  const rest=document.getElementById("supportRestClock");
  if(rest && supportPlayer){
    const seconds=Math.ceil((supportPlayer.restUntil?Math.max(0,supportPlayer.restUntil-Date.now()):supportPlayer.restRemaining||0)/1000);
    rest.textContent=seconds?`Rust: ${seconds} sec`:"Klaar voor de volgende oefening";
  }
}
function startSupportRest(){
  if(!supportPlayer) return;
  supportPlayer.restRemaining=45000;
  supportPlayer.restUntil=supportPlayer.resumedAt?Date.now()+45000:null;
  saveSupportPlayer();updateSupportClock();
}
function stepSupportPlayer(delta){
  if(!supportPlayer) return;
  const max=supportSequence(supportPlayer.routine).length-1;
  supportPlayer.index=Math.max(0,Math.min(max,supportPlayer.index+delta));
  supportPlayer.restRemaining=0;supportPlayer.restUntil=null;
  saveSupportPlayer();renderSupportPlayer();
}
function renderSupportPlayer(){
  if(!supportPlayer) return;
  const s=supportPlayer,sequence=supportSequence(s.routine),step=sequence[s.index];
  supportDialog().innerHTML=`<div class="support-dialog-top"><p class="label">Begeleide sessie</p><button type="button" class="secondary" onclick="closeSupportDialog()">Sluiten & bewaren</button></div>
    <h2 id="supportDialogTitle">${supportEscape(s.routine.name)}</h2>
    <div class="support-summary"><strong id="supportClock">0:00</strong><span>Ronde ${step.round}/${s.routine.rounds} · Stap ${s.index+1}/${sequence.length}</span></div>
    <progress max="${sequence.length}" value="${s.index}" aria-label="Voortgang oefeningen"></progress>
    <div class="support-exercise" aria-live="polite"><h3>${supportEscape(step.exercise[0])}</h3><strong>${supportEscape(step.exercise[1])}</strong><p>${supportEscape(step.exercise[2])}</p></div>
    <p class="help">Warm eerst 2 minuten rustig op. Volg je eigen tempo; wissel zelf naar de volgende oefening. Stop bij pijn.</p>
    <div class="support-actions"><button id="supportPause" type="button" onclick="toggleSupportPause()">${s.resumedAt?"Pauze":"Start / hervat timer"}</button><button class="secondary" type="button" onclick="startSupportRest()">45 sec rust</button></div><p id="supportRestClock" class="help"></p>
    <div class="support-actions"><button class="secondary" type="button" ${s.index===0?"disabled":""} onclick="stepSupportPlayer(-1)">Vorige</button><button type="button" ${s.index===sequence.length-1?"disabled":""} onclick="stepSupportPlayer(1)">Oefening gedaan →</button></div>
    <button class="secondary" type="button" onclick="finishSupportPlayer()">Afronden & registreren</button>
    <button class="secondary" type="button" onclick="discardSupportPlayer()">Sessie stoppen zonder registratie</button>`;
  updateSupportClock();document.getElementById("supportPause").focus();
}
function discardSupportPlayer(){
  if(!confirm("Deze lopende sessie stoppen zonder hem te registreren?")) return;
  pauseSupportPlayer();supportPlayer=null;sessionStorage.removeItem(SUPPORT_ACTIVE_KEY);closeSupportDialog();renderSupportTraining();
}
function finishSupportPlayer(){
  pauseSupportPlayer();
  openSupportLog({...supportPlayer,done:false},supportElapsedMs()>0?Math.max(0.5,Math.round(supportElapsedMs()/6000)/10):null);
}
let supportLogSession=null;
function openSupportLog(session,measuredMinutes=null){
  pauseSupportPlayer();supportLogSession=JSON.parse(JSON.stringify(session));
  const saved=loadObject(SUPPORT_DONE_KEY)[`${session.date}:${session.kind}`]||{};
  showSupportDialog();
  supportDialog().innerHTML=`<div class="support-dialog-top"><p class="label">Trainingslogboek</p><button type="button" class="secondary" onclick="closeSupportDialog()">Sluiten</button></div><h2 id="supportDialogTitle">${supportEscape(session.routine.name)}</h2><p>${session.date}</p>
    <form id="supportLogForm"><div class="grid2"><label>Werkelijk getraind (minuten)<input id="supportActualMinutes" type="number" min="0.5" max="180" step="0.1" required value="${supportEscape(saved.actualMinutes??measuredMinutes??"")}"></label>
    <label>Ervaren zwaarte (RPE 1–10)<input id="supportActualRpe" type="number" min="1" max="10" step="1" value="${supportEscape(saved.rpe??"")}" placeholder="Onbekend"></label></div>
    <label>Uitvoering<select id="supportCompletion"><option value="complete">Volledige sessie</option><option value="partial" ${saved.completion==="partial"?"selected":""}>Gedeeltelijk gedaan</option></select></label>
    <label>Klachten tijdens de sessie<select id="supportPain"><option value="">Niet ingevuld</option>${[[0,"Geen"],[1,"Licht"],[2,"Duidelijk"],[3,"Gestopt door pijn"]].map(([v,l])=>`<option value="${v}" ${saved.pain===v?"selected":""}>${l}</option>`).join("")}</select></label>
    <label>Notitie<textarea id="supportNote" maxlength="1000" placeholder="Bijvoorbeeld aangepaste oefening, aantal rondes of hoe het voelde">${supportEscape(saved.note||"")}</textarea></label>
    <p class="help">Je looptraining en dagelijkse check-in blijven afzonderlijk bewaard. Ontbrekende RPE wordt niet geschat.</p>
    <p id="supportLogStatus" class="status" role="status"></p><button type="submit">Registratie opslaan</button>
    ${session.done?'<button type="button" class="secondary" onclick="removeSupportLog()">Voltooiing ongedaan maken</button>':""}</form>`;
  document.getElementById("supportLogForm").onsubmit=saveSupportLog;
  document.getElementById("supportActualMinutes").focus();
}
function supportFeedback(minutes,rpe,pain,note,completion){
  const actualMinutes=finiteNumberOrNull(minutes),effort=finiteNumberOrNull(rpe),complaint=finiteNumberOrNull(pain);
  if(actualMinutes===null || actualMinutes<0.5 || actualMinutes>180) throw new Error("Vul een werkelijke duur tussen 0,5 en 180 minuten in.");
  if(effort!==null && (!Number.isInteger(effort)||effort<1||effort>10)) throw new Error("RPE moet tussen 1 en 10 liggen of leeg blijven.");
  if(complaint!==null && (![0,1,2,3].includes(complaint))) throw new Error("Kies een geldige klachtenscore.");
  return {actualMinutes,rpe:effort,pain:complaint,note:String(note||"").slice(0,1000),completion:completion==="partial"?"partial":"complete"};
}
function saveSupportLog(event){
  event.preventDefault();
  const s=supportLogSession;
  if(!s || s.date>todayDateString()) return;
  try{
    const feedback=supportFeedback(document.getElementById("supportActualMinutes").value,document.getElementById("supportActualRpe").value,document.getElementById("supportPain").value,document.getElementById("supportNote").value,document.getElementById("supportCompletion").value);
    const data=loadObject(SUPPORT_DONE_KEY);
    data[`${s.date}:${s.kind}`]={done:true,completedAt:new Date().toISOString(),routine:s.routine,...feedback};
    saveObject(SUPPORT_DONE_KEY,data);
    if(supportPlayer?.date===s.date && supportPlayer?.kind===s.kind){pauseSupportPlayer();supportPlayer=null;sessionStorage.removeItem(SUPPORT_ACTIVE_KEY);}
    closeSupportDialog();refreshDerivedCoachViews();renderSupportTraining();supportToast("Sessie opgeslagen in je kracht- en mobiliteitslogboek.");
  }catch(error){document.getElementById("supportLogStatus").textContent=error.message;}
}
function removeSupportLog(){
  if(!supportLogSession || !confirm("Voltooiing en feedback van deze aanvullende sessie ongedaan maken?")) return;
  const data=loadObject(SUPPORT_DONE_KEY);delete data[`${supportLogSession.date}:${supportLogSession.kind}`];
  try{saveObject(SUPPORT_DONE_KEY,data);closeSupportDialog();refreshDerivedCoachViews();renderSupportTraining();}
  catch(error){document.getElementById("supportLogStatus").textContent=error.message;}
}
function supportRecipeText(session){
  const r=session.routine;
  return `${r.name}\n${session.date} · circa ${r.minutes} minuten · ${r.rounds} ronde(n)\nThuis, zonder materiaal.\n\n`+
    r.exercises.map(e=>`- ${e[0]}: ${e[1]}. ${e[2]}`).join("\n")+
    "\n\nRust: 30–45 sec tussen krachtoefeningen, 60 sec tussen rondes. Mobiliteit: rustige overgangen. Stop bij pijn.";
}
function downloadSupportRecipe(date,kind){
  const s=currentSupportSessions(date).find(s=>s.kind===kind&&!s.reason);if(!s) return;
  const blob=new Blob([supportRecipeText(s)],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`jaco-${kind}-${date}.txt`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function exportSupportSession(date,kind){
  const s=currentSupportSessions(date).find(s=>s.kind===kind&&!s.reason);if(!s) return;
  const id=`${date}:${kind}`;
  if(supportExportPending.has(id)) return;
  supportExportPending.add(id);supportToast("Sessie wordt naar Intervals.icu verstuurd…");
  try{
    const response=await fetchWithAppPin("/api/upload-workout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({customWorkout:{date,name:s.routine.name,type:kind==="strength"?"Strength":"Mobility",supportKind:kind,intervalsDescription:supportRecipeText(s)}})});
    const result=await response.json();if(!response.ok) throw new Error(result.error||"Export mislukt");
    const data=loadObject(SUPPORT_UPLOAD_KEY);data[id]={exportedAt:new Date().toISOString(),externalId:result.externalId,eventId:result.eventId??null};
    try{saveObject(SUPPORT_UPLOAD_KEY,data);}catch{supportToast("Export geslaagd, maar de lokale exportstatus kon niet worden bewaard. Opnieuw exporteren werkt dezelfde sessie bij.");return;}
    renderSupportTraining();supportToast("Gepland in Intervals.icu met eigen sessie-ID; je hoofdtraining is behouden.");
  }catch(error){supportToast(`Export mislukt: ${error.message}`);}
  finally{supportExportPending.delete(id);}
}
