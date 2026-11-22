/** Stage complete district assemblies offscreen and attach them atomically. */
export function createDistrictStream({
  initial,
  concurrency = 2,
  timeout = 45000,
  pace = false,
  frameBudgetMs = 8,
  yieldMs = 24,
  onPrepare = null,
  onAttach = () => {},
  onError = console.warn,
}) {
  const queue = [];
  let target = initial;
  let running = 0;
  let started = false;
  let scheduled = false;
  let attachChain = Promise.resolve();
  let turnStart = 0;
  let attachedThisTurn = false;

  function distance(job, point) {
    const {minX,maxX,minZ,maxZ} = job.bounds;
    return Math.hypot(Math.max(minX-point.x,0,point.x-maxX), Math.max(minZ-point.z,0,point.z-maxZ));
  }

  const nextTurn = ms => new Promise(resolve => {
    let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(timer); resolve(); };
    const timer = setTimeout(finish, ms);
    if (ms > 0 && typeof requestAnimationFrame === 'function') requestAnimationFrame(finish);
  });

  function schedulePump(delayMs = 0) {
    if (!pace) { pump(); return; }
    if (scheduled) return;
    scheduled = true;
    nextTurn(delayMs).then(() => {
      scheduled = false;
      turnStart = performance.now();
      attachedThisTurn = false;
      pump();
    });
  }

  function pump() {
    if (pace && turnStart === 0) turnStart = performance.now();
    const pending = queue.filter(job => job.state === 'queued' && (started || job.opening));
    pending.sort((a,b) => Number(b.opening)-Number(a.opening) || a.priority-b.priority || distance(a,target)-distance(b,target));
    while (running < concurrency && pending.length) {
      if (pace && !pending[0].opening && attachedThisTurn && performance.now() - turnStart >= frameBudgetMs) {
        schedulePump(attachedThisTurn ? yieldMs : 0);
        return;
      }
      const job = pending.shift();
      job.state = 'loading';
      running++;
      let timer;
      const deadline = new Promise((_,reject) => {
        timer = setTimeout(()=>reject(new Error('District timed out')),timeout);
      });
      Promise.race([Promise.resolve().then(job.load),deadline]).then(async result => {
        clearTimeout(timer);
        if (!pace || job.opening) {
          if (onPrepare) await onPrepare(result, job);
          job.attach(result);
          job.state = 'loaded';
          onAttach(result);
          return;
        }
        // Serialize background prepares & attaches so at most one heavy district
        // compiles shaders and attaches per macrotask frame turn.
        await (attachChain = attachChain.then(async () => {
          if (attachedThisTurn && performance.now() - turnStart >= frameBudgetMs) {
            await nextTurn(yieldMs);
            turnStart = performance.now();
            attachedThisTurn = false;
          }
          if (onPrepare) await onPrepare(result, job);
          job.attach(result);
          job.state = 'loaded';
          attachedThisTurn = true;
          onAttach(result);
        }));
      }).catch(error => {
        clearTimeout(timer);
        job.state = 'failed';
        onError('Could not load ' + job.id, error);
      }).finally(() => {
        running--;
        job.finish();
        if (pace && !job.opening) schedulePump(attachedThisTurn ? yieldMs : 0);
        else pump();
      });
    }
  }

  return {
    add(id, bounds, {load, attach, opening = false}) {
      const job = {id,bounds,load,attach,opening,priority:Infinity,state:'queued'};
      job.done = new Promise(resolve => { job.finish = resolve; });
      queue.push(job);
    },
    opening() {
      pump();
      return Promise.all(queue.filter(job => job.opening).map(job => job.done));
    },
    start() {
      started = true;
      pump();
      return Promise.all(queue.map(job => job.done));
    },
    prioritize(point, radius = 0) {
      target = point;
      for (const job of queue) {
        const gap = distance(job,point);
        job.priority = gap <= radius ? gap : Infinity;
      }
      pump();
    },
    nearby(point, radius = 0) {
      return Promise.all(queue.filter(job => distance(job,point) <= radius).map(job => job.done));
    },
    audit: () => Object.fromEntries(queue.map(({id,state}) => [id,state])),
  };
}
