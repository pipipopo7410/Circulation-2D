const CACHE_NAME = 'blood-2d-v1';
const FILES = ['./', './index.html', './styles.css', './app.js', './circulation.svg', './manifest.webmanifest', './favicon.svg'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('blood-2d-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok){const clone=response.clone();caches.open(CACHE_NAME).then(c=>c.put(event.request,clone));}
    return response;
  })));
});
