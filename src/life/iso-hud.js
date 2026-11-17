export function createIsoHud(q) {
 const style=document.createElement('style');style.textContent=`
 #hud,#life-hud,#lk-cam{display:none!important} ${q.get('debug')==='1'?'':'#look{display:none!important}'}
 .iso-chrome{position:fixed;color:#fff1d4;background:#233731eb;border:1px solid #d8c29088;border-radius:12px;box-shadow:0 5px 22px #18272030;font:13px/1.65 system-ui;z-index:35}
 #iso-clock{left:20px;bottom:20px;padding:12px 18px;pointer-events:none}#iso-clock b{font:20px Georgia}#iso-clock small{opacity:.8;font-size:11px}
 #iso-tooltip{padding:6px 12px;pointer-events:none;display:none;max-width:260px}
 #iso-card{right:20px;top:20px;width:250px;padding:16px 20px;display:none}#iso-card strong{display:block;font:20px/1.4 Georgia}#iso-card button{float:right;margin:-6px -10px 2px 8px;border:0;background:transparent;color:inherit;font-size:24px;cursor:pointer}#iso-card p{margin:8px 0 0}#iso-card small{opacity:.75}
 @media(max-width:600px){#iso-clock{left:8px;bottom:8px;max-width:calc(100vw - 52px)}#iso-card{right:8px;top:8px;width:210px}}
 `;document.head.append(style);
 const clock=document.createElement('div');clock.id='iso-clock';clock.className='iso-chrome';document.body.append(clock);
 const tooltip=document.createElement('div');tooltip.id='iso-tooltip';tooltip.className='iso-chrome';document.body.append(tooltip);
 const card=document.createElement('aside');card.id='iso-card';card.className='iso-chrome';card.setAttribute('aria-live','polite');
 const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Close inspection');const title=document.createElement('strong'),body=document.createElement('p'),note=document.createElement('small');card.append(close,title,body,note);document.body.append(card);
 return {close, clock(hour){const h=Math.floor(hour),m=Math.floor(hour%1*60);clock.innerHTML=`<b>Willowmere</b> &nbsp; ${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'} · ${hour<6||hour>=19?'Moonlit':hour>=16?'Golden hour':'Daylight'}<br><small>Wheel / pinch zoom · Drag ground to pan · Q/E rotate · Click to inspect · F +3h</small>`;},tooltip(text,x,y){tooltip.textContent=text||'';tooltip.style.display=text?'block':'none';tooltip.style.left=Math.max(8,Math.min(innerWidth-280,x+16))+'px';tooltip.style.top=Math.max(8,Math.min(innerHeight-60,y+14))+'px';},card(name,text,hint=''){card.style.display=name?'block':'none';title.textContent=name||'';body.textContent=text||'';note.textContent=hint;}};
}
