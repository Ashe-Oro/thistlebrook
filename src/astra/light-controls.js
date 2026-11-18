import { LIGHT_PRESETS, lightPeriod, normalizeHour } from './light-cycle.js';
import { icon } from './ui.js';
import './light-controls.css';

// Extend the existing clock without changing the shared UI/district markup.
// The clock dropdown is the single place to set time, pace, weather and skin.
export function createLightControls(root, setHour, actions = {}) {
 const toggle = document.createElement('button');
 toggle.className = 'light-toggle';
 toggle.type = 'button';
 toggle.setAttribute('aria-label', 'Time, weather and look');
 toggle.setAttribute('aria-expanded', 'false');
 toggle.setAttribute('aria-controls', 'astra-light-picker');
 toggle.title = 'Time, weather and look';
 toggle.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m5 8 5 5 5-5"/></svg>';
 root.querySelector('.clock').append(toggle);
 const panel = document.createElement('section');
 panel.id = 'astra-light-picker';
 panel.className = 'light-picker glass';
 panel.setAttribute('aria-label', 'Time of day');
 panel.hidden = true;
 panel.innerHTML = `<div class="light-heading"><span>A different kind of lovely</span><button type="button" aria-label="Close time picker">×</button></div><p>Find your favourite light.</p><div class="light-presets">${LIGHT_PRESETS.map(p => `<button type="button" data-hour="${p.hour}" style="--swatch:${p.color}" aria-pressed="false"><span></span>${p.label}</button>`).join('')}</div><label class="light-range-label" for="astra-hour">Time of day <output for="astra-hour"></output></label><input id="astra-hour" type="range" min="0" max="1439" step="1" aria-label="Time of day"><div class="light-range-ends"><span>Midnight</span><span>Noon</span><span>Midnight</span></div><div class="light-row light-pace"><span class="light-row-label">Pace</span><button type="button" id="pause" aria-label="Pause village" aria-pressed="false">${icon('pause')}</button><button type="button" id="speed" title="Change simulation speed" aria-label="Change simulation speed">1×</button></div><div class="light-row light-section" data-section="weather"><label class="light-row-label" for="astra-weather">Weather</label><select id="astra-weather" class="astra-weather" aria-label="Weather"></select></div><div class="light-section light-skin" data-section="skin"></div>`;
 root.append(panel);
 const slider = panel.querySelector('input');
 const output = panel.querySelector('output');
 const presets = [...panel.querySelectorAll('[data-hour]')];
 let lastMinute = -1;
 function open(value) {
  panel.hidden = !value;
  toggle.setAttribute('aria-expanded', String(value));
  if (value) slider.focus();
 }
 toggle.onclick = () => open(panel.hidden);
 panel.querySelector('.light-heading button').onclick = () => { open(false); toggle.focus(); };
 presets.forEach(button => button.onclick = () => { setHour(Number(button.dataset.hour)); });
 panel.querySelector('#pause').onclick = () => actions.pause?.();
 panel.querySelector('#speed').onclick = () => actions.speed?.();
 slider.addEventListener('input', () => setHour(Number(slider.value)/60));
 panel.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.stopPropagation(); open(false); toggle.focus(); }
 });
 document.addEventListener('pointerdown', event => {
  if (!panel.hidden && !panel.contains(event.target) && !toggle.contains(event.target)) open(false);
 });
 return { panel, open, section: name => panel.querySelector(`[data-section="${name}"]`), update(hour) {
  const h = normalizeHour(hour), minute = Math.floor(h*60+1e-6);
  // Match createUI.clock's update boundary even when a decimal preset is a
  // fraction below a whole minute (e.g. 10.4). Display rounds only that noise.
  const uiMinute = Math.floor(hour*60);
  if (uiMinute === lastMinute) return;
  lastMinute = uiMinute;
  const period = lightPeriod(h);
  const time = `${Math.floor(minute/60)%12||12}:${String(minute%60).padStart(2,'0')} ${h<12?'am':'pm'}`;
  slider.value = String(minute); slider.setAttribute('aria-valuetext', `${time}, ${period}`);
  output.textContent = time;
  root.querySelector('#astra-clock').textContent = time;
  root.querySelector('.clock > svg').outerHTML = icon(period === 'Moonlight' ? 'moon' : 'sun');
  root.classList.toggle('night', h < 5.4 || h >= 19.1);
  presets.forEach(button => button.setAttribute('aria-pressed',String(Math.abs(h-Number(button.dataset.hour))<.12)));
 }};
}
