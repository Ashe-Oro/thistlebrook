import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { place } from '../catalog/loader.js';
import { toonMaterial } from '../toon.js';
import { CHESS_LINE, chessFrame } from './life/activities.js';
import { residentPoses } from './life/visuals.js';
import { SUNBEAM_AMBIENT, SUNBEAM_FURNISHINGS, SUNBEAM_PAVING_Y } from './sunbeam-mall-plan.js';
import { SUNBEAM_MALL } from './sunbeam-layout.js';

const tabletop = square => [(square.charCodeAt(0) - 100.5) * .12, (Number(square[1]) - 4.5) * .12];

// Chess pieces move over the board through the town life system's legal
// opening study. Two profiles make the pawns and rear rank easy to distinguish.
function buildChessGames(root, tableHeight) {
  const unit = new THREE.Matrix4();
  const kinds = [false, true].map(pawn => {
    const h = pawn ? .058 : .10;
    const foot = new THREE.CylinderGeometry(.024, .035, h, 8).translate(0, h / 2, 0);
    const head = new THREE.IcosahedronGeometry(pawn ? .021 : .029, 0).translate(0, h + .013, 0);
    const geometry = mergeGeometries([foot.toNonIndexed(), head]);
    return new THREE.InstancedMesh(geometry, toonMaterial('#ffffff'), 32);
  });
  kinds.forEach(kind => {
    kind.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    kind.frustumCulled = false;
    kind.name = 'Sunbeam chess pieces';
    root.add(kind);
  });
  const tables = SUNBEAM_FURNISHINGS.flatMap((spot, i) => spot.kind === 'chess' ? [{...spot, id: i}] : []);
  const initial = [...'abcdefgh'].flatMap(col => ['1', '2', '7', '8'].map(row => col + row));
  const move = (squares, from, to) => { squares[squares.indexOf(from)] = to; };
  const bases = tables.map((_, board) => {
    const color = [new THREE.Color('#fff1d7'), new THREE.Color('#394f47')];
    return initial.map((square, i) => {
      const mesh = kinds[i % 4 === 1 || i % 4 === 2 ? 1 : 0];
      const index = board * 16 + Math.floor(i / 4) * 2 + i % 2;
      mesh.setColorAt(index, color[i % 4 >= 2 ? 1 : 0]);
      return {mesh, index};
    });
  });
  return time => {
    const frames = new Map();
    tables.forEach(({id, pos: [x, z]}, board) => {
      const frame = chessFrame(time + 5 * board + 2);
      frames.set(id, frame);
      const squares = [...initial];
      CHESS_LINE.slice(0, frame.turn).forEach(([from, to]) => {
        move(squares, from, to);
        if (from === 'e1') move(squares, 'h1', 'f1');
      });
      squares.forEach((square, i) => {
        const [a, b] = tabletop(square);
        const target = square === frame.move[0] ? frame.move[1]
          : frame.move[0] === 'e1' && square === 'h1' ? 'f1' : null;
        const [c, d] = target ? tabletop(target) : [a, b];
        const {mesh, index} = bases[board][i];
        mesh.setMatrixAt(index, unit.makeTranslation(
          x + THREE.MathUtils.lerp(a, c, frame.progress),
          SUNBEAM_PAVING_Y + tableHeight + (target ? .10 * Math.sin(Math.PI * frame.progress) : 0),
          z + THREE.MathUtils.lerp(b, d, frame.progress)));
      });
    });
    kinds.forEach(kind => { kind.instanceMatrix.needsUpdate = true; });
    return frames;
  };
}

function musicianInstrument(root) {
  const g = new THREE.Group();
  g.name = 'Sunbeam busker accordion';
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const pieces = [
    [0, .99, .27, .43, .28, .21, '#824b3b'],
    [-.23, .99, .27, .14, .32, .23, '#bf9c65'],
    [.23, .99, .27, .14, .31, .23, '#514f43'],
    ...Array.from({length: 6}, (_, i) => [(i - 2.5) * .062, .99, .384, .025, .245, .016, '#e7d4a7']),
  ];
  pieces.forEach(([x, y, z, w, h, d, color]) => {
    const box = new THREE.Mesh(cube, toonMaterial(color));
    box.position.set(x, y, z);
    box.scale.set(w, h, d);
    g.add(box);
  });
  g.matrixAutoUpdate = false;
  root.add(g);
  return g;
}

export async function buildMallLife(parent, {chessTableHeight, seatHeight}) {
  const root = new THREE.Group();
  root.name = 'Sunbeam Mall life';
  parent.add(root);
  const people = SUNBEAM_AMBIENT.map((plan, i) => ({ ...plan, i, matrix: new THREE.Matrix4() }));
  const roles = new Map();
  people.forEach(p => {
    const key = p.role + (p.seated ? ':seated' : ':standing');
    if (!roles.has(key)) roles.set(key, []);
    roles.get(key).push(p);
  });
  const bounds = new THREE.Sphere(new THREE.Vector3(SUNBEAM_MALL.axisX, 1, -61.5), 29);
  const batches = (await Promise.all([...roles.values()].map(async members => {
    const {role, seated} = members[0];
    const template = await place('townsfolk-' + role);
    if (seated) residentPoses(template).setSeat(true);
    template.updateMatrixWorld(true);
    const parts = [];
    template.traverse(part => {
      if (!part.isMesh) return;
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, members.length);
      mesh.name = 'Sunbeam ' + role + (seated ? ' seated' : ' strolling');
      mesh.boundingSphere = bounds;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = part.castShadow && !part.userData.outline;
      if (part.userData.outline) mesh.userData.outline = true;
      root.add(mesh);
      parts.push({mesh, members, local: part.matrixWorld.clone()});
    });
    return parts;
  }))).flat();
  const gameStep = buildChessGames(root, chessTableHeight);
  const instrument = musicianInstrument(root);
  const transform = new THREE.Object3D(), combined = new THREE.Matrix4();
  let previousTime, previousVisibility, frames;
  function update(time, visible) {
    if (previousTime === time && previousVisibility === visible) return;
    previousTime = time;
    previousVisibility = visible;
    // Furniture and boards remain in place at night, including game positions.
    for (const {mesh} of batches) mesh.visible = visible;
    instrument.visible = visible;
    if (!visible) return;
    frames = gameStep(time);
    for (const p of people) {
      const scale = .90 + p.i % 3 * .04;
      const [x, z] = p.pos;
      transform.position.set(x, SUNBEAM_PAVING_Y + (p.seated ? seatHeight : 0), z);
      transform.rotation.set(0, p.yaw, 0);
      if (p.activity === 'stroll') {
        const phase = time * .051 + p.phase;
        transform.position.z += Math.sin(phase) * 21;
        transform.position.x += Math.sin(phase * 2) * .19;
        transform.position.y += Math.abs(Math.sin(time * 8 + p.i)) * .043;
        transform.rotation.y = Math.cos(phase) > 0 ? 0 : Math.PI;
        transform.rotation.z = Math.sin(time * 8 + p.i) * .031;
      } else if (p.activity === 'chess') {
        const {side, progress} = frames.get(p.table);
        if (p.seat === (side === 'white' ? 0 : 1)) transform.rotation.x = .18 * Math.sin(progress * Math.PI);
      } else if (p.activity === 'performer') {
        transform.rotation.z = Math.sin(time * 4.4) * .11;
        transform.rotation.y += Math.sin(time * 2.2) * .13;
      } else {
        transform.rotation.y += Math.sin(time * 1.4 + p.i) * .09;
      }
      transform.scale.setScalar(scale);
      transform.updateMatrix();
      p.matrix.copy(transform.matrix);
      if (p.activity === 'performer') {
        instrument.matrix.copy(p.matrix);
        instrument.matrixWorldNeedsUpdate = true;
      }
    }
    for (const {mesh, members, local} of batches) {
      members.forEach((p, i) => mesh.setMatrixAt(i, combined.multiplyMatrices(p.matrix, local)));
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  update(0, true);
  return {
    update,
    audit: () => ({
      active: previousVisibility,
      people: people.map(({activity, seated, role, matrix}) => ({
        activity, seated: !!seated, model: 'townsfolk-' + role,
        position: new THREE.Vector3().setFromMatrixPosition(matrix).toArray(),
      })),
      chess: [...frames.entries()].map(([table, {move, progress}]) => ({table, move, progress})),
    }),
  };
}
