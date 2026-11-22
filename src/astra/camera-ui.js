import * as THREE from 'three';
import './camera.css';
import { ZOOM_LIMITS } from './camera.js';

export function createCameraUI(root, controls, camera) {
  const tools = root.querySelector('.tools');
  tools.setAttribute('role', 'group');
  tools.setAttribute('aria-label', 'Map controls');
  root.querySelector('#rotate').title = 'Turn 90° (Q / E)';
  root.querySelector('#home').title = 'Town view (H)';
  root.querySelector('#zoom-in').title = 'Zoom in (+)';
  root.querySelector('#zoom-out').title = 'Zoom out (−)';
  const live = document.createElement('div');
  live.className = 'resident-activity';
  live.innerHTML = '<span class="dot"></span><span></span>';
  live.hidden = true;
  root.querySelector('.card p').after(live);
  root.querySelector('.card').setAttribute('aria-live', 'polite');
  root.querySelector('.card').setAttribute('aria-atomic', 'true');
  function update(state) {
    const center = controls.target.clone().project(camera);
    const north = controls.target.clone().add(new THREE.Vector3(0, 0, -1)).project(camera);
    const angle = Math.atan2((north.x - center.x) * innerWidth, (north.y - center.y) * innerHeight) * 180 / Math.PI;
    root.querySelector('.map-note svg').style.transform = `rotate(${angle}deg)`;
    root.querySelector('#zoom-in').disabled = state.zoom >= ZOOM_LIMITS.max - .0001;
    root.querySelector('#zoom-out').disabled = state.zoom <= ZOOM_LIMITS.min + .0001;
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
