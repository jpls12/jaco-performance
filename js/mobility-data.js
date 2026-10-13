/* General exercise education, not injury treatment. Text adapted 2026-10-13.
   Sources, media rights and review limits: docs/mobility.md. No media is copied. */
const MOBILITY_PREFS_KEY='jp_mobility_preferences_v1';
const MOBILITY_PLANS_KEY='jp_mobility_plans_v1';
const MOBILITY_ACTIVE_KEY='jaco_mobility_active_v1';
const MOBILITY_AREAS={ankles:'Enkels en kuiten',hips:'Heupen en bilspieren',thighs:'Bovenbenen',spine:'Bovenrug en romprotatie',shoulders:'Schouders'};
const MOBILITY_CATEGORIES={mobility:'Mobiliteit',stretch:'Rekken',activation:'Activatie',strength:'Kracht'};
const MOBILITY_SOURCES={
 warmup:'https://www.nhs.uk/live-well/exercise/how-to-warm-up-before-exercising/',
 sitting:'https://www.nhs.uk/live-well/exercise/sitting-exercises/',
 flexibility:'https://www.nhs.uk/live-well/exercise/flexibility-exercises/',
 stretching:'https://www.nhs.uk/live-well/exercise/how-to-stretch-after-exercising/',
 strength:'https://www.nhs.uk/live-well/exercise/strength-exercises/',
 cat:'https://www.acefitness.org/resources/everyone/exercise-library/15/cat-cow/',
 ankle:'https://e3rehab.com/ankle-dorsiflexion/',
 hip:'https://e3rehab.com/how-to-improve-your-hip-range-of-motion/'
};
// Each bilateral prescription is per side. Repetitions are self-paced, never inferred from time.
const MOBILITY_EXERCISES=Object.fromEntries([
 ['ankle-pump','Enkel buigen en strekken','ankles','mobility',true,['chair'],'Enkel rustig doorbewegen',['Zit stevig; til één voet op.','Wijs je tenen van je af en trek ze terug.','Wissel rustig, zonder je been mee te zwaaien.'],'Houd de knie comfortabel.','Niet snel veren.','Houd de voet dichter bij de vloer.','sitting',null],
 ['ankle-rock','Knie over de voet','ankles','mobility',true,['wall'],'Enkelbuiging verkennen',['Sta in een kleine spreidstand met steun aan de muur.','Beweeg de voorste knie over de tenen; de hiel blijft staan.','Ga rustig terug en herhaal.'],'Knie volgt de richting van de voet.','Geen opgetilde hiel of geforceerde eindstand.','Maak de beweging kleiner.','ankle',null],
 ['calf-stretch','Kuitrek met gestrekte knie','ankles','stretch',true,['wall'],'Kuit rustig rekken',['Steun tegen een muur; zet één been achteruit.','Houd de achterste hiel laag en de knie gestrekt.','Verplaats je gewicht iets naar voren en adem rustig.'],'Een lichte rek is voldoende.','Niet veren of door pijn heen duwen.','Zet een kleinere stap.','flexibility',null],
 ['calf-raise','Kuitheffen met steun','ankles','strength',false,['chair'],'Kuiten gecontroleerd belasten',['Sta achter een stevige stoel.','Til beide hielen langzaam op.','Laat ze beheerst zakken.'],'Verdeel je gewicht over beide voeten.','Niet stuiteren op de tenen.','Kom minder hoog.','strength',null],
 ['hip-march','Zittend knieheffen','hips','activation',true,['chair'],'Heupspieren licht activeren',['Zit rechtop en houd de zitting vast.','Til één gebogen knie rustig op.','Zet de voet zacht terug.'],'Blijf rustig doorademen.','Niet achterover leunen.','Til de voet slechts enkele centimeters.','sitting',null],
 ['hip-switch','90/90 heupwissel','hips','mobility',false,[],'Gecontroleerd wisselen van heuprotatie',['Zit met beide knieën gebogen, handen achter je voor steun.','Laat beide knieën rustig naar één kant zakken.','Wissel naar de andere kant; blijf binnen een prettige uitslag.'],'Voeten en knieën mogen een comfortabele hoek kiezen.','Duw je knieën niet naar de vloer.','Leun meer op je handen en maak kleinere wissels.','hip','647991664'],
 ['hip-side','Zijwaarts beenheffen','hips','strength',true,['chair'],'Zijkant van de heup belasten',['Houd een stevige stoel vast.','Beweeg één gestrekt been een klein stukje zijwaarts.','Breng het langzaam terug.'],'Bekken blijft horizontaal.','Niet zijwaarts hangen.','Til minder hoog.','strength',null],
 ['hip-back','Achterwaarts beenheffen','hips','strength',true,['chair'],'Bilspieren gecontroleerd belasten',['Sta met steun aan een stoel.','Beweeg één been rustig naar achteren.','Ga terug zonder je rug hol te trekken.'],'Houd de romp stil.','Niet met je onderrug compenseren.','Verklein de beweging.','strength',null],
 ['glute-stretch','Liggende bilrek','hips','stretch',true,[],'Bilregio rustig rekken',['Lig op je rug met gebogen benen.','Leg één enkel op het andere bovenbeen.','Pak achter het onderste bovenbeen en trek voorzichtig naar je toe.'],'Hoofd en schouders blijven ontspannen.','Trek niet aan het kniegewricht.','Laat de onderste voet op de vloer.','stretching',null],
 ['hamstring-stretch','Liggende hamstringrek','thighs','stretch',true,[],'Achterkant bovenbeen rekken',['Lig op je rug; één voet staat op de vloer.','Til het andere been en ondersteun achter het bovenbeen.','Strek die knie alleen zover comfortabel.'],'Houd het bekken ontspannen.','Niet hard aan de knie trekken.','Houd de knie verder gebogen.','stretching',null],
 ['quad-stretch','Bovenbeenrek in zijlig','thighs','stretch',true,[],'Voorkant bovenbeen rekken',['Lig op je zij en steun je hoofd.','Buig de bovenste knie en pak de voet.','Breng de hiel rustig richting bil; knieën bij elkaar.'],'Houd je heupen boven elkaar.','Trek je onderrug niet hol.','Buig minder ver; sla over als je de voet niet prettig bereikt.','stretching',null],
 ['butterfly','Vlinderzit','thighs','stretch',false,[],'Binnenkant bovenbenen rekken',['Zit met voetzolen tegen elkaar.','Houd de voeten losjes vast.','Laat de knieën ontspannen zakken.'],'Blijf comfortabel rechtop.','Druk niet op je knieën.','Zet de voeten verder van je af.','stretching',null],
 ['mini-squat','Kleine squat met steun','thighs','strength',false,['chair'],'Benen gecontroleerd belasten',['Sta op heupbreedte met steun aan een stoel.','Buig rustig heupen en knieën.','Kom beheerst terug omhoog.'],'Kn ieën volgen de voeten.'.replace('Kn ieën','Knieën'),'Niet naar binnen zakken of veren.','Zak minder diep.','strength',null],
 ['cat-cow','Kat-koe','spine','mobility',false,[],'Wervelkolom rustig doorbewegen',['Zet handen onder schouders en knieën onder heupen.','Maak de rug langzaam rond.','Beweeg rustig terug naar een lichte holle stand.'],'Laat je hoofd de beweging volgen.','Niet forceren in de onderrug.','Maak de beweging kleiner of kies zittende romprotatie.','cat','731400896'],
 ['seated-twist','Zittende romprotatie','spine','mobility',true,['chair'],'Bovenrug draaien',['Zit rechtop met voeten op de grond.','Kruis je armen voor de borst.','Draai rustig naar één kant en keer terug.'],'Bekken blijft naar voren gericht.','Trek niet met je armen aan de stoel.','Draai minder ver.','sitting',null],
 ['side-bend','Staande zijwaartse buiging','spine','mobility',true,[],'Romp zijwaarts doorbewegen',['Sta ontspannen op heupbreedte.','Glijd met één hand langs je been.','Kom rustig terug rechtop.'],'Beweeg opzij, zonder naar voren te buigen.','Niet naar een eindstand trekken.','Gebruik een kleinere uitslag.','flexibility',null],
 ['chest-open','Zittende borstopening','shoulders','stretch',false,['chair'],'Borst en schoudergordel rustig rekken',['Zit rechtop, los van de rugleuning.','Breng je armen laag opzij en schouders rustig naar achteren.','Open je borst licht en laat weer los.'],'Adem vrij door.','Niet overdreven hol trekken.','Houd je armen dichter bij het lichaam.','sitting',null],
 ['shoulder-roll','Schouders rollen','shoulders','mobility',false,[],'Schoudergordel rustig bewegen',['Sta ontspannen, armen los naast je.','Rol je schouders vijf keer rustig naar voren.','Rol daarna vijf keer rustig naar achteren.'],'Houd je nek ontspannen.','Geen grote geforceerde cirkels.','Maak kleinere cirkels.','warmup',null],
 ['neck-turn','Rustige nekrotatie','shoulders','mobility',true,[],'Hoofd rustig draaien',['Zit of sta ontspannen.','Draai je hoofd rustig naar één kant.','Keer terug naar het midden.'],'Schouders blijven ontspannen.','Geen nekcirkels of doorduwen.','Kies een kleinere draai.','flexibility',null]
].map(([id,name,area,category,bilateral,equipment,goal,steps,cue,mistake,easier,source,video])=>[id,{
 id,name,area,category,bilateral,equipment,goal,steps,cue,mistake,easier,
 seconds:category==='stretch'?20:30,reps:category==='stretch'?null:5,sets:1,restSeconds:10,setupSeconds:10,
 source:MOBILITY_SOURCES[source],reviewedOn:'2026-10-13',review:'Tekst vergeleken met de vermelde bron; geen individuele beoordeling.',
 media:video?{provider:'vimeo',id:video,url:`https://vimeo.com/${video}`,owner:'E3 Rehab',rights:'Alleen insluiten via de door Vimeo aangeboden speler; geen kopie of download.',checkedOn:'2026-10-13',status:'embed-available'}:{status:'missing',reason:'Nog geen gecontroleerde afbeelding of video beschikbaar.'}
}]));
const MOBILITY_ROUTINES={
 run:{name:'Voorbereiding hardlopen',purpose:'preparation',sport:'Run',description:'Rustig doorbewegen en licht activeren. Begin daarna geleidelijk met lopen.',ids:['ankle-rock','hip-march','hip-switch','side-bend']},
 ankles:{name:'Enkels en heupen',purpose:'standalone',description:'Rustige enkelbuiging en heuprotatie.',ids:['ankle-rock','hip-switch','ankle-pump','glute-stretch']},
 bike:{name:'Mobiliteit voor fietsen',purpose:'preparation',sport:'Ride',description:'Heupen en romp rustig bewegen vóór een rustige start op de fiets.',ids:['hip-switch','cat-cow','seated-twist','neck-turn']},
 swim:{name:'Bovenrug voor zwemmen',purpose:'preparation',sport:'Swim',description:'Bovenrug en schoudergordel ontspannen bewegen; start het zwemmen rustig.',ids:['shoulder-roll','seated-twist','cat-cow','side-bend']},
 calm:{name:'Rustige algemene mobiliteit',purpose:'standalone',description:'Een rustige sessie zonder prestatiedoel.',ids:['cat-cow','hip-switch','ankle-pump','chest-open','side-bend']},
 short:{name:'Weinig tijd',purpose:'standalone',description:'Een korte pauze om rustig te bewegen.',ids:['side-bend','hip-switch','neck-turn','cat-cow']},
 after:{name:'Rustig na het sporten',purpose:'standalone',description:'Lichte rekoefeningen na inspanning; geen claim over sneller herstel.',ids:['calf-stretch','glute-stretch','hamstring-stretch','quad-stretch','chest-open','butterfly']},
 strength:{name:'Voorbereiding kracht',purpose:'preparation',sport:'Strength',description:'Gewrichten doorbewegen; doe daarna opbouwsets van je eigen krachtoefeningen.',ids:['ankle-rock','hip-switch','cat-cow','shoulder-roll']}
};
function mobilityPreferences(){
 const raw=loadObject(MOBILITY_PREFS_KEY),ids=Object.keys(MOBILITY_EXERCISES);
 const list=(k,allowed,fallback=[])=>Array.isArray(raw[k])?[...new Set(raw[k].filter(x=>allowed.includes(x)))]:fallback;
 return {minutes:[5,10,15].includes(raw.minutes)?raw.minutes:10,areas:list('areas',Object.keys(MOBILITY_AREAS)),equipment:list('equipment',['chair','wall'],['chair','wall']),favorites:list('favorites',ids),avoid:list('avoid',ids),reallow:raw.reallow&&typeof raw.reallow==='object'?raw.reallow:{},sound:raw.sound===true,vibrate:raw.vibrate===true};
}
function mobilityAvoided(id,prefs=mobilityPreferences()){
 return prefs.avoid.includes(id)||Object.values(loadObject(SUPPORT_DONE_KEY)).some(e=>e.mobility?.uncomfortableIds?.includes(id)&&(!prefs.reallow?.[id]||e.completedAt>prefs.reallow[id]));
}
function mobilityAllowed(e,prefs=mobilityPreferences()){
 return !mobilityAvoided(e.id,prefs)&&e.equipment.every(x=>prefs.equipment.includes(x));
}
function mobilityBuildRoutine(id='calm',minutes=10,prefs=mobilityPreferences()){
 const def=MOBILITY_ROUTINES[id]||MOBILITY_ROUTINES.calm;
 const ids=def.ids.filter(id=>mobilityAllowed(MOBILITY_EXERCISES[id],prefs)).sort((a,b)=>{
  const score=id=>(prefs.favorites.includes(id)?1:0)+(prefs.areas.includes(MOBILITY_EXERCISES[id].area)?2:0);
  return score(b)-score(a);
 });
 const steps=[],selected=new Set();let totalSeconds=0;
 // Never stretch a hold to fill a time target. Repeat at most three modest sets.
 for(let set=1;set<=3;set++) for(const id of ids){
  const e=MOBILITY_EXERCISES[id],sides=e.bilateral?['links','rechts']:['beide'];
  const duration=sides.length*(e.setupSeconds+e.seconds+e.restSeconds);
  if(totalSeconds+duration>Math.max(0,minutes)*60) continue;
  selected.add(id);
  for(const side of sides) for(const [phase,seconds] of [['setup',e.setupSeconds],['work',e.seconds],['rest',e.restSeconds]]) steps.push({exerciseId:id,side,set,phase,seconds});
  totalSeconds+=duration;
 }
 return {id:Object.hasOwn(MOBILITY_ROUTINES,id)?id:'calm',name:def.name,minutes:totalSeconds/60,totalSeconds,rounds:1,purpose:def.purpose,steps,
  exercises:[...selected].map(id=>{const e=MOBILITY_EXERCISES[id];return [e.name,`${e.seconds} sec${e.bilateral?' per zijde':''} · maximaal 3 sets`,e.steps.join(' ')];})};
}
function mobilityContains(workout){
 return workout?.type==='Mobility'||Boolean(workout?.mobilityIncluded)||Boolean(workout?.mobilityRoutineId)||
  /mobiliteit|mobility/i.test([workout?.name,...(workout?.displaySteps||[]),workout?.warmup,workout?.cooldown].filter(Boolean).join(' '));
}
function mobilityRoutineForDate(date,budget=15){
 const prefs=mobilityPreferences(),main=allWorkouts()[date],planned=loadObject(MOBILITY_PLANS_KEY)[date];
 const recovery=typeof dailyRecoveryEvidence==='function'?dailyRecoveryEvidence(date):null;
 const recent=Object.entries(loadObject(SUPPORT_DONE_KEY)).filter(([key])=>calendarDayDifference(date,key.split(':')[0])>=0&&calendarDayDifference(date,key.split(':')[0])<=7);
 const reduce=recent.some(([,e])=>e.mobility?.feedback==='hard')||['attention','elevated'].includes(recovery?.level)||
  (date===todayDateString()&&typeof supportRecoveryBlocked==='function'&&supportRecoveryBlocked());
 const previous=allWorkouts()[addDays(date,-1)];
 const tired=previous&&typeof isHardWorkout==='function'&&isHardWorkout(previous);
 const type=main?.type;
 let id=planned?.routineId||(reduce||tired?'calm':({Run:'run',Ride:'bike',Bike:'bike',VirtualRide:'bike',Swim:'swim',Strength:'strength',Core:'strength'})[type]||'calm');
 const limit=Math.min(planned?.minutes||prefs.minutes,budget,reduce?5:15);
 return mobilityBuildRoutine(id,limit,prefs);
}
function validateMobilityBackup(key,value){
 if(key===MOBILITY_PREFS_KEY){
  if(![5,10,15].includes(value.minutes)) throw new Error('Ongeldige mobiliteitsduur.');
  for(const [field,allowed] of [['areas',Object.keys(MOBILITY_AREAS)],['equipment',['chair','wall']],['favorites',Object.keys(MOBILITY_EXERCISES)],['avoid',Object.keys(MOBILITY_EXERCISES)]]){
   if(!Array.isArray(value[field])||value[field].some(x=>!allowed.includes(x))) throw new Error('Ongeldige mobiliteitsvoorkeur.');
  }
  if(typeof value.sound!=='boolean'||typeof value.vibrate!=='boolean') throw new Error('Ongeldige signaalvoorkeur.');
  if(value.reallow!==undefined&&(!value.reallow||typeof value.reallow!=='object'||Array.isArray(value.reallow)||Object.entries(value.reallow).some(([id,date])=>!MOBILITY_EXERCISES[id]||typeof date!=='string'||!Number.isFinite(Date.parse(date)))))throw new Error('Ongeldige toestemming voor oefeningen.');
 }else if(key===MOBILITY_PLANS_KEY){
  for(const [date,p] of Object.entries(value)) if(calendarDayNumber(date)===null||!p||!Object.hasOwn(MOBILITY_ROUTINES,p.routineId)||![5,10,15].includes(p.minutes)) throw new Error('Ongeldige mobiliteitsplanning.');
 }
}
function validateMobilityLog(m){
 if(m.version!==1||!['','pleasant','easy','hard','uncomfortable'].includes(m.feedback)||!Number.isFinite(m.actualSeconds)||m.actualSeconds<0||m.actualSeconds>10800||!Array.isArray(m.uncomfortableIds)||m.uncomfortableIds.some(id=>!MOBILITY_EXERCISES[id])||!Array.isArray(m.records)||m.records.length>200)throw new Error('Ongeldig mobiliteitslogboek.');
 for(const r of m.records)if(!MOBILITY_EXERCISES[r.exerciseId]||!['links','rechts','beide'].includes(r.side)||!['complete','partial','skipped'].includes(r.status)||!Number.isFinite(r.seconds)||r.seconds<0||r.seconds>60||!Number.isInteger(r.set)||r.set<1||r.set>3)throw new Error('Ongeldige uitgevoerde oefening.');
}
function mobilityMainCompleted(date,workout){
 if(workout?.type!=='Mobility')return false;
 const e=loadObject(SUPPORT_DONE_KEY)[`${date}:mobility`];return e?.done===true&&e.completion==='complete'&&e.mobility?.mainIdentity===workoutCompletionIdentity(workout);
}
