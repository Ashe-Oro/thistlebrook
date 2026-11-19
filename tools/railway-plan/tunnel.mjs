import {GROUND_TOP} from '../../src/compiler/woods.js';
import {RULES as R, corridor} from './costmap.mjs';

export const offset = (q, o) => [q.p[0] - q.d[1] * o, q.p[1] + q.d[0] * o];
const corridorOffsets = Array.from({length: 17}, (_, i) => (i - 8) * corridor() / 8);

// A sampled 15 m arc can measure slightly tighter after rounding.
function tightTurn(a, b, c) {
  const ab = [b[0] - a[0], b[1] - a[1]], bc = [c[0] - b[0], c[1] - b[1]];
  const cross = ab[0] * bc[1] - ab[1] * bc[0];
  const product = Math.hypot(...ab) * Math.hypot(...bc) * Math.hypot(c[0] - a[0], c[1] - a[1]);
  return 2 * Math.abs(cross) * R.tightCorridorRadius * .97 > product ? Math.sign(cross) : 0;
}

export function extraInsideOffsets(q) {
  return q.tightSide ? [q.tightSide * (corridor() + R.tightInside) / 2, q.tightSide * R.tightInside] : [];
}

// Sample the exported polyline at quarter-metre intervals, including at bends.
export function sampleTrack(centreline, length) {
  const step = length / centreline.length;
  return centreline.flatMap((q, i) => {
    const next = centreline[(i + 1) % centreline.length];
    const prev = centreline[(i - 1 + centreline.length) % centreline.length];
    const after = centreline[(i + 2) % centreline.length];
    const dx = next.p[0] - q.p[0], dz = next.p[1] - q.p[1], d = Math.hypot(dx, dz);
    const tightHere = tightTurn(prev.p, q.p, next.p), tightNext = tightTurn(q.p, next.p, after.p);
    return [0, .25, .5, .75].map((t) => ({
      tightSide: t < .5 ? tightHere : tightNext,
      p: [q.p[0] + dx * t, q.p[1] + dz * t],
      d: [dx / d, dz / d],
      y: q.y + (next.y - q.y) * t,
      s: (i + t) * step,
    }));
  });
}

export function terrainSection(terrain, q) {
  const height = (o) => terrain.height(...offset(q, o));
  const lowerSide = (o) => Math.min(height(-o), height(o)) - q.y;
  return {
    bed: Math.max(...corridorOffsets.map(height), ...extraInsideOffsets(q).map(height)) - GROUND_TOP,
    crown: height(0) - q.y,
    walls: lowerSide(R.boreWall),
    flank: lowerSide(R.boreFlank),
    wings: lowerSide(R.portalWing),
  };
}

export const hasFace = ({crown, wings}) => crown >= R.portalHeight && wings >= R.wingCover;
export const hasCoreCover = ({crown, walls}) => crown >= R.tunnelClear + R.tunnelMargin && walls >= R.tunnelClear;
export const hasBoreCover = (section) => hasCoreCover(section) && section.flank >= R.flankCover;
