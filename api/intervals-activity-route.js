function sendJson(res,status,payload){
  res.status(status);
  res.setHeader("Content-Type","application/json; charset=utf-8");
  return res.end(JSON.stringify(payload));
}

export function normalizeRouteStreams(body){
  const streams=Array.isArray(body)?body:body?.type==="latlng"?[body]:
    Array.isArray(body?.streams)?body.streams:Object.values(body||{});
  const stream=streams.find(item=>item?.type==="latlng" &&
    Array.isArray(item.data) && Array.isArray(item.data2));
  if(!stream) return [];
  const count=Math.min(stream.data.length,stream.data2.length,100000);
  const stride=Math.max(1,Math.ceil(count/600));
  const points=[];
  for(let i=0;i<count;i+=stride){
    const lat=Number(stream.data[i]);
    const lon=Number(stream.data2[i]);
    if(Number.isFinite(lat) && Math.abs(lat)<=85 &&
      Number.isFinite(lon) && Math.abs(lon)<=180){
      points.push([lat,lon]);
    }
  }
  const last=count-1;
  if(last>=0 && last%stride!==0){
    const lat=Number(stream.data[last]);
    const lon=Number(stream.data2[last]);
    if(Number.isFinite(lat) && Math.abs(lat)<=85 &&
      Number.isFinite(lon) && Math.abs(lon)<=180){
      points.push([lat,lon]);
    }
  }
  return points;
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="GET"){
    res.setHeader("Allow","GET");
    return sendJson(res,405,{error:"Alleen GET is toegestaan."});
  }
  const apiKey=process.env.INTERVALS_API_KEY;
  const appPin=process.env.JACO_APP_PIN;
  if(!apiKey || !appPin) return sendJson(res,500,{error:"API-configuratie ontbreekt."});
  if(String(req.headers["x-jaco-pin"]??"")!==String(appPin)){
    return sendJson(res,401,{error:"App-pincode is nodig voor routegegevens."});
  }
  const activityId=String(req.query?.activityId||"").trim();
  if(!/^[A-Za-z0-9_-]{1,80}$/.test(activityId)){
    return sendJson(res,400,{error:"Ongeldig activityId."});
  }
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const auth=Buffer.from(`API_KEY:${apiKey}`,"utf8").toString("base64");
    const response=await fetch(
      `https://intervals.icu/api/v1/activity/${encodeURIComponent(activityId)}/streams.json?types=latlng`,
      {headers:{Authorization:`Basic ${auth}`,Accept:"application/json"},signal:controller.signal}
    );
    if(!response.ok) return sendJson(res,502,{error:"Route kon niet worden opgehaald."});
    const points=normalizeRouteStreams(await response.json());
    return sendJson(res,200,{activityId,points});
  }catch(error){
    return sendJson(res,502,{error:error.name==="AbortError"
      ?"Routeaanvraag duurde te lang.":"Route kon niet worden opgehaald."});
  }finally{clearTimeout(timer);}
}
