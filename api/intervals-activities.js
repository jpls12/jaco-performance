function sendJson(res,status,payload){
  res.status(status);
  res.setHeader("Content-Type","application/json; charset=utf-8");
  return res.end(JSON.stringify(payload));
}

const AMSTERDAM_DATE_FORMATTER=new Intl.DateTimeFormat("en-GB",{
  timeZone:"Europe/Amsterdam",
  year:"numeric",
  month:"2-digit",
  day:"2-digit"
});

function isoDate(date){
  const parts=Object.fromEntries(
    AMSTERDAM_DATE_FORMATTER
      .formatToParts(date)
      .filter(part=>part.type!=="literal")
      .map(part=>[part.type,part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function numberOrNull(value){
  if(value===null || value===undefined || value==="") return null;
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

function normalizeActivity(activity){
  const date=String(activity?.start_date_local||"").slice(0,10);
  const id=String(activity?.id||"").trim();
  if(!id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const distance=numberOrNull(activity?.distance);
  const movingTime=numberOrNull(activity?.moving_time);
  const elapsedTime=numberOrNull(activity?.elapsed_time);

  return{
    id,
    date,
    name:String(activity?.name||"Training"),
    type:String(activity?.type||""),
    startDateLocal:String(activity?.start_date_local||""),
    distanceKm:distance===null?null:distance/1000,
    durationMinutes:movingTime===null?null:movingTime/60,
    elapsedMinutes:elapsedTime===null?null:elapsedTime/60,
    elevationM:numberOrNull(activity?.total_elevation_gain),
    averageSpeed:numberOrNull(activity?.average_speed),
    averageHeartRate:numberOrNull(activity?.average_heartrate),
    maxHeartRate:numberOrNull(activity?.max_heartrate),
    averageWatts:numberOrNull(activity?.icu_average_watts),
    weightedAverageWatts:numberOrNull(activity?.icu_weighted_avg_watts),
    trainingLoad:numberOrNull(activity?.icu_training_load),
    intensity:numberOrNull(activity?.icu_intensity),
    perceivedExertion:numberOrNull(activity?.perceived_exertion)
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
  if(!apiKey || !appPin){
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

  const newest=new Date();
  const oldest=new Date();
  oldest.setDate(oldest.getDate()-56);

  const params=new URLSearchParams({
    oldest:isoDate(oldest),
    newest:isoDate(newest),
    limit:"300"
  });

  const authorization=Buffer
    .from(`API_KEY:${apiKey}`,"utf8")
    .toString("base64");

  try{
    const response=await fetchWithTimeout(
      `https://intervals.icu/api/v1/athlete/0/activities?${params.toString()}`,
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
      body=text?JSON.parse(text):[];
    }catch{
      body={raw:text};
    }

    if(!response.ok){
      const message=
        body?.message ||
        body?.error ||
        body?.raw ||
        `HTTP ${response.status}`;
      return sendJson(res,502,{
        error:`Intervals.icu weigerde de activiteitenaanvraag: ${message}`
      });
    }

    if(response.status!==204 && !Array.isArray(body)){
      return sendJson(res,502,{
        error:"Intervals.icu gaf een onverwacht activiteitenformaat terug."
      });
    }

    const rawActivities=Array.isArray(body)?body:[];
    const normalized=rawActivities.map(normalizeActivity);
    const activities=normalized
      .filter(Boolean)
      .sort((a,b)=>a.startDateLocal.localeCompare(b.startDateLocal));

    const typeCounts=activities.reduce((acc,activity)=>{
      const type=activity.type||"Unknown";
      acc[type]=(acc[type]||0)+1;
      return acc;
    },{});

    const coverage=key=>
      activities.filter(activity=>activity[key]!==null).length;

    return sendJson(res,200,{
      ok:true,
      fetchedAt:new Date().toISOString(),
      oldest:isoDate(oldest),
      newest:isoDate(newest),
      count:activities.length,
      rawCount:rawActivities.length,
      normalizedCount:activities.length,
      droppedCount:normalized.filter(activity=>!activity).length,
      typeCounts,
      metricsCoverage:{
        distanceKm:coverage("distanceKm"),
        durationMinutes:coverage("durationMinutes"),
        averageHeartRate:coverage("averageHeartRate"),
        trainingLoad:coverage("trainingLoad"),
        weightedAverageWatts:coverage("weightedAverageWatts")
      },
      activities
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
