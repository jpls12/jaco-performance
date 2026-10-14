/* Pure, versioned field-test calculations. No DOM, profile defaults or network access. */
(function(root){
  'use strict';
  const VERSION=1;
  const SOURCES={
    friel:'https://www.trainingpeaks.com/learn/articles/joe-friel-s-quick-guide-to-setting-zones/',
    drift:'https://uphillathlete.com/aerobic-training/heart-rate-drift/',
    maximum:'https://www.polar.com/blog/calculate-maximum-heart-rate-running/'
  };
  const PROTOCOLS={
    aerobic:{name:'Aerobe duurcontrole',minutes:85,hard:false,days:56,source:SOURCES.drift,
      measures:'Hartslag-tempo-ontkoppeling bij een vaste rustige inspanning. Geeft een aanwijzing voor een aerobe trainingsgrens; geen lactaat- of ventilatoire meting.',
      steps:[[15,'Rustig inlopen; kies een comfortabel praattempo en laat de hartslag stabiliseren'],[30,'Eerste helft: constant tempo, markeer begin met rondeknop'],[30,'Tweede helft: exact dezelfde snelheid, geen pauze'],[10,'Rustig uitlopen']],
      needs:'60 minuten test met tijd, hartslag en snelheid; markeer de start. Vlakke baan of gekalibreerde loopband op vaste helling. Noteer RPE en omstandigheden.'},
    threshold:{name:'30 minuten solotest',minutes:55,hard:true,days:56,source:SOURCES.friel,
      measures:'Veldschatting van drempelhartslag (laatste 20 minuten) en functioneel drempeltempo (30 minuten). Geen exacte LT2- of VT2-meting.',
      steps:[[15,'Rustig inlopen en geleidelijk voorbereiden'],[10,'Begin 30 minuten gelijkmatig zo hard als je kunt volhouden; loop solo'],[20,'Zonder pauze doorgaan; druk na de eerste 10 minuten op de rondeknop'],[10,'Rustig uitlopen']],
      needs:'30 ononderbroken testminuten met tijd, hartslag en snelheid, inclusief de laatste 20 minuten. Vlak verkeersvrij parcours; geen sprintstart.'},
    performance:{name:'5 km prestatietest',minutes:60,hard:true,days:42,source:SOURCES.friel,
      measures:'Werkelijke 5 km-prestatie, geen fysiologische drempel. Een recente correct gemeten wedstrijd kan deze test vervangen.',
      steps:[[15,'Rustig inlopen'],[null,'Loop 5 km gelijkmatig op beste vol te houden inspanning; markeer begin en einde'],[10,'Rustig uitlopen']],
      needs:'Gemeten 5 km-baan, verstreken tijd en volledige snelheidsdata. Geen autopauze. Een recente wedstrijd van 3–42,2 km kan ook als prestatieresultaat worden ingevoerd.'},
    maximum:{name:'Optionele maximale hartslagtest',minutes:50,hard:true,days:180,source:SOURCES.maximum,
      measures:'Hoogste aanhoudende hartslag in een bewust maximale veldtest. Benadering van HRmax; een gewone trainingspiek blijft een afzonderlijke waarneming.',
      steps:[[15,'Inlopen op vlak terrein'],[2,'Heuvelop naar inspanning die circa 20 minuten houdbaar is'],[4,'Rustig terug naar beneden'],[2,'Heuvelop naar circa 3 km-inspanning'],[4,'Herstel tot hartslag 30–40 slagen is gedaald; neem zo nodig langer'],[1,'Alleen indien geschikt: laatste helling op maximaal vol te houden inspanning'],[10,'Minimaal 10 minuten uitlopen']],
      needs:'Borstband aanbevolen, begeleider en ervaring met intensieve training. Volledige hartslagtijdreeks; geen vaste opslag bij een eerdere piek. Markeer begin/einde van het hele heuvelblok.'}
  };
  const METRICS={aerobicHr:['Aerobe trainingsgrens','bpm',70,210],thresholdHr:['Drempelhartslag','bpm',80,220],maxHr:['Geteste maximale hartslag','bpm',100,230],observedHr:['Hoogste waargenomen hartslag','bpm',60,230],thresholdPace:['Drempeltempo','s/km',150,900],performance:['Prestatie','s',300,25000],ftp:['FTP','W',50,600],css:['CSS','s/100 m',40,300]};
  const copy=x=>JSON.parse(JSON.stringify(x));
  const num=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
  const day=x=>{const stamp=Date.parse(x+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(x||'')&&Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===x?stamp/86400000:NaN;};
  const age=(today,date)=>day(today)-day(date);
  const empty=()=>({schema:VERSION,revision:0,values:{run:{},ride:{},swim:{}},results:[],history:[],plans:{}});
  function validateValue(v){
    const m=METRICS[v.metric],n=num(v.value);
    if(!m||!['run','ride','swim'].includes(v.sport)||n===null||n<m[2]||n>m[3]||!Number.isFinite(day(v.date))||!v.source||!v.method) throw Error('Vul een geldige waarde, sport, testdatum, bron en methode in.');
    if(v.sport==='swim'&&v.metric!=='css'||v.metric==='css'&&v.sport!=='swim'||v.metric==='ftp'&&v.sport!=='ride'||['thresholdPace','performance'].includes(v.metric)&&v.sport!=='run') throw Error('Deze waarde past niet bij deze sport.');
    if(v.metric==='performance'&&(!(num(v.distanceKm)>=3)||num(v.distanceKm)>42.2||n/v.distanceKm<150||n/v.distanceKm>900)) throw Error('Prestatie: gebruik 3–42,2 km en een plausibele eindtijd.');
    return {...v,value:n};
  }
  function zones(values,sport){
    const v=values?.[sport]||{},hr=v.thresholdHr?.value;
    // Friel zone percentages are a training convention, not measured LT1/VT1.
    const cuts=sport==='run'?[.85,.90,.95,1,1.03,1.07]:[.81,.90,.94,1,1.03,1.07];
    const labels=['Z1','Z2','Z3','Z4','Z5a','Z5b','Z5c'];
    return hr?labels.map((label,i)=>({label,min:i?Math.ceil(hr*cuts[i-1]):null,max:i<6?Math.ceil(hr*cuts[i])-1:null})):[];
  }
  function accept(state,id,{resolveConflict=false,confirmLarge=false,today}={}){
    const s=copy(state),r=s.results.find(x=>x.id===id);
    if(!r||r.status!=='pending'||r.quality!=='bruikbaar'||!r.candidates.length) throw Error('Dit resultaat kan niet worden verwerkt.');
    const next=copy(s.values);
    for(const raw of r.candidates){
      const v=validateValue(raw),old=next[v.sport]?.[v.metric];
      if(today&&age(today,v.date)<0) throw Error('Een testdatum mag niet in de toekomst liggen.');
      if(old&&(old.locked||old.sourceType==='professional')&&!resolveConflict) throw Error('Deze waarde is vastgezet of professioneel bepaald. Kies expliciet welke bron leidend is.');
      if(old?.date&&v.date<old.date&&!resolveConflict) throw Error('De bestaande bron is recenter. Kies expliciet welke bron leidend is.');
      if(old?.value&&Math.abs(v.value/old.value-1)>.08&&!confirmLarge) throw Error('Wijziging groter dan 8%: controleer de bron en bevestig de grote wijziging.');
      if(v.metric==='observedHr'&&old&&v.value<old.value) continue;
      next[v.sport][v.metric]={...v,resultId:id};
    }
    for(const v of Object.values(next)){
      if(v.aerobicHr&&v.thresholdHr&&v.aerobicHr.value>=v.thresholdHr.value) throw Error('Aerobe grens moet onder de drempelhartslag liggen; controleer de bronnen.');
      if(v.maxHr&&v.thresholdHr&&v.thresholdHr.value>v.maxHr.value) throw Error('Drempelhartslag ligt boven de geteste maximale hartslag; controleer de bronnen.');
    }
    s.history.push({revision:s.revision+1,resultId:id,before:copy(s.values),after:copy(next),date:today});
    r.previous=copy(s.values);s.values=next;s.revision++;r.status='accepted';return s;
  }
  function reject(state,id){const s=copy(state),r=s.results.find(x=>x.id===id);if(!r||r.status!=='pending')throw Error('Resultaat is al behandeld.');r.status='rejected';return s;}
  function undo(state,today){
    const s=copy(state),last=s.history[s.history.length-1];
    if(!last)throw Error('Geen wijziging om terug te draaien.');
    const before=copy(s.values);s.values=copy(last.before);s.revision++;
    s.history.push({revision:s.revision,before,after:copy(s.values),date:today,undoOf:last.revision});return s;
  }
  function addResult(state,result,{retry=false}={}){
    const s=copy(state);
    // One activity can never be accepted twice under a different protocol.
    const index=s.results.findIndex(x=>x.id===result.id||(result.activityId&&x.activityId===result.activityId));
    if(index>=0){const old=s.results[index];if(retry&&old.status==='pending'&&old.quality!=='bruikbaar'){s.results[index]={...copy(result),previousAttempts:[...(old.previousAttempts||[]),{quality:old.quality,issues:old.issues,date:old.date}]};}return s;}
    s.results.push(copy(result));return s;
  }
  function eligible(kind,check={}){
    if(check.symptoms||check.ill||check.medical) return {ok:false,reason:'Geen test bij inspanningsklachten, ziekte of relevante medische beperking. Laat klachten of beperkingen professioneel beoordelen.'};
    if(!check.reviewed||!check.recovered) return {ok:false,reason:'Vul de geschiktheidscheck in en test alleen voldoende hersteld.'};
    if(PROTOCOLS[kind]?.hard&&(!check.optIn||!check.experienced)) return {ok:false,reason:'Een zware test vereist een bewuste keuze en recente ervaring met intensieve training. Kies anders een rustige duurcontrole.'};
    return {ok:true};
  }
  function recommendation(state,{today,phase='build',recentRace=null}={}){
    const v=state.values.run;
    if(recentRace&&age(today,recentRace.date)>=0&&age(today,recentRace.date)<=42) return {kind:null,reason:'Recente wedstrijd beschikbaar: beoordeel die eerst als prestatiebron; geen extra prestatietest nodig.'};
    const recent=state.results.filter(r=>r.quality==='bruikbaar'&&age(today,r.date)>=0&&age(today,r.date)<=42);
    const trend=recent.filter(r=>r.candidates.some(c=>c.sport==='run'&&v[c.metric]?.value&&Math.abs(c.value/v[c.metric].value-1)>.03));
    if(trend.length>=3)return {kind:null,reason:'Meerdere bruikbare resultaten wijzen op verandering. Beoordeel de bestaande voorstellen eerst.'};
    const lastAerobic=recent.find(r=>r.kind==='aerobic');
    if((!v.aerobicHr||v.aerobicHr.quality==='onbevestigd')&&!lastAerobic)return {kind:'aerobic',reason:'Geen betrouwbare aerobe uitgangswaarde. Begin met een submaximale duurcontrole.'};
    if(v.aerobicHr?.date&&age(today,v.aerobicHr.date)>=PROTOCOLS.aerobic.days)return {kind:'aerobic',reason:'Aerobe bron is ouder dan 8 weken. Controleer alleen als recente rustige trainingen onvoldoende informatie geven.'};
    if((!v.thresholdHr||!v.thresholdPace||age(today,v.thresholdHr.date)>=56)&&!recent.some(r=>r.kind==='threshold'))return {kind:'threshold',reason:'Drempelgegevens ontbreken of zijn ouder dan 8 weken. Een solotest is optioneel en vereist je bewuste keuze.'};
    if(['base','build'].includes(phase)&&!recent.length)return {kind:'aerobic',reason:'Basis-/opbouwfase: een rustige controle kan de trainingsgrens evalueren.'};
    return {kind:null,reason:'Recente waarden of resultaten beschikbaar. Geen extra test nodig; je kunt zelf een test kiezen.'};
  }
  function slot(kind,date,ctx){
    const p=PROTOCOLS[kind],w=ctx.workouts[date];
    if(!p||age(date,ctx.today)<=0)return 'Kies een toekomstige dag.';
    if(!w||w.type!=='Run'||w.locked||w.calibration||ctx.completed?.[date])return 'Vervang een bestaande, niet vastgezette hardlooptraining.';
    const a=ctx.availability(date);
    if(!a?.available||num(a.maxMinutes)===null||a.maxMinutes<(p.minutes+(ctx.supportMinutes?.(date)||0)))return 'Onvoldoende beschikbare tijd inclusief aanvullende sessies.';
    const duration=num(w.durationMinutes)||num(w.distanceKm)*5.5;
    if(!duration||duration<p.minutes)return 'Deze test duurt langer dan de bestaande training; kies een langer gepland slot.';
    if(p.hard&&!ctx.isHard(w))return 'Een zware test vervangt uitsluitend een kwaliteitstraining.';
    if(ctx.readiness==='low'||ctx.readiness==='moderate')return 'Herstel laat nu geen kalibratie toe.';
    for(const r of ctx.races||[]){const delta=age(r.date,date);if(delta>=-Math.max(3,ctx.recoveryDays?.(r)||3)&&delta<=(r.priority==='A'?14:7))return 'Beschermde periode rond een wedstrijd; stel de test uit.';}
    for(const [d,item] of Object.entries(ctx.workouts)){if(d!==date&&Math.abs(age(d,date))<=2&&(item.type==='Race'||ctx.isHard(item)||item.planType==='long'))return 'Houd minimaal twee rustige dagen rond een zware of lange training, ook bij andere sporten.';}
    for(const a of ctx.activities||[]){const gap=age(date,a.date);if(gap>=0&&gap<=2&&(num(a.perceivedExertion)>=7||num(a.durationMinutes)>=90||num(a.trainingLoad)>=80))return 'Te kort na een zware of lange activiteit.';}
    if(ctx.supportHardNear?.(date))return 'Zware aanvullende krachttraining te dicht bij de test.';
    return null;
  }
  function analyze(kind,input){
    const p=PROTOCOLS[kind];if(!p)throw Error('Onbekend protocol.');
    const result={id:`activity:${input.activityId}`,activityId:String(input.activityId),kind,date:input.date,sport:'run',method:p.name,status:'pending',quality:'onbruikbaar',issues:[],candidates:[],summary:'',protocolVersion:VERSION};
    const issue=x=>{if(!result.issues.includes(x))result.issues.push(x);};
    const start=num(input.start),end=num(input.end),rpe=num(input.rpe),rows=input.samples||[];
    if(!input.activityId||!Number.isFinite(day(input.date))||input.sport!=='run')issue('Een gedateerde hardloopactiviteit is vereist.');
    if(!input.completed)issue('Test afgebroken of protocol niet volledig gevolgd.');
    if(start===null||end===null||start<0||end<=start)issue('Selecteer het exacte testblok, zonder in- en uitlopen.');
    const duration=end-start;
    if(start<900)issue('De vereiste warming-up van minimaal 15 minuten ontbreekt in de registratie.');
    if(kind==='maximum'&&(duration<780||duration>1800))issue('Het volledige heuvelprotocol inclusief herstel is niet geselecteerd (13–30 minuten).');
    if(kind==='aerobic'&&Math.abs(duration-3600)>5||kind==='threshold'&&Math.abs(duration-1800)>5)issue('Testduur wijkt af van het gekozen protocol.');
    if(rpe===null||rpe<1||rpe>10)issue('Ervaren inspanning ontbreekt.');
    if(!input.conditionsReviewed)issue('Omstandigheden zijn nog niet beoordeeld.');
    if(kind==='aerobic'&&(rpe>4||!input.talkComfortable))issue('De duurcontrole was niet comfortabel op praattempo.');
    if(['threshold','performance','maximum'].includes(kind)&&rpe<8)issue('De vereiste testinspanning is niet bevestigd.');
    if(!eligible(kind,input.check).ok)issue(eligible(kind,input.check).reason);
    const limitations=['heat','fatigue','hills','interruptions','gpsProblems'].filter(k=>input[k]);
    if(kind==='maximum'&&limitations.includes('hills'))limitations.splice(limitations.indexOf('hills'),1);
    limitations.forEach(x=>issue(({heat:'Hitte',fatigue:'Vermoeidheid',hills:'Wisselend terrein',interruptions:'Onderbrekingen',gpsProblems:'GPS-/afstandsproblemen'})[x]+' beperkt de interpretatie.'));
    const data=rows.filter(x=>num(x.t)!==null&&x.t>=start&&x.t<=end);
    if(data.length<20||!data.length||data[0].t>start+5||data[data.length-1].t<end-5)issue('Volledige tijdreeks ontbreekt; activiteitsgemiddelden zijn onvoldoende.');
    const needHr=kind!=='performance',needSpeed=kind!=='maximum';
    let coverage=0,hrCoverage=0,speedCoverage=0,lockSeconds=0;
    const segments=[];
    for(let i=0;i<data.length-1;i++){
      const a=data[i],b=data[i+1],dt=b.t-a.t,hr=num(a.hr),speed=num(a.speed),cad=num(a.cadence);
      if(dt<=0||dt>5){issue('Meetuitval of ongeldige tijdvolgorde.');continue;}
      coverage+=dt;
      if(hr!==null&&hr>=45&&hr<=230)hrCoverage+=dt;else if(needHr)issue('Hartslag ontbreekt of is onrealistisch.');
      if(needHr&&hr!==null&&num(b.hr)!==null&&Math.abs(b.hr-hr)>Math.max(12,dt*5))issue('Abrupte hartslagpiek: controleer de sensor.');
      if(speed!==null&&speed>=1&&speed<=8)speedCoverage+=dt;else if(needSpeed)issue('Snelheidsuitval, stop of onrealistische GPS-snelheid.');
      if(needSpeed&&speed!==null&&num(b.speed)!==null&&Math.abs(b.speed-speed)/dt>2)issue('Abrupte GPS-snelheidsverandering.');
      if(needHr&&cad>0&&hr!==null&&(Math.abs(hr-cad)<3||Math.abs(hr-2*cad)<3))lockSeconds+=dt;
      segments.push({a,b,dt,hr,speed});
    }
    if(coverage<duration*.98||needHr&&hrCoverage<duration*.98||needSpeed&&speedCoverage<duration*.98)issue('Onvoldoende meetdekking in het testblok.');
    if(needHr&&lockSeconds>duration*.7)issue('Mogelijke cadansverwarring; beoordeel de hartslagmeting.');
    function mean(field,lo=start,hi=end){let sum=0,n=0;for(const s of segments){const dt=Math.max(0,Math.min(s.b.t,hi)-Math.max(s.a.t,lo));if(num(s[field])!==null&&dt){sum+=s[field]*dt;n+=dt;}}return n?sum/n:null;}
    function peakTen(){let peak=0;for(let i=0;i<segments.length;i++){const lo=segments[i].a.t,hi=lo+10;if(hi>end)break;let sum=0,n=0;for(let j=i;j<segments.length&&segments[j].a.t<hi;j++){const seg=segments[j],dt=Math.min(seg.b.t,hi)-seg.a.t;if(seg.hr!==null&&dt>0){sum+=seg.hr*dt;n+=dt;}}if(n>=10)peak=Math.max(peak,sum/n);}return peak;}
    const hr=mean('hr'),speed=mean('speed');
    const value=(metric,n,extra={})=>({sport:'run',metric,value:Math.round(n),date:input.date,source:`Intervals.icu ${input.activityId}`,sourceType:'field',method:p.name,quality:'veldschatting',locked:false,...extra});
    if(result.issues.length){result.summary='Geen zonewijziging. Controleer de meetgegevens en herhaal pas hersteld onder geschikte omstandigheden.';return result;}
    result.quality='bruikbaar';
    if(kind==='aerobic'||kind==='threshold'){
      const mid=start+duration/2,s1=mean('speed',start,mid),s2=mean('speed',mid,end);
      const variability=Math.sqrt(segments.reduce((n,s)=>n+(s.speed-speed)**2*s.dt,0)/coverage)/speed;
      if(Math.abs(s2/s1-1)>.05||variability>.08){result.quality='beperkt';issue('Tempo was onvoldoende constant.');result.summary='Herhaal gelijkmatiger; geen zonewijziging.';return result;}
    }
    if(kind==='aerobic'){
      const mid=start+duration/2,ef1=mean('speed',start,mid)/mean('hr',start,mid),ef2=mean('speed',mid,end)/mean('hr',mid,end);
      const drift=(ef1/ef2-1)*100;result.drift=Math.round(drift*10)/10;
      result.summary=`Ontkoppeling ${result.drift}%. Dit is een veldindicatie, geen gemeten LT1 of VT1.`;
      if(drift>=3.5&&drift<=5)result.candidates=[value('aerobicHr',mean('hr',start,start+180))];
      else result.summary+=drift<3.5?' Waarschijnlijk onder de aerobe grens; geen nieuwe drempel uit deze test.':'Te veel drift; herhaal rustiger en controleer omstandigheden.';
    }
    if(kind==='threshold'){
      result.candidates=[value('thresholdHr',mean('hr',start+600,end)),value('thresholdPace',1000/speed)];
      result.summary='Laatste 20 minuten hartslag en volledige 30 minuten tempo. Beide zijn functionele veldschattingen met dagvariatie.';
    }
    if(kind==='performance'){
      const distance=num(input.distanceKm),measured=speed*duration/1000;
      if(!input.measuredCourse||distance===null||distance<3||distance>42.2||Math.abs(measured/distance-1)>.03){result.quality='beperkt';issue('Afstand niet bevestigd op gemeten parcours of wijkt af van de tijdreeks.');}
      else result.candidates=[value('performance',duration,{distanceKm:distance,quality:'gemeten prestatie'})];
      result.summary='Eindtijd op gemeten parcours. Prognoses naar andere afstanden blijven modelschattingen; geen drempelhartslag afgeleid.';
    }
    if(kind==='maximum'){
      // Highest 10-second time-weighted window rejects single-sample maxima.
      const peak=peakTen();
      result.candidates=[value('maxHr',peak),value('observedHr',peak)];
      result.summary='Hoogste gemiddelde over 10 seconden tijdens de bevestigde maximale veldtest; exacte fysiologische HRmax blijft onzeker.';
    }
    if(needHr&&kind!=='maximum'&&result.quality==='bruikbaar'){result.observedHr=Math.round(peakTen());}
    return result;
  }
  root.CalibrationEngine={VERSION,SOURCES,PROTOCOLS,METRICS,num,day,age,empty,copy,validateValue,zones,accept,reject,undo,addResult,eligible,recommendation,slot,analyze};
  if(typeof module!=='undefined')module.exports=root.CalibrationEngine;
})(typeof window!=='undefined'?window:globalThis);
