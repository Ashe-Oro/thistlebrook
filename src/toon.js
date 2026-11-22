import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Palette — pulled from the style reference (cream / terracotta / teal / lime).
// style-ref.jpg is a MOOD reference only; nothing here is textured from it.
// ---------------------------------------------------------------------------
export const PALETTE = {
  skyTop: '#4ea3e0',
  skyHorizon: '#bfe4f5',
  cloud: '#ffffff',

  grass: '#8ec24b',
  grassDark: '#6fa63c',
  hill: '#79b347',
  hillFar: '#8cc457',

  dirt: '#c7a469',
  dirtDark: '#b08c53',

  wall: '#f0e6c8',
  wallShade: '#e4d4a8',
  roof: '#c35a39',
  roofRidge: '#a84a2e',
  trim: '#2f8f87', // teal shutters / doors
  trimDark: '#236b64',
  wood: '#a9743f',
  woodDark: '#7c5330',
  stone: '#9b9890',
  stoneDark: '#7c7a72',

  trunk: '#7a5230',
  leafDark: '#4f8f36',
  leafMid: '#67a93f',
  leafLight: '#86c457',

  ink: '#20262b', // outline / ink colour
};

// ---------------------------------------------------------------------------
// Toon gradient ramp — a tiny 1D texture that quantises diffuse lighting into
// a few flat bands, giving the hard two/three-tone cel look (no soft falloff).
// ---------------------------------------------------------------------------
export function makeToonRamp(a = 84, b = 168, c = 255) {
  const steps = new Uint8Array([a, a, a, 255, b, b, b, 255, c, c, c, 255]);
  const tex = new THREE.DataTexture(steps, 3, 1, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export const RAMP = makeToonRamp();
// Foliage ramp — a harder, wider three-tone split (dark / mid / lit) so tree
// crowns read as clearly banded rather than a soft green blob.
export const FOLIAGE_RAMP = makeToonRamp(46, 132, 255);
const RAMPS = { default: RAMP, foliage: FOLIAGE_RAMP };

const _matCache = new Map();
const toonRamps = new WeakMap();

export function toonMaterial(color, { ramp = 'default' } = {}) {
  const key = ramp + ':' + String(color);
  if (_matCache.has(key)) return _matCache.get(key);
  const mat = new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap: RAMPS[ramp] || RAMP,
  });
  toonRamps.set(mat, ramp);
  _matCache.set(key, mat);
  return mat;
}

export function flatToonRamp(material) {
  return !material.userData.scenery && toonRamps.get(material);
}

// Inverted-hull outline: a back-faced copy of the geometry pushed outward
// along its normals, drawn in ink. Stable, clean, camera-independent.
const _outlineCache = new Map();
const outlines = new WeakSet();
// Hull ink. The shader used to write the linear colour straight to the
// screen, which only looked right by accident (near-black on screen, but the
// true #20262b once rendered through the post chain's linear targets). Now it
// encodes like every other material, so both paths draw the same ink.
const OUTLINE_INK = '#0e1114';
// Distance fade for every hull, shared by all outline materials. The post
// chain sets uFadeDist each frame to the view depth of the town core
// (0 = fading off, e.g. ?inkFade=0 or ortho). In perspective the hull keeps
// full thickness up to that depth and thins linearly to uFadeMin at 2x it, so
// far fences and trees don't turn into solid ink.
export const HULL_FADE = { uFadeDist: { value: 0 }, uFadeMin: { value: 0.35 } };
export function outlineMaterial(thickness) {
  const key = thickness.toFixed(4);
  if (_outlineCache.has(key)) return _outlineCache.get(key);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uThickness: { value: thickness }, uInk: { value: new THREE.Color(OUTLINE_INK) }, ...HULL_FADE },
    vertexShader: /* glsl */ `
      #include <batching_pars_vertex>
      #include <skinning_pars_vertex>
      uniform float uThickness, uFadeDist, uFadeMin;
      void main() {
        #include <batching_vertex>
        float k = 1.0;
        // projectionMatrix[2][3] is -1 for perspective, 0 for ortho.
        if (uFadeDist > 0.0 && projectionMatrix[2][3] != 0.0) {
          vec4 samplePos = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            samplePos = instanceMatrix * samplePos;
          #endif
          #ifdef USE_BATCHING
            samplePos = batchingMatrix * samplePos;
          #endif
          float depth = -(modelViewMatrix * samplePos).z;
          k = mix(1.0, uFadeMin, clamp((depth - uFadeDist) / uFadeDist, 0.0, 1.0));
        }
        float nLen = length(normal);
        vec3 safeNormal = nLen > 1e-6 ? normal / nLen : vec3(0.0);
        vec3 transformed = position + safeNormal * uThickness * k;
        #include <skinbase_vertex>
        #include <skinning_vertex>
        vec4 hullPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          hullPos = instanceMatrix * hullPos;
        #endif
        #ifdef USE_BATCHING
          hullPos = batchingMatrix * hullPos;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * hullPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uInk;
      void main() {
        gl_FragColor = vec4(uInk, 1.0);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
  });
  outlines.add(mat);
  _outlineCache.set(key, mat);
  return mat;
}

export function isOutlineMaterial(material) {
  return outlines.has(material);
}

// Build a toon-shaded mesh (+ optional ink outline) as a small Group.
export function toon(geometry, color, opts = {}) {
  const { outline = true, thickness = 0.04, cast = true, receive = true, ramp = 'default' } = opts;
  const group = new THREE.Group();

  const mesh = new THREE.Mesh(geometry, toonMaterial(color, { ramp }));
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  // Foliage flag: the post prepass masks crease ink inside tree/bush crowns.
  if (ramp === 'foliage') mesh.userData.foliage = true;
  group.add(mesh);

  if (outline) {
    const edge = new THREE.Mesh(geometry, outlineMaterial(thickness));
    edge.castShadow = false;
    edge.receiveShadow = false;
    edge.userData.outline = true; // post passes hide hulls via this flag
    group.add(edge);
  }
  return group;
}

// Toon material for imported vertex-coloured meshes (e.g. Cozy Village). The
// glTF base colour is white, so the vertex colours carry the palette.
const _vcMat = {};
export function ensureNonZeroNormals(geometry) {
  const attr = geometry?.attributes?.normal;
  if (!attr) return geometry;
  for (let i = 0; i < attr.count; i++) {
    const x = attr.getX(i), y = attr.getY(i), z = attr.getZ(i);
    if (x * x + y * y + z * z <= 1e-12) attr.setXYZ(i, 0, 1, 0);
  }
  return geometry;
}

export function toonVertexColorMaterial({ ramp = 'default' } = {}) {
  if (_vcMat[ramp]) return _vcMat[ramp];
  _vcMat[ramp] = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: RAMPS[ramp] || RAMP });
  return _vcMat[ramp];
}
