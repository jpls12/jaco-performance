document.querySelectorAll(".tab").forEach(tab=>{
  tab.onclick=()=>{
    if(tab.dataset.view==="editor"){
      setDefaultForm(selectedDate);
    }
    switchView(tab.dataset.view);
  };
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

document.getElementById("workoutType").onchange=updateWorkoutTypeFields;
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
document.getElementById("refreshTodayCoach").onclick=async()=>{
  await refreshTodayCoach();
  renderCoachBrain();
};
document.getElementById("applyTodayAdvice").onclick=applyTodayRecommendation;
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
document.getElementById("profileForm").onsubmit=saveProfile;
document.getElementById("planningForm").onsubmit=savePlanning;
document.getElementById("raceForm").onsubmit=saveRace;
document.getElementById("raceDistance").onchange=()=>{
  document.getElementById("customRaceDistanceLabel").hidden=
    document.getElementById("raceDistance").value!=="other";
};
document.getElementById("generatePlan").onclick=generateRacePlan;
document.getElementById("planStartDate").value=ymd(today);

async function initializeJacoPerformance(){
  const greeting=document.getElementById("greeting");
  if(greeting){
    greeting.textContent=
      (today.getHours()<12
        ?"Goedemorgen"
        :today.getHours()<18
          ?"Goedemiddag"
          :"Goedenavond")+" Jaco";
  }

  setDefaultForm(ymd(today));
  fillProfileForm();
  fillPlanningForm();
  renderProfileSummary();
  renderRaces();
  renderRaceOptions();
  renderVisualWorkout("core");

  // Lokale trainingen en wedstrijden eerst tonen.
  await loadServer();

  // Daarna actuele wellnessdata ophalen.
  try{
    await loadWellnessDashboard();
  }catch(error){
    console.error("Wellnessdata laden mislukt:",error);
  }

  // Coach pas berekenen nadat profiel, planning, wedstrijden en wellness geladen zijn.
  renderTodayCoach();
  renderCoachBrain();
  buildCoachHorizon();
  renderPerformanceEngine();
  renderAiTrainingGenerator();
  renderAiWeekPlanner();
  renderCoachIntelligence();
  renderPerformanceTrend(7);
  renderSmartWeekCoach();
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
