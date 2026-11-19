import './navigation.css';
export const VIEW_GROUPS=[
 ['Town life',[['village','The whole world'],['railway','Thistlebrook Northern Loop'],['neighbourhood','Willowbank'],['sunbeam','Sunbeam Terrace'],['maple-hollow','Maple Hollow'],['downtown','Downtown'],['market','Market Square'],['orchard','Clover Fields'],['campus','Thistlebrook High'],['civic','Civic Green'],['works','West Works'],['quay','Lantern Quay']]],
 ['Parks & coast',[['fair','Merrymead Park'],['outskirts','Stillwater countryside'],['lake','Stillwater Lake'],['farmland','Farms & orchards'],['skatepark','Switchyard Skate & Bike'],['harbor','Saltwind Harbor'],['shell-cove','Shell Cove'],['coast','Coral Coast'],['beach','Coral Beach'],['strip','Ocean Drive']]],
 ['Beyond town',[['airport','Municipal Airport'],['themepark','Pinecrest Adventure Park'],['mountainpass','Mountain Pass'],['parkcoasters','Pinecrest coasters'],['roadster','Roadster Proving Ground'],['starbase','Starbase Texas'],['launch','Launch tower'],['recovery','Landing zones'],['offshore','Offshore recovery'],['starfactory','Starfactory']]],
];
export function mountWorldNavigation(ui,view){
 const nav=ui.root.querySelector('.view-tabs');nav.classList.add('world-navigation');nav.setAttribute('aria-label','Explore the world');nav.replaceChildren();
 const details=document.createElement('details');details.className='world-nav';const summary=document.createElement('summary');summary.innerHTML='<span class="nav-kicker">EXPLORE</span><span class="nav-current">The whole world</span><span aria-hidden="true">⌄</span>';details.append(summary);
 const menu=document.createElement('div');menu.className='world-menu glass';
 for(const [label,views]of VIEW_GROUPS){const section=document.createElement('section'),title=document.createElement('h2');title.textContent=label;section.append(title);for(const [id,name]of views){const b=document.createElement('button');b.dataset.view=id;b.textContent=name;b.onclick=()=>{view(id);details.open=false;summary.focus();};section.append(b);}menu.append(section);}
 details.append(menu);nav.append(details);
 ui.root.addEventListener('astra-view',e=>{const item=VIEW_GROUPS.flatMap(g=>g[1]).find(v=>v[0]===e.detail);summary.querySelector('.nav-current').textContent=item?.[1]||'Your own little corner';});
 document.addEventListener('pointerdown',e=>{if(!nav.contains(e.target))details.open=false;});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&details.open){details.open=false;summary.focus();}});
 return {close(){details.open=false;}};
}
