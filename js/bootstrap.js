
let deferredPwaInstallPrompt=null;

function appRunsStandalone(){
  return window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone===true;
}

function isIosWebBrowser(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent||"") &&
    !appRunsStandalone();
}

function navigateAppView(id){
  if(id==="editor"){
    setDefaultForm(selectedDate);
  }
  switchView(id);
  window.scrollTo({top:0,behavior:"auto"});
}

function syncMobileNavigation(id){
  const primaryViews=["today","calendar","races","planning"];
  document.querySelectorAll(".mobile-nav-button[data-mobile-view]").forEach(button=>{
    const active=button.dataset.mobileView===id;
    button.classList.toggle("active",active);
    if(active) button.setAttribute("aria-current","page");
    else button.removeAttribute("aria-current");
  });

  const more=document.getElementById("openAppMenu");
  if(more){
    const active=!primaryViews.includes(id);
    more.classList.toggle("active",active);
    if(active) more.setAttribute("aria-current","page");
    else more.removeAttribute("aria-current");
  }
}
window.syncMobileNavigation=syncMobileNavigation;

function openAppMenu(){
  const backdrop=document.getElementById("appMenuBackdrop");
  if(!backdrop) return;
  backdrop.hidden=false;
  backdrop.classList.add("open");
  document.body.classList.add("app-menu-open");
}
window.openAppMenu=openAppMenu;

function closeAppMenu(){
  const backdrop=document.getElementById("appMenuBackdrop");
  if(!backdrop) return;
  backdrop.classList.remove("open");
  backdrop.hidden=true;
  document.body.classList.remove("app-menu-open");
}
window.closeAppMenu=closeAppMenu;

function hideInstallExperience(){
  const banner=document.getElementById("installAppBanner");
  const menuInstall=document.getElementById("menuInstallApp");
  if(banner) banner.hidden=true;
  if(menuInstall) menuInstall.hidden=true;
}

function showInstallExperience(){
  if(appRunsStandalone()){
    hideInstallExperience();
    return;
  }

  const installAvailable=
    isIosWebBrowser() ||
    Boolean(deferredPwaInstallPrompt);

  if(!installAvailable){
    hideInstallExperience();
    return;
  }

  let dismissed=false;
  try{
    dismissed=sessionStorage.getItem("jp_install_banner_dismissed")==="1";
  }catch{
    dismissed=false;
  }

  const banner=document.getElementById("installAppBanner");
  if(banner && !dismissed){
    banner.hidden=false;
  }

  const menuInstall=document.getElementById("menuInstallApp");
  if(menuInstall) menuInstall.hidden=false;
}

async function handleInstallApp(){
  if(appRunsStandalone()){
    hideInstallExperience();
    return;
  }

  // Sluit de mobiele sheet vóór een browser- of iOS-installatiestap.
  // Zo blijft er na de installprompt geen onzichtbare overlay boven de app staan.
  closeAppMenu();

  if(deferredPwaInstallPrompt){
    deferredPwaInstallPrompt.prompt();
    const choice=await deferredPwaInstallPrompt.userChoice;
    if(choice?.outcome==="accepted"){
      hideInstallExperience();
    }
    deferredPwaInstallPrompt=null;
    return;
  }

  const instructions=document.getElementById("installAppInstructions");
  const text=document.getElementById("installAppText");
  const banner=document.getElementById("installAppBanner");

  if(banner) banner.hidden=false;
  if(instructions) instructions.hidden=false;

  if(text){
    text.textContent=isIosWebBrowser()
      ?"Gebruik Safari om Jaco Performance aan je beginscherm toe te voegen."
      :"Open het browsermenu en kies ‘Installeren’ of ‘Toevoegen aan beginscherm’.";
  }

  banner?.scrollIntoView({behavior:"smooth",block:"start"});
}

function setupPwaExperience(){
  syncMobileNavigation(
    document.querySelector(".view.active")?.id || "today"
  );

  document.querySelectorAll(".mobile-nav-button[data-mobile-view]").forEach(button=>{
    button.onclick=()=>navigateAppView(button.dataset.mobileView);
  });

  document.querySelectorAll(".app-menu-item[data-menu-view]").forEach(button=>{
    button.onclick=()=>navigateAppView(button.dataset.menuView);
  });

  document.getElementById("openAppMenu").onclick=openAppMenu;
  document.getElementById("closeAppMenu").onclick=closeAppMenu;
  document.getElementById("appMenuBackdrop").onclick=event=>{
    if(event.target.id==="appMenuBackdrop") closeAppMenu();
  };

  document.getElementById("installAppButton").onclick=handleInstallApp;
  document.getElementById("menuInstallApp").onclick=handleInstallApp;
  document.getElementById("dismissInstallApp").onclick=()=>{
    document.getElementById("installAppBanner").hidden=true;
    try{
      sessionStorage.setItem("jp_install_banner_dismissed","1");
    }catch{
      // Geen probleem als tijdelijke opslag niet beschikbaar is.
    }
  };

  document.addEventListener("keydown",event=>{
    if(event.key==="Escape") closeAppMenu();
  });

  window.addEventListener("beforeinstallprompt",event=>{
    event.preventDefault();
    deferredPwaInstallPrompt=event;
    showInstallExperience();
  });

  window.addEventListener("appinstalled",()=>{
    deferredPwaInstallPrompt=null;
    hideInstallExperience();
  });

  window.addEventListener("online",()=>{
    const status=document.getElementById("todayStatus");
    if(status && /offline/i.test(status.textContent||"")){
      status.className="status";
      status.textContent="Verbinding hersteld. Vernieuw de coach voor actuele hersteldata.";
    }
  });

  if(!appRunsStandalone()){
    showInstallExperience();
  }else{
    hideInstallExperience();
  }

  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>{
      navigator.serviceWorker
        .register("/sw.js",{updateViaCache:"none"})
        .catch(error=>console.warn("Service worker kon niet worden geregistreerd:",error));
    });
  }
}


document.querySelectorAll(".tab").forEach(tab=>{
  tab.onclick=()=>navigateAppView(tab.dataset.view);
});

document.getElementById("prevMonth").onclick=()=>{
  visibleMonth=new Date(visibleMonth.getFullYear(),visibleMonth.getMonth()-1,1);
  renderMonth();
};
document.getElementById("nextMonth").onclick=()=>{
  visibleMonth=new Date(visibleMonth.getFullYear(),visibleMonth.getMonth()+1,1);
  renderMonth();
};
document.getElementById("recoveryType").onchange=()=>{
  const isTime=document.getElementById("recoveryType").value==="time";
  updateRecoveryLabel();
  document.getElementById("recoveryValue").value=isTime ? "2" : "200";
  updatePreview();
};

document.getElementById("parseSmartInput").onclick=parseSmartTraining;
document.getElementById("generateSmartWorkout").onclick=generateSmartWorkout;
document.getElementById("clearExactRun").onclick=()=>{
  clearExactRunMode();
  document.getElementById("smartStatus").className="status";
  document.getElementById("smartStatus").textContent=
    "Exacte multi-block modus uitgeschakeld. Je kunt nu de eenvoudige velden gebruiken.";
};

document.getElementById("workoutType").onchange=()=>{
  if(document.getElementById("workoutType").value!=="Run"){
    clearExactRunMode(false);
  }
  updateWorkoutTypeFields();
};
document.getElementById("workoutForm").addEventListener("input",updatePreview);
document.getElementById("workoutForm").onsubmit=saveWorkout;
document.getElementById("cancelEdit").onclick=()=>{
  setDefaultForm(selectedDate);
  switchView("calendar");
};
document.getElementById("closeDuplicate").onclick=closeDuplicate;
document.getElementById("confirmDuplicate").onclick=duplicateWorkout;
document.getElementById("duplicateModal").onclick=event=>{
  if(event.target.id==="duplicateModal") closeDuplicate();
};


document.getElementById("startCorePlayer").onclick=()=>openVisualWorkoutPlayer("core");
document.getElementById("startMobilityPlayer").onclick=()=>openVisualWorkoutPlayer("mobility");
document.getElementById("closeWorkoutPlayer").onclick=closeVisualWorkoutPlayer;
document.getElementById("playerPrevious").onclick=previousPlayerStep;
document.getElementById("playerMinus").onclick=()=>adjustPlayerSeconds(-10);
document.getElementById("playerPause").onclick=togglePlayerPause;
document.getElementById("playerPlus").onclick=()=>adjustPlayerSeconds(10);
document.getElementById("playerNextButton").onclick=advancePlayerStep;
document.getElementById("finishAndSaveWorkout").onclick=saveCompletedVisualWorkout;
document.getElementById("restartVisualWorkout").onclick=restartVisualWorkout;
document.getElementById("showCoreRecipe").onclick=()=>renderVisualWorkout("core");
document.getElementById("showMobilityRecipe").onclick=()=>renderVisualWorkout("mobility");
document.getElementById("copyCorosRecipe").onclick=copyCorosRecipe;
document.getElementById("buildCoachHorizon").onclick=buildCoachHorizon;
document.getElementById("recalculateBrain").onclick=renderCoachBrain;
document.getElementById("refreshLoadMonitor").onclick=renderTodayCoach;
document.getElementById("coachDiaryForm").onsubmit=saveCoachDiary;
document.getElementById("diaryDate").onchange=event=>{
  renderCoachDiary(event.target.value);
};
document.getElementById("deleteDiaryEntry").onclick=deleteCoachDiaryEntry;
document.getElementById("loadTodayDiary").onclick=()=>renderCoachDiary(todayDateString());
document.getElementById("sendCoachChat").onclick=sendCoachChatMessage;
document.getElementById("clearCoachChat").onclick=clearCoachChat;
document.getElementById("applyCoachChatAction").onclick=applyCoachChatWorkout;
document.querySelectorAll(".coach-chip").forEach(button=>{
  button.onclick=()=>handleCoachChat(button.dataset.coachPrompt);
});
document.getElementById("coachChatInput").addEventListener("keydown",event=>{
  if(event.key==="Enter" && !event.shiftKey){
    event.preventDefault();
    sendCoachChatMessage();
  }
});
document.getElementById("optimizeSmartWeek").onclick=generateSmartWeekOptions;
document.getElementById("smartWeekAlternative").onclick=selectNextSmartWeek;
document.getElementById("applySmartWeek").onclick=applySmartWeekPlan;
document.getElementById("refreshPerformanceTrend").onclick=()=>renderPerformanceTrend(activeTrendDays);
document.querySelectorAll(".trend-period").forEach(button=>{
  button.onclick=()=>renderPerformanceTrend(Number(button.dataset.trendDays));
});
document.getElementById("refreshCoachIntelligence").onclick=renderCoachIntelligence;
document.getElementById("generateAiWeek").onclick=generateAiWeekOptions;
document.getElementById("regenerateAiWeek").onclick=regenerateAiWeek;
document.getElementById("saveAiWeek").onclick=saveAiGeneratedWeek;
document.getElementById("generateAiTraining").onclick=generateAiTrainingOptions;
document.getElementById("regenerateAiTraining").onclick=regenerateAiTraining;
document.getElementById("saveAiTraining").onclick=saveAiGeneratedTraining;
document.getElementById("startTodayTraining").onclick=startTodayTrainingExperience;
document.getElementById("completeTodayTraining").onclick=completeTodayTrainingFromCard;
document.getElementById("openTodayTrainingCalendar").onclick=openTodayTrainingCalendar;
document.getElementById("closeGuidedTraining").onclick=()=>closeGuidedTrainingSession();
document.getElementById("guidedTrainingPrevious").onclick=previousGuidedTrainingStep;
document.getElementById("guidedTrainingPause").onclick=toggleGuidedTrainingPause;
document.getElementById("guidedTrainingNext").onclick=nextGuidedTrainingStep;
document.getElementById("finishGuidedTraining").onclick=finishGuidedTrainingSession;
document.getElementById("refreshTodayCoach").onclick=refreshTodayCoach;
document.getElementById("refreshActivitySync").onclick=()=>syncCompletedActivities();
document.getElementById("copyActivitySyncDiagnostics").onclick=copyActivitySyncDiagnostics;
document.getElementById("refreshTrainingQuality").onclick=()=>syncTrainingQualityLatest({force:true});
document.getElementById("refreshFullyAdaptiveCoach").onclick=refreshFullyAdaptiveCoach;
document.getElementById("fullyAdaptivePrimaryAction").onclick=applyFullyAdaptiveCoachPriority;
document.getElementById("applyTodayAdvice").onclick=applyTodayRecommendation;
document.getElementById("refreshWeekReplan").onclick=refreshAdaptiveWeekReplanner;
document.getElementById("applyWeekReplan").onclick=applyAdaptiveWeekReplan;
document.getElementById("refreshDashboard").onclick=loadWellnessDashboard;
document.getElementById("buildAdaptiveWeek").onclick=()=>{
  const status=document.getElementById("adaptiveWeekStatus");
  try{
    buildAdaptiveWeek();
  }catch(error){
    console.error(error);
    status.className="status error";
    status.textContent=`Voorstel kon niet worden gemaakt: ${error.message}`;
    document.getElementById("adaptiveCoachHeadline").textContent="Er ging iets mis";
    document.getElementById("adaptiveCoachReason").textContent=
      "Controleer je Planning, Profiel en Wedstrijden en probeer het opnieuw.";
  }
};
document.getElementById("saveAdaptiveWeek").onclick=saveAdaptiveWeek;
document.getElementById("planMyWeek").onclick=generatePersonalWeek;
document.getElementById("saveWeekPlan").onclick=savePersonalWeek;
document.getElementById("exportLocalBackup").onclick=exportLocalBackup;
document.getElementById("chooseBackupFile").onclick=()=>{
  document.getElementById("backupFileInput").click();
};
document.getElementById("backupFileInput").onchange=handleBackupFileSelection;
document.getElementById("backupImportMode").onchange=updateBackupImportModeHelp;
document.getElementById("applyBackupImport").onclick=applySelectedBackupImport;
document.getElementById("cancelBackupImport").onclick=cancelBackupImport;
document.getElementById("restoreSafetyBackup").onclick=restoreLastSafetyBackup;
document.getElementById("profileForm").onsubmit=saveProfile;
document.getElementById("planningForm").onsubmit=savePlanning;
document.getElementById("buildFullSeasonSchedule").onclick=buildFullSeasonSchedulePreview;
document.getElementById("applyFullSeasonSchedule").onclick=applyFullSeasonSchedule;
document.getElementById("removeFullSeasonSchedule").onclick=removeFullSeasonSchedule;
document.getElementById("fullSeasonTarget").onchange=()=>{
  pendingFullSeasonSchedule=null;
  renderFullSeasonSchedulePreview();
};
document.getElementById("fullSeasonStart").onchange=()=>{
  pendingFullSeasonSchedule=null;
  renderFullSeasonSchedulePreview();
};
document.getElementById("fullSeasonOverwriteManual").onchange=()=>{
  renderFullSeasonSchedulePreview();
};
document.getElementById("refreshSeasonPlanner").onclick=()=>{
  renderSeasonPlanner();
  renderRaceCalendarOptimizer();
  refreshDerivedCoachViews();
};
document.getElementById("refreshRaceCalendarOptimizer").onclick=()=>{
  renderRaceCalendarOptimizer();
  renderSeasonPlanner();
  refreshDerivedCoachViews();
};
document.getElementById("simulateRace").onclick=renderRaceSimulator;
document.getElementById("raceSimulatorSelect").onchange=renderRaceSimulator;
document.getElementById("saveRaceSimulation").onclick=saveCurrentRaceSimulation;
document.getElementById("editSimulatedRace").onclick=editCurrentSimulatedRace;
document.getElementById("raceForm").onsubmit=saveRace;
document.getElementById("raceDistance").onchange=()=>{
  document.getElementById("customRaceDistanceLabel").hidden=
    document.getElementById("raceDistance").value!=="other";
};
document.getElementById("generatePlan").onclick=generateRacePlan;
document.getElementById("planStartDate").value=todayDateString();
document.getElementById("fullSeasonStart").value=nextMonday();

let lastKnownAppDate=todayDateString();

function refreshDayBoundaryIfNeeded(){
  const current=todayDateString();
  if(current===lastKnownAppDate) return;

  const previous=lastKnownAppDate;
  lastKnownAppDate=current;

  if(selectedDate===previous){
    selectedDate=current;
  }

  const currentDate=new Date(current+"T12:00:00");
  const previousDate=new Date(previous+"T12:00:00");
  if(
    visibleMonth.getFullYear()===previousDate.getFullYear() &&
    visibleMonth.getMonth()===previousDate.getMonth()
  ){
    visibleMonth=new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
  }

  const greeting=document.getElementById("greeting");
  const now=new Date();
  if(greeting){
    greeting.textContent=
      (now.getHours()<12
        ?"Goedemorgen"
        :now.getHours()<18
          ?"Goedemiddag"
          :"Goedenavond")+" Jaco";
  }

  renderMonth();
  renderSelected();
  renderCoachDiary(current);
  refreshDerivedCoachViews();
}

document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"){
    refreshDayBoundaryIfNeeded();
    if(
      document.getElementById("guidedTrainingPlayer")?.classList.contains("active") &&
      !guidedTrainingSession.pauseStartedAt
    ){
      requestGuidedWakeLock();
    }
  }
});

document.addEventListener("keydown",event=>{
  if(
    event.key==="Escape" &&
    document.getElementById("guidedTrainingPlayer")?.classList.contains("active")
  ){
    closeGuidedTrainingSession();
  }
});
window.addEventListener("focus",refreshDayBoundaryIfNeeded);

async function initializeJacoPerformance(){
  setupPwaExperience();
  repairStoredWorkoutMismatches();
  installHmAmsterdamBlock2026();
  installHmAmsterdamRaceweek2026();
  const greeting=document.getElementById("greeting");
  const now=new Date();
  if(greeting){
    greeting.textContent=
      (now.getHours()<12
        ?"Goedemorgen"
        :now.getHours()<18
          ?"Goedemiddag"
          :"Goedenavond")+" Jaco";
  }

  setDefaultForm(todayDateString());
  fillProfileForm();
  fillPlanningForm();
  renderProfileSummary();
  renderBackupManager();
  renderPendingBackupImport();
  renderRaces();
  renderRaceOptions();
  renderRaceSimulator();
  renderRaceCalendarOptimizer();
  renderSeasonPlanner();
  renderFullSeasonTargetOptions();
  renderFullSeasonSchedulePreview();
  renderVisualWorkout("core");

  // Lokale trainingen en wedstrijden eerst tonen.
  await loadServer();
  upgradeCompletionMarkers();

  // Daarna actuele wellnessdata ophalen. De wellness-loader herberekent
  // alle afhankelijke coachpanelen exact één keer, ook bij een fout.
  const wellnessResult=await loadWellnessDashboard();
  if(!wellnessResult.ok){
    console.error(
      "Wellnessdata laden mislukt:",
      wellnessResult.error
    );
  }

  const activitySyncResult=await syncCompletedActivities({
    silent:true,
    render:true
  });
  if(!activitySyncResult.ok){
    console.error(
      "Training Sync laden mislukt:",
      activitySyncResult.error
    );
  }

  renderCoachDiary(todayDateString());
}

window.addEventListener("error",event=>{
  console.error("Jaco Performance fout:",event.error || event.message);
  const status=document.getElementById("todayStatus");
  if(status && !status.textContent){
    status.className="status error";
    status.textContent=`JavaScript-fout: ${event.message}`;
  }
});

window.addEventListener("unhandledrejection",event=>{
  console.error("Jaco Performance promise-fout:",event.reason);
});

initializeJacoPerformance().catch(error=>{
  console.error("Opstartfout:",error);
  const status=document.getElementById("todayStatus");
  if(status){
    status.className="status error";
    status.textContent=`Opstarten mislukt: ${error.message}`;
  }
});
