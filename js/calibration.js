/* Adapter for the existing calendar, profile, Intervals export and progress screen. */
const CALIBRATION_KEY='jp_calibration_v1';
function calibrationState(){
  const stored=loadObject(CALIBRATION_KEY);
  return stored?.schema===1&&stored.values?.run&&Array.isArray(stored.results)&&Array.isArray(stored.history)?stored:CalibrationEngine.empty();
}
function calibrationSave(state){saveObject(CALIBRATION_KEY,state);}
function calibrationValue(metric,sport='run'){return calibrationState().values[sport]?.[metric]||null;}
function calibrationProfile(p){
  const s=calibrationState(),v=s.values.run;
  return {...p,maxHr:v.maxHr?.value??p.maxHr,z2Hr:v.aerobicHr?.value??p.z2Hr};
}
function calibrationInitialize(){
  const s=calibrationState();
  if(!s.migrated){
    for(const [metric,key] of [['maxHr','maxHr'],['aerobicHr','z2Hr']]){
      const value=CalibrationEngine.num(profile?.[key]);
      if(value&& !s.values.run[metric])s.values.run[metric]={sport:'run',metric,value,date:null,source:'Bestaande profielinstelling',sourceType:'legacy',method:'Methode onbekend; niet als meting bevestigd',quality:'onbevestigd',locked:false};
    }
    s.migrated=true;calibrationSave(s);
  }
  const h=s.history[s.history.length-1];let repaired=false;
  for(const [date,after] of Object.entries(h?.workoutsAfter||{})){if(date>todayDateString()&&JSON.stringify(allWorkouts()[date])===JSON.stringify(h.workoutsBefore[date])){customWorkouts[date]=after;repaired=true;}}
  if(repaired)saveObject(STORAGE_KEY,customWorkouts);
  renderCalibration();
}
function calibrationTrainingReference(values){
  const v=values.run;if(v.thresholdPace)return v.thresholdPace.value;
  // Riegel 60-minute equivalent is a prescription model, never stored as a measured threshold.
  const r=v.performance;return r?3600/(r.distanceKm*Math.pow(3600/r.value,1/1.06)):null;
}
function calibrationPaces(base){
  const tp=calibrationTrainingReference(calibrationState().values);
  if(!tp)return base;
  const fmt=n=>formatPace(Math.round(n));
  return {...base,easy:`${fmt(tp*1.15)}-${fmt(tp*1.29)}/km`,recovery:`${fmt(tp*1.30)}-${fmt(tp*1.40)}/km`,threshold:`${fmt(tp*.99)}-${fmt(tp*1.02)}/km`,vo2:`${fmt(tp*.95)}-${fmt(tp*.98)}/km`};
}
function calibrationPerformanceSources(){
  const v=calibrationValue('performance');
  return v?[{distance:v.distanceKm,seconds:v.value,label:`Kalibratie ${v.date}`,type:'calibration',date:v.date}]:null;
}
function calibrationSportProfile(activity,fallback={}){
  const sport=typeof syncedSportFamily==='function'?syncedSportFamily(activity?.type):'run';
  const state=calibrationState();let values=state.values;
  const firstLater=state.history.find(h=>activity?.date&&h.date>activity.date);if(firstLater)values=firstLater.before;
  const v=values[sport]||{};
  return {...fallback,maxHr:v.maxHr?.value??(sport==='run'?fallback.maxHr:null),z2Hr:v.aerobicHr?.value??(sport==='run'?fallback.z2Hr:null)};
}
function calibrationQueue(date){
  if(!uploadedWorkouts[date])return;const s=calibrationState();s.exportQueue=[...new Set([...(s.exportQueue||[]),date])];calibrationSave(s);
}
function calibrationPending(){const queue=new Set(calibrationState().exportQueue||[]);return Object.entries(customWorkouts).filter(([d,w])=>queue.has(d)&&d>todayDateString()&&uploadedWorkouts[d]&&!workoutUploadIsCurrent(d,w));}
function calibrationText(v){
  if(!v)return 'Nog onbekend';
  if(v.metric==='thresholdPace')return `${formatPace(v.value)}/km`;
  if(v.metric==='performance')return `${formatPace(v.value)} op ${v.distanceKm} km`;
  return `${v.value} ${CalibrationEngine.METRICS[v.metric]?.[1]||''}`;
}
function calibrationContext(){
  const workouts=allWorkouts(),settings=typeof supportSettings==='function'?supportSettings():null;
  const supportFor=d=>settings?supportSessionsForDate(d,settings,workouts,Object.values(races),getProfile().availability):[];
  return {today:todayDateString(),workouts,races:Object.values(races),availability:availabilityForDate,
    readiness:determineReadiness(getWellnessSnapshot()).level,recoveryDays:raceRecoveryDays,
    completed:Object.fromEntries(Object.entries(workouts).filter(([d,w])=>completionMarkerMatches(doneWorkouts[d],w))),
    isHard:w=>isHardWorkout(w)||Number.parseFloat(w.rpe)>=7||['quality','threshold','vo2'].includes(w.planType),
    activities:Object.values(syncedActivities||{}),
    supportMinutes:d=>supportFor(d).filter(s=>!s.reason).reduce((sum,s)=>sum+Number(s.routine.minutes||0),0),
    supportHardNear:d=>[-2,-1,0,1,2].some(n=>supportFor(addDays(d,n)).some(s=>s.kind==='strength'&&!s.reason))};
}
function calibrationCheck(form){return Object.fromEntries(['reviewed','recovered','symptoms','ill','medical','optIn','experienced'].map(k=>[k,form.elements[k]?.checked===true]));}
function calibrationPlan(kind,date,check){
  const allowed=CalibrationEngine.eligible(kind,check);if(!allowed.ok)throw Error(allowed.reason);
  const ctx=calibrationContext(),why=CalibrationEngine.slot(kind,date,ctx);if(why)throw Error(why);
  const p=CalibrationEngine.PROTOCOLS[kind],s=calibrationState();
  if(Object.entries(s.plans).some(([d,x])=>d>=ctx.today&&allWorkouts()[d]?.calibration?.id===x.id))throw Error('Er staat al een kalibratie gepland. Rond die af of annuleer die eerst.');
  const id=`calibration-${kind}-${date}`;
  const cues={aerobic:['Inlopen en stabiliseren','Vast praattempo eerste helft','Zelfde tempo tweede helft','Uitlopen'],threshold:['Inlopen','Solo gelijkmatig hard eerste deel','Solo gelijkmatig hard vervolg','Uitlopen'],performance:['Inlopen','Gelijkmatig beste inspanning','Uitlopen'],maximum:['Inlopen','Heuvel gecontroleerd','Herstel afdalen','Heuvel intensief','Herstel voldoende laten dalen','Heuvel maximaal alleen indien geschikt','Uitlopen']}[kind];
  const description=p.steps.map(([minutes],i)=>`- ${cues[i]} ${minutes?minutes+'m':'5km'}`).join('\n');
  s.plans[date]={id,kind,date,check,original:CalibrationEngine.copy(ctx.workouts[date])};
  customWorkouts[date]={date,name:p.name,uploadName:`Jaco - ${p.name}`,type:'Run',planType:p.hard?'quality':'easy',durationMinutes:p.minutes,distanceKm:0,rpe:p.hard?'9/10':'3/10',status:'planned',locked:true,
    calibration:{id,kind,check,version:1},zoneSnapshot:CalibrationEngine.copy(s.values.run),zoneRevision:s.revision,
    displaySteps:p.steps.map(([m,t])=>`${m?m+' min':'5 km'} · ${t}`),intervalsDescription:`${p.measures}\n\n${description}\n\nStop bij pijn op de borst, duizeligheid, ongewone benauwdheid, hartkloppingen of scherpe pijn.\n${p.needs}`};
  calibrationSave(s);saveObject(STORAGE_KEY,customWorkouts);calibrationQueue(date);refreshAfterCalendarMutation();renderCalibration();
}
function calibrationCancel(date){
  const s=calibrationState(),plan=s.plans[date],current=allWorkouts()[date];
  if(!plan||date<=todayDateString()||current?.calibration?.id!==plan.id||completionMarkerMatches(doneWorkouts[date],current))throw Error('Deze kalibratie kan niet meer veilig worden teruggezet.');
  customWorkouts[date]=plan.original;delete s.plans[date];calibrationSave(s);saveObject(STORAGE_KEY,customWorkouts);calibrationQueue(date);refreshAfterCalendarMutation();renderCalibration();
}
function calibrationPrepareWorkout(workout){
  const state=calibrationState();return calibrationRetarget(workout,state.values,state.revision);
}
function calibrationRetarget(workout,values,revision,previousValues=null){
  const w=CalibrationEngine.copy(workout),v=values.run,p=calibrationTrainingReference(values);
  if(w.type!=='Run'||w.calibration||w.locked)return w;
  const fmt=n=>formatPace(Math.round(n));
  const ranges=p?{threshold:`${fmt(p*.99)}-${fmt(p*1.02)}/km`,vo2:`${fmt(p*.95)}-${fmt(p*.98)}/km`,easy:`${fmt(p*1.15)}-${fmt(p*1.29)}/km`,long:`${fmt(p*1.15)}-${fmt(p*1.29)}/km`,recovery:`${fmt(p*1.30)}-${fmt(p*1.40)}/km`}:{};
  const kind=w.planType==='quality'?(/drempel|threshold/i.test(w.name)?'threshold':/vo2|vo₂/i.test(w.name)?'vo2':null):w.planType;
  const pace=(!previousValues||calibrationTrainingReference(previousValues)!==p)?ranges[kind]:null;
  const aerobicChanged=!previousValues||previousValues.run?.aerobicHr?.value!==v.aerobicHr?.value;
  const protectedTargets=(w.displaySteps||[]).filter(t=>/inlopen|uitlopen|warming|cooling/i.test(t)).flatMap(t=>String(t).match(/\d{1,2}:\d{2}(?:\s*[-–]\s*\d{1,2}:\d{2})?\s*\/km/g)||[]);
  function update(text){
    let t=String(text);
    // Warm-ups/cool-downs and explicit race-pace blocks retain their own targets.
    if(pace&&!/inlopen|uitlopen|warming|cooling|wedstrijd|race.?pace|hm.?tempo|marathon.?tempo/i.test(t))t=t.replace(/\d{1,2}:\d{2}(?:\s*[-–]\s*\d{1,2}:\d{2})?\s*\/km/g,target=>protectedTargets.includes(target)?target:pace);
    if(aerobicChanged&&v.aerobicHr?.value)t=t.replace(/(hartslag (?:bij voorkeur )?onder (?:circa )?)\d+ bpm/ig,`$1${v.aerobicHr.value} bpm`);
    return t;
  }
  w.displaySteps=(w.displaySteps||[]).map(update);w.intervalsDescription=String(w.intervalsDescription||'').split('\n').map(update).join('\n');
  w.zoneSnapshot=CalibrationEngine.copy(v);w.zoneRevision=revision;return w;
}
function calibrationCommit(next){
  const previous=calibrationState(),today=todayDateString(),changed=[];
  const before={},after={};
  const previousTransition=previous.history[previous.history.length-1];
  const isUndo=next.history[next.history.length-1]?.undoOf;
  for(const [date,w] of Object.entries(allWorkouts())){
    if(date<=today||w.type!=='Run'||w.locked||w.calibration||completionMarkerMatches(doneWorkouts[date],w))continue;
    let revised;
    // Undo restores only untouched future workouts from the most recent transaction.
    if(isUndo&&previousTransition?.workoutsBefore?.[date]&&JSON.stringify(w)===JSON.stringify(previousTransition.workoutsAfter?.[date]))revised=CalibrationEngine.copy(previousTransition.workoutsBefore[date]);
    else if(!isUndo&&JSON.stringify(previous.values.run)!==JSON.stringify(next.values.run))revised=calibrationRetarget(w,next.values,next.revision,previous.values);
    else continue;
    if(JSON.stringify(w)===JSON.stringify(revised))continue;
    before[date]=CalibrationEngine.copy(w);after[date]=revised;changed.push(date);
  }
  const h=next.history[next.history.length-1];if(h){h.workoutsBefore=before;h.workoutsAfter=after;}
  // Persist the canonical transaction before materializing; recoverable from history.
  next.exportQueue=[...new Set([...(next.exportQueue||[]),...changed.filter(d=>uploadedWorkouts[d])])];
  calibrationSave(next);
  Object.assign(customWorkouts,after);saveObject(STORAGE_KEY,customWorkouts);
  const attempts=loadObject('jp_export_attempts_v1');
  for(const date of changed){if(uploadedWorkouts[date]&&!workoutUploadIsCurrent(date,customWorkouts[date]))attempts[date]={state:'pending',error:null,updatedAt:new Date().toISOString(),fingerprint:workoutUploadFingerprint(customWorkouts[date])};}
  saveObject('jp_export_attempts_v1',attempts);
  resetGeneratedPlannerPreviews();refreshAfterCalendarMutation();fillProfileForm();renderCalibration();
  return changed;
}
async function calibrationExportPending(){
  const pending=calibrationPending();
  for(const [date,workout] of pending){
    if(workoutExportsInFlight.has(date))continue;
    workoutExportsInFlight.add(date);
    try{
      const response=await fetchWithAppPin('/api/upload-workout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workoutDate:date,customWorkout:workout})});
      const data=await response.json();if(!response.ok||data.ok!==true||data.eventId==null)throw Error(data.error||'Export mislukt');
      uploadedWorkouts[date]={uploadedAt:new Date().toISOString(),name:workout.name,externalId:data.externalId||`jaco-performance-${date}`,eventId:data.eventId,fingerprint:workoutUploadFingerprint(workout)};saveObject(UPLOAD_KEY,uploadedWorkouts);
      const attempts=loadObject('jp_export_attempts_v1');attempts[date]={state:'synced',updatedAt:new Date().toISOString()};saveObject('jp_export_attempts_v1',attempts);
    }catch(error){const attempts=loadObject('jp_export_attempts_v1');attempts[date]={state:'failed',error:error.message,fingerprint:workoutUploadFingerprint(workout),updatedAt:new Date().toISOString()};saveObject('jp_export_attempts_v1',attempts);}
    finally{workoutExportsInFlight.delete(date);}
  }
  renderCalibration();renderMonth();
}
function calibrationShowStatus(text,error=false){const el=document.getElementById('calibrationStatus');if(el){el.textContent=text;el.className=error?'status error':'status ok';}}
function calibrationOpen(){switchView('dashboard');document.getElementById('calibrationCard')?.scrollIntoView({behavior:'smooth',block:'start'});}
function calibrationRecentRace(){return Object.values(syncedActivities||{}).find(a=>syncedSportFamily(a.type)==='run'&&CalibrationEngine.age(todayDateString(),a.date)>=0&&CalibrationEngine.age(todayDateString(),a.date)<=42&&performanceModelRaceForActivity(a));}
function renderCalibration(){
  const root=document.getElementById('calibrationContent');if(!root)return;
  const e=escapeHtmlAttribute,s=calibrationState(),recommend=CalibrationEngine.recommendation(s,{today:todayDateString(),phase:classifyRacePhase(getRaceFocus()).phase,recentRace:calibrationRecentRace()});
  root.innerHTML=`<p class="help">${e(recommend.reason)}</p><div class="calibration-values">${['run','ride','swim'].map(sport=>`<section><h4>${{run:'Hardlopen',ride:'Fietsen',swim:'Zwemmen'}[sport]}</h4>${(sport==='run'?['aerobicHr','thresholdHr','thresholdPace','maxHr','observedHr','performance']:sport==='ride'?['thresholdHr','maxHr','ftp']:['css']).map(metric=>{const v=s.values[sport][metric];return `<div class="calibration-value"><span>${e(CalibrationEngine.METRICS[metric][0])}</span><strong>${e(calibrationText(v))}</strong><small>${v?e(`${v.date||'Datum onbekend'} · ${v.source} · ${v.quality}${v.locked?' · vastgezet':''}`):'Geen persoonlijke meting beschikbaar'}</small></div>`;}).join('')}${CalibrationEngine.zones(s.values,sport).length?`<details><summary>Hartslagzones · Friel</summary><p class="help">Trainingsindeling op drempelhartslag. Z2 is niet automatisch de gemeten aerobe grens.</p><p>${CalibrationEngine.zones(s.values,sport).map(z=>`${z.label}: ${z.min??'≤'}–${z.max??'hoger'} bpm`).join(' · ')}</p></details>`:''}</section>`).join('')}</div>
    <p class="help">Tempodoelen gebruiken de geaccepteerde drempeltempo-schatting. Zonder die waarde gebruikt een geaccepteerde prestatie een Riegel-model (exponent 1,06) voor trainingsdoelen; dit wordt niet opgeslagen als gemeten drempel. Gemengde/handmatig vastgezette trainingen behouden hun eigen doelen.</p><p class="help">Aerobe grens, lactaatdrempels (LT1/LT2), ventilatoire drempels (VT1/VT2) en HRmax zijn verschillende begrippen. Veldtesten meten geen lactaat of ademgassen. Fiets- en zwemwaarden kunnen handmatig worden vastgelegd; automatische FTP-/CSS-testverwerking is nog niet beschikbaar.</p>`;
  const history=document.getElementById('calibrationResults');
  history.innerHTML=s.results.slice().reverse().slice(0,30).map(r=>`<article class="calibration-result"><strong>${e(r.method)} · ${e(r.date)}</strong><p>${e(r.quality)} · ${e(r.status)} · ${e(r.summary||'Handmatig ingevoerde bron; controleer waarde en methode.')}</p>${(r.issues||[]).map(x=>`<p class="help">${e(x)}</p>`).join('')}${r.candidates.map(c=>{const old=(r.status==='accepted'?r.previous:s.values)?.[c.sport]?.[c.metric];return `<p>${e(CalibrationEngine.METRICS[c.metric][0])}: ${e(calibrationText(old))} → <strong>${e(calibrationText(c))}</strong>${old?` (${c.value-old.value>0?'+':''}${Math.round(c.value-old.value)} ${e(CalibrationEngine.METRICS[c.metric][1])})`:''}<br><small>${e(c.method)} · ${e(c.quality)}</small></p>`;}).join('')}${r.status==='pending'&&r.quality==='bruikbaar'&&r.candidates.length?`<p class="help">Acceptatie wijzigt alleen de genoemde waarden. Alleen toekomstige, niet vastgezette trainingen krijgen aangepaste doelen. Historie blijft behouden.</p><label><input type="checkbox" data-conflict="${e(r.id)}"> Nieuwe bron expliciet leidend maken boven een vastgezette, professionele of recentere bron</label><label><input type="checkbox" data-large="${e(r.id)}"> Wijziging groter dan 8% gecontroleerd</label><button type="button" data-cal-accept="${e(r.id)}">Waarden accepteren</button>`:''}${r.status==='pending'?`<button type="button" class="secondary" data-cal-reject="${e(r.id)}">Afwijzen</button>`:''}</article>`).join('')||'<p class="help">Nog geen testresultaten. Analyseer een activiteit of voer een eigen test in.</p>';
  const historyEl=document.getElementById('calibrationHistory');
  historyEl.innerHTML=s.history.slice().reverse().slice(0,15).map(h=>`<li>Versie ${h.revision} · ${e(h.date||'')} ${h.undoOf?`· teruggedraaid vanaf versie ${h.undoOf}`:''}<br>${['run','ride','swim'].flatMap(sport=>Object.entries(h.after[sport]||{}).filter(([metric,v])=>JSON.stringify(h.before[sport]?.[metric])!==JSON.stringify(v)).map(([metric,v])=>`${e(sport)} ${e(CalibrationEngine.METRICS[metric][0])}: ${e(calibrationText(h.before[sport]?.[metric]))} → ${e(calibrationText(v))}`)).join('<br>')}</li>`).join('');
  document.getElementById('calibrationUndo').disabled=!s.history.length;
  document.getElementById('calibrationPlans').innerHTML=Object.entries(s.plans).filter(([d,p])=>allWorkouts()[d]?.calibration?.id===p.id).map(([d,p])=>`<p>${e(d)} · ${e(CalibrationEngine.PROTOCOLS[p.kind].name)} ${d>todayDateString()?`<button class="secondary" type="button" data-cal-cancel="${e(d)}">Herstel oorspronkelijke training</button>`:''}</p>`).join('');
  const pending=calibrationPending();
  document.getElementById('calibrationExport').hidden=!pending.length;
  document.getElementById('calibrationExportStatus').textContent=pending.length?`${pending.length} gewijzigde training(en) nog niet gesynchroniseerd. Gebruik Bijwerken; bij fouten blijft dit zichtbaar.`:'Geen gewijzigde exports in afwachting. Nieuwe testen exporteer je vanuit Planning.';
  const select=document.getElementById('calibrationActivity'),old=select.value;
  select.innerHTML='<option value="">Kies uitgevoerde activiteit</option>'+Object.values(syncedActivities||{}).filter(a=>syncedSportFamily(a.type)==='run').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,100).map(a=>`<option value="${e(a.id)}">${e(a.date)} · ${e(a.name)} · ${e(a.distanceKm)} km</option>`).join('');select.value=old;
  document.querySelectorAll('[data-cal-accept]').forEach(b=>b.onclick=async()=>{try{const id=b.dataset.calAccept;const conflict=[...document.querySelectorAll('[data-conflict]')].find(x=>x.dataset.conflict===id)?.checked;const large=[...document.querySelectorAll('[data-large]')].find(x=>x.dataset.large===id)?.checked;calibrationCommit(CalibrationEngine.accept(calibrationState(),id,{resolveConflict:conflict,confirmLarge:large,today:todayDateString()}));calibrationShowStatus('Waarden geaccepteerd; toekomstige trainingen bijgewerkt.');await calibrationExportPending();}catch(err){calibrationShowStatus(err.message,true);}});
  document.querySelectorAll('[data-cal-reject]').forEach(b=>b.onclick=()=>{calibrationSave(CalibrationEngine.reject(calibrationState(),b.dataset.calReject));renderCalibration();});
  document.querySelectorAll('[data-cal-cancel]').forEach(b=>b.onclick=()=>{try{calibrationCancel(b.dataset.calCancel);}catch(err){calibrationShowStatus(err.message,true);}});
  for(const id of ['profileMaxHr','profileZ2Hr']){const el=document.getElementById(id);if(el){el.readOnly=true;el.title='Wijzig met bron en historie via Voortgang → Kalibratie & zones';}}
}
function calibrationProtocolInfo(){
  const kind=document.getElementById('calibrationKind').value,p=CalibrationEngine.PROTOCOLS[kind],e=escapeHtmlAttribute;
  document.getElementById('calibrationProtocol').innerHTML=`<h4>${e(p.name)} · ${p.minutes} minuten</h4><p>${e(p.measures)}</p><ol>${p.steps.map(([m,t])=>`<li>${m?m+' min':'5 km'}: ${e(t)}</li>`).join('')}</ol><p>${e(p.needs)}</p><p class="help">Hartslag: borstband aanbevolen, ook daarmee kunnen fouten voorkomen. Kies koele omstandigheden, wees uitgerust en drink normaal. Stop bij pijn op de borst, duizeligheid, ongewone benauwdheid, hartkloppingen of scherpe pijn. Laat inspanningsklachten beoordelen.</p><p class="help">${p.hard?'Zware test, nooit automatisch ingepland. Een rustige duurcontrole is het submaximale alternatief en meet geen HRmax.':'Submaximaal: houd praten comfortabel, zoek niet de maximale hartslag op.'}</p><a href="${e(p.source)}" target="_blank" rel="noopener">Protocolbron</a>`;
  const ctx=calibrationContext(),slots=Object.keys(ctx.workouts).sort().filter(d=>!CalibrationEngine.slot(kind,d,ctx));
  const dates=document.getElementById('calibrationDate');dates.innerHTML=slots.map(d=>`<option value="${e(d)}">${e(d)} · vervangt ${e(ctx.workouts[d].name)}</option>`).join('');
  document.getElementById('calibrationPlanButton').disabled=!slots.length;
  document.getElementById('calibrationSlotReason').textContent=slots.length?'De test vervangt de gekozen training en telt mee in je beschikbare tijd.':'Geen geschikt bestaand slot: controleer herstel, beschikbare tijd en ruimte rond zware trainingen of wedstrijden. Er wordt niets extra ingepland.';
}
function setupCalibration(){
  calibrationInitialize();calibrationProtocolInfo();
  document.getElementById('calibrationKind').onchange=calibrationProtocolInfo;
  document.getElementById('calibrationPlanForm').onsubmit=event=>{event.preventDefault();try{calibrationPlan(document.getElementById('calibrationKind').value,document.getElementById('calibrationDate').value,calibrationCheck(event.target));calibrationProtocolInfo();calibrationShowStatus('Kalibratie vervangt de training; zichtbaar in Vandaag en Planning. Controleer je geschiktheid opnieuw op de testdag.');}catch(err){calibrationShowStatus(err.message,true);}};
  document.getElementById('calibrationUndo').onclick=async()=>{try{calibrationCommit(CalibrationEngine.undo(calibrationState(),todayDateString()));calibrationShowStatus('Vorige waarden hersteld. Ongewijzigde toekomstige trainingen teruggezet.');await calibrationExportPending();}catch(err){calibrationShowStatus(err.message,true);}};
  document.getElementById('calibrationExport').onclick=calibrationExportPending;
  document.getElementById('calibrationManual').onsubmit=event=>{event.preventDefault();try{
    const f=event.target.elements,s=calibrationState(),v=CalibrationEngine.validateValue({sport:f.sport.value,metric:f.metric.value,value:f.value.value,date:f.date.value,source:f.source.value.trim(),method:f.method.value.trim(),sourceType:f.sourceType.value,quality:f.sourceType.value==='professional'?'professioneel bepaald':'handmatig opgegeven veldschatting',locked:f.locked.checked,distanceKm:Number(f.distanceKm.value)||undefined});
    if(CalibrationEngine.age(todayDateString(),v.date)<0)throw Error('Testdatum mag niet in de toekomst liggen.');
    calibrationSave(CalibrationEngine.addResult(s,{id:`manual:${Date.now()}`,kind:'manual',date:v.date,method:v.method,status:'pending',quality:'bruikbaar',issues:[],summary:'Handmatige invoer; de app heeft het onderliggende rapport niet gecontroleerd.',candidates:[v]}));renderCalibration();calibrationShowStatus('Eigen test opgeslagen als voorstel. Beoordeel en accepteer hieronder.');
  }catch(err){calibrationShowStatus(err.message,true);}};
  document.getElementById('calibrationAnalyze').onsubmit=async event=>{event.preventDefault();const form=event.target,f=form.elements,button=form.querySelector('button[type="submit"]');button.disabled=true;try{
    const id=f.activity.value,a=Object.values(syncedActivities||{}).find(x=>String(x.id)===id);if(!a)throw Error('Kies een gesynchroniseerde hardloopactiviteit.');
    const s=calibrationState(),existing=s.results.find(r=>r.activityId===id);if(existing&&(existing.status!=='pending'||existing.quality==='bruikbaar'))throw Error('Deze activiteit is al beoordeeld of heeft een bruikbaar resultaat. Het bestaande resultaat blijft behouden; opnieuw synchroniseren maakt geen duplicaat.');
    calibrationShowStatus('Tijdreeksen ophalen en testblok controleren…');
    const response=await fetchWithAppPin(`/api/intervals-activity-detail?activityId=${encodeURIComponent(id)}&streams=1`);const detail=await response.json();if(!response.ok)throw Error(detail.error||'Details niet beschikbaar');
    const flags=Object.fromEntries(['completed','conditionsReviewed','talkComfortable','heat','fatigue','hills','interruptions','gpsProblems','measuredCourse'].map(k=>[k,f[k].checked]));
    const kind=f.kind.value;const result=CalibrationEngine.analyze(kind,{...flags,activityId:id,date:a.date,sport:syncedSportFamily(detail.activity?.type||a.type),start:f.start.value,end:f.end.value,rpe:f.rpe.value,distanceKm:f.distanceKm.value,samples:detail.samples,check:calibrationCheck(form)});
    if(detail.streamError)result.issues.push(detail.streamError);
    if(result.observedHr&&result.observedHr>(calibrationValue('observedHr')?.value||0))result.candidates.push({sport:'run',metric:'observedHr',value:result.observedHr,date:a.date,source:`Intervals.icu ${id}`,sourceType:'field',method:'Hoogste gemiddelde over 10 seconden',quality:'waarneming; geen HRmax-test',locked:false});
    calibrationSave(CalibrationEngine.addResult(calibrationState(),result,{retry:true}));renderCalibration();calibrationShowStatus('Analyse opgeslagen. Waarden veranderen pas na jouw acceptatie.');
  }catch(err){calibrationShowStatus(err.message,true);}finally{button.disabled=false;}};
}
document.addEventListener('DOMContentLoaded',setupCalibration);
