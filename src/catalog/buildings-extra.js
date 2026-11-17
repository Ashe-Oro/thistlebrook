// WORKTREE-HOOK building-variety is the sole shared catalog integration.
// No additions to compiler pools. Browser-only imports start after an explicit opt-in.
export function installBuildingVariety() {
 if(typeof window==='undefined'||new URLSearchParams(window.location.search).get('variety')!=='1')return;
 window.__variety={ready:false,error:null};
 const started=Date.now();
 const timer=setInterval(()=>{
  if(!window.__ready){if(Date.now()-started>180000){clearInterval(timer);window.__variety.error='Town did not become ready';}return;}
  clearInterval(timer);
  import('./building-variety-runtime.js').then(m=>m.applyBuildingVariety()).catch(e=>{window.__variety.error=String(e.stack||e);console.error(e);});
 },50);
}
