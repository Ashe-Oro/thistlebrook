// Start the demonstration cast at nearby graph nodes to keep capture setup
// short and deterministic. Every displayed after action uses the real executor.
export function stage(name, app, phase) {
  const { life, people, update } = app.residents;
  life.setBrain(() => null);
  const places = new Map(life.registry.places.map(p => [p.id, p]));
  const actor = name => people.find(p => p.name === name).actor;
  const actors = [];
  function place(a, node, facing) {
    a.context.location = { ...a.context.location, position: [...app.town.nodes[node]], node, place: null, slot: null };
    a.facing = facing;
    actors.push(a);
  }
  function request(a, tool, target, slot) {
    const result = life.execute(a, { tool, args: { target, ...(slot ? { slot } : {}) }, reason: 'Seed 831 capture' });
    if (!result.ok) throw new Error(`${a.context.name} ${tool} ${target}: ${result.error}`);
  }
  function wait(walkers) {
    for (let i = 0; i < 500 && walkers.some(a => a.action?.tool === 'walkTo'); i++) update(.25, life.elapsed + .25, life.hour);
    if (walkers.some(a => a.action?.tool === 'walkTo')) throw new Error('Capture route did not arrive');
  }
  function idle(name, position, facing) {
    const a = actor(name);
    const node = app.town.nodes.reduce((best, p, i) =>
      Math.hypot(p[0] - position[0], p[1] - position[1]) < best.distance
        ? { i, distance: Math.hypot(p[0] - position[0], p[1] - position[1]) } : best,
    { i: 0, distance: Infinity }).i;
    place(a, node, facing);
    a.context.location.position = [...position];
    return a;
  }
  function pairs(id, specs) {
    const p = places.get(id);
    const cast = specs.map(([name, tool, slot, fallback]) => {
      const a = actor(name);
      if (!p?.interaction) return idle(name, fallback.position, fallback.facing);
      place(a, p.node, 0);
      request(a, 'walkTo', id, slot);
      return a;
    });
    wait(cast);
    if (p?.interaction) for (const [i, a] of cast.entries()) request(a, specs[i][1], id);
    return cast;
  }
  if (name === 'bench') {
    pairs('life:fountain-bench-1', [
      ['Ada', 'rest', 'sit-1', { position: [-52.01,-9.55], facing: -Math.PI / 2 }],
      ['Finn', 'rest', 'sit-2', { position: [-52.01,-8.45], facing: -Math.PI / 2 }],
    ]);
    const picnic = places.get('life:picnic');
    const Clover = actor('Clover');
    place(Clover, picnic.node, 0);
    request(Clover, 'walkTo', picnic.id, 'south');
    wait([Clover]);
    request(Clover, 'eat', picnic.id);
    const walker = idle('Rowan', [-55.1, -9.25], 0);
    if (phase === 'after') {
      request(walker, 'walkTo', 'life:fountain-bench-3', 'sit-1');
      const [x, z] = walker.context.location.position;
      const next = walker.route.find(step => Math.hypot(step.pos[0] - x, step.pos[1] - z) > .05);
      if (next) walker.facing = Math.atan2(next.pos[0] - x, next.pos[1] - z);
      update(0, life.elapsed, life.hour);
    }
    idle('Mabel', [-53.8, -11.4], .4);
  } else if (name === 'counter') {
    pairs('parcel-22', [
      ['Bea', 'work', 'service', { position: [-69.61,-7.49], facing: Math.PI / 2 }],
      ['Hazel', 'buy', 'customer', { position: [-68.05,-7.49], facing: -Math.PI / 2 }],
    ]);
    idle('Bram', [-68.2, -5.12], 2.3);
  } else if (name === 'path') {
    pairs('life:playground', [
      ['Pip', 'visit', 'play', { position: [-26,-39.4], facing: 0 }],
    ]);
    const fern = idle('Fern', [-26.9,-37.4], 1.04);
    const rose = idle('Rose', [-25.03,-37.0], -1.92);
    const walker = idle('Theo', [-26.15,-36.5], Math.PI);
    request(walker, 'walkTo', 'playground');
    if (phase === 'after') {
      request(fern, 'walkTo', 'playground');
      request(fern, 'talkTo', rose.context.id);
    }
  }
  return actors.map(a => a.context.name);
}
