/* Recurring supplementary sessions: never replace a calendar workout. */
const SUPPORT_SETTINGS_KEY="jp_support_settings_v1";
const SUPPORT_DONE_KEY="jp_support_done_v1";
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
  return {enabled:raw.enabled!==false,strength:days("strength",[2,6]),mobility:days("mobility",[1,4,5])};
}

function validateSupportBackup(key,value){
  if(key===SUPPORT_SETTINGS_KEY){
    if(typeof value.enabled!=="boolean" || ["strength","mobility"].some(kind=>
      !Array.isArray(value[kind]) || value[kind].some(day=>!Number.isInteger(day)||day<0||day>6)
    )) throw new Error("Ongeldige kracht- en mobiliteitsinstellingen in backup.");
    return;
  }
  for(const [id,entry] of Object.entries(value)){
    const [date,kind]=id.split(":");
    const r=entry?.routine;
    if(id!==`${date}:${kind}` || !SUPPORT_ROUTINES[kind] || calendarDayNumber(date)===null ||
      entry?.done!==true || !r || typeof r.name!=="string" ||
      !Number.isFinite(r.minutes) || r.minutes<=0 || r.minutes>90 ||
      !Number.isInteger(r.rounds) || r.rounds<1 || r.rounds>5 ||
      !Array.isArray(r.exercises) || r.exercises.length>20 ||
      r.exercises.some(e=>!Array.isArray(e)||e.length!==3||e.some(v=>typeof v!=="string"))
    ) throw new Error("Ongeldige voltooide kracht- of mobiliteitssessie in backup.");
  }
}

function supportSessionsForDate(date,settings,workouts,raceList,availability){
  const index=(new Date(date+"T12:00:00").getDay()+6)%7;
  const sessions=[];
  let remaining=Number(availability[DAY_KEYS[index]]?.maxMinutes)||0;
  const main=workouts[date];
  if(main && main.type!=="Rest"){
    remaining-=Number(main.durationMinutes)||workoutDurationEstimate(main.planType||"easy",Number(main.distanceKm)||0);
  }
  for(const kind of ["strength","mobility"]){
    const saved=loadObject(SUPPORT_DONE_KEY)[`${date}:${kind}`];
    if(saved?.done && saved.routine){
      sessions.push({date,kind,routine:saved.routine,done:true,reason:""});
      remaining-=Number(saved.routine.minutes)||0;
      continue;
    }
    if(!settings.enabled || !settings[kind].includes(index)) continue;
    const routine=SUPPORT_ROUTINES[kind];
    let reason="";
    const raceDay=raceList.some(r=>r.date===date)||main?.type==="Race";
    const nearbyRace=[-2,-1,1,2].some(offset=>{
      const d=addDays(date,offset);
      return workouts[d]?.type==="Race" || raceList.some(r=>r.date===d);
    });
    const next=workouts[addDays(date,1)];
    if((kind==="strength" && ["Strength","Core"].includes(main?.type)) || (kind==="mobility" && main?.type==="Mobility")) reason="Dit onderdeel staat al als hoofdtraining gepland.";
    else if(raceDay) reason="Wedstrijddag: geen aanvullende sessie.";
    else if(kind==="strength" && nearbyRace) reason="Rond je wedstrijd: kracht overslaan.";
    else if(kind==="strength" && ["long","quality","threshold","interval"].includes(next?.planType)) reason="Morgen een lange of intensieve training: kracht overslaan.";
    else if(!availability[DAY_KEYS[index]]?.available) reason="Deze dag is niet beschikbaar in je weekplanning.";
    else if(remaining<routine.minutes) reason="Onvoldoende tijd naast je hoofdtraining; pas dagen of beschikbare minuten aan.";
    if(!reason) remaining-=routine.minutes;
    sessions.push({date,kind,routine,done:false,reason});
  }
  return sessions;
}

function currentSupportSessions(date){
  return supportSessionsForDate(date,supportSettings(),allWorkouts(),Object.values(races),{
    ...defaultAvailability(),...(getProfile().availability||{})
  });
}

function supportSessionMarkup(session){
  const {date,kind,routine,done,reason}=session;
  const escape=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const exercises=Array.isArray(routine.exercises)?routine.exercises:[];
  return `<div class="section"><strong>${escape(routine.name)} · ±${escape(routine.minutes)} min ${done?"✓ Voltooid":""}</strong>
    ${reason?`<p class="help">${escape(reason)}</p>`:""}
    <details><summary>Oefeningen en uitvoering</summary>
      <p class="help">${escape(routine.rounds)} ronde(n). ${kind==="strength"?"Neem 30–45 seconden rust tussen oefeningen en 60 seconden tussen rondes. Begin desgewenst met één ronde.":"Beweeg rustig binnen een comfortabele bewegingsuitslag."} Stop bij pijn.</p>
      <ol>${exercises.map(e=>`<li><strong>${escape(e[0])} — ${escape(e[1])}</strong><p class="help">${escape(e[2])}</p></li>`).join("")}</ol>
    </details>
    ${!reason && date<=todayDateString()?`<button type="button" class="secondary" onclick="toggleSupportCompletion('${date}','${kind}')">${done?"Markering ongedaan maken":"Sessie voltooid"}</button>`:""}
  </div>`;
}

function toggleSupportCompletion(date,kind){
  const session=currentSupportSessions(date).find(s=>s.kind===kind);
  if(!session || session.reason || date>todayDateString()) return;
  const data=loadObject(SUPPORT_DONE_KEY);
  const key=`${date}:${kind}`;
  if(data[key]?.done) delete data[key];
  else data[key]={done:true,completedAt:new Date().toISOString(),routine:session.routine};
  try{
    saveObject(SUPPORT_DONE_KEY,data);
    renderSupportTraining();
  }catch{alert("Opslaan mislukt. Je sessie is niet als voltooid bewaard.");}
}

function saveSupportSettings(event){
  event.preventDefault();
  const settings={enabled:document.getElementById("supportEnabled").checked};
  for(const kind of ["strength","mobility"]){
    settings[kind]=DAY_KEYS.flatMap((key,i)=>document.getElementById(`support-${kind}-${key}`).checked?[i]:[]);
  }
  const status=document.getElementById("supportSettingsStatus");
  try{
    saveObject(SUPPORT_SETTINGS_KEY,settings);
    renderSupportTraining();
    status.textContent="Opgeslagen. Deze dagen keren iedere week terug; overgeslagen sessies staan met reden in het overzicht.";
  }catch{status.textContent="Opslaan mislukt. Probeer opnieuw; controleer je beschikbare opslagruimte.";}
}

function renderSupportSettings(){
  const settings=supportSettings();
  const form=document.getElementById("supportSettingsForm");
  form.innerHTML=`<label class="switchrow"><span>Iedere week kracht en mobiliteit meenemen</span><input id="supportEnabled" type="checkbox" ${settings.enabled?"checked":""}></label>
    ${["strength","mobility"].map(kind=>`<fieldset><legend>${kind==="strength"?"Kracht (standaard 2× per week)":"Mobiliteit (standaard 3× per week)"}</legend>
      ${DAY_KEYS.map((key,i)=>`<label class="switchrow"><span>${DAY_NAMES[i]}</span><input type="checkbox" id="support-${kind}-${key}" ${settings[kind].includes(i)?"checked":""}></label>`).join("")}</fieldset>`).join("")}
    <button type="submit">Kracht en mobiliteit opslaan</button>`;
  form.onsubmit=saveSupportSettings;
}

function renderSupportTraining(){
  for(const [id,date] of [["supportToday",todayDateString()],["supportCalendar",selectedDate]]){
    const element=document.getElementById(id);
    if(element) element.innerHTML=currentSupportSessions(date).map(supportSessionMarkup).join("")||'<p class="help">Geen aanvullende sessie gepland.</p>';
  }
  const week=document.getElementById("supportWeek");
  if(week){
    const anchor=document.getElementById("supportWeekDate").value||todayDateString();
    const index=(new Date(anchor+"T12:00:00").getDay()+6)%7;
    const monday=addDays(anchor,-index);
    week.innerHTML=Array.from({length:7},(_,i)=>{
      const date=addDays(monday,i);
      return `<h3>${DAY_NAMES[i]} · ${date}</h3>`+(currentSupportSessions(date).map(supportSessionMarkup).join("")||'<p class="help">Geen aanvullende sessie.</p>');
    }).join("");
  }
}

document.addEventListener("DOMContentLoaded",()=>{
  document.getElementById("supportWeekDate").value=todayDateString();
  document.getElementById("supportWeekDate").onchange=renderSupportTraining;
  renderSupportSettings();
  renderSupportTraining();
});
