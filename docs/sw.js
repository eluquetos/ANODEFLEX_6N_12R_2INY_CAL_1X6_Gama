const CACHE="anodeflex-6n-12r-2iny-cal-1x6-gama-v2";
const ASSETS=["./","index.html","styles.css?v=5","model.js?v=4","app.js?v=5","manifest.webmanifest","favicon.svg","icon-192.svg","icon-512.svg"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("anodeflex-6n-12r-2iny-cal-1x6-gama-")&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()).then(()=>self.clients.matchAll({type:"window"})).then(clients=>Promise.all(clients.map(client=>client.navigate(client.url))))));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(cached=>cached||caches.match("index.html"))));
});
