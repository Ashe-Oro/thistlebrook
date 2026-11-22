import {BOOT_WEIGHTS,createLoadProgress} from './load-progress.js';

function indicator(label) {
  return `<div class="load-meter" role="progressbar" aria-label="${label}" aria-valuenow="0"><div class="load-fill"></div></div><div class="load-meta"><span class="load-percent">0%</span><span class="load-eta"></span></div>`;
}

export function mountLoading() {
  const overlay = document.createElement('div');
  overlay.className = 'loading';
  overlay.innerHTML = '<div class="sprout">❧</div><h1>A little world awaits.</h1><p>Opening the shutters, putting the kettle on…</p>'
    + '<div class="glass load-card">'+indicator('Opening Thistlebrook')+'</div>';
  const slim = document.createElement('div');
  slim.className = 'glass load-slim';
  slim.hidden = true;
  slim.innerHTML = indicator('Loading map scenery');
  document.body.append(overlay,slim);

  const meters = [overlay,slim].map(root=>({
    root,bar:root.querySelector('.load-meter'),fill:root.querySelector('.load-fill'),
    percent:root.querySelector('.load-percent'),eta:root.querySelector('.load-eta'),
  }));
  let frame = 0, expiry = 0;
  const displayed = [];
  function draw(state) {
    const meter = meters[state.mode==='boot'?0:1];
    if (state.mode==='slim') slim.hidden = !state.active;
    const percent = Math.floor(state.progress*100+1e-8);
    meter.fill.style.transform = `scaleX(${state.progress})`;
    meter.bar.setAttribute('aria-valuenow',percent);
    meter.percent.textContent = percent+'%';
    meter.eta.textContent = state.eta===null ? '' : `About ${state.eta} s left`;
    if (state.mode==='boot' && displayed.at(-1)?.progress!==state.progress) {
      displayed.push({time:performance.now(),progress:state.progress,phase:state.phase,eta:state.eta});
    }
    clearTimeout(expiry);
    if (state.eta!==null) expiry = setTimeout(()=>draw(progress.state()),620);
  }
  const phone = matchMedia('(pointer: coarse)').matches && Math.min(innerWidth,innerHeight)<=600;
  const query = new URLSearchParams(location.search);
  const useOpening = !location.hash && ['',null,'home'].includes(query.get('view'))
    && [null,'831'].includes(query.get('seed')) && query.get('classroom')!=='1' && !query.has('registryCapture');
  const progress = createLoadProgress({weights:BOOT_WEIGHTS[phone?'phone':'desktop'],onChange(state) {
    if (state.mode==='boot' && !state.active) {
      cancelAnimationFrame(frame);
      frame = 0;
      draw(state);
    } else if (!frame) frame = requestAnimationFrame(()=>{
      frame = 0;
      draw(progress.state());
    });
  }});
  draw(progress.state());
  window.__loadProgress = {
    get current(){return progress.state();},
    get progress(){return progress.state().progress;},
    get phase(){return progress.state().phase;},
    get eta(){return progress.state().eta;},
    samples:displayed,
    workSamples:progress.samples,
    get openingModels(){return progress.openingModels;},
  };

  function resource(entry) {
    const url = new URL(entry.name,location.href);
    if (url.origin===location.origin) progress.resource(url.pathname,entry.decodedBodySize);
  }
  const observer = new PerformanceObserver(list=>list.getEntries().forEach(resource));
  // Keep entries for the build's opening inventory as well as for progress.
  performance.setResourceTimingBufferSize(1500);
  observer.observe({type:'resource',buffered:true});
  if (import.meta.env.PROD) {
    fetch(import.meta.env.BASE_URL+'asset-sizes.json').then(response=>response.ok?response.json():null).then(data=>{
      if (!data?.sizes || !data.opening) return;
      progress.setManifest(data,phone?'phone':'desktop',useOpening);
      performance.getEntriesByType('resource').forEach(resource);
    }).catch(()=>{});
  }
  return {
    progress,
    // Let the last completed work paint before synchronous batching and drawing.
    paint() {
      if (document.hidden) return;
      return new Promise(resolve=>{
        let next = requestAnimationFrame(()=>{next=requestAnimationFrame(finish);});
        function finish() {
          cancelAnimationFrame(next);
          document.removeEventListener('visibilitychange',finish);
          resolve();
        }
        document.addEventListener('visibilitychange',finish);
      });
    },
    ready() {
      progress.ready();
      overlay.classList.add('done');
      overlay.setAttribute('aria-hidden','true');
    },
    fail() {
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(expiry);
      overlay.innerHTML='<h1>The village is taking a moment.</h1><p>Could not load the village. Check that the private asset library is available.</p>';
    },
  };
}
