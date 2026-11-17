// OWNER: grok-skins lane (Grok). Skin "cel" — the default look, exactly as shipped
// in 7c6d639. Every block is null, which tells the skin runtime to leave the
// original code path alone (original light keys, toon ramp, no post pass).
// Do not add values here: the default must stay pixel-identical.
export default {
 id: 'cel',
 label: 'Cel (default)',
 swatch: ['#cadbce', '#c94a3a', '#6f9a55'],
 keys: null,        // null -> LIGHT_KEYS from src/astra/light-cycle.js
 shade: null,       // null -> #d1c8e5 day / #a8bce7 night
 halos: { visible: true, color: null }, // null -> original lantern halo colour
 material: null,    // null -> original three-band toon ramp
 practicals: null,  // null -> bulbs, signs, hulls and lamp pools untouched
 post: null,        // null -> renderer.render(scene, camera), no post pass
};
