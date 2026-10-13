/* Mobility uses the existing supplementary planner and log. No second calendar. */
let mobilityActive=null,mobilityClock=null,mobilityReturnFocus=null,mobilityAudio=null;
const mobEsc=value=>supportEscape(value);
const mobTime=seconds=>`${Math.floor(Math.max(0,seconds)/60)}:${String(Math.floor(Math.max(0,seconds)%60)).padStart(2,'0')}`;
function mobilityNotice(text){supportToast(text);}
function mobilityRefresh(){renderSupportTraining();renderMobilityLibrary();renderMobilityHistory();}
function mobilitySavePreferences(event){
 event.preventDefault();const f=event.target,p=mobilityPreferences();
 p.minutes=Number(f.elements.minutes.value);
 for(const field of ['areas','equipment']) p[field]=[...f.querySelectorAll(`[name="${field}"]:checked`)].map(n=>n.value);
 p.sound=f.elements.sound.checked;p.vibrate=f.elements.vibrate.checked;
 try{saveObject(MOBILITY_PREFS_KEY,p);mobilityRefresh();mobilityNotice('Voorkeuren opgeslagen. De planning is opnieuw berekend.');}catch{mobilityNotice('Opslaan mislukt; controleer de opslagruimte.');}
}
function mobilityTogglePreference(id,field){
 if(!MOBILITY_EXERCISES[id]||!['favorites','avoid'].includes(field)) return;
 const p=mobilityPreferences();
 if(field==='avoid'&&mobilityAvoided(id,p)){p.avoid=p.avoid.filter(x=>x!==id);p.reallow[id]=new Date().toISOString();}
 else p[field]=p[field].includes(id)?p[field].filter(x=>x!==id):[...p[field],id];
 try{saveObject(MOBILITY_PREFS_KEY,p);mobilityRefresh();}catch{mobilityNotice('Voorkeur niet opgeslagen.');}
}
function openMobilityLibrary(){switchView('library');document.getElementById('mobilityLibrary').scrollIntoView({block:'start'});}
function mobilityExerciseMarkup(id){
 const e=MOBILITY_EXERCISES[id],p=mobilityPreferences();
 return `<details class="mob-exercise"><summary><span><strong>${mobEsc(e.name)}</strong><small>${MOBILITY_AREAS[e.area]} · ${MOBILITY_CATEGORIES[e.category]}</small></span><span>${e.media.id?'Video':'Tekst'}</span></summary>
 <div class="mob-exercise-body"><p>${mobEsc(e.goal)}</p>${mobilityInstructions(e)}${mobilityMediaMarkup(e)}
 <div class="mob-actions"><button type="button" class="secondary" aria-pressed="${p.favorites.includes(id)}" onclick="mobilityTogglePreference('${id}','favorites')">${p.favorites.includes(id)?'★ Favoriet':'☆ Favoriet maken'}</button><button type="button" class="secondary" aria-pressed="${mobilityAvoided(id,p)}" onclick="mobilityTogglePreference('${id}','avoid')">${mobilityAvoided(id,p)?'Weer toestaan':'Vermijden'}</button></div>
 ${!mobilityAllowed(e,p)?'<p class="help">Deze oefening wordt weggelaten door je materiaalkeuze, vermijdlijst of opgeslagen ongemak.</p>':''}</div></details>`;
}
function mobilityInstructions(e,compact=false){
 const detail=`<p class="help">${MOBILITY_CATEGORIES[e.category]} · ${e.seconds} sec ${e.bilateral?'per zijde':'beide zijden samen'} · ${e.reps?`richtlijn ${e.reps} rustige herhalingen, op eigen tempo`:'rustig vasthouden'} · 1–3 sets · 10 sec rust en 10 sec voorbereiding per stap</p>
 <p class="help">Materiaal: ${e.equipment.map(x=>({chair:'stevige stoel',wall:'muur'})[x]).join(', ')||'geen (mat optioneel)'}</p>
 <ol>${e.steps.map(s=>`<li>${mobEsc(s)}</li>`).join('')}</ol><p><strong>Let op:</strong> ${mobEsc(e.cue)} ${mobEsc(e.mistake)}</p><p><strong>Eenvoudiger:</strong> ${mobEsc(e.easier)}</p>
 <p class="help">Stop bij pijn of ongemak. Algemene oefeninformatie, geen blessurebehandeling.</p>
 <details><summary>Inhoud en bron</summary><p class="help">Nederlandse bewerking · bronvergelijking ${e.reviewedOn}. Niet individueel of klinisch beoordeeld.</p><a href="${e.source}" target="_blank" rel="noopener">Oorspronkelijke oefenbeschrijving</a></details>`;
 return compact?`<ol class="mob-short-instructions">${e.steps.map(s=>`<li>${mobEsc(s)}</li>`).join('')}</ol><details><summary>Aandachtspunten, eenvoudiger & bron</summary>${detail}</details>`:detail;
}
function mobilityMediaMarkup(e){
 if(!e.media.id) return `<p class="mob-media-missing">Beeld nog niet gecontroleerd · volg de tekstinstructies.</p>`;
 return `<div class="mob-media" data-exercise="${e.id}"><button class="secondary" type="button" onclick="mobilityLoadVideo(this,'${e.id}')">Bekijk instructievideo</button><p class="help">E3 Rehab · internet nodig · Vimeo wordt pas na je tik geladen. Start en pauzeer met de videoknoppen.</p><div class="mob-video-slot"></div><p class="mob-media-status" role="status"></p><button class="secondary mob-video-close" type="button" hidden onclick="mobilityCloseVideo(this)">Video sluiten / opnieuw laden</button><small>Alleen ingesloten, niet gekopieerd. <a href="${e.media.url}" target="_blank" rel="noopener">Bron en maker</a> · insluitcode gecontroleerd ${e.media.checkedOn}.</small></div>`;
}
function mobilityCloseVideo(button){const host=button.closest('.mob-media');host.querySelector('.mob-video-slot').replaceChildren();host.querySelector('button').hidden=false;button.hidden=true;host.querySelector('.mob-media-status').textContent='Tekstinstructies blijven beschikbaar.';}
function mobilityLoadVideo(button,id){
 const e=MOBILITY_EXERCISES[id];if(!e?.media.id) return;
 const host=button.closest('.mob-media'),status=host.querySelector('.mob-media-status');
 if(navigator.onLine===false){status.textContent='Je bent offline. Gebruik de tekstinstructies of probeer later opnieuw.';return;}
 // Pause exercise timing while studying the demonstration.
 if(mobilityActive?.running) mobilityPause();
 button.hidden=true;host.querySelector('.mob-video-close').hidden=false;
 const frame=document.createElement('iframe');frame.title=`Uitvoering: ${e.name}`;frame.loading='lazy';frame.allow='fullscreen; picture-in-picture';frame.referrerPolicy='strict-origin-when-cross-origin';
 frame.src=`https://player.vimeo.com/video/${e.media.id}?dnt=1&autoplay=0`;
 status.textContent='Video laden… Als afspelen niet lukt, volg de tekst hieronder.';
 frame.onerror=()=>{status.textContent='Video niet beschikbaar. De tekstinstructies blijven bruikbaar.';};
 frame.onload=()=>{status.textContent='Start de video zelf. Werkt hij niet? Volg de tekstinstructies; je sessie blijft bewaard.';};
 host.querySelector('.mob-video-slot').replaceChildren(frame);
 setTimeout(()=>{if(frame.isConnected) status.textContent='Gebruik de speler om te starten, pauzeren en terug te spoelen. Bij een videofout kun je met de tekst doorgaan.';},12000);
}
function renderMobilityLibrary(){
 const root=document.getElementById('mobilityLibrary');if(!root) return;
 const p=mobilityPreferences(),filter=document.getElementById('mobArea')?.value||'',cat=document.getElementById('mobCategory')?.value||'';
 root.innerHTML=`<p class="label">Mobiliteit</p><h2>Bewegen dat in je dag past</h2><p class="help">Kies een routine of bekijk de uitvoering. De getoonde tijd omvat beide zijden, voorbereiding, rust en wissels.</p>
 <details><summary>Mijn voorkeuren</summary><form id="mobPrefs"><label>Gewenste tijd<select name="minutes">${[5,10,15].map(n=>`<option ${p.minutes===n?'selected':''}>${n}</option>`).join('')}</select></label>
 <fieldset><legend>Aandachtsgebieden</legend>${Object.entries(MOBILITY_AREAS).map(([id,label])=>`<label class="mob-check"><input type="checkbox" name="areas" value="${id}" ${p.areas.includes(id)?'checked':''}>${label}</label>`).join('')}</fieldset>
 <fieldset><legend>Aanwezig materiaal</legend>${[['chair','Stevige stoel'],['wall','Muur']].map(([id,label])=>`<label class="mob-check"><input type="checkbox" name="equipment" value="${id}" ${p.equipment.includes(id)?'checked':''}>${label}</label>`).join('')}</fieldset>
 <label class="mob-check"><input type="checkbox" name="sound" ${p.sound?'checked':''}>Geluid bij fasewissel</label><label class="mob-check"><input type="checkbox" name="vibrate" ${p.vibrate?'checked':''}>Trillen waar ondersteund (niet op iedere iPhone)</label><button>Voorkeuren opslaan</button></form></details>
 <div class="mob-routines">${Object.entries(MOBILITY_ROUTINES).map(([id,r])=>{const built=mobilityBuildRoutine(id,p.minutes);return `<article class="mob-routine"><p class="label">${r.purpose==='preparation'?'Voorbereiding':'Rustige sessie'}</p><h3>${r.name}</h3><p>${r.description}</p><strong>${mobTime(built.totalSeconds)} min · ${built.exercises.length} oefeningen</strong><div class="mob-actions"><button type="button" onclick="mobilityPlanDialog('${id}')" ${built.steps.length?'':'disabled'}>Kies & plan</button></div>${built.steps.length?'':'<p>Geen passende oefeningen. Wijzig je voorkeuren.</p>'}</article>`;}).join('')}</div>
 <h3>Oefeningen · ${Object.keys(MOBILITY_EXERCISES).length}</h3><div class="grid2"><label>Lichaamsgebied<select id="mobArea" onchange="renderMobilityLibrary()"><option value="">Alle gebieden</option>${Object.entries(MOBILITY_AREAS).map(([id,name])=>`<option value="${id}" ${filter===id?'selected':''}>${name}</option>`).join('')}</select></label><label>Soort<select id="mobCategory" onchange="renderMobilityLibrary()"><option value="">Alle soorten</option>${Object.entries(MOBILITY_CATEGORIES).map(([id,name])=>`<option value="${id}" ${cat===id?'selected':''}>${name}</option>`).join('')}</select></label></div>
 <div>${Object.values(MOBILITY_EXERCISES).filter(e=>(!filter||filter===e.area)&&(!cat||cat===e.category)).map(e=>mobilityExerciseMarkup(e.id)).join('')||'<p>Geen oefeningen binnen dit filter.</p>'}</div>
 <p class="help">Mobiliteit = actief bewegen; rekken = lichte rek vasthouden; activatie = lichte voorbereiding; kracht = spierbelasting. Geen automatische verhoging na voltooiing. Contains public sector information licensed under the <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noopener">Open Government Licence v3.0</a>. Nederlandse bewerking, geen goedkeuring door de bronhouder.</p>`;
 document.getElementById('mobPrefs').onsubmit=mobilitySavePreferences;
}
function mobilityShowDialog(){const d=document.getElementById('mobilityDialog');if(!d.open){mobilityReturnFocus=document.activeElement;d.showModal();}return d;}
function mobilityCloseDialog(){mobilityPause();document.getElementById('mobilityDialog').close();mobilityReturnFocus?.isConnected&&mobilityReturnFocus.focus();}
function mobilityPlanDialog(id){
 if(!MOBILITY_ROUTINES[id]) return;
 const d=mobilityShowDialog();d.innerHTML=`<div class="mob-actions"><button class="secondary" onclick="mobilityCloseDialog()">Sluiten</button></div><h2 id="mobilityTitle">${MOBILITY_ROUTINES[id].name}</h2><form id="mobPlanForm"><label>Datum<input type="date" name="date" value="${todayDateString()}" min="${todayDateString()}" required></label><label>Tijdbudget<select name="minutes">${[5,10,15].map(n=>`<option value="${n}" ${mobilityPreferences().minutes===n?'selected':''}>Maximaal ${n} min</option>`).join('')}</select></label><p id="mobPlanPreview"></p><p class="help">Tijd naast je hoofdtraining. Als mobiliteit al daarin zit, voegen we geen tweede blok toe.</p><p id="mobPlanStatus" role="status"></p><button type="submit">Inplannen</button></form>`;
 const f=document.getElementById('mobPlanForm');const preview=()=>{const r=mobilityBuildRoutine(id,Number(f.elements.minutes.value));document.getElementById('mobPlanPreview').textContent=`Werkelijke routinetijd ${mobTime(r.totalSeconds)} · ${r.exercises.map(e=>e[0]).join(', ')}`;};f.oninput=preview;preview();
 f.onsubmit=event=>{event.preventDefault();try{mobilityPlan(f.elements.date.value,id,Number(f.elements.minutes.value));mobilityCloseDialog();switchView('calendar');selectDate(f.elements.date.value);mobilityRefresh();mobilityNotice('Routine ingepland. Start vanuit Vandaag of Planning.');}catch(e){document.getElementById('mobPlanStatus').textContent=e.message;}};
}
function mobilityPlan(date,routineId,minutes){
 validateMobilityBackup(MOBILITY_PLANS_KEY,{[date]:{routineId,minutes}});
 if(date<todayDateString()) throw new Error('Kies vandaag of een toekomstige datum.');
 const main=allWorkouts()[date];if(mobilityContains(main)) throw new Error('Mobiliteit is al onderdeel van deze training. Start die via Vandaag of Planning.');
 if(loadObject(SUPPORT_DONE_KEY)[`${date}:mobility`]?.done) throw new Error('Voor deze dag is al een mobiliteitssessie geregistreerd.');
 const a=availabilityForDate(date),strength=currentSupportSessions(date).find(s=>s.kind==='strength'&&!s.reason);
 const used=(main&&main.type!=='Rest'?estimatedWorkoutMinutes(main):0)+(strength?.routine.minutes||0),r=mobilityBuildRoutine(routineId,minutes);
 if(!r.steps.length) throw new Error('Geen passende oefeningen bij je voorkeuren.');
 if(main?.type==='Race'||Object.values(races).some(r=>r.date===date)) throw new Error('Op een wedstrijddag voegen we geen extra sessie toe.');
 if(!a.available||used+r.minutes>a.maxMinutes) throw new Error('Onvoldoende beschikbare tijd. Kies een kortere routine of een andere dag.');
 const plans=loadObject(MOBILITY_PLANS_KEY);plans[date]={routineId,minutes};saveObject(MOBILITY_PLANS_KEY,plans);
 const skips=loadObject(SUPPORT_SKIP_KEY);if(skips[`${date}:mobility`]){delete skips[`${date}:mobility`];saveObject(SUPPORT_SKIP_KEY,skips);}
}
function mobilitySessionMarkup(s){
 const saved=loadObject(SUPPORT_DONE_KEY)[`${s.date}:mobility`],status=s.done?(saved?.completion==='partial'?'Gedeeltelijk uitgevoerd':'Voltooid'):loadObject(SUPPORT_SKIP_KEY)[`${s.date}:mobility`]?'Overgeslagen':s.reason?'Niet ingepland':'Gepland';
 return `<div class="support-session ${s.done?'is-done':s.reason?'is-blocked':''}"><div class="support-session-head"><span class="pill">MOBILITEIT</span><span>${status}</span></div><h3>${mobEsc(s.routine.name)}</h3><p>${mobTime(s.routine.totalSeconds??s.routine.minutes*60)} min · ${s.routine.exercises.length} oefeningen</p>${s.movedFrom?`<p class="help">Verplaatst vanaf ${s.movedFrom}.</p>`:''}${s.reason?`<p class="support-notice">${mobEsc(s.reason)}</p>`:''}
 <div class="mob-actions">${!s.reason&&!s.done&&s.date===todayDateString()?`<button onclick="mobilityStart('${s.date}')">Start begeleide sessie</button>`:''}${s.done?`<button class="secondary" onclick="mobilityViewLog('${s.date}')">Bekijk uitvoering</button>`:''}${!s.done&&!s.reason?`<button class="secondary" onclick="skipSupportSession('${s.date}','mobility')">Overslaan</button>`:''}${loadObject(SUPPORT_SKIP_KEY)[`${s.date}:mobility`]?`<button class="secondary" onclick="skipSupportSession('${s.date}','mobility',true)">Weer inplannen</button>`:''}<button class="secondary" onclick="openMobilityLibrary()">Routines & oefeningen</button>${!s.reason?`<button class="secondary" onclick="exportSupportSession('${s.date}','mobility')">Naar Intervals.icu</button>`:''}</div></div>`;
}
function mobilityPersist(){
 try{if(mobilityActive)localStorage.setItem(MOBILITY_ACTIVE_KEY,JSON.stringify(mobilityActive));else localStorage.removeItem(MOBILITY_ACTIVE_KEY);return true;}catch{mobilityNotice('Voortgang kon niet worden opgeslagen. Houd de sessie open en probeer opslaan opnieuw.');return false;}
}
function mobilityStart(date,mainMode=false){
 if(date!==todayDateString()) return;
 if(mobilityActive){mobilityResume();return;}
 if(supportPlayer){mobilityNotice('Rond je lopende krachtsessie eerst af.');return;}
 const main=allWorkouts()[date];
 if(loadObject(SUPPORT_DONE_KEY)[`${date}:mobility`]?.done){mobilityViewLog(date);return;}
 const available=availabilityForDate(date);
 if(!available.available){mobilityNotice('Vandaag is niet beschikbaar. Pas eerst je planning aan.');return;}
 const s=mainMode&&main?.type==='Mobility'?{routine:mobilityRoutineForDate(date,Math.min(available.maxMinutes,estimatedWorkoutMinutes(main))),reason:''}:currentSupportSessions(date).find(s=>s.kind==='mobility');
 if(!s||s.reason||s.done||!s.routine.steps?.length){mobilityNotice('Deze sessie is niet beschikbaar. Bekijk je planning of voorkeuren.');return;}
 if(mainMode&&workoutWasCompleted(date,main)){mobilityNotice('Deze training is al voltooid.');return;}
 mobilityActive={version:1,date,plannedFor:s.movedFrom||date,routine:JSON.parse(JSON.stringify(s.routine)),index:0,phaseElapsed:0,running:false,startedAt:null,records:[],elapsedSeconds:0,uncomfortableIds:[],mainIdentity:mainMode?workoutCompletionIdentity(main):null,mainPlannedSeconds:mainMode?estimatedWorkoutMinutes(main)*60:null};
 mobilityPersist();mobilityResume();
}
function mobilityElapsed(now=Date.now()){return mobilityActive?mobilityActive.phaseElapsed+(mobilityActive.running?Math.max(0,(now-mobilityActive.startedAt)/1000):0):0;}
function mobilityPause(){
 if(!mobilityActive)return;
 const step=mobilityActive.routine.steps[mobilityActive.index];
 mobilityActive.phaseElapsed=Math.min(step?.seconds||0,mobilityElapsed());mobilityActive.running=false;mobilityActive.startedAt=null;clearInterval(mobilityClock);mobilityClock=null;mobilityPersist();mobilityUpdateClock();
 const btn=document.getElementById('mobPause');if(btn)btn.textContent='Start / hervat';
}
function mobilityTogglePause(){
 if(!mobilityActive)return;
 if(mobilityActive.running)mobilityPause();else{
  if(mobilityActive.index>=mobilityActive.routine.steps.length)return;
  // Remove a media player before resuming, so demonstrations cannot keep playing behind a timer.
  document.querySelectorAll('#mobilityDialog iframe').forEach(f=>f.remove());
  if(mobilityPreferences().sound&&!mobilityAudio){try{mobilityAudio=new (window.AudioContext||window.webkitAudioContext)();}catch{}}
  mobilityAudio?.resume().catch(()=>{});
  mobilityActive.running=true;mobilityActive.startedAt=Date.now();mobilityPersist();mobilityClock=setInterval(mobilityTick,200);document.getElementById('mobPause').textContent='Pauzeren';
 }
}
function mobilitySignal(){const p=mobilityPreferences();if(p.vibrate&&navigator.vibrate)navigator.vibrate(100);if(p.sound&&mobilityAudio){try{const o=mobilityAudio.createOscillator(),g=mobilityAudio.createGain();g.gain.value=.04;o.connect(g);g.connect(mobilityAudio.destination);o.start();o.stop(mobilityAudio.currentTime+.12);}catch{}}}
function mobilityRecordPhase(status){
 const s=mobilityActive,step=s.routine.steps[s.index];if(!step)return;
 const seconds=Math.min(step.seconds,mobilityElapsed());s.elapsedSeconds+=seconds;
 if(step.phase==='work')s.records.push({exerciseId:step.exerciseId,side:step.side,set:step.set,seconds,status:seconds>=step.seconds&&status==='complete'?'complete':status==='skipped'?'skipped':'partial'});
 s.phaseElapsed=0;s.startedAt=null;s.running=false;
}
function mobilityTick(){
 const s=mobilityActive;if(!s?.running)return;
 const step=s.routine.steps[s.index];if(mobilityElapsed()>=step.seconds){
  mobilityRecordPhase('complete');s.index++;clearInterval(mobilityClock);mobilityClock=null;mobilitySignal();
  // Setup transitions into work. After work/rest, wait for a deliberate next action.
  // Background delay never silently completes subsequent exercises or both sides.
  if(step.phase==='setup'&&document.visibilityState!=='hidden'){s.running=true;s.startedAt=Date.now();mobilityClock=setInterval(mobilityTick,200);}
  mobilityPersist();mobilityRenderPlayer();
 }else mobilityUpdateClock();
}
function mobilityUpdateClock(){
 const s=mobilityActive;if(!s)return;const step=s.routine.steps[s.index];
 const elapsed=Math.min(step?.seconds||0,mobilityElapsed());
 const clock=document.getElementById('mobClock');if(clock)clock.textContent=mobTime(Math.ceil((step?.seconds||0)-elapsed));
 const rest=document.getElementById('mobRemaining');if(rest)rest.textContent=`Nog ${mobTime(Math.ceil(s.routine.steps.slice(s.index).reduce((n,x)=>n+x.seconds,0)-elapsed))} gepland`;
 const resume=document.getElementById('mobilityResume');if(resume)resume.hidden=false;
}
function mobilityAdvance(){
 const s=mobilityActive;if(!s)return;const step=s.routine.steps[s.index];if(!step)return;
 if(step.phase==='work'&&mobilityElapsed()<step.seconds){mobilityNotice('Laat de timer aflopen of gebruik Overslaan.');return;}
 mobilityPause();mobilityRecordPhase('complete');s.index++;mobilityPersist();mobilityRenderPlayer();
}
function mobilitySkipExercise(pain=false){
 const s=mobilityActive;if(!s)return;const step=s.routine.steps[s.index];if(!step)return;
 mobilityPause();mobilityRecordPhase('skipped');
 const id=step.exerciseId,set=step.set;
 if(pain){
  s.uncomfortableIds=[...new Set([...s.uncomfortableIds,id])];
  const p=mobilityPreferences();p.avoid=[...new Set([...p.avoid,id])];
  try{saveObject(MOBILITY_PREFS_KEY,p);}catch{mobilityNotice('Vermijden nog niet opgeslagen; rond de sessie af om je feedback te bewaren.');}
 }
 while(s.index<s.routine.steps.length&&s.routine.steps[s.index].exerciseId===id&&s.routine.steps[s.index].set===set){
  const skip=s.routine.steps[s.index];if(skip.phase==='work'&&!s.records.some(r=>r.exerciseId===id&&r.side===skip.side&&r.set===skip.set))s.records.push({...skip,seconds:0,status:'skipped'});s.index++;
 }
 if(pain){s.routine.steps=s.routine.steps.filter((x,i)=>i<s.index||x.exerciseId!==id);}
 mobilityPersist();mobilityRenderPlayer();
}
function mobilityReplace(id=null){
 const s=mobilityActive;if(!s)return;mobilityPause();const current=s.routine.steps[s.index];if(!current)return;
 const old=MOBILITY_EXERCISES[current.exerciseId];
 const allowed=Object.values(MOBILITY_EXERCISES).filter(e=>e.id!==old.id&&e.area===old.area&&e.category===old.category&&e.bilateral===old.bilateral&&mobilityAllowed(e));
 if(!id){document.getElementById('mobReplace').innerHTML=allowed.length?`<label>Vervang door<select id="mobReplacement">${allowed.map(e=>`<option value="${e.id}">${mobEsc(e.name)}</option>`).join('')}</select></label><button onclick="mobilityReplace(document.getElementById('mobReplacement').value)">Vervangen</button>`:'<p>Geen gelijkwaardige vervanger met je voorkeuren. Gebruik de eenvoudigere uitvoering of sla over.</p>';return;}
 if(!allowed.some(e=>e.id===id))return;
 mobilityRecordPhase('partial');
 // Replace the remaining set with fresh setup and both sides; old work remains in the log.
 let end=s.index;while(end<s.routine.steps.length&&s.routine.steps[end].exerciseId===old.id&&s.routine.steps[end].set===current.set)end++;
 const e=MOBILITY_EXERCISES[id],replacement=(e.bilateral?['links','rechts']:['beide']).flatMap(side=>[['setup',10],['work',e.seconds],['rest',10]].map(([phase,seconds])=>({exerciseId:id,side,set:current.set,phase,seconds})));
 s.routine.steps.splice(s.index,end-s.index,...replacement);mobilityPersist();mobilityRenderPlayer();
}
function mobilityResume(){if(!mobilityActive)return;mobilityShowDialog();mobilityTick();mobilityRenderPlayer();}
function mobilityRenderPlayer(){
 const s=mobilityActive;if(!s)return;const d=mobilityShowDialog(),step=s.routine.steps[s.index];
 if(!step){mobilityFinish();return;}
 const e=MOBILITY_EXERCISES[step.exerciseId],next=s.routine.steps.slice(s.index+1).find(x=>x.phase==='work'&&(x.exerciseId!==e.id||x.side!==step.side));
 d.innerHTML=`<div class="mob-actions"><span class="pill">${s.routine.purpose==='preparation'?'Voorbereiding':'Rustige sessie'}</span><button class="secondary" onclick="mobilityCloseDialog()">Sluiten & bewaren</button></div><h2 id="mobilityTitle">${mobEsc(e.name)}</h2>
 <p class="mob-phase" aria-live="polite">${({setup:'Neem je houding aan',work:'Rustig uitvoeren',rest:'Rust en wisseltijd'})[step.phase]} · ${step.side==='beide'?'beide zijden samen':step.side} · set ${step.set}</p>
 <div class="mob-timer"><strong id="mobClock"></strong><span id="mobRemaining"></span></div><progress max="${s.routine.steps.length}" value="${s.index}" aria-label="Voortgang sessie"></progress>
 <div class="mob-actions"><button id="mobPause" onclick="mobilityTogglePause()">${s.running?'Pauzeren':'Start / hervat'}</button>${step.phase!=='work'?'<button class="secondary" onclick="mobilityAdvance()">Klaar →</button>':''}</div>
 ${mobilityInstructions(e,true)}${mobilityMediaMarkup(e)}<p class="help"><strong>Volgende:</strong> ${next?mobEsc(MOBILITY_EXERCISES[next.exerciseId].name)+' · '+next.side:'Afronden'}</p>
 <p class="help">Volg je eigen tempo. Stop bij pijn. Na de werkfase wacht de sessie op jou.</p>
 <div class="mob-actions"><button class="secondary" onclick="mobilitySkipExercise()">Oefening overslaan</button><button class="secondary" onclick="mobilityReplace()">Vervangen</button><button class="secondary" onclick="mobilitySkipExercise(true)">Ongemak: stop deze oefening</button></div><div id="mobReplace"></div><button class="secondary" onclick="mobilityFinish()">Stoppen & opslaan</button>`;
 mobilityUpdateClock();
}
function mobilityFinish(){
 if(!mobilityActive)return;mobilityPause();
 const d=mobilityShowDialog();d.innerHTML=`<h2 id="mobilityTitle">Hoe voelde je sessie?</h2><p>${mobTime(mobilityActive.elapsedSeconds+mobilityActive.phaseElapsed)} geregistreerd inclusief voorbereiding en rust. Alleen werkelijk getimede oefenstappen worden opgeslagen.</p><form id="mobFeedbackForm"><label>Ervaring<select name="feedback"><option value="">Niet ingevuld</option><option value="pleasant">Prettig</option><option value="easy">Te makkelijk</option><option value="hard">Te zwaar</option><option value="uncomfortable">Ongemakkelijk</option></select></label><fieldset><legend>Bij ongemak: welke oefeningen? Deze laten we voortaan weg.</legend>${[...new Set(mobilityActive.routine.steps.map(x=>x.exerciseId))].map(id=>`<label class="mob-check"><input type="checkbox" name="uncomfortable" value="${id}" ${mobilityActive.uncomfortableIds.includes(id)?'checked':''}>${MOBILITY_EXERCISES[id].name}</label>`).join('')}</fieldset><p id="mobSaveStatus" role="status"></p><button>Uitvoering opslaan</button><button type="button" class="secondary" onclick="mobilityRenderPlayer()" ${mobilityActive.index>=mobilityActive.routine.steps.length?'hidden':''}>Terug naar sessie</button></form>`;
 document.getElementById('mobFeedbackForm').onsubmit=event=>{event.preventDefault();const f=event.target;try{mobilitySaveSession(f.elements.feedback.value,[...f.querySelectorAll('[name="uncomfortable"]:checked')].map(x=>x.value));mobilityCloseDialog();mobilityRefresh();refreshDerivedCoachViews();mobilityNotice('Je uitvoering en feedback zijn opgeslagen.');}catch(e){document.getElementById('mobSaveStatus').textContent=e.message;}};
}
function mobilitySaveSession(feedback='',uncomfortable=[]){
 const s=mobilityActive;if(!s)return;
 if(feedback==='uncomfortable'&&!uncomfortable.length&&!s.uncomfortableIds.length)throw new Error('Kies de oefening die ongemakkelijk voelde.');
 const snapshot=JSON.parse(JSON.stringify(s));
 const step=snapshot.routine.steps[snapshot.index];
 if(step&&snapshot.phaseElapsed>0){snapshot.elapsedSeconds+=snapshot.phaseElapsed;if(step.phase==='work')snapshot.records.push({exerciseId:step.exerciseId,side:step.side,set:step.set,seconds:snapshot.phaseElapsed,status:snapshot.phaseElapsed>=step.seconds?'complete':'partial'});}
 const actual=snapshot.records.filter(r=>r.seconds>0);
 if(!actual.length){const skips=loadObject(SUPPORT_SKIP_KEY);skips[`${s.date}:mobility`]={skippedAt:new Date().toISOString(),plannedFor:s.plannedFor||s.date};saveObject(SUPPORT_SKIP_KEY,skips);}
 else{
 const total=snapshot.routine.steps.filter(x=>x.phase==='work').length;
 const complete=snapshot.index>=snapshot.routine.steps.length&&snapshot.records.filter(r=>r.status==='complete').length===total&&!snapshot.records.some(r=>r.status!=='complete')&&(!snapshot.mainIdentity||snapshot.elapsedSeconds>=snapshot.mainPlannedSeconds);
 const data=loadObject(SUPPORT_DONE_KEY);
 if(data[`${s.date}:mobility`]?.done)throw new Error('Deze sessie is al opgeslagen. Er wordt geen eerdere registratie overschreven.');
 const ids=[...new Set(actual.map(r=>r.exerciseId))],routine={...snapshot.routine,exercises:ids.map(id=>{const e=MOBILITY_EXERCISES[id];return[e.name,`${e.seconds} sec per stap`,e.steps.join(' ')];})};
 const bad=[...new Set([...s.uncomfortableIds,...uncomfortable])];
 data[`${s.date}:mobility`]={done:true,completion:complete?'complete':'partial',completedAt:new Date().toISOString(),routine,actualMinutes:snapshot.elapsedSeconds/60,rpe:null,pain:bad.length?1:null,note:'',mobility:{version:1,plannedFor:s.plannedFor||s.date,feedback,uncomfortableIds:bad,records:snapshot.records,actualSeconds:snapshot.elapsedSeconds,mainIdentity:s.mainIdentity,load:null}};
 saveObject(SUPPORT_DONE_KEY,data);
 }
 mobilityActive=null;mobilityPersist();const resume=document.getElementById('mobilityResume');if(resume)resume.hidden=true;
}
function mobilityViewLog(date){
 const e=loadObject(SUPPORT_DONE_KEY)[`${date}:mobility`];if(!e)return;
 mobilityShowDialog().innerHTML=`<button class="secondary" onclick="mobilityCloseDialog()">Sluiten</button><h2 id="mobilityTitle">${mobEsc(e.routine.name)}</h2><p>${date} · ${e.completion==='partial'?'Gedeeltelijk uitgevoerd':'Voltooid'} · ${e.mobility?mobTime(e.mobility.actualSeconds):mobEsc(e.actualMinutes??'—')+' min'}</p><p>Ervaring: ${mobEsc(({pleasant:'Prettig',easy:'Te makkelijk',hard:'Te zwaar',uncomfortable:'Ongemakkelijk'})[e.mobility?.feedback]||'Niet ingevuld')}</p><ol>${(e.mobility?.records||[]).map(r=>`<li>${mobEsc(MOBILITY_EXERCISES[r.exerciseId]?.name||r.exerciseId)} · ${mobEsc(r.side)} · set ${r.set}: ${Math.round(r.seconds)} sec · ${r.status==='complete'?'gedaan':r.status==='skipped'?'overgeslagen':'gedeeltelijk'}</li>`).join('')||'<li>Oudere registratie: geen afzonderlijke oefenstappen bewaard.</li>'}</ol>`;
}
function renderMobilityHistory(){
 const host=document.getElementById('mobilityHistory');if(!host)return;
 const entries=supportCompletedEntries(0,27).filter(x=>x.kind==='mobility'),days=new Set(entries.map(x=>x.date)).size;
 const seconds=entries.reduce((n,x)=>n+(x.entry.mobility?.actualSeconds??(x.entry.actualMinutes||0)*60),0);
 host.innerHTML=`<h3>Mobiliteit · afgelopen 28 dagen</h3><p><strong>${days} dagen</strong> · ${Math.round(seconds/60)} minuten geregistreerd</p><p class="help">Regelmaat en tijd, geen meting van bewegingsbereik. Trainingsbelasting wordt niet geschat of bij CTL/ATL opgeteld.</p>${entries.map(x=>`<button class="secondary support-history-row" onclick="mobilityViewLog('${x.date}')">${x.date} · ${mobEsc(x.entry.routine.name)} · ${x.entry.completion==='partial'?'gedeeltelijk':'voltooid'}</button>`).join('')||'<p>Nog geen sessies. Kies een routine in de bibliotheek.</p>'}`;
}
function mobilityRestore(){
 try{const s=JSON.parse(localStorage.getItem(MOBILITY_ACTIVE_KEY)||'null');if(!s)return;
 if(s.version!==1||calendarDayNumber(s.date)===null||s.date>todayDateString()||!Array.isArray(s.routine?.steps)||!s.routine.steps.length||s.routine.steps.length>200||!Number.isInteger(s.index)||s.index<0||s.index>s.routine.steps.length||!Number.isFinite(s.phaseElapsed)||s.phaseElapsed<0||!Number.isFinite(s.elapsedSeconds)||s.elapsedSeconds<0||!Array.isArray(s.records)||!Array.isArray(s.uncomfortableIds)||s.routine.steps.some(x=>!MOBILITY_EXERCISES[x.exerciseId]||!['setup','work','rest'].includes(x.phase)||!['links','rechts','beide'].includes(x.side)||!Number.isFinite(x.seconds)||x.seconds<=0||x.seconds>60))throw new Error();
 if(loadObject(SUPPORT_DONE_KEY)[`${s.date}:mobility`]?.done){localStorage.removeItem(MOBILITY_ACTIVE_KEY);return;}
 if(s.running&&(!Number.isFinite(s.startedAt)||s.startedAt<0))throw new Error();
 validateMobilityLog({version:1,feedback:'',actualSeconds:s.elapsedSeconds,uncomfortableIds:s.uncomfortableIds,records:s.records});
 mobilityActive=s;mobilityPause();document.getElementById('mobilityResume').hidden=false;
 }catch{mobilityActive=null;mobilityNotice('Bewaarde mobiliteitssessie is niet leesbaar. Je eerdere registraties zijn behouden.');}
}
document.addEventListener('DOMContentLoaded',()=>{
 renderMobilityLibrary();renderMobilityHistory();mobilityRestore();
 const dialog=document.getElementById('mobilityDialog');dialog.addEventListener('cancel',()=>mobilityPause());dialog.addEventListener('close',()=>{mobilityPause();dialog.querySelectorAll('iframe').forEach(f=>f.remove());mobilityReturnFocus?.isConnected&&mobilityReturnFocus.focus();});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')mobilityPersist();else if(mobilityActive){mobilityTick();mobilityUpdateClock();}});
 document.getElementById('showMobilityRecipe').onclick=openMobilityLibrary;document.getElementById('startMobilityPlayer').onclick=openMobilityLibrary;
});
