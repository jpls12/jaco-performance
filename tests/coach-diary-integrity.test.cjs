const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync('js/app.js','utf8');
const formCode=app.slice(app.indexOf('function fillCoachDiaryForm('),app.indexOf('function renderDiaryRecent('));
const saveCode=app.slice(app.indexOf('function diaryScore('),app.indexOf('function deleteCoachDiaryEntry('));

function setup(entries={}){
  const elements={};
  const ids=['diaryDate','diaryRpe','diaryLegs','diaryEnergy','diaryEnjoyment',
    'diaryComplaint','diaryActualDistance','diaryActualDuration','diaryComplaintText',
    'diaryNote','diaryExtra','diaryWorkoutContext','deleteDiaryEntry','diaryStatus'];
  for(const id of ids) elements[id]={value:'',open:false,focused:false,focus(){this.focused=true}};
  elements.diaryDate.value='2026-09-26';
  const saved=[];
  const context=vm.createContext({
    document:{getElementById:id=>elements[id]},
    coachDiary:entries,
    diaryWorkoutForDate:()=>null,
    DIARY_KEY:'jp_coach_diary_v1',
    safe:value=>value,
    saveObject:(key,value)=>saved.push(JSON.parse(JSON.stringify(value))),
    renderCoachDiary:()=>{},
    resetGeneratedPlannerPreviews:()=>{},
    renderFullSeasonSchedulePreview:()=>{},
    refreshDerivedCoachViews:()=>{}
  });
  vm.runInContext(formCode+saveCode,context);
  return {context,elements,saved};
}

test('new check-in requires five deliberate scores; empty complaint is not zero',()=>{
  const {context,elements,saved}=setup();
  context.fillCoachDiaryForm('2026-09-26');
  assert.deepEqual(['diaryRpe','diaryLegs','diaryEnergy','diaryEnjoyment','diaryComplaint']
    .map(id=>elements[id].value),['','','','','']);
  context.saveCoachDiary({preventDefault(){}});
  assert.equal(saved.length,0);
  assert.equal(elements.diaryRpe.focused,true);
  assert.match(elements.diaryStatus.textContent,/Kies alle vijf/);

  Object.assign(elements.diaryRpe,{value:'7'});
  Object.assign(elements.diaryLegs,{value:'4'});
  Object.assign(elements.diaryEnergy,{value:'2'});
  Object.assign(elements.diaryEnjoyment,{value:'3'});
  context.saveCoachDiary({preventDefault(){}});
  assert.equal(saved.length,0);
  assert.equal(elements.diaryComplaint.focused,true);

  elements.diaryComplaint.value='0';
  context.saveCoachDiary({preventDefault(){}});
  assert.equal(saved.length,1);
  assert.equal(saved[0]['2026-09-26'].complaintSeverity,0);
  assert.equal(saved[0]['2026-09-26'].sessionRpe,7);
});

test('saved check-in restores scores and optional notes without changing stored data',()=>{
  const entry={date:'2026-09-25',sessionRpe:8,legs:4,energy:2,enjoyment:3,
    complaintSeverity:1,actualDistanceKm:12.5,note:'Kuit gevoelig'};
  const {context,elements,saved}=setup({'2026-09-25':entry});
  context.fillCoachDiaryForm('2026-09-25');
  assert.equal(elements.diaryRpe.value,'8');
  assert.equal(elements.diaryComplaint.value,'1');
  assert.equal(elements.diaryActualDistance.value,12.5);
  assert.equal(elements.diaryNote.value,'Kuit gevoelig');
  assert.equal(elements.diaryExtra.open,true);
  assert.equal(elements.deleteDiaryEntry.disabled,false);
  assert.equal(saved.length,0);
  assert.equal(entry.note,'Kuit gevoelig');
});
