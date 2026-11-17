import * as THREE from 'three';
import './camera.css';

export function createCameraUI(root, controls, camera) {
  const tools = root.querySelector('.tools');
  tools.setAttribute('role', 'group');
  tools.setAttribute('aria-label', 'Map controls');
  root.querySelector('#rotate').title = 'Turn 90° (Q / E)';
  root.querySelector('#home').title = 'Town view (H)';
  root.querySelector('#zoom-in').title = 'Zoom in (+)';
  root.querySelector('#zoom-out').title = 'Zoom out (−)';
  const status = document.createElement('div');
  status.className = 'camera-status glass';
  status.innerHTML = '<span class="camera-label">YOUR VIEW</span><output class="camera-zoom"></output><button class="share-view" title="Copy a link to this view" aria-label="Copy link to this view"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 0 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0)"/></svg><span>Share view</span></button>';
  root.append(status);
  const message = document.createElement('div');
  message.className = 'camera-message glass';
  message.setAttribute('role', 'status');
  root.append(message);
  let messageTimer;
  status.querySelector('button').onclick = async () => {
    const url = controls.flushHash();
    try {
      await navigator.clipboard.writeText(url);
      message.textContent = 'View link copied. See you here.';
    } catch {
      message.replaceChildren();
      const label = document.createElement('label'); label.textContent = 'Copy your view link';
      const input = document.createElement('input'); input.value = url; input.readOnly = true;
      label.append(input); message.append(label);
      requestAnimationFrame(() => { input.focus(); input.select(); });
    }
    message.classList.add('open');
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => message.classList.remove('open'), 7000);
  };
  const hint = root.querySelector('.hint');
  hint.textContent = 'Drag to pan · Scroll to get closer · Click to discover';
  root.querySelector('.help').innerHTML = '<strong>Find your own little corner</strong><br>Drag or <kbd>↑ ↓ ← →</kbd> to pan<br>Scroll, pinch or <kbd>+ −</kbd> to zoom<br><kbd>Q</kbd> <kbd>E</kbd> Turn by 90°<br><kbd>Space</kbd> Pause · <kbd>H</kbd> Town view<br><kbd>Esc</kbd> Close details<br>Click a building or meet a neighbour.<br><span class="help-footnote">Your view stays in the address bar.</span>';
  const help = root.querySelector('#help');
  help.setAttribute('aria-expanded', 'false');
  help.onclick = () => { const open = root.querySelector('.help').classList.toggle('open'); help.setAttribute('aria-expanded', String(open)); };
  const live = document.createElement('div');
  live.className = 'resident-activity';
  live.innerHTML = '<span class="dot"></span><span></span>';
  live.hidden = true;
  root.querySelector('.card p').after(live);
  root.querySelector('.card').setAttribute('aria-live', 'polite');
  root.querySelector('.card').setAttribute('aria-atomic', 'true');
  function update(state) {
    const output = status.querySelector('output'), label = state.zoom.toFixed(2) + '×';
    if (output.textContent !== label) {
      output.textContent = label;
      output.setAttribute('aria-label', 'Zoom ' + state.zoom.toFixed(2) + ' times');
    }
    const center = controls.target.clone().project(camera);
    const north = controls.target.clone().add(new THREE.Vector3(0, 0, -1)).project(camera);
    const angle = Math.atan2((north.x - center.x) * innerWidth, (north.y - center.y) * innerHeight) * 180 / Math.PI;
    root.querySelector('.map-note svg').style.transform = `rotate(${angle}deg)`;
    root.querySelector('#zoom-in').disabled = state.zoom >= 4.9999;
    root.querySelector('#zoom-out').disabled = state.zoom <= .1201;
  }
  function activity(person, following) {
    if (live.hidden !== !person) live.hidden = !person;
    if (!person) return;
    const text = live.querySelector('span:last-child');
    if (text.textContent !== person.activity) text.textContent = person.activity;
    const follow = root.querySelector('.follow');
    const label = following ? 'Stop following · explore freely' : 'Follow their day ↗';
    if (follow.textContent !== label) follow.textContent = label;
    const pressed = String(Boolean(following));
    if (follow.getAttribute('aria-pressed') !== pressed) follow.setAttribute('aria-pressed', pressed);
  }
  update(controls.state());
  return { update, activity };
}
