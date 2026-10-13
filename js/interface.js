/* Presentation only: all training decisions and mutations remain in the coach. */
function openInterfacePanel(id){
  const panel=document.getElementById(id);
  if(!panel) return;
  const view=panel.closest('.view');
  if(view && !view.classList.contains('active')) switchView(view.id);
  for(let parent=panel;parent;parent=parent.parentElement){
    if(parent.tagName==='DETAILS') parent.open=true;
  }
  requestAnimationFrame(()=>{
    panel.scrollIntoView({block:'start',behavior:'instant'});
    const heading=panel.querySelector('summary,h2,h3');
    if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
  });
}

function updateInterfaceRoute(id){
  const back=document.getElementById('sectionBack');
  if(back){
    back.hidden=!['planning','editor','saved','library','profile'].includes(id);
    back.textContent=['planning','editor','saved'].includes(id)?'← Terug naar planning':'← Terug';
    back.onclick=()=>switchView(['planning','editor','saved'].includes(id)?'calendar':previousAppView);
  }
  renderPlanningWeek();
}
window.updateInterfaceRoute=updateInterfaceRoute;

function renderPlanningWeek(){
  const root=document.getElementById('planningWeekDays');
  if(!root || typeof allWorkouts!=='function') return;
  const workouts=allWorkouts(), start=mondayOf(todayDateString()), today=todayDateString();
  let count=0, minutes=0, hasUnknown=false;
  root.innerHTML=DAY_KEYS.map((key,index)=>{
    const date=addDays(start,index), workout=workouts[date];
    const done=workout && workoutWasCompleted(date,workout);
    const rest=workout?.type==='Rest';
    const type=workout?trainingTypeInfo(workout.type).label:'Vrij';
    const available=availabilityForDate(date);
    const saved=weeklyAvailabilityComplete(start);
    if(workout && !rest){
      count++;
      const duration=numberOrNull(workout.durationMinutes);
      if(duration!==null && duration>0) minutes+=duration; else hasUnknown=true;
    }
    const state=done?'Voltooid':date===today?'Vandaag':date<today?'Voorbij':workout?.type==='Race'?'Wedstrijd':'Gepland';
    return `<button type="button" class="planning-day${date===today?' is-today':''}${done?' is-done':''}" onclick="openTodayWeekDate('${date}')">
      <span class="planning-day-date">${safe(DAY_NAMES[index].slice(0,2))}<strong>${Number(date.slice(8))}</strong></span>
      <span class="planning-day-copy"><strong>${safe(workout?.name||'Geen training gepland')}</strong><small>${safe(type)}${workout&&!rest?' · '+safe(trainingVolumeLabel(workout)):''}${workout?.rpe?' · RPE '+safe(workout.rpe):''}</small><small>${saved?(available.available?available.maxMinutes+' min beschikbaar':'Niet beschikbaar'):'Beschikbaarheid nog invullen'}</small></span>
      <span class="planning-day-state">${rest?'Rustdag':workout?state:'Vrij'}</span></button>`;
  }).join('');
  document.getElementById('planningWeekSummary').textContent=`${count} trainingen${minutes?' · '+minutes+' min'+(hasUnknown?' bekend':' gepland'):''}${hasUnknown?' · duur deels onbekend':''}`;
}

function updateCoachBrief(){
  const title=document.getElementById('coachBriefTitle'), text=document.getElementById('coachBriefText');
  if(!title || !text) return;
  const recent=document.getElementById('weekReplannerRecent');
  const change=document.getElementById('weekReplannerSummary');
  const status=document.getElementById('weekReplannerStatus');
  const headline=document.getElementById('todayHeadline');
  const summary=document.getElementById('todaySummary');
  const applied=recent && !recent.hidden && recent.textContent.trim();
  const changes=Number(document.getElementById('weekReplannerChanges')?.textContent);
  // Explicitly distinguish applied changes from an unapplied suggestion.
  title.textContent=applied?'Schema aangepast':changes>0?'Voorstel voor je planning':headline?.textContent||'Je coach';
  text.textContent=applied?recent.textContent.trim():changes>0?`${status?.textContent||'Weekadvies'}. ${change?.textContent||''}`:summary?.textContent||'Nog geen actueel advies beschikbaar.';
}

function setupInterface(){
  document.querySelectorAll('[data-route]').forEach(button=>button.addEventListener('click',()=>navigateAppView(button.dataset.route)));
  document.querySelectorAll('[data-open-panel]').forEach(button=>button.addEventListener('click',()=>openInterfacePanel(button.dataset.openPanel)));
  // Links can target content behind a disclosure or on a different screen.
  document.addEventListener('click',event=>{
    const anchor=event.target.closest('a[href^="#"]');
    if(!anchor) return;
    const target=document.getElementById(anchor.getAttribute('href').slice(1));
    if(target){event.preventDefault();openInterfacePanel(target.id);}
  });
  const notice=document.getElementById('connectionNotice');
  function connection(){
    notice.hidden=navigator.onLine;
    notice.textContent='Offline · je lokale planning blijft beschikbaar. Synchroniseer opnieuw wanneer je verbinding terug is.';
  }
  window.addEventListener('online',connection);window.addEventListener('offline',connection);connection();
  // Observe existing renderer output, never copy or recalculate coach state.
  const observer=new MutationObserver(updateCoachBrief);
  for(const id of ['weekReplannerRecent','weekReplannerSummary','weekReplannerChanges','todayHeadline','todaySummary']){
    const node=document.getElementById(id);
    if(node) observer.observe(node,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden']});
  }
  function syncBrief(){
    const link=document.getElementById('syncBrief');
    const status=document.getElementById('activitySyncStatus');
    const quality=document.getElementById('activitySyncQuality');
    link.textContent=status?.classList.contains('error')?'Synchronisatie mislukt · bekijk status':
      `${quality?.textContent||'Synchronisatie controleren'} · bekijk status`;
  }
  const syncObserver=new MutationObserver(syncBrief);
  for(const id of ['activitySyncStatus','activitySyncQuality']){
    const node=document.getElementById(id);
    if(node) syncObserver.observe(node,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
  }
  syncBrief();
  const week=document.getElementById('todayWeekOverviewDays');
  if(week) new MutationObserver(renderPlanningWeek).observe(week,{childList:true});
  // Return focus and contain keyboard focus in the existing More sheet.
  const menu=document.getElementById('appMenuBackdrop');
  const trigger=document.getElementById('openAppMenu');
  let wasOpen=false;
  new MutationObserver(()=>{
    const open=!menu.hidden;
    trigger.setAttribute('aria-expanded',String(open));
    if(open && !wasOpen) document.getElementById('closeAppMenu').focus();
    if(!open && wasOpen && menu.contains(document.activeElement)) trigger.focus();
    wasOpen=open;
  }).observe(menu,{attributes:true,attributeFilter:['hidden']});
  trigger.setAttribute('aria-controls','appMenuBackdrop');trigger.setAttribute('aria-haspopup','dialog');
  menu.addEventListener('keydown',event=>{
    if(event.key!=='Tab') return;
    const buttons=[...menu.querySelectorAll('button:not([disabled])')].filter(el=>el.getClientRects().length);
    const first=buttons[0],last=buttons.at(-1);
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
  });
  // Preserve existing status messages, expose their updates to assistive technology.
  document.querySelectorAll('.status').forEach(el=>{if(!el.hasAttribute('role')) el.setAttribute('role','status');});
  updateCoachBrief();renderPlanningWeek();
}
document.addEventListener('DOMContentLoaded',setupInterface);
