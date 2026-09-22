function sendJson(res,status,payload){
  res.status(status);
  res.setHeader("Content-Type","application/json; charset=utf-8");
  return res.end(JSON.stringify(payload));
}

function numberOrNull(value){
  if(value===null||value===undefined||value==="") return null;
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}

async function fetchWithTimeout(url,options={},timeoutMs=12000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    return await fetch(url,{...options,signal:controller.signal});
  }finally{
    clearTimeout(timer);
  }
}

function normalizeInterval(interval,index){
  if(!interval||typeof interval!=="object") return null;

  const distance=numberOrNull(interval.distance);
  const moving=numberOrNull(interval.moving_time);
  const speed=numberOrNull(interval.average_speed);

  return{
    id:String(interval.id??index),
    type:String(interval.type||""),
    startTime:numberOrNull(interval.start_time),
    endTime:numberOrNull(interval.end_time),
    distanceKm:distance===null?null:distance/1000,
    movingSeconds:moving,
    elapsedSeconds:numberOrNull(interval.elapsed_time),
    averageSpeed:speed,
    paceSecondsPerKm:
      speed!==null&&speed>0
        ?1000/speed
        :distance!==null&&distance>0&&moving!==null&&moving>0
          ?moving/(distance/1000)
          :null,
    averageHeartRate:numberOrNull(interval.average_heartrate),
    maxHeartRate:numberOrNull(interval.max_heartrate),
    averageCadence:numberOrNull(interval.average_cadence),
    trainingLoad:numberOrNull(interval.training_load),
    intensity:numberOrNull(interval.intensity),
    zone:numberOrNull(interval.zone)
  };
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");

  if(req.method!=="GET"){
    res.setHeader("Allow","GET");
    return sendJson(res,405,{error:"Alleen GET is toegestaan."});
  }

  const apiKey=process.env.INTERVALS_API_KEY;
  const appPin=process.env.JACO_APP_PIN;

  if(!apiKey||!appPin){
    return sendJson(res,500,{
      error:"INTERVALS_API_KEY of JACO_APP_PIN ontbreekt in Vercel."
    });
  }

  const providedPin=req.headers["x-jaco-pin"];
  if(String(providedPin??"")!==String(appPin)){
    return sendJson(res,401,{
      error:"App-pincode is nodig voor persoonlijke trainingsdata."
    });
  }

  const activityId=String(req.query?.activityId||"").trim();
  if(
    !activityId ||
    activityId.length>80 ||
    !/^[A-Za-z0-9_-]+$/.test(activityId)
  ){
    return sendJson(res,400,{error:"Ongeldig activityId."});
  }

  const authorization=Buffer
    .from(`API_KEY:${apiKey}`,"utf8")
    .toString("base64");

  try{
    const response=await fetchWithTimeout(
      `https://intervals.icu/api/v1/activity/${encodeURIComponent(activityId)}?intervals=true`,
      {
        method:"GET",
        headers:{
          Authorization:`Basic ${authorization}`,
          Accept:"application/json"
        }
      }
    );

    const text=await response.text();
    let body;
    try{
      body=text?JSON.parse(text):{};
    }catch{
      body={raw:text};
    }

    if(!response.ok){
      const message=
        body?.message||
        body?.error||
        body?.raw||
        `HTTP ${response.status}`;

      return sendJson(res,502,{
        error:`Intervals.icu weigerde de detailaanvraag: ${message}`
      });
    }

    if(!body||Array.isArray(body)||typeof body!=="object"){
      return sendJson(res,502,{
        error:"Intervals.icu gaf een onverwacht activiteitsdetailformaat terug."
      });
    }

    const rawIntervals=
      Array.isArray(body.icu_intervals)
        ?body.icu_intervals
        :Array.isArray(body.intervals)
          ?body.intervals
          :[];

    const intervals=rawIntervals
      .map(normalizeInterval)
      .filter(Boolean)
      .sort((a,b)=>(a.startTime||0)-(b.startTime||0));

    return sendJson(res,200,{
      ok:true,
      fetchedAt:new Date().toISOString(),
      activityId,
      intervalCount:intervals.length,
      intervals,
      activity:{
        name:String(body.name||""),
        type:String(body.type||""),
        startDateLocal:String(body.start_date_local||""),
        distanceKm:numberOrNull(body.distance)===null
          ?null
          :numberOrNull(body.distance)/1000,
        movingMinutes:numberOrNull(body.moving_time)===null
          ?null
          :numberOrNull(body.moving_time)/60,
        averageHeartRate:numberOrNull(body.average_heartrate),
        maxHeartRate:numberOrNull(body.max_heartrate),
        trainingLoad:numberOrNull(body.icu_training_load),
        perceivedExertion:numberOrNull(body.perceived_exertion),
        decoupling:numberOrNull(body.decoupling)
      }
    });
  }catch(error){
    const message=
      error?.name==="AbortError"
        ?"de aanvraag duurde te lang"
        :error.message;
    return sendJson(res,500,{
      error:`De server kon Intervals.icu niet bereiken: ${message}`
    });
  }
}
