const clamp = value => Math.min(1,Math.max(0,value));
const estimateWindow = 2400;
const minRateSpan = 600;

export const BOOT_WEIGHTS = {
  phone: {plan:.12, download:.10, decode:.30, assemble:.38, compile:.025, frame:.075},
  desktop: {plan:.23, download:.06, decode:.20, assemble:.38, compile:.025, frame:.105},
};
const SLIM_WEIGHTS = {download:.30,decode:.45,compile:.10,attach:.15};

function estimate(history, time, fraction) {
  if (history.length < 4 || time-history.at(-1).time > minRateSpan) return null;
  const first = history[0], last = history.at(-1);
  const span = last.time-first.time;
  if (span < minRateSpan || last.progress-first.progress < .04) return null;
  const rates = [];
  const step = span/3;
  let previous = first;
  for (let i=1;i<3;i++) {
    const next = history.find(sample=>sample.time>=first.time+step*i);
    if (next.time===previous.time || next===last) return null;
    rates.push((next.progress-previous.progress)/(next.time-previous.time));
    previous = next;
  }
  rates.push((last.progress-previous.progress)/(last.time-previous.time));
  const rate = (last.progress-first.progress)/span;
  if (rates.some(value=>value<rate*.55 || value>rate*1.65)) return null;
  return Math.ceil((1-fraction)/rate/1000);
}

export function createLoadProgress({weights=BOOT_WEIGHTS.desktop, now=()=>performance.now(), onChange=()=>{}}={}) {
  let manifest = {}, streamed = [], boot = true, batch = null;
  const samples = [];
  const opening = new Set();
  const fresh = () => ({
    files:new Map(),steps:{},progress:0,history:[],phase:'plan',pending:0,active:true,
    compile:{done:0,total:0},attach:{done:0,total:0,started:0},
  });
  const initial = fresh();
  const current = () => boot ? initial : batch;
  function state(work=current(), time=now()) {
    const progress = work?.progress ?? 1;
    return {
      mode:boot?'boot':'slim',phase:work?.phase ?? 'ready',progress,
      eta:work?.active && progress<1 ? estimate(work.history,time,progress) : null,
      active:work?.active ?? false,
    };
  }
  function publish(work, phase) {
    const isBoot = work===initial;
    if ((isBoot && !boot) || current()!==work) return;
    const totals = {download:0,decode:0}, done = {download:0,decode:0};
    for (const [url,file] of work.files) {
      const knownSize = manifest[url] || file.total;
      const size = knownSize || file.loaded;
      totals.download += size;
      done.download += file.downloaded ? size : Math.min(file.loaded,knownSize);
      if (file.model) {
        totals.decode += size;
        if (file.pending===0 && file.seen) done.decode += size;
      }
    }
    const earned = {...work.steps};
    for (const key of ['download','decode']) {
      earned[key] ??= totals[key] ? done[key]/totals[key] : 0;
    }
    // District precompilation covers only part of the opening frame's shader work.
    if (work.compile.total) earned.compile = work.compile.done/work.compile.total * (isBoot ? .5 : 1);
    if (work.attach.total) earned.attach = work.attach.done/work.attach.total;
    const max = isBoot ? .98 : .97;
    const fraction = Math.min(max,Object.entries(isBoot?weights:SLIM_WEIGHTS)
      .reduce((sum,[key,weight])=>sum+weight*(earned[key]||0),0));
    const time = now();
    if (fraction>work.progress) {
      work.progress = fraction;
      work.phase = phase;
      const last = work.history.at(-1);
      // Bucket nearby callbacks so bursts of chunks do not dominate the rate.
      const sample = {time,progress:work.progress};
      if (last && Math.floor(time/120)===Math.floor(last.time/120)) work.history[work.history.length-1] = sample;
      else work.history.push(sample);
      work.history = work.history.filter(sample=>time-sample.time<=estimateWindow);
      if (isBoot) samples.push({time,progress:work.progress,phase});
    }
    onChange(state(work,time));
  }
  function fileAt(work,url) {
    if (!work.files.has(url)) work.files.set(url,{loaded:0,total:0,pending:0});
    return work.files.get(url);
  }
  function begin(phase) {
    if (!boot && !batch?.active) batch = {...fresh(),phase};
    const work = current();
    work.pending++;
    onChange(state());
    return work;
  }
  function end(work) {
    work.pending--;
    if (work!==batch || work.pending || !work.active) return;
    work.active = false;
    work.progress = 1;
    work.phase = 'ready';
    onChange(state());
  }

  samples.push({time:now(),progress:0,phase:'plan'});
  return {
    samples,
    state,
    get openingModels() {return [...opening];},
    setManifest(data,profile,useOpening) {
      manifest = data.sizes;
      if (useOpening) streamed = data.streamed ?? [];
      if (!boot) return;
      const expected = useOpening && data.opening[profile];
      if (expected) {
        for (const url of expected.downloads) fileAt(initial,url);
        for (const url of expected.models) fileAt(initial,url).model = true;
      }
      publish(initial,'download');
    },
    resource(url,bytes) {
      const work = current();
      if (!work?.active || (!work.files.has(url) && !(boot && manifest[url]))) return;
      const file = fileAt(work,url);
      file.total ||= bytes;
      file.downloaded = true;
      publish(work,'download');
    },
    model(url) {
      if (boot) opening.add(url);
      const work = begin('download');
      const file = fileAt(work,url);
      file.model = file.seen = true;
      file.pending++;
      let finished = false;
      return {
        transfer(loaded,total) {
          file.loaded = Math.max(file.loaded,loaded);
          file.total ||= total;
          publish(work,'download');
        },
        finish() {
          if (finished) return;
          finished = true;
          file.downloaded = true;
          file.pending--;
          publish(work,'decode');
          end(work);
        },
      };
    },
    stream(districtCount) {
      const work = begin('download');
      work.attach.total = districtCount;
      for (const url of streamed) fileAt(work,url).model = /\.gltf?$|\.glb$/i.test(url);
      return ()=>end(work);
    },
    district() {
      if (boot) return ()=>{};
      const work = begin('assemble');
      work.attach.total = Math.max(work.attach.total,++work.attach.started);
      return ()=>{
        work.attach.done++;
        publish(work,'attach');
        end(work);
      };
    },
    compile(count) {
      const work = current();
      if (!work || !count) return ()=>{};
      work.compile.total += count;
      return ()=>{
        work.compile.done++;
        publish(work,'compile');
      };
    },
    step(phase,fraction) {
      if (!boot) return;
      initial.steps[phase] = clamp(fraction);
      publish(initial,phase);
    },
    prepareBoot() {
      initial.steps.download = initial.steps.decode = initial.steps.assemble = 1;
      publish(initial,'frame');
    },
    ready() {
      if (!boot) return;
      initial.progress = 1;
      initial.active = false;
      initial.phase = 'ready';
      samples.push({time:now(),progress:1,phase:'ready'});
      onChange(state(initial));
      boot = false;
    },
  };
}
