import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRng } from '../compiler/rng.js';
import { travelWeather, WEATHER_TYPES } from './weather-plan.js';
import './weather.css';

const rain = 1, snow = 2;
const PARTICLES = 850;
const PAVING = { road: 1, plaza: 2, sidewalk: 3 };
const snowColor = new THREE.Color('#edf4f5');

function lampMap(lamps) {
  // A low-resolution light field for reflections. Project onto the receiving
  // material, so road edges, raised paving and bridges clip it automatically.
  const min = new THREE.Vector2(Math.min(...lamps.map(l => l.pos[0])) - 8, Math.min(...lamps.map(l => l.pos[1])) - 8);
  const span = new THREE.Vector2(Math.max(...lamps.map(l => l.pos[0])) + 8, Math.max(...lamps.map(l => l.pos[1])) + 8).sub(min);
  const size = 256, pixels = new Uint8Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = min.x + (i + .5) / size * span.x;
    const z = min.y + (j + .5) / size * span.y;
    let light = 0;
    for (const lamp of lamps) {
      const dx = x - lamp.pos[0], dz = z - lamp.pos[1];
      const along = (dx + dz) * .7071, across = (dx - dz) * .7071;
      const distance = Math.hypot(along / 5.8, across / 1.6);
      light = Math.max(light, Math.max(0, 1 - distance) ** 1.65);
    }
    pixels[j * size + i] = Math.round(light * 255);
  }
  const map = new THREE.DataTexture(pixels, size, size, THREE.RedFormat);
  map.minFilter = map.magFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  return { weatherLamps: { value: map }, weatherLampMin: { value: min }, weatherLampSpan: { value: span } };
}

function patchMaterial(material, kind, uniforms) {
  const variant = material.clone();
  const previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey();
  variant.customProgramCacheKey = () => previousKey + '|weather-' + kind;
  variant.onBeforeCompile = (shader, renderer) => {
    previous.call(variant, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    const cap = kind === 'cap';
    shader.vertexShader = `
      varying vec3 vWeatherW;
      ${cap ? 'attribute float weatherCapHeight; varying float vWeatherCapHeight;' : ''}
    ` + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 weatherPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
      weatherPosition = instanceMatrix * weatherPosition;
      #endif
      vWeatherW = (modelMatrix * weatherPosition).xyz;
      ${cap ? 'vWeatherCapHeight = weatherCapHeight;' : ''}
    `);
    shader.fragmentShader = `
      varying vec3 vWeatherW;
      uniform float weatherMode, weatherNight, weatherTime;
      uniform vec3 weatherSnowColor;
      uniform sampler2D weatherLamps;
      uniform vec2 weatherLampMin, weatherLampSpan;
      ${cap ? 'varying float vWeatherCapHeight;' : ''}
      float weatherHash(vec2 p) {
        p = fract(p * vec2(.1031, .11369));
        p += dot(p, p.yx + 19.19);
        return fract((p.x + p.y) * p.x);
      }
      float weatherNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f*f*(3.-2.*f);
        return mix(mix(weatherHash(i), weatherHash(i+vec2(1,0)), f.x),
                   mix(weatherHash(i+vec2(0,1)), weatherHash(i+vec2(1,1)), f.x), f.y);
      }
    ` + shader.fragmentShader.replace('#include <opaque_fragment>', `
      if (weatherMode > .5) {
        vec3 surface = normalize(cross(dFdx(vWeatherW), dFdy(vWeatherW)));
        vec2 ground = vWeatherW.xz;
        ${cap ? `
          if (weatherMode > 1.5 && vWeatherW.y > vWeatherCapHeight) {
            float drift = weatherNoise(ground * .62) * .78 + weatherNoise(ground * 1.7) * .22;
            float cap = smoothstep(.45, .73, surface.y)
              * smoothstep(.40, .71, drift + .24 * surface.y)
              * smoothstep(0., .22, vWeatherW.y - vWeatherCapHeight);
            float snowBand = clamp(drift * .55 + surface.y * .35, 0., 1.);
            vec3 snowCol = mix(weatherSnowColor * vec3(.72, .78, .92), weatherSnowColor * vec3(1.02, 1.0, .96), snowBand);
            outgoingLight = mix(outgoingLight, snowCol * (1. - weatherNight * .69), cap * .79);
          }
        ` : `
          if (surface.y > .65) {
            float textureBand = weatherNoise(ground * .72);
            if (weatherMode < 1.5) {
              // Scattered depressions, with a narrow painted rim and soft sky bounce.
              vec2 tile = ground * vec2(.38, .64);
              vec2 cell = floor(tile);
              float n = weatherHash(cell);
              vec2 offset = vec2(n, weatherHash(cell.yx + 2.));
              vec2 p = (fract(tile) - .32 - offset*.32) * vec2(1.1, 1.65);
              float edge = length(p) + .08 * sin(p.x*23. + p.y*12.) - (.16 + .15*n);
              float puddle = (1. - smoothstep(-.035, .02, edge)) * step(.51, n);
              float rim = (1. - smoothstep(.012, .052, abs(edge))) * step(.51, n);
              float line = .5 + .5 * sin(ground.x*.7 + ground.y*.34);
              vec3 sheen = vec3(.26,.38,.48) * (.014 + .022*line) * (1.-weatherNight*.79);
              outgoingLight = outgoingLight * mix(${kind === PAVING.road ? '.60' : '.76'}, .46, puddle)
                + sheen * (.65 + puddle*1.1 + rim*.85);
              vec2 lampUV = (ground - weatherLampMin) / weatherLampSpan;
              float lamp = texture2D(weatherLamps, lampUV).r;
              float ripple = .7 + .3*sin((ground.x+ground.y)*19. + weatherTime*4.);
              outgoingLight += vec3(.97,.46,.16)*lamp*weatherNight*(.16+.21*puddle)*ripple;
            } else {
              float crust = smoothstep(.37, .73, textureBand);
              outgoingLight = ${kind === PAVING.road
                ? 'outgoingLight * .79 + vec3(.135,.18,.21) * crust * (1.-weatherNight*.7) * .26'
                : 'mix(outgoingLight, weatherSnowColor * (1. - weatherNight*.73), crust * .36)'};
            }
          }
        `}
      }
      #include <opaque_fragment>
    `);
  };
  return variant;
}

function coatTown(scene, town, world, residents, uniforms) {
  const pavement = new Map(town.roads.map(r => [r.registryId, PAVING.road]));
  pavement.set('built:market-paving', PAVING.plaza);
  pavement.set('built:fountain-0', PAVING.plaza);
  const caps = new Map();
  for (const { type, data, bounds } of world.selectables) {
    if (type === 'building' && data.registryId && bounds.max.y > 2) caps.set(data.registryId, bounds.max.y * .63);
  }
  for (const prop of [...town.props, ...town.trees, ...town.supplemental]) {
    const id = prop.asset || prop.id;
    if (/streetlamp/.test(id)) caps.set(prop.registryId, 1.76 * prop.scale);
    if (/hedge|bush/.test(id)) caps.set(prop.registryId, .38 * prop.scale);
  }
  const walkers = new Set();
  residents.people.forEach(({ object }) => object.traverse(part => walkers.add(part)));
  const materials = new Map();
  scene.traverse(mesh => {
    if (walkers.has(mesh) || !mesh.material?.isMeshToonMaterial) return;
    const ids = mesh.userData.registryIds || [mesh.userData.registryId];
    let kind = PAVING[mesh.userData.weatherPaving];
    if (!kind && pavement.has(ids[0]) && ids.every(id => pavement.get(id) === pavement.get(ids[0]))) {
      // Regional road IDs also own fences and verges. Only asphalt is coated.
      if (pavement.get(ids[0]) !== PAVING.road || mesh.userData.weatherPaving === 'road'
          || ['76847b', '87958b', 'd9c9a4'].includes(mesh.material.color.getHexString())) kind = pavement.get(ids[0]);
    }
    if (!kind && ids.some(id => caps.has(id))) {
      kind = 'cap';
      mesh.geometry = mesh.geometry.clone();
      const heights = ids.map(id => caps.get(id) ?? 10000);
      const attribute = mesh.isInstancedMesh
        ? new THREE.InstancedBufferAttribute(new Float32Array(heights), 1)
        : new THREE.BufferAttribute(new Float32Array(mesh.geometry.attributes.position.count).fill(heights[0]), 1);
      mesh.geometry.setAttribute('weatherCapHeight', attribute);
    }
    if (!kind) return;
    const key = mesh.material.uuid + ':' + kind;
    if (!materials.has(key)) materials.set(key, patchMaterial(mesh.material, kind, uniforms));
    mesh.material = materials.get(key);
  });
}

function precipitation(scene, time) {
  const rng = makeRng(61433);
  const seeds = new Float32Array(PARTICLES * 4).map(() => rng.float());
  const geo = new THREE.InstancedBufferGeometry();
  geo.copy(new THREE.PlaneGeometry(2, 2));
  geo.setAttribute('particle', new THREE.InstancedBufferAttribute(seeds, 4));
  geo.instanceCount = PARTICLES;
  const uniforms = { time, mode: { value: 0 }, halfView: { value: new THREE.Vector2() },
    pixel: { value: new THREE.Vector2() }, focus: { value: new THREE.Vector3() }, night: { value: 0 } };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: `
      uniform float time, mode;
      uniform vec2 halfView, pixel;
      uniform vec3 focus;
      attribute vec4 particle;
      varying vec2 mark;
      varying float brightness;
      void main(){
        bool isRain = mode < 1.5;
        float speed = isRain ? .48 : .105;
        float wind = isRain ? -.10 : -.038;
        vec2 drift = vec2(time*wind + sin(time*1.25+particle.y*33.)*(isRain ? .006 : .025),
                          -time*speed*mix(.72,1.25,particle.w));
        vec2 sheet = (fract(particle.xy + drift) * 2. - 1.) * 1.05;
        vec2 width = pixel * (isRain ? vec2(.65, 8.7) : vec2(2.6, 2.6)) * mix(.55,1.14,particle.w);
        vec2 offset = position.xy * width;
        if (isRain) offset.x += offset.y * .32;
        vec4 target = viewMatrix * vec4(focus,1.);
        vec2 center = sheet * halfView;
        gl_Position = projectionMatrix * vec4(center + offset, target.z + mix(-34.,85.,particle.z), 1.);
        mark = position.xy;
        brightness = mix(.42,1.,particle.w);
      }
    `,
    fragmentShader: `
      uniform float mode, night;
      varying vec2 mark;
      varying float brightness;
      void main(){
        bool isRain = mode < 1.5;
        float shape = isRain
          ? (1.-smoothstep(.0,1.,abs(mark.x))) * smoothstep(-1.,-.25,mark.y) * (1.-smoothstep(.08,1.,mark.y))
          : 1.-smoothstep(.31,1.,length(mark));
        vec3 tint = isRain ? vec3(.75,.86,.94) : vec3(.94,.97,1.);
        gl_FragColor = vec4(tint, shape * brightness * (isRain ? mix(.47,.62,night) : .88));
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'Weather precipitation';
  mesh.userData.registryExempt = true;
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  scene.add(mesh);
  return { mesh, uniforms };
}

function umbrellas(scene, max) {
  const crown = new THREE.SphereGeometry(.89, 8, 4, 0, Math.PI * 2, 0, Math.PI * .47);
  crown.scale(1, .39, 1);
  crown.translate(0, 1.76, 0);
  const shaft = new THREE.CylinderGeometry(.027, .027, .96, 6);
  shaft.translate(0, 1.33, 0);
  const dark = new THREE.Color('#34494c'), palette = ['#b55c4f', '#54857f', '#e4b857', '#617da3'].map(v => new THREE.Color(v));
  for (const [geometry, color] of [[crown, new THREE.Color('#ffffff')], [shaft, dark]]) {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(
      Array.from({ length: geometry.attributes.position.count }, () => color.toArray()).flat(), 3));
  }
  const material = new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(mergeGeometries([crown, shaft]), material, max);
  mesh.name = 'Umbrellas';
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.userData.registryExempt = true;
  mesh.frustumCulled = false;
  scene.add(mesh);
  const pose = new THREE.Object3D();
  return { mesh, update(residents, errands) {
    let count = 0;
    const place = (x, y, z, yaw, index, scale) => {
      pose.position.set(x + Math.cos(yaw)*.29, y, z - Math.sin(yaw)*.29);
      pose.rotation.set(.08, yaw, -.06);
      pose.scale.setScalar(scale);
      pose.updateMatrix();
      mesh.setMatrixAt(count, pose.matrix);
      mesh.setColorAt(count++, palette[index % palette.length]);
    };
    residents.people.forEach((person, index) => {
      if (!person.object.visible || residents.life.travelWeather(person.actor) !== 'umbrella') return;
      const { x, y, z } = person.object.position;
      place(x, y, z, person.object.rotation.y, index, person.object.scale.x);
    });
    errands.forEach(({ visible, position: p, scale }, index) => {
      if (visible && travelWeather('rain', index, p.walking) === 'umbrella') place(p.x, p.y, p.z, p.yaw, index, scale);
    });
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  } };
}

export function createWeather({ scene, town, world, residents, renderer }) {
  const uniforms = { weatherMode: { value: 0 }, weatherTime: { value: 0 }, weatherNight: { value: 0 },
    weatherSnowColor: { value: snowColor }, ...lampMap(town.props.filter(p => p.id === 'cv-streetlamp')) };
  coatTown(scene, town, world, residents, uniforms);
  const particles = precipitation(scene, uniforms.weatherTime);
  const errands = world.districts.downtown.errands;
  const props = umbrellas(scene, residents.people.length + errands.length);
  const size = new THREE.Vector2();
  return {
    update(type, time, night, camera, target) {
      const mode = type === 'rain' ? rain : type === 'snow' ? snow : 0;
      uniforms.weatherMode.value = mode;
      uniforms.weatherNight.value = night;
      uniforms.weatherTime.value = time;
      particles.mesh.visible = !!mode;
      props.mesh.visible = mode === rain;
      if (mode) {
        const u = particles.uniforms;
        u.mode.value = mode;
        u.night.value = night;
        u.focus.value.copy(target);
        u.halfView.value.set(camera.right - camera.left, camera.top - camera.bottom).multiplyScalar(.5 / camera.zoom);
        renderer.getSize(size);
        u.pixel.value.copy(u.halfView.value).multiplyScalar(2).divide(size);
        particles.mesh.geometry.instanceCount = mode === rain ? PARTICLES : 550;
      }
      if (mode === rain) props.update(residents, errands);
    },
    audit: () => ({ particles: particles.mesh.visible ? particles.mesh.geometry.instanceCount : 0,
      umbrellas: props.mesh.visible ? props.mesh.count : 0,
      effectDrawCalls: Number(particles.mesh.visible) + Number(props.mesh.visible && props.mesh.count > 0) }),
  };
}

export function mountWeatherControl(root, initial, setWeather) {
  const chooser = root.querySelector('#astra-weather');
  for (const type of WEATHER_TYPES) {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type[0].toUpperCase() + type.slice(1);
    chooser.add(option);
  }
  chooser.value = initial;
  chooser.addEventListener('change', () => setWeather(chooser.value));
  return type => { chooser.value = type; };
}
