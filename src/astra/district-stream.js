/** Stage complete district assemblies offscreen and attach them atomically. */
export function createDistrictStream({initial, concurrency = 2, timeout = 45000, onAttach = () => {}, onError = console.warn}) {
  const queue = [];
  let target = initial;
  let running = 0;
  let started = false;

  function distance(job, point) {
    const {minX,maxX,minZ,maxZ} = job.bounds;
    return Math.hypot(Math.max(minX-point.x,0,point.x-maxX), Math.max(minZ-point.z,0,point.z-maxZ));
  }

  function pump() {
    const pending = queue.filter(job => job.state === 'queued' && (started || job.opening));
    pending.sort((a,b) => Number(b.opening)-Number(a.opening) || a.priority-b.priority || distance(a,target)-distance(b,target));
    while (running < concurrency && pending.length) {
      const job = pending.shift();
      job.state = 'loading';
      running++;
      let timer;
      const deadline = new Promise((_,reject) => {
        timer = setTimeout(()=>reject(new Error('District timed out')),timeout);
      });
      Promise.race([Promise.resolve().then(job.load),deadline]).then(result => {
        job.attach(result);
        job.state = 'loaded';
        onAttach(result);
      }).catch(error => {
        job.state = 'failed';
        onError('Could not load ' + job.id, error);
      }).finally(() => {
        clearTimeout(timer);
        running--;
        job.finish();
        pump();
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
