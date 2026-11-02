const CACHE='manageopd-shell-v3', SHELL=['/','/index.html','/manifest.webmanifest','/favicon-64.png','/icon-192.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)))}); self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
const save=(req,r)=>{if(r.ok&&r.type==='basic'){const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy))}return r};
// Pages are network-first so a deploy reaches users on the next load (the cache is only the offline fallback);
// hashed /assets/ files never change under the same name, so they stay cache-first.
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/'))return;
if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(r=>save('/index.html',r)).catch(()=>caches.match('/index.html')));return}
e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>save(e.request,r))))});
