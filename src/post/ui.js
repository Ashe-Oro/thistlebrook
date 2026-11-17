// Small collapsible "Look" panel (bottom-right) wired to the post chain and the
// camera mode. Changes apply live. Kept clear of the compile panel (top-left)
// and the HUD (bottom-left).
import { DEFAULTS } from './options.js';

const CSS = `
  #look { position: fixed; right: 12px; bottom: 12px; width: 194px; z-index: 20;
    font: 12px/1.4 ui-sans-serif, system-ui, sans-serif; color: #22333b;
    background: rgba(255,255,255,0.9); border: 2px solid #22333b; border-radius: 10px;
    box-shadow: 3px 3px 0 rgba(34,51,59,.25); user-select: none; }
  #look h2 { font-size: 12px; padding: 7px 10px; margin: 0; cursor: pointer; display: flex; justify-content: space-between; }
  #look .body { padding: 2px 10px 9px; display: grid; gap: 5px; }
  #look.collapsed .body { display: none; }
  #look label { display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer; }
  #look input[type=range] { width: 92px; }
  #look .seg { display: flex; border: 1.5px solid #22333b; border-radius: 6px; overflow: hidden; }
  #look .seg button { flex: 1; font: inherit; border: 0; background: #fff; padding: 2px 0; cursor: pointer; }
  #look .seg button.on { background: #22333b; color: #fff; }
`;

export function createLookPanel({ post, stage }) {
  const o = post.options;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'look';
  el.innerHTML = `
    <h2><span>Look</span><span id="lk-tog">▾</span></h2>
    <div class="body">
      <label><span>post</span><input type="checkbox" id="lk-post"></label>
      <label><span>edges</span><input type="checkbox" id="lk-edges"></label>
      <label><span>normals</span><input type="checkbox" id="lk-normals"></label>
      <label><span>ink fade</span><input type="checkbox" id="lk-fade"></label>
      <label><span>foliage mask</span><input type="checkbox" id="lk-fol"></label>
      <label><span>kuwahara <b id="lk-kv"></b></span><input type="range" id="lk-kuw" min="0" max="7" step="1"></label>
      <label><span>grade</span><input type="checkbox" id="lk-grade"></label>
      <label><span>quant <b id="lk-qv"></b></span><input type="range" id="lk-quant" min="0" max="1" step="0.1"></label>
      <label><span>hull outlines</span><input type="checkbox" id="lk-hull"></label>
      <div class="seg" id="lk-cam">
        <button data-m="persp">perspective</button><button data-m="iso">iso</button>
      </div>
    </div>`;
  document.body.appendChild(el);

  const $ = (id) => el.querySelector(id);
  el.querySelector('#lk-tog').parentElement.addEventListener('click', () => el.classList.toggle('collapsed'));

  const chk = (id, key) => {
    const i = $(id);
    i.checked = o[key];
    i.addEventListener('change', () => post.setOptions({ [key]: i.checked }));
  };
  chk('#lk-post', 'post');
  chk('#lk-edges', 'edges');
  chk('#lk-normals', 'normals');
  chk('#lk-fade', 'inkFade');
  chk('#lk-fol', 'foliageMask');
  chk('#lk-grade', 'grade');

  const hull = $('#lk-hull');
  hull.checked = o.hull;
  hull.addEventListener('change', () => post.setOptions({ hull: hull.checked }));

  const kuw = $('#lk-kuw'), kv = $('#lk-kv');
  kuw.value = o.kuwahara; kv.textContent = o.kuwahara;
  kuw.addEventListener('input', () => { const v = +kuw.value; kv.textContent = v; post.setOptions({ kuwahara: v }); });

  const quant = $('#lk-quant'), qv = $('#lk-qv');
  quant.value = o.quant; qv.textContent = o.quant.toFixed(1);
  quant.addEventListener('input', () => { const v = +quant.value; qv.textContent = v.toFixed(1); post.setOptions({ quant: v }); });

  const camBtns = el.querySelectorAll('#lk-cam button');
  const syncCam = () => camBtns.forEach((b) => b.classList.toggle('on', b.dataset.m === stage.mode));
  camBtns.forEach((b) => b.addEventListener('click', () => {
    stage.setMode(b.dataset.m);
    // Re-apply hull visibility: a fresh camera doesn't change the scene, but keep
    // the outline meshes consistent with the toggle.
    post.setHullVisible(post.options.hull);
    syncCam();
  }));
  syncCam();

  return { el };
}

export { DEFAULTS };
