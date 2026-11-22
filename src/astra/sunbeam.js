import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { place } from '../catalog/loader.js';
import { DISTRICT_OFFSETS } from '../compiler/astra-placement.js';
import { toonMaterial } from '../toon.js';
import { buildLampGlow } from './lamp-glow.js';
import { lampPosts, SUNBEAM_LAMPS } from './lamp-posts.js';
import { SUNBEAM_MALL } from './sunbeam-layout.js';
import { SUNBEAM_AMBIENT, SUNBEAM_FURNISHINGS, SUNBEAM_GLOBE_HEIGHT, SUNBEAM_PAVING_Y, sunbeamDaytime } from './sunbeam-mall-plan.js';
import { buildMallLife } from './sunbeam-mall-life.js';
import { tagObject } from './registry/render-tags.js';
import { batchStaticMeshes } from './static-batches.js';

const trim = '#f3dec0';
const iron = '#405e59';
const timber = '#997659';
const litGlass = new THREE.Color('#ffc981');

function scenery(root) {
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const orb = new THREE.IcosahedronGeometry(1, 0);
  const round = new THREE.CylinderGeometry(.5, .5, 1, 12);
  const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const awning = new THREE.ConeGeometry(1, 1, 8);
  const ring = new THREE.TorusGeometry(1, .15, 5, 14);
  const signs = [];
  const mesh = (geometry, x, y, z, w, h, d, color, parent = root) => {
    const m = new THREE.Mesh(geometry, typeof color === 'string' ? toonMaterial(color) : color);
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    m.castShadow = geometry !== plane;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (...args) => mesh(cube, ...args);
  const ball = (x, y, z, r, color, parent) => mesh(orb, x, y, z, r, r, r, color, parent);
  const disk = (x, y, z, diameter, height, color, parent) => mesh(round, x, y, z, diameter, height, diameter, color, parent);
  const tile = (x, y, z, w, d, color) => mesh(plane, x, y, z, w, 1, d, color);
  const sign = (text, x, y, z, w, h, color, parent, registryId) => {
    const anchor = new THREE.Object3D();
    anchor.position.set(x, y, z);
    parent.add(anchor);
    signs.push({ text, w, h, color, anchor, registryId });
  };
  return { box, ball, disk, tile, sign, signs, mesh, awning, ring };
}

// The atlas keeps every shop name readable with one textured draw for the mall.
function signMesh(root, signs) {
  const columns = 2, cellWidth = 512, cellHeight = 96;
  const canvas = document.createElement('canvas');
  canvas.width = columns * cellWidth;
  canvas.height = THREE.MathUtils.ceilPowerOfTwo(Math.ceil(signs.length / columns) * cellHeight);
  const ctx = canvas.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 51px Georgia';
  root.updateMatrixWorld(true);
  const planes = signs.map(({ text, w, h, color, anchor }, i) => {
    const x = (i % columns) * cellWidth, y = Math.floor(i / columns) * cellHeight;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, cellWidth, cellHeight);
    ctx.strokeStyle = '#fff0cb';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 8, y + 8, cellWidth - 16, cellHeight - 16);
    ctx.fillStyle = '#fff3d5';
    ctx.fillText(text.toUpperCase(), x + cellWidth / 2, y + cellHeight / 2 + 3, cellWidth - 35);
    const geometry = new THREE.PlaneGeometry(w, h).applyMatrix4(anchor.matrixWorld);
    const uv = geometry.attributes.uv;
    for (let j = 0; j < uv.count; j++) {
      uv.setXY(j, (x + 2 + uv.getX(j) * (cellWidth - 4)) / canvas.width,
        1 - (y + 2 + (1 - uv.getY(j)) * (cellHeight - 4)) / canvas.height);
    }
    return geometry;
  });
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const mesh = new THREE.Mesh(mergeGeometries(planes), new THREE.MeshBasicMaterial({ map }));
  mesh.name = 'Sunbeam shop signs';
  mesh.userData.registryIds = [...new Set(signs.map(s => s.registryId))];
  return mesh;
}

function paveMall({box, tile}) {
  const {axisX, north, south, clearWidth, pavedWidth} = SUNBEAM_MALL;
  const length = south - north;
  const centerZ = (north + south) / 2;
  const paving = SUNBEAM_PAVING_Y;
  box(axisX, paving - .085, centerZ, pavedWidth, .12, length, '#bda78b');
  const bandWidth = (pavedWidth - clearWidth) / 2;
  const rows = Math.ceil(length / 1.75), spacing = length / rows;
  const stone = ['#e9dfc8', '#e6dac3', '#e3d6c0', '#eadfc9'];
  const edging = ['#cfbaa3', '#d7c2a8', '#d1bca5', '#dbc7b0'];
  for (let row = 0; row < rows; row++) {
    const z = north + (row + .5) * spacing;
    // Alternate broad central joints to keep the surface one continuous plaza.
    const widths = row % 2 ? [1, 2, 2, 1] : [2, 2, 2];
    let x = axisX - clearWidth / 2;
    widths.forEach((w, column) => {
      tile(x + w / 2, paving, z, w - .026, spacing - .034, stone[(row + column * 3) % stone.length]);
      x += w;
    });
    for (const side of [-1, 1]) {
      const edge = axisX + side * (clearWidth / 2 + bandWidth / 2);
      for (let column = -1; column <= 1; column++) {
        tile(edge + column * bandWidth / 3, paving, z, bandWidth / 3 - .027, spacing - .035,
          edging[(row * 3 + column + side + 4) % edging.length]);
      }
    }
  }
  for (const side of [-1, 1]) {
    tile(axisX + side * (clearWidth / 2 + .05), paving + .003, centerZ, .10, length, '#a89984');
    tile(axisX + side * (pavedWidth / 2 - .10), paving + .004, centerZ, .20, length, '#f1ddba');
    for (let z = north + 2.5; z < south - 1; z += 6.8) {
      const x = axisX + side * (clearWidth / 2 + .44);
      tile(x, paving + .005, z, .37, .37, '#a68e7c').rotation.y = Math.PI / 4;
      tile(x, paving + .006, z, .23, .23, '#e3d6af').rotation.y = Math.PI / 4;
    }
  }
}

function storefront(art, root, building, glass, index) {
  const { box, ball, mesh, ring, sign } = art;
  const g = new THREE.Group();
  g.position.set(building.pos[0], SUNBEAM_PAVING_Y, building.pos[1]);
  g.rotation.y = building.rot;
  root.add(g);
  const { height: h, color, shop, shopName, shopColor, storeys, registryId } = building;
  const roof = ['#526d71', '#66716c', '#746966', '#596d7d'][index % 4];
  const exterior = shopColor || '#506f68';
  const groundHeight = 3.12;
  const floor = (h - groundHeight) / (storeys - 1);
  const parapet = index % 5 === 1 || index % 5 === 3;

  box(0, h / 2, 0, 5.52, h, 6, color, g);
  box(0, .27, 0, 5.62, .54, 6.08, '#ae9d8a', g);
  box(0, groundHeight, 0, 5.64, .17, 6.13, trim, g);
  box(0, h - .10, 0, 5.68, .16, 6.17, trim, g);
  for (const x of [-2.66, 2.66]) box(x, h / 2, 3.04, .13, h, .17, trim, g);

  if (parapet) {
    box(0, h + .17, 0, 5.62, .32, 6.15, roof, g);
    for (const z of [-3, 3]) box(0, h + .4, z, 5.72, .20, .27, color, g);
    for (const x of [-2.74, 2.74]) box(x, h + .4, 0, .24, .20, 5.8, color, g);
    box(.1, h + .42, -.35, 1.35, .16, 1.62, '#828e87', g);
    box(.1, h + .52, -.35, 1.10, .09, 1.35, glass, g);
  } else {
    for (const side of [-1, 1]) {
      const slope = box(0, h + .49, side * 1.47, 5.75, .19, 3.28, roof, g);
      slope.rotation.x = side * .29;
    }
    box(0, h + .97, 0, 5.77, .15, .19, '#435c60', g);
    box(-1.64, h + .73, -1.61, .60, 1.38, .59, '#b98570', g);
    box(-1.64, h + 1.46, -1.61, .78, .15, .74, trim, g);
  }

  for (let level = 0; level < storeys - 1; level++) {
    const y = groundHeight + (level + .51) * floor;
    if (level > 0) box(0, groundHeight + level * floor, 0, 5.62, .11, 6.10, trim, g);
    for (const side of [-1, 1]) for (const x of [-1.27, 1.27]) {
      box(x, y, side * 3.05, 1.60, 1.68, .13, trim, g);
      box(x, y, side * 3.13, 1.33, 1.43, .06, glass, g);
      box(x, y, side * 3.17, .055, 1.44, .05, trim, g);
      box(x, y + .18, side * 3.17, 1.34, .055, .05, trim, g);
      box(x, y - .89, side * 3.15, 1.79, .12, .29, trim, g);
      if (index % 3 !== 1) for (const dx of [-.94, .94]) {
        box(x + dx, y, side * 3.10, .25, 1.49, .095, roof, g);
      }
    }
    for (const side of [-1, 1]) {
      box(side * 2.78, y, .26, .12, 1.45, 1.29, trim, g);
      box(side * 2.85, y, .26, .06, 1.24, 1.06, glass, g);
      box(side * 2.89, y, .26, .045, 1.24, .055, trim, g);
    }
  }

  // Every retail level uses the same clear door line, with displays beside it.
  box(0, 1.46, 3.035, 5.11, 2.83, .12, exterior, g);
  box(.95, 1.20, 3.13, 1.34, 2.40, .11, trim, g);
  box(.95, 1.22, 3.20, 1.10, 2.17, .07, exterior, g);
  box(.95, 1.49, 3.25, .83, 1.51, .034, glass, g);
  box(1.33, 1.10, 3.28, .066, .16, .04, '#d8b66c', g);
  box(.95, .047, 3.27, 1.42, .094, .48, '#b5a58a', g);
  for (const [x, width] of [[-1.15, 2.09], [2.00, .69]]) {
    box(x, 1.46, 3.13, width + .12, 1.97, .12, trim, g);
    box(x, 1.46, 3.22, width, 1.76, .075, glass, g);
    box(x, 1.76, 3.27, width, .05, .045, trim, g);
    box(x, .49, 3.23, width + .14, .16, .28, exterior, g);
  }
  if (index % 2 === 0) box(-1.15, 1.48, 3.27, .055, 1.75, .05, trim, g);

  box(0, 2.85, 3.19, 4.95, .52, .18, exterior, g);
  sign(shopName, 0, 2.86, 3.292, 4.82, .48, exterior, g, registryId);
  const striped = index % 5 !== 4;
  for (let n = 0; n < 10; n++) {
    const accent = striped && n % 2 ? trim : exterior;
    const x = (n - 4.5) * .512;
    box(x, 2.54, 3.63, .513, .092, 1.05, accent, g).rotation.x = .28;
    box(x, 2.31, 4.13, .513, .22, .071, accent, g);
  }

  if (shop === 'grocer') {
    for (const [n, x] of [-2.04, -1.18].entries()) {
      box(x, .36, 3.46, .74, .55, .62, timber, g);
      for (let j = 0; j < 5; j++) {
        ball(x + (j % 3 - 1) * .20, .70, 3.29 + Math.floor(j / 3) * .25, .125,
          n ? '#e3ab49' : '#ba6652', g);
      }
    }
  } else if (shop === 'laundry') {
    for (const x of [-1.68, -.65]) mesh(ring, x, 1.10, 3.31, .32, .32, .27, '#ecdfc9', g);
  } else {
    box(-1.17, .32, 3.45, 1.46, .32, .52, '#ac785e', g);
    for (let i = 0; i < 5; i++) {
      const x = -1.70 + i * .27;
      ball(x, .55, 3.45, .15, '#739264', g);
      ball(x, .66, 3.45, .08, i % 2 ? '#e4b762' : '#da8e93', g);
    }
  }

  if (index % 3 !== 1) {
    box(0, groundHeight + .16, 3.38, 4.38, .16, .82, trim, g);
    box(0, groundHeight + .87, 3.75, 4.43, .07, .085, iron, g);
    for (let i = 0; i < 11; i++) box((i - 5) * .41, groundHeight + .52, 3.75, .055, .72, .055, iron, g);
    box(-1.37, groundHeight + .52, 3.76, 1.39, .30, .35, '#ab795d', g);
    for (let i = 0; i < 5; i++) {
      const x = -1.91 + i * .27;
      ball(x, groundHeight + .72, 3.76, .14, '#739265', g);
      ball(x, groundHeight + .84, 3.76, .075, i % 2 ? '#ddc36e' : '#d58d92', g);
    }
  }
  box(.95, 1.18, -3.10, 1.2, 2.20, .10, exterior, g);
  box(.95, 1.65, -3.16, .72, .83, .045, glass, g);
  box(-1.23, 1.52, -3.10, 1.54, 1.70, .13, trim, g);
  box(-1.23, 1.52, -3.18, 1.34, 1.46, .06, glass, g);
  tagObject(g, registryId);
  return {
    type: 'building', data: building, bounds: new THREE.Box3(
      new THREE.Vector3(building.box.min[0], 0, building.box.min[1]),
      new THREE.Vector3(building.box.max[0], h + 1.7, building.box.max[1])),
  };
}

function garden(art, g) {
  const {box, ball} = art;
  box(0, .25, 0, 2.08, .50, 1.92, '#a4937a', g);
  box(0, .49, 0, 2.17, .13, 2.00, '#c5af8b', g);
  box(0, .56, 0, 1.88, .034, 1.71, '#715f48', g);
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const x = side * .77, z = (i - 1) * .53;
    ball(x, .63, z, .17, '#60834e', g);
    ball(x, .75, z, .095, i % 2 ? '#dcac59' : '#cc7e8d', g);
  }
}

const CHESS_TABLE = .83;
const CHESS_SEAT = .43;
const CAFE_SEAT = .43;

function chair({box}, g, slot, seatHeight, color) {
  const [x, z] = slot.offset;
  const back = Math.sign(z) * .245;
  box(x, seatHeight - .046, z, .54, .092, .51, color, g);
  for (const dx of [-.19, .19]) for (const dz of [-.17, .17]) {
    box(x + dx, .189, z + dz, .064, .377, .064, iron, g);
  }
  for (const dx of [-.20, .20]) box(x + dx, .65, z + back, .061, .44, .064, iron, g);
  box(x, .82, z + back, .54, .11, .092, color, g);
}

function chessTable(art, g, seats) {
  const {box, disk} = art;
  disk(0, .09, 0, .68, .16, iron, g);
  disk(0, .41, 0, .18, .78, iron, g);
  box(0, CHESS_TABLE - .072, 0, 1.27, .13, 1.27, '#9b7958', g);
  box(0, CHESS_TABLE, 0, .99, .034, .99, '#f0dbb0', g);
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    if ((row + col) % 2 === 0) box((col - 3.5) * .12, CHESS_TABLE + .018, (row - 3.5) * .12,
      .12, .006, .12, '#55736a', g);
  }
  seats.forEach(slot => chair(art, g, slot, CHESS_SEAT, '#b09570'));
}

function cafeTable(art, g, color, seats) {
  const {box, disk, mesh, awning} = art;
  disk(0, .77, 0, 1.20, .10, '#ac825f', g);
  disk(0, 1.14, 0, .069, 2.26, timber, g);
  disk(0, .087, 0, .54, .15, iron, g);
  mesh(awning, 0, 2.29, 0, 1.08, .50, 1.08, color, g).rotation.y = Math.PI / 8;
  disk(0, 2.057, 0, 1.99, .085, trim, g);
  disk(0, 2.56, 0, .135, .08, timber, g);
  seats.forEach(slot => chair(art, g, slot, CAFE_SEAT, color));
  for (const z of [-.29, .29]) {
    disk(.25, .834, z, .23, .031, trim, g);
    disk(.25, .892, z, .12, .10, '#f0e3cc', g);
    box(.31, .89, z, .049, .056, .061, '#f0e3cc', g);
  }
}

function kiosk(art, g, districtId) {
  const {box, sign} = art;
  const teal = '#567f79';
  g.rotation.y = -Math.PI / 2;
  box(0, .54, 0, 2.08, 1.08, 1.72, teal, g);
  box(0, 1.16, .92, 2.26, .18, .44, '#ba946c', g);
  for (const x of [-.92, .92]) box(x, 1.66, 0, .13, 1.3, 1.68, teal, g);
  box(0, 1.66, -.80, 1.75, 1.24, .10, '#c3af91', g);
  for (const x of [-.62, 0, .62]) {
    box(x, 1.45, .81, .49, .33, .28, '#a68360', g);
    box(x, 1.68, .85, .35, .37, .048, x === 0 ? '#dec88c' : '#f0e3c5', g).rotation.x = -.25;
    box(x, 1.69, .879, .20, .026, .006, teal, g);
  }
  box(0, 2.31, 0, 2.56, .23, 2.15, '#ba7058', g);
  box(0, 2.47, -.10, 2.18, .14, 1.82, '#ce8266', g);
  box(0, 2.27, 1.09, 2.04, .34, .09, teal, g);
  sign('Sunbeam News', 0, 2.27, 1.145, 1.99, .32, teal, g, districtId);
}

function fixtures(art, root, districtId, jobs) {
  const {box, ball, disk, sign} = art;
  const paving = SUNBEAM_PAVING_Y;
  for (const spot of SUNBEAM_FURNISHINGS) {
    const [x, z] = spot.pos;
    if (spot.kind === 'lamp') continue;
    if (spot.kind === 'bench') {
      jobs.push(place('cv-bench', { x, z, scale: .64, rotY: spot.yaw }).then(o => {
        o.position.y = paving;
        root.add(o);
      }));
      continue;
    }
    const g = new THREE.Group();
    g.position.set(x, paving, z);
    root.add(g);
    switch (spot.kind) {
      case 'tree-planter':
        garden(art, g);
        jobs.push(place('cv-tree-fruit', { scale: .64 }).then(tree => {
          tree.position.y = .56;
          g.add(tree);
        }));
        break;
      case 'chess':
        chessTable(art, g, spot.seats);
        break;
      case 'cafe':
        cafeTable(art, g, spot.color, spot.seats);
        break;
      case 'kiosk':
        kiosk(art, g, districtId);
        break;
      case 'performer': {
        // A low tip case and music board mark the busking pitch.
        box(-.38, .071, .45, .91, .14, .51, '#526663', g);
        box(-.38, .146, .45, .79, .023, .39, '#a77859', g);
        box(-.38, .28, .69, .91, .11, .31, '#526663', g).rotation.x = -.84;
        for (const [x, z] of [[-.52,.37],[-.25,.42],[-.13,.55]]) disk(x, .164, z, .087, .025, '#e8bd63', g);
        const board = box(.40, .46, -.76, .66, .77, .09, timber, g);
        board.rotation.x = .14;
        sign('Live Music', .40, .55, -.69, .61, .35, '#4d6c66', g, districtId);
        break;
      }
    }
  }
  for (const [x, z] of SUNBEAM_LAMPS) {
    disk(x, paving + .09, z, .44, .18, iron);
    disk(x, paving + .25, z, .23, .31, iron);
    disk(x, paving + 1.38, z, .105, 2.44, iron);
    disk(x, paving + 2.63, z, .35, .14, iron);
    disk(x, paving + 2.70, z, .40, .075, '#77928a');
    ball(x, paving + SUNBEAM_GLOBE_HEIGHT, z, .145, '#efe2bd');
    disk(x, paving + 2.965, z, .11, .065, iron);
  }
}

export async function buildSunbeam(scene, town) {
  const root = new THREE.Group();
  root.name = 'Sunbeam Mall scenery';
  const art = scenery(root);
  const dusk = { value: 0 };
  const glass = toonMaterial('#7399a0').clone();
  glass.name = 'Sunbeam window glass';
  // Weather clones the material and preserves its shader hook.
  glass.onBeforeCompile = shader => {
    shader.uniforms.uSunbeamDusk = dusk;
    shader.uniforms.uSunbeamLitGlass = { value: litGlass };
    shader.fragmentShader = `uniform float uSunbeamDusk;
uniform vec3 uSunbeamLitGlass;
` + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, uSunbeamLitGlass, uSunbeamDusk);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += uSunbeamLitGlass * uSunbeamDusk * .72;`);
  };
  glass.customProgramCacheKey = () => 'sunbeam-window-light';
  paveMall(art);
  const buildings = town.buildings.filter(b => b.district === 'sunbeam');
  const selectables = buildings.map((b, i) => storefront(art, root, b, glass, i));
  const districtId = town.districts.find(d => d.id === 'sunbeam').registryId;
  const jobs = [];
  fixtures(art, root, districtId, jobs);
  const life = await buildMallLife(scene, { chessTableHeight: CHESS_TABLE + .03, seatHeight: CHESS_SEAT });
  await Promise.all(jobs);
  scene.add(signMesh(root, art.signs));
  batchStaticMeshes(root, scene, { cellSize: 32 });
  scene.add(buildLampGlow(lampPosts(town).filter(p=>p.source==='sunbeam'), {
    name: 'Sunbeam Mall', offset: DISTRICT_OFFSETS.sunbeam,
  }).group);
  return {
    selectables,
    stats: {
      buildings: buildings.length, shops: buildings.filter(b => b.shop).length,
      residentialFrontages: buildings.filter(b => b.upperUse === 'flats').length,
      chessTables: SUNBEAM_FURNISHINGS.filter(p => p.kind === 'chess').length,
      cafeTables: SUNBEAM_FURNISHINGS.filter(p => p.kind === 'cafe').length,
      kiosks: SUNBEAM_FURNISHINGS.filter(p => p.kind === 'kiosk').length,
      performers: SUNBEAM_AMBIENT.filter(p => p.activity === 'performer').length,
      seatedPeople: SUNBEAM_AMBIENT.filter(p => p.seated).length, ambientPeople: SUNBEAM_AMBIENT.length,
    },
    audit: life.audit,
    update(t, hour, night) {
      dusk.value = night;
      life.update(t, sunbeamDaytime(hour));
    },
  };
}
