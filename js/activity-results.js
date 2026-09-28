const ACTIVITY_REVIEWS_KEY="jp_activity_reviews_v1";
let activityReviews=loadObject(ACTIVITY_REVIEWS_KEY);
let selectedResultId=null;
let resultRouteRequest=0;
const resultRoutes=new Map();
const resultIntervals=new Map();
let resultSportFilter="all";

function resultNumber(value,digits=0,unit=""){
  const number=finiteNumberOrNull(value);
  return number===null?"—":`${number.toLocaleString("nl-NL",{
    maximumFractionDigits:digits,minimumFractionDigits:digits
  })}${unit}`;
}

function resultPace(activity){
  const km=finiteNumberOrNull(activity.distanceKm);
  const minutes=finiteNumberOrNull(activity.durationMinutes);
  const family=syncedSportFamily(activity.type);
  if(!["run","swim"].includes(family) || !km || !minutes) return null;
  const seconds=Math.round(minutes*60/(family==="swim"?km*10:km));
  return seconds>0 && seconds<3600
    ?`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")} ${family==="swim"?"/100 m":"/km"}`:null;
}

function suggestedActivityRpe(activity,profile){
  const average=finiteNumberOrNull(activity?.averageHeartRate);
  const max=finiteNumberOrNull(profile?.maxHr);
  const z2=finiteNumberOrNull(profile?.z2Hr);
  if(average===null || max===null || z2===null ||
    max<120 || max>230 || z2<90 || z2>=max-15 ||
    average<55 || average>max+5) return null;
  if(average<z2-20) return 2;
  if(average<z2-10) return 3;
  if(average<=z2) return 4;
  const fraction=(average-z2)/(max-z2);
  if(fraction<=.2) return 5;
  if(fraction<=.4) return 6;
  if(fraction<=.6) return 7;
  if(fraction<=.8) return 8;
  return 9;
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

function activityResultPlanComparison(activity){
  const workout=allWorkouts()[activity.date]||null;
  if(!workout || ["Rest","Race"].includes(workout.type)) return null;
  const execution=trainingExecutionForDate(activity.date,workout);
  if(execution.actual?.id!==activity.id || !execution.matched) return null;
  const difference=(actual,planned,unit,digits=0)=>{
    const a=finiteNumberOrNull(actual),p=finiteNumberOrNull(planned);
    if(a===null || p===null || p<=0) return null;
    const delta=a-p;
    const rounded=Math.abs(delta).toLocaleString("nl-NL",{
      maximumFractionDigits:digits,minimumFractionDigits:digits
    });
    return Math.abs(delta)<(digits?0.05:0.5)
      ?`Volgens plan (${resultNumber(p,digits,unit)})`
      :`${delta>0?"+":"−"}${rounded}${unit} t.o.v. ${resultNumber(p,digits,unit)} gepland`;
  };
  return{
    name:workout.name,
    distance:difference(activity.distanceKm,workout.distanceKm," km",1),
    duration:difference(activity.durationMinutes,workout.durationMinutes," min")
  };
}

function activityReviewInsight(activity,review){
  if(!review) return{
    tone:"neutral",title:"Nog niet beoordeeld",
    explanation:"De meetgegevens zijn binnen. Vul in hoe deze training voelde om het coachsignaal aan te vullen.",
    coach:"Er is nog geen subjectieve beoordeling van deze activiteit opgeslagen."
  };
  const manual=coachDiary[activity.date] &&
    coachDiary[activity.date].source!=="activity_reviews";
  let tone="steady",title="Reactie genoteerd";
  let explanation="Geen duidelijk herstelalarm in deze beoordeling. De coach combineert dit met je overige gegevens.";
  if(review.complaintSeverity!=null && review.complaintSeverity>=2){
    tone="caution";title="Klachten vragen aandacht";
    explanation="Je meldde duidelijke klachten. Controleer het actuele coachadvies voordat je de volgende zware training uitvoert.";
  }else if(review.sessionRpe>=8 && review.legs!=null && review.legs>=4 &&
    review.energy!=null && review.energy<=2){
    tone="caution";title="Zware trainingsrespons";
    explanation="De combinatie van hoge zwaarte, zware benen en lage energie is een herstelsignaal voor de coach.";
  }else if(review.sessionRpe>=8){
    tone="attention";title="Zware training voltooid";
    explanation="Je gaf een hoge RPE op zonder extra klachten- of vermoeidheidssignaal in deze beoordeling. De coach weegt de overige daggegevens mee.";
  }else if((review.legs!=null && review.legs>=4) ||
    (review.energy!=null && review.energy<=2)){
    tone="attention";title="Herstel in de gaten houden";
    explanation="Je benen of energie vragen aandacht. De coach gebruikt de volledige dagcontext voor het vervolg.";
  }
  return{
    tone,title,explanation,
    coach:manual
      ?"Er is ook een handmatige dag-check-in. Die blijft leidend voor het coachadvies; pas die aan als dit resultaat je dagbeeld verandert."
      :"Deze beoordeling is verwerkt in het dagboeksignaal. Bij meerdere trainingen op één dag gebruikt de coach de zwaarste bekende inspanning en klachten en de laagste bekende energie."
  };
}

function filterActivityResults(activities,filter){
  return activities.filter(activity=>filter==="all" ||
    (filter==="unreviewed"
      ?!activityReviews[activity.id]
      :filter==="other"
        ?!["run","ride","swim"].includes(syncedSportFamily(activity.type))
        :syncedSportFamily(activity.type)===filter));
}

function activityWeekSummary(activities,reviews,today,meta){
  const start=addDays(today,-6);
  const rows=activities.filter(activity=>activity?.date>=start && activity.date<=today);
  const run=rows.filter(activity=>syncedSportFamily(activity.type)==="run");
  const known=(items,key)=>items.map(item=>finiteNumberOrNull(item[key]))
    .filter(value=>value!==null && value>=0);
  const distances=known(run,"distanceKm");
  const minutes=known(rows,"durationMinutes");
  const loads=known(rows,"trainingLoad");
  const rated=rows.filter(activity=>reviews[activity.id]);
  const days=Array.from({length:7},(_,index)=>{
    const date=addDays(start,index);
    const daily=run.filter(activity=>activity.date===date);
    return{date,runKm:known(daily,"distanceKm").reduce((a,b)=>a+b,0),
      missing:daily.some(activity=>finiteNumberOrNull(activity.distanceKm)===null),
      covered:Boolean(meta?.fetchedAt && meta.oldest && meta.newest &&
        date>=meta.oldest && date<=meta.newest)};
  });
  return{
    start,today,activities:rows.length,runCount:run.length,
    runKm:distances.reduce((a,b)=>a+b,0),runDistanceCount:distances.length,
    minutes:minutes.reduce((a,b)=>a+b,0),durationCount:minutes.length,
    load:loads.reduce((a,b)=>a+b,0),loadCount:loads.length,
    rated:rated.length,
    complaints:rated.filter(activity=>Number(reviews[activity.id].complaintSeverity)>=2).length,
    covered:Boolean(meta?.fetchedAt && meta.oldest<=start && meta.newest>=today),
    fetchedAt:meta?.fetchedAt||null,days
  };
}

function renderActivityWeekReport(){
  const box=document.getElementById("activityWeekReport");
  if(!box) return;
  const summary=activityWeekSummary(Object.values(syncedActivities),activityReviews,
    todayDateString(),activitySyncMeta);
  if(!summary.fetchedAt){
    box.innerHTML='<p class="help">Weekoverzicht verschijnt na de eerste Training Sync.</p>';
    return;
  }
  const maxKm=Math.max(1,...summary.days.map(item=>item.runKm));
  const metric=(label,value,note)=>`<div><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;
  const race=getRaceFocus();
  box.innerHTML=`<div class="activity-week-head">
    <div><p class="label">Laatste 7 dagen</p><h3>Uitgevoerd en beoordeeld</h3></div>
    <small>${safe(summary.start)} t/m ${safe(summary.today)}</small>
  </div>
  <div class="activity-week-metrics">
    ${metric("Activiteiten",summary.activities,"uit Intervals.icu")}
    ${metric("Hardlopen",summary.runDistanceCount || !summary.runCount?`${summary.runKm.toFixed(1)} km`:"—",
      `${summary.runDistanceCount}/${summary.runCount} met afstand`)}
    ${metric("Beweegtijd",summary.durationCount?`${Math.round(summary.minutes)} min`:"—",
      `${summary.durationCount}/${summary.activities} met duur`)}
    ${metric("Beoordeeld",`${summary.rated}/${summary.activities}`,
      summary.complaints?`${summary.complaints} met duidelijke klachten`:"per activiteit")}
  </div>
  <div class="activity-week-bars" role="img" aria-label="Hardloopafstand per dag: ${summary.days.map(day=>`${day.date} ${!day.covered?"geen syncdekking":day.missing && day.runKm===0?"afstand ontbreekt":`${day.runKm.toFixed(1)} kilometer${day.missing?" en ontbrekende afstand":""}`}`).join("; ")}">
    ${summary.days.map(day=>{
      const height=Math.round(day.runKm/maxKm*100);
      const label=new Date(day.date+"T12:00:00").toLocaleDateString("nl-NL",{weekday:"short"});
      return `<div class="activity-week-day" title="${safe(day.date)}: ${day.covered?`${day.runKm.toFixed(1)} km${day.missing?" · onvolledige afstand":""}`:"geen syncdekking"}">
        <strong>${day.covered && (!day.missing || day.runKm>0)?`${day.runKm.toFixed(1)}${day.missing?"*":""}`:"—"}</strong>
        <span class="activity-week-track"><span style="height:${day.covered?height:0}%"></span></span>
        <small>${safe(label)}</small>
      </div>`;
    }).join("")}
  </div>
  <p class="activity-week-caption">Balken tonen alleen geregistreerde hardloopkilometers; * betekent dat een afstand ontbreekt. ${summary.loadCount?`Bekende trainingsbelasting: ${Math.round(summary.load)} (${summary.loadCount}/${summary.activities} activiteiten met waarde). `:"Geen belastingsdata beschikbaar. "}${summary.covered?"Syncbereik omvat deze zeven dagen.":"Het syncbereik omvat niet alle zeven dagen; ontbrekende dagen zijn geen rustdagen."}</p>
  ${race?`<p class="activity-week-goal">Wedstrijdfocus: <strong>${safe(race.name)}</strong> · ${safe(race.date)}. Het weekoverzicht is een terugblik; het actuele coachadvies bepaalt de volgende training.</p>`:""}`;
}

function renderActivityResults(){
  const list=document.getElementById("activityResultsList");
  const detail=document.getElementById("activityResultDetail");
  if(!list || !detail) return;
  renderActivityWeekReport();
  const activities=recentActivityResults();
  const reviewButton=document.getElementById("reviewNextActivity");
  if(reviewButton){
    const open=activities.filter(activity=>!activityReviews[activity.id]).length;
    reviewButton.textContent=open?`Beoordeel training${open>1?` (${open})`:""}`:"Bekijk resultaten";
    reviewButton.setAttribute("aria-label",open
      ?`${open} training${open===1?"":"en"} te beoordelen; open de meest recente`
      :"Bekijk je uitgevoerde trainingen");
  }
  const filters=[
    ["all","Alles"],["unreviewed","Te beoordelen"],["run","Lopen"],["ride","Fietsen"],
    ["swim","Zwemmen"],["other","Overig"]
  ];
  const visible=filterActivityResults(activities,resultSportFilter);
  list.innerHTML=activities.length?`<div class="activity-result-filters" role="group" aria-label="Filter trainingen">
    ${filters.map(([value,label])=>`<button type="button" class="${resultSportFilter===value?"active":""}" data-result-filter="${value}" aria-pressed="${resultSportFilter===value}">${label}</button>`).join("")}
  </div><p class="activity-result-count">${visible.length} getoond · ${activities.filter(activity=>activityReviews[activity.id]).length} van ${activities.length} beoordeeld</p>`+
  (visible.length?visible.map(activity=>{
    const reviewed=activityReviews[activity.id];
    const family=syncedSportFamily(activity.type);
    const icon={run:"↗",ride:"◉",swim:"≈",strength:"◆"}[family]||"•";
    return `<button type="button" class="activity-result-row${selectedResultId===activity.id?" selected":""}" data-activity-id="${escapeHtmlAttribute(activity.id)}" aria-pressed="${selectedResultId===activity.id}">
      <span class="activity-result-icon" aria-hidden="true">${icon}</span>
      <span class="activity-result-main"><strong>${safe(activity.name)}</strong><small>${safe(activity.date)} · ${safe(activity.type||"Training")} · ${safe(resultNumber(activity.durationMinutes,0," min"))}</small></span>
      <span class="activity-result-side"><strong>${safe(resultNumber(activity.distanceKm,1," km"))}</strong><small>${reviewed?`✓ Beoordeeld · RPE ${safe(reviewed.sessionRpe)}`:"Beoordeel →"}</small></span>
    </button>`;
  }).join(""):'<p class="help">Geen trainingen binnen dit filter.</p>')
    :'<p class="help">Nog geen uitgevoerde trainingen beschikbaar. Gebruik Synchroniseer om Intervals.icu op te halen.</p>';
  const selected=activities.find(item=>item.id===selectedResultId);
  if(selected) renderActivityResultDetail(selected);
  else{selectedResultId=null;detail.hidden=true;detail.innerHTML="";}
}

function openNextActivityReview(){
  const activities=recentActivityResults();
  const next=activities.find(activity=>!activityReviews[activity.id]);
  if(next){
    resultSportFilter="unreviewed";
    selectActivityResult(next.id);
    document.getElementById("activityReviewForm")?.scrollIntoView({block:"start",behavior:"smooth"});
  }else{
    resultSportFilter="all";
    renderActivityResults();
    document.getElementById("activityResultsCard")?.scrollIntoView({block:"start",behavior:"smooth"});
  }
}

function activityRouteSvg(points){
  if(!Array.isArray(points) || points.length<2) return "";
  const coordinates=points.filter(point=>Array.isArray(point) &&
    point.length===2 && point.every(Number.isFinite));
  if(coordinates.length<2) return "";
  const lats=coordinates.map(point=>point[0]);
  const lons=coordinates.map(point=>point[1]);
  if(Math.max(...lons)-Math.min(...lons)>180) return "";
  const width=360,height=240;
  const project=([lat,lon],zoom)=>{
    const world=256*2**zoom;
    const radians=lat*Math.PI/180;
    return[(lon+180)/360*world,
      (1-Math.log(Math.tan(radians)+1/Math.cos(radians))/Math.PI)/2*world];
  };
  let zoom=3;
  for(let candidate=15;candidate>=3;candidate--){
    const a=project([Math.min(...lats),Math.min(...lons)],candidate);
    const b=project([Math.max(...lats),Math.max(...lons)],candidate);
    if(Math.abs(b[0]-a[0])<=width-48 && Math.abs(b[1]-a[1])<=height-48){
      zoom=candidate;break;
    }
  }
  const pixels=coordinates.map(point=>project(point,zoom));
  const xBounds=pixels.map(point=>point[0]),yBounds=pixels.map(point=>point[1]);
  const originX=(Math.min(...xBounds)+Math.max(...xBounds)-width)/2;
  const originY=(Math.min(...yBounds)+Math.max(...yBounds)-height)/2;
  const screen=pixels.map(([x,y])=>[x-originX,y-originY]);
  const path=screen.map(([x,y])=>`${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const start=screen[0],end=screen[screen.length-1];
  const maxTile=2**zoom;
  const tiles=[];
  for(let x=Math.floor(originX/256);x<=Math.floor((originX+width)/256);x++){
    for(let y=Math.floor(originY/256);y<=Math.floor((originY+height)/256);y++){
      if(y<0 || y>=maxTile) continue;
      const wrappedX=(x+maxTile)%maxTile;
      tiles.push(`<image href="https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png" x="${Math.round(x*256-originX)}" y="${Math.round(y*256-originY)}" width="256" height="256"/>`);
    }
  }
  return `<figure class="activity-route">
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Routekaart van de training, start groen en finish donkerblauw">
      ${tiles.join("")}
      <polyline points="${path}" class="activity-route-line"/>
      <polyline points="${path}" class="activity-route-line-top"/>
      <circle cx="${start[0].toFixed(1)}" cy="${start[1].toFixed(1)}" r="5" class="activity-route-start"/>
      <circle cx="${end[0].toFixed(1)}" cy="${end[1].toFixed(1)}" r="5" class="activity-route-end"/>
    </svg>
    <figcaption>GPS-route · start groen, finish blauw · kaartgegevens © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap-bijdragers</a>. Kaarttegels vragen internet.</figcaption>
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
  const hrSuggestion=suggestedActivityRpe(activity,getProfile());
  const initialRpe=review.sessionRpe??hrSuggestion??5;
  const metric=(label,value)=>`<div><span>${label}</span><strong>${safe(value)}</strong></div>`;
  const scoreSelect=(id,label,max,min=1)=>`<label>${label}<select name="${id}">
    <option value="">Niet ingevuld</option>${Array.from({length:max-min+1},(_,i)=>{
      const value=i+min;
      return `<option value="${value}"${review[id]===value?" selected":""}>${value}${value===0?" · geen":""}</option>`;
    }).join("")}</select></label>`;
  const pace=resultPace(activity);
  const family=syncedSportFamily(activity.type);
  const speed=activity.distanceKm>0 && activity.durationMinutes>0
    ?resultNumber(activity.distanceKm/(activity.durationMinutes/60),1," km/u"):"—";
  const comparison=activityResultPlanComparison(activity);
  const workout=allWorkouts()[activity.date]||null;
  const insight=activityReviewInsight(activity,review.savedAt?review:null);
  detail.hidden=false;
  detail.innerHTML=`<div class="activity-result-heading">
      <div><p class="label">${safe(activity.date)} · ${safe(activity.type||"Training")}</p><h4>${safe(activity.name)}</h4></div>
      <button type="button" class="secondary" id="closeActivityResult">Sluiten</button>
    </div>
    <div class="activity-result-metrics">
      ${metric("Afstand",resultNumber(activity.distanceKm,2," km"))}
      ${metric("Beweegtijd",resultNumber(activity.durationMinutes,0," min"))}
      ${metric(family==="ride"?"Gem. snelheid":"Gem. tempo",family==="ride"?speed:pace||"—")}
      ${metric("Gem. hartslag",resultNumber(activity.averageHeartRate,0," bpm"))}
    </div>
    <form id="activityReviewForm" data-activity-id="${escapeHtmlAttribute(activity.id)}">
      <h4>Hoe voelde deze training?</h4>
      <p class="help">Twee snelle keuzes per training. Extra details kun je toevoegen als ze belangrijk zijn.</p>
      <div class="activity-review-quick">
        <label class="activity-rpe-label" for="activityRpe">Zwaarte · RPE <output id="activityRpeValue" for="activityRpe">${safe(initialRpe)}/10</output></label>
        <input id="activityRpe" name="sessionRpe" type="range" min="1" max="10" step="1" value="${safe(initialRpe)}">
        <div class="activity-rpe-ends"><span>Heel licht</span><span>Maximaal</span></div>
        <p class="activity-rpe-hint">${review.savedAt
          ?"Jouw opgeslagen RPE. Verschuif de balk als je de beoordeling wilt aanpassen."
          :hrSuggestion!==null
            ?`Voorstel op basis van ${safe(Math.round(activity.averageHeartRate))} bpm gemiddeld, je zone 2-grens en maximale hartslag. Pas aan op hoe zwaar het echt voelde.`
            :"Geen betrouwbare hartslag voor een voorstel. Startwaarde 5; stel de balk in op jouw gevoel."}</p>
        <fieldset class="activity-feeling"><legend>Hoe voelde je je?</legend>
          <div class="activity-feeling-options">${[
            [1,"😫","Uitgeput"],[2,"😕","Matig"],[3,"😐","Oké"],
            [4,"🙂","Goed"],[5,"😁","Top"]
          ].map(([value,emoji,label])=>`<label><input type="radio" name="energy" value="${value}"${review.energy===value?" checked":""} required><span><span aria-hidden="true">${emoji}</span><small>${label}</small></span></label>`).join("")}</div>
        </fieldset>
      </div>
      <details class="activity-review-extra"${review.savedAt && [review.legs,review.enjoyment,review.complaintSeverity].some(value=>value!=null)?" open":""}>
        <summary>Extra details (optioneel)</summary>
        <div class="activity-review-grid">
          ${scoreSelect("legs","Benen · 1 fris, 5 zwaar",5)}
          ${scoreSelect("enjoyment","Plezier · 1 laag, 5 hoog",5)}
          ${scoreSelect("complaintSeverity","Klachten · 0 geen, 3 sterk",3,0)}
        </div>
      </details>
      <label>Opmerking (optioneel)<textarea name="note" rows="2" maxlength="500" placeholder="Bijv. laatste blok zwaar, kuit licht gevoelig">${safe(review.note||"")}</textarea></label>
      <div class="today-actions"><button type="submit">${review.savedAt?"Beoordeling bijwerken":"Beoordeling opslaan"}</button>
        <button type="button" class="secondary" id="openResultDiary">Open dagboek</button>
        ${review.savedAt?'<button type="button" class="secondary" id="deleteActivityReview">Verwijder beoordeling</button>':""}</div>
      <p id="activityReviewStatus" class="status" role="status"></p>
    </form>
    <div class="activity-result-insight ${insight.tone}" role="status">
      <div><span class="activity-insight-dot" aria-hidden="true"></span><strong>${safe(insight.title)}</strong></div>
      <p>${safe(insight.explanation)}</p>
      <small>${safe(insight.coach)}</small>
      ${review.savedAt?'<a href="#fullyAdaptiveCoachCard">Bekijk actueel coachadvies ↑</a>':""}
    </div>
    <details id="activityResultMore" class="activity-result-more">
      <summary>Kaart, splits en extra metingen</summary>
      <div class="activity-result-metrics">
        ${metric("Hoogtemeters",resultNumber(activity.elevationM,0," m"))}
        ${metric("Belasting",resultNumber(activity.trainingLoad,0))}
        ${activity.maxHeartRate!=null?metric("Max. hartslag",resultNumber(activity.maxHeartRate,0," bpm")):""}
        ${family==="ride" && activity.averageWatts!=null?metric("Gem. vermogen",resultNumber(activity.averageWatts,0," W")):""}
      </div>
      <div class="activity-result-comparison">
        <strong>${comparison?`Vergeleken met ${safe(comparison.name)}`:workout?"Activiteit apart van de planning":"Geen geplande training op deze dag"}</strong>
        <p>${comparison
          ?safe([comparison.distance,comparison.duration].filter(Boolean).join(" · ")||"Geen vergelijkbare afstand of duur beschikbaar.")
          :workout?"Deze activiteit is niet betrouwbaar aan de geplande training gekoppeld. De app schrijft het resultaat daarom niet aan dat plan toe.":"Dit resultaat blijft beschikbaar voor je beoordeling."}</p>
      </div>
      <div id="activityRoutePreview" class="activity-route-preview" role="status"></div>
      <details id="activityResultIntervals" class="activity-result-intervals">
        <summary>Bekijk splits en intervallen</summary>
        <div id="activityResultIntervalRows" class="activity-result-interval-rows"></div>
      </details>
    </details>`;
  detail.querySelector("#activityResultMore").addEventListener("toggle",event=>{
    if(event.target.open) loadActivityRoute(activity);
  });
  detail.querySelector("#activityResultIntervals").addEventListener("toggle",event=>{
    if(event.target.open) loadActivityResultIntervals(activity);
  });
}

function renderActivityIntervalRows(intervals){
  const valid=(Array.isArray(intervals)?intervals:[])
    .filter(item=>item && ((finiteNumberOrNull(item.distanceKm)||0)>=.1 ||
      (finiteNumberOrNull(item.movingSeconds)||0)>=30));
  const rows=valid.slice(0,15);
  if(!rows.length) return '<p class="help">Geen afzonderlijke intervallen bij deze activiteit gevonden.</p>';
  return `<div class="activity-interval-table" role="table" aria-label="Splits en intervallen">
    <div class="activity-interval-row head" role="row"><span>Deel</span><span>Afstand</span><span>Tempo</span><span>Hartslag</span></div>
    ${rows.map((item,index)=>{
      const speed=finiteNumberOrNull(item.paceSecondsPerKm);
      const seconds=Math.round(speed||0);
      const pace=speed && speed>0 && speed<3600
        ?`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`:"—";
      return `<div class="activity-interval-row" role="row">
        <span>${index+1}${item.type?` · ${safe(item.type)}`:""}</span>
        <span>${safe(resultNumber(item.distanceKm,2," km"))}</span>
        <span>${pace}</span>
        <span>${safe(resultNumber(item.averageHeartRate,0," bpm"))}</span>
      </div>`;
    }).join("")}
  </div>${valid.length>rows.length?'<p class="help">Eerste 15 onderdelen getoond.</p>':""}`;
}

async function loadActivityResultIntervals(activity){
  const target=document.getElementById("activityResultIntervalRows");
  if(!target) return;
  if(resultIntervals.has(activity.id)){
    target.innerHTML=resultIntervals.get(activity.id);
    return;
  }
  target.textContent="Intervallen worden opgehaald…";
  try{
    const response=await fetchWithAppPin(
      `/api/intervals-activity-detail?activityId=${encodeURIComponent(activity.id)}`);
    const data=await response.json();
    if(selectedResultId!==activity.id || !target.isConnected) return;
    if(!response.ok) throw new Error(data.error||"Intervallen niet beschikbaar.");
    const html=renderActivityIntervalRows(data.intervals);
    if(resultIntervals.size>=12) resultIntervals.delete(resultIntervals.keys().next().value);
    resultIntervals.set(activity.id,html);
    target.innerHTML=html;
  }catch(error){
    if(selectedResultId===activity.id && target.isConnected){
      target.textContent=`Intervallen niet beschikbaar: ${error.message}`;
    }
  }
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
  const known=key=>reviews.map(item=>finiteNumberOrNull(item[key]))
    .filter(value=>value!==null);
  const max=key=>known(key).length?Math.max(...known(key)):null;
  const min=key=>known(key).length?Math.min(...known(key)):null;
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
    const value=raw==="" || raw==null?null:Number(raw);
    if((value===null && ["sessionRpe","energy"].includes(key)) ||
      (value!==null && (!Number.isInteger(value) || value<min || value>max))){
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
      ?"Beoordeling opgeslagen. Het coachadvies is opnieuw berekend met je RPE, gevoel en eventuele extra details."
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
  const filter=event.target.closest("[data-result-filter]");
  if(filter && filter.closest("#activityResultsList")){
    resultSportFilter=filter.dataset.resultFilter;
    selectedResultId=null;
    resultRouteRequest++;
    renderActivityResults();
    return;
  }
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
