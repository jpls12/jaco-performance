const CACHE_NAME="jaco-performance-shell-v1147";
const APP_SHELL=[
  "/",
  "/index.html",
  "/css/app.css?v=1147",
  "/css/visual-refresh.css?v=1147",
  "/js/app.js?v=1147",
  "/js/calibration-engine.js?v=1147",
  "/js/calibration.js?v=1147",
  "/js/support-training.js?v=1147",
  "/js/training-sync.js?v=1147",
  "/js/activity-results.js?v=1147",
  "/js/training-quality.js?v=1147",
  "/js/performance-model.js?v=1147",
  "/js/training-response.js?v=1147",
  "/js/session-progression.js?v=1147",
  "/js/adaptive-block-planner.js?v=1147",
  "/js/race-readiness.js?v=1147",
  "/js/fuel-hydration.js?v=1147",
  "/js/race-strategy.js?v=1147",
  "/js/race-day.js?v=1147",
  "/js/race-debrief.js?v=1147",
  "/js/daily-decision.js?v=1147",
  "/js/adaptive-week-replanner.js?v=1147",
  "/js/fully-adaptive-coach.js?v=1147",
  "/js/coach-state.js?v=1147",
  "/js/bootstrap.js?v=1147",
  "/js/interface.js?v=1147",
  "/manifest.webmanifest?v=1147",
  "/icons/app-icon.svg?v=1147",
  "/icons/app-icon-180.png?v=1147",
  "/icons/app-icon-192.png?v=1147",
  "/icons/app-icon-512.png?v=1147"
];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache=>cache.addAll(APP_SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys
          .filter(key=>key.startsWith("jaco-performance-shell-") && key!==CACHE_NAME)
          .map(key=>caches.delete(key))
      ))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET") return;

  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;
  if(url.pathname.startsWith("/api/")) return;

  if(request.mode==="navigate"){
    event.respondWith(
      fetch(request)
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put("/index.html",copy));
          return response;
        })
        .catch(()=>caches.match("/index.html"))
    );
    return;
  }

  const isStatic=
    url.pathname.startsWith("/css/") ||
    url.pathname.startsWith("/js/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname==="/manifest.webmanifest";

  if(!isStatic) return;

  event.respondWith(
    caches.match(request).then(cached=>{
      if(cached) return cached;

      return fetch(request).then(response=>{
        if(response && response.ok){
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
        }
        return response;
      });
    })
  );
});
