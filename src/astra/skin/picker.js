// OWNER: grok-skins lane (Grok). Small in-game skin picker: a row of swatch
// buttons plus the K hotkey (Shift+K goes back). Switching is live, and the
// URL's ?skin= is updated in place so a reload or shared link keeps the skin.
import './picker.css';

export function mountSkinPicker(root, skins) {
 const bar = document.createElement('section');
 bar.className = 'skin-picker glass';
 bar.setAttribute('aria-label', 'Skin');
 bar.innerHTML = `<span class="skin-title" title="Skins restyle the village live. Hotkey: K">Skin <kbd>K</kbd></span>` + skins.list().map(s =>
  `<button type="button" data-skin="${s.id}" title="${s.label}" aria-label="${s.label}" aria-pressed="false"><span style="background:linear-gradient(135deg,${s.swatch[0]} 0 45%,${s.swatch[1]} 45% 72%,${s.swatch[2]} 72%)"></span></button>`).join('') +
  `<output class="skin-name" aria-live="polite"></output>`;
 root.append(bar);
 const name = bar.querySelector('output');
 const buttons = [...bar.querySelectorAll('[data-skin]')];
 const sync = skin => {
  buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.skin === skin.id)));
  name.textContent = skin.label;
  try { const u = new URL(location.href); if (skin.id === 'cel') u.searchParams.delete('skin'); else u.searchParams.set('skin', skin.id); u.searchParams.delete('look'); history.replaceState(history.state, '', u); } catch {}
 };
 buttons.forEach(b => b.onclick = () => skins.setSkin(b.dataset.skin));
 skins.onChange(sync); sync(skins.skin);
 document.addEventListener('keydown', e => {
  if (e.code !== 'KeyK' || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  e.preventDefault(); skins.next(e.shiftKey ? -1 : 1);
 });
 return bar;
}
