/* Cache application files only. Never cache Supabase requests or touch user storage. */
const PREFIX='education-shell-';
const CACHE=PREFIX+'__BUILD_ID__';
const FILES=__PRECACHE__;
const SCOPE=self.registration.scope;
const SHELL=new URL('./index.html',SCOPE).href;
const URLS=FILES.map(file=>new URL(file,SCOPE).href);
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    // Atomic installation: an incomplete release does not replace the working one.
    await cache.addAll(URLS.map(url=>new Request(url,{cache:'reload'})));
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const older=(await caches.keys()).filter(key=>key.startsWith(PREFIX)&&key!==CACHE);
    // Keep two previous shells for tabs still displaying an earlier release.
    await Promise.all(older.slice(0,-2).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  const url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin)return;
  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(req,{cache:'no-store'});
        if(response.ok||response.status<500)return response;
      }catch{}
      // Keep the install-time HTML and its matching, versioned assets together.
      return (await (await caches.open(CACHE)).match(SHELL))||new Response('Education is offline. Reconnect once to install the app.',{status:503,headers:{'Content-Type':'text/plain'}});
    })());
    return;
  }
  if(URLS.includes(url.href)){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      return (await cache.match(req))||fetch(req);
    })());
  }
});
