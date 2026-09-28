const ACTIVITY_REVIEWS_KEY="jp_activity_reviews_v1";
let activityReviews=loadObject(ACTIVITY_REVIEWS_KEY);
let selectedResultId=null;
let resultRouteRequest=0;
const resultRoutes=new Map();

function resultNumber(value,digits=0,unit=""){
  const number=finiteNumberOrNull(value);
  return number===null?"—":`${number.toLocaleString("nl-NL",{
    maximumFractionDigits:digits,minimumFractionDigits:digits
  })}${unit}`;
}

function resultPace(activity){
  const km=finiteNumberOrNull(activity.distanceKm);
  const minutes=finiteNumberOrNull(activity.durationMinutes);
  if(syncedSportFamily(activity.type)!=="run" || !km || !minutes) return null;
  const seconds=Math.round(minutes*60/km);
  return seconds>0 && seconds<3600
    ?`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")} /km`:null;
}

function recentActivityResults(){
  return Object.values(syncedActivities)
    .filter(activity=>activity?.id && activity.date &&
      (calendarDayDifference(todayDateString(),activity.date)??999)<=56 &&
      activity.date<=todayDateString())
    .sort((a,b)=>String(b.startDateLocal||b.date).localeCompare(
      String(a.startDateLocal||a.date)))
    .slice(0,100);
}

function renderActivityResults(){
  const list=document.getElementById("activityResultsList");
  const detail=document.getElementById("activityResultDetail");
  if(!list || !detail) return;
  const activities=recentActivityResults();
  list.innerHTML=activities.length?activities.map(activity=>{
    const reviewed=activityReviews[activity.id];
    return `<button type="button" class="activity-result-row${selectedResultId===activity.id?" selected":""}" data-activity-id="${escapeHtmlAttribute(activity.id)}" aria-pressed="${selectedResultId===activity.id}">
      <span><strong>${safe(activity.name)}</strong><small>${safe(activity.date)} · ${safe(activity.type||"Training")}</small></span>
      <span class="activity-result-side"><strong>${safe(resultNumber(activity.distanceKm,1," km"))}</strong><small>${reviewed?`Beoordeeld · RPE ${safe(reviewed.sessionRpe)}`:"Bekijk resultaat"}</small></span>
    </button>`;
  }).join(""):'<p class="help">Nog geen uitgevoerde trainingen beschikbaar. Gebruik Sync trainingen om Intervals.icu op te halen.</p>';
  const selected=activities.find(item=>item.id===selectedResultId);
  if(selected) renderActivityResultDetail(selected);
  else{selectedResultId=null;detail.hidden=true;detail.innerHTML="";}
}

function activityRouteSvg(points){
  if(!Array.isArray(points) || points.length<2) return "";
  const coordinates=points.filter(point=>Array.isArray(point) &&
    point.length===2 && point.every(Number.isFinite));
  if(coordinates.length<2) return "";
  const lats=coordinates.map(point=>point[0]);
  const lons=coordinates.map(point=>point[1]);
  if(Math.max(...lons)-Math.min(...lons)>180) return "";
  const mercator=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
  const xs=lons.map(lon=>lon*Math.PI/180);
  const ys=lats.map(lat=>mercator(lat));
  const minX=Math.min(...xs),maxX=Math.max(...xs);
  const minY=Math.min(...ys),maxY=Math.max(...ys);
  const scale=Math.min(316/Math.max(maxX-minX,1e-8),174/Math.max(maxY-minY,1e-8));
  const left=(360-(maxX-minX)*scale)/2;
  const top=(220-(maxY-minY)*scale)/2;
  const screen=coordinates.map((_,i)=>[
    left+(xs[i]-minX)*scale,
    220-top-(ys[i]-minY)*scale
  ]);
  const path=screen.map(([x,y])=>`${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const start=screen[0],end=screen[screen.length-1];
  return `<figure class="activity-route">
    <svg viewBox="0 0 360 220" role="img" aria-label="GPS-route van de training, start groen en finish donkerblauw">
      <path d="M0 55H360 M0 110H360 M0 165H360 M90 0V220 M180 0V220 M270 0V220" class="activity-route-grid"/>
      <polyline points="${path}" class="activity-route-line"/>
      <circle cx="${start[0].toFixed(1)}" cy="${start[1].toFixed(1)}" r="5" class="activity-route-start"/>
      <circle cx="${end[0].toFixed(1)}" cy="${end[1].toFixed(1)}" r="5" class="activity-route-end"/>
    </svg>
    <figcaption>GPS-route · schematisch, zonder kaartondergrond · start ● groen, finish ● blauw</figcaption>
  </figure>`;
}

async function loadActivityRoute(activity){
  const token=++resultRouteRequest;
  const target=document.getElementById("activityRoutePreview");
  if(!target) return;
  if(activity.hasGps===false){
    target.textContent="Voor deze activiteit is geen GPS-route beschikbaar.";
    return;
  }
  if(resultRoutes.has(activity.id)){
    target.innerHTML=resultRoutes.get(activity.id) ||
      "Geen bruikbare GPS-route bij deze training.";
    return;
  }
  target.textContent="GPS-route wordt opgehaald…";
  try{
    const response=await fetchWithAppPin(
      `/api/intervals-activity-route?activityId=${encodeURIComponent(activity.id)}`);
    const data=await response.json();
    if(token!==resultRouteRequest || selectedResultId!==activity.id) return;
    if(!response.ok) throw new Error(data.error||"Route niet beschikbaar.");
    const svg=activityRouteSvg(data.points);
    if(resultRoutes.size>=12) resultRoutes.delete(resultRoutes.keys().next().value);
    resultRoutes.set(activity.id,svg);
    if(svg) target.innerHTML=svg;
    else target.textContent="Geen bruikbare GPS-route bij deze training.";
  }catch(error){
    if(token===resultRouteRequest && selectedResultId===activity.id){
      target.textContent=`Route niet beschikbaar: ${error.message}`;
    }
  }
}

function renderActivityResultDetail(activity){
  const detail=document.getElementById("activityResultDetail");
  if(!detail) return;
  const review=activityReviews[activity.id]||{};
  const metric=(label,value)=>`<div><span>${label}</span><strong>${safe(value)}</strong></div>`;
  const scoreSelect=(id,label,max,min=1)=>`<label>${label}<select name="${id}" required>
    <option value="">Kies</option>${Array.from({length:max-min+1},(_,i)=>{
      const value=i+min;
      return `<option value="${value}"${review[id]===value?" selected":""}>${value}${value===0?" · geen":""}</option>`;
    }).join("")}</select></label>`;
  const pace=resultPace(activity);
  detail.hidden=false;
  detail.innerHTML=`<div class="activity-result-heading">
      <div><p class="label">${safe(activity.date)} · ${safe(activity.type||"Training")}</p><h4>${safe(activity.name)}</h4></div>
      <button type="button" class="secondary" id="closeActivityResult">Sluiten</button>
    </div>
    <div class="activity-result-metrics">
      ${metric("Afstand",resultNumber(activity.distanceKm,2," km"))}
      ${metric("Beweegtijd",resultNumber(activity.durationMinutes,0," min"))}
      ${metric("Gem. tempo",pace||"—")}
      ${metric("Gem. hartslag",resultNumber(activity.averageHeartRate,0," bpm"))}
      ${metric("Hoogtemeters",resultNumber(activity.elevationM,0," m"))}
      ${metric("Belasting",resultNumber(activity.trainingLoad,0))}
    </div>
    <div id="activityRoutePreview" class="activity-route-preview" role="status"></div>
    <form id="activityReviewForm" data-activity-id="${escapeHtmlAttribute(activity.id)}">
      <h4>Hoe voelde deze training?</h4>
      <p class="help">Je beoordeling wordt per activiteit bewaard en helpt het coachadvies. Vul alle vijf scores bewust in.</p>
      <div class="activity-review-grid">
        ${scoreSelect("sessionRpe","Zwaarte · RPE",10)}
        ${scoreSelect("legs","Benen · 1 fris, 5 zwaar",5)}
        ${scoreSelect("energy","Energie · 1 laag, 5 hoog",5)}
        ${scoreSelect("enjoyment","Plezier · 1 laag, 5 hoog",5)}
        ${scoreSelect("complaintSeverity","Klachten · 0 geen, 3 sterk",3,0)}
      </div>
      <label>Opmerking (optioneel)<textarea name="note" rows="2" maxlength="500" placeholder="Bijv. laatste blok zwaar, kuit licht gevoelig">${safe(review.note||"")}</textarea></label>
      <div class="today-actions"><button type="submit">${review.savedAt?"Beoordeling bijwerken":"Beoordeling opslaan"}</button>
        <button type="button" class="secondary" id="openResultDiary">Open dagboek</button>
        ${review.savedAt?'<button type="button" class="secondary" id="deleteActivityReview">Verwijder beoordeling</button>':""}</div>
      <p id="activityReviewStatus" class="status" role="status"></p>
    </form>`;
  loadActivityRoute(activity);
}

function selectActivityResult(id){
  if(!Object.hasOwn(syncedActivities,id)) return;
  selectedResultId=id;
  renderActivityResults();
  document.getElementById("activityResultDetail")?.scrollIntoView({block:"nearest",behavior:"smooth"});
}

function deriveActivityDiary(date){
  const reviews=Object.values(activityReviews).filter(item=>item?.date===date);
  if(!reviews.length) return null;
  const latest=reviews.slice().sort((a,b)=>String(b.startDateLocal||"").localeCompare(
    String(a.startDateLocal||"")))[0];
  const workout=diaryWorkoutForDate(date);
  const max=key=>Math.max(...reviews.map(item=>item[key]));
  const min=key=>Math.min(...reviews.map(item=>item[key]));
  return{
    date,source:"activity_reviews",activityIds:reviews.map(item=>item.activityId),
    workoutName:latest.name,workoutType:latest.type,
    plannedDistanceKm:finiteNumberOrNull(workout?.distanceKm),
    plannedDurationMinutes:finiteNumberOrNull(workout?.durationMinutes),
    actualDistanceKm:null,actualDurationMinutes:null,
    sessionRpe:max("sessionRpe"),legs:max("legs"),energy:min("energy"),
    enjoyment:min("enjoyment"),complaintSeverity:max("complaintSeverity"),
    complaintText:"",note:latest.note||"",savedAt:new Date().toISOString()
  };
}

function saveActivityReview(event){
  event.preventDefault();
  const form=event.target;
  const activity=syncedActivities[form.dataset.activityId];
  if(!activity) return;
  const scores={};
  for(const [key,min,max] of [
    ["sessionRpe",1,10],["legs",1,5],["energy",1,5],
    ["enjoyment",1,5],["complaintSeverity",0,3]
  ]){
    const raw=form.elements[key].value;
    const value=Number(raw);
    if(raw==="" || !Number.isInteger(value) || value<min || value>max){
      form.elements[key].focus();
      return;
    }
    scores[key]=value;
  }
  activityReviews[activity.id]={activityId:activity.id,date:activity.date,
    startDateLocal:activity.startDateLocal,name:activity.name,type:activity.type,
    ...scores,note:form.elements.note.value.trim().slice(0,500),savedAt:new Date().toISOString()};
  saveObject(ACTIVITY_REVIEWS_KEY,activityReviews);
  const diary=coachDiary[activity.date];
  const mirrored=!diary || diary.source==="activity_reviews";
  if(mirrored){
    coachDiary[activity.date]=deriveActivityDiary(activity.date);
    saveObject(DIARY_KEY,coachDiary);
    resetGeneratedPlannerPreviews();
    renderFullSeasonSchedulePreview();
    refreshDerivedCoachViews();
    renderCoachDiary(document.getElementById("diaryDate")?.value||todayDateString());
  }
  renderActivityResults();
  const status=document.getElementById("activityReviewStatus");
  if(status){
    status.className="status ok";
    status.textContent=mirrored
      ?"Beoordeling opgeslagen. Het coachadvies is opnieuw berekend; bij meerdere trainingen gebruikt de dagcoach de zwaarste belasting en klachten, en de laagste energie."
      :"Beoordeling opgeslagen. Je bestaande handmatige dagcheck-in blijft leidend voor het coachadvies.";
  }
}

function deleteActivityReview(){
  const activity=syncedActivities[selectedResultId];
  if(!activity || !activityReviews[activity.id] ||
    !confirm(`Beoordeling van ${activity.name} verwijderen?`)) return;
  delete activityReviews[activity.id];
  saveObject(ACTIVITY_REVIEWS_KEY,activityReviews);
  if(coachDiary[activity.date]?.source==="activity_reviews"){
    const derived=deriveActivityDiary(activity.date);
    if(derived) coachDiary[activity.date]=derived;
    else delete coachDiary[activity.date];
    saveObject(DIARY_KEY,coachDiary);
    resetGeneratedPlannerPreviews();
    renderFullSeasonSchedulePreview();
    refreshDerivedCoachViews();
    renderCoachDiary(document.getElementById("diaryDate")?.value||todayDateString());
  }
  renderActivityResults();
  const status=document.getElementById("activityReviewStatus");
  if(status){status.className="status ok";status.textContent="Beoordeling verwijderd. Het coachadvies is bijgewerkt.";}
}

function handleActivityResultClick(event){
  const row=event.target.closest("[data-activity-id]");
  if(row && row.closest("#activityResultsList")){
    selectActivityResult(row.dataset.activityId);
    return;
  }
  if(event.target.closest("#closeActivityResult")){
    selectedResultId=null;
    resultRouteRequest++;
    renderActivityResults();
    return;
  }
  if(event.target.closest("#openResultDiary")){
    const activity=syncedActivities[selectedResultId];
    if(activity) openDiaryForDate(activity.date);
  }
  if(event.target.closest("#deleteActivityReview")) deleteActivityReview();
}
