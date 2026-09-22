const CACHE_NAME="jaco-performance-shell-v910";
const APP_SHELL=[
  "/",
  "/index.html",
  "/css/app.css?v=910",
  "/js/app.js?v=910",
  "/js/bootstrap.js?v=910",
  "/manifest.webmanifest?v=910",
  "/icons/app-icon.svg"
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
