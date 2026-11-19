// Dubins paths (shortest forward curves with a minimum turn radius) between
// two poses. Heading theta: direction (cos θ, sin θ) in the x/z plane; a
// positive curvature turns toward +θ ("L").
const TAU = Math.PI * 2;
const mod2pi = (a) => ((a % TAU) + TAU) % TAU;

const WORDS = {
  LSL(a, b, d, sa, sb, ca, cb) {
    const p2 = 2 + d * d - 2 * Math.cos(a - b) + 2 * d * (sa - sb); if (p2 < 0) return null;
    const t1 = Math.atan2(cb - ca, d + sa - sb);
    return [mod2pi(-a + t1), Math.sqrt(p2), mod2pi(b - t1)];
  },
  RSR(a, b, d, sa, sb, ca, cb) {
    const p2 = 2 + d * d - 2 * Math.cos(a - b) + 2 * d * (sb - sa); if (p2 < 0) return null;
    const t1 = Math.atan2(ca - cb, d - sa + sb);
    return [mod2pi(a - t1), Math.sqrt(p2), mod2pi(-b + t1)];
  },
  LSR(a, b, d, sa, sb, ca, cb) {
    const p2 = -2 + d * d + 2 * Math.cos(a - b) + 2 * d * (sa + sb); if (p2 < 0) return null;
    const p = Math.sqrt(p2), t2 = Math.atan2(-ca - cb, d + sa + sb) - Math.atan2(-2, p);
    return [mod2pi(-a + t2), p, mod2pi(-mod2pi(b) + t2)];
  },
  RSL(a, b, d, sa, sb, ca, cb) {
    const p2 = d * d - 2 + 2 * Math.cos(a - b) - 2 * d * (sa + sb); if (p2 < 0) return null;
    const p = Math.sqrt(p2), t2 = Math.atan2(ca + cb, d - sa - sb) - Math.atan2(2, p);
    return [mod2pi(a - t2), p, mod2pi(b - t2)];
  },
  RLR(a, b, d, sa, sb, ca, cb) {
    const tmp = (6 - d * d + 2 * Math.cos(a - b) + 2 * d * (sa - sb)) / 8; if (Math.abs(tmp) > 1) return null;
    const p = mod2pi(TAU - Math.acos(tmp)), t = mod2pi(a - Math.atan2(ca - cb, d - sa + sb) + p / 2);
    return [t, p, mod2pi(a - b - t + p)];
  },
  LRL(a, b, d, sa, sb, ca, cb) {
    const tmp = (6 - d * d + 2 * Math.cos(a - b) + 2 * d * (-sa + sb)) / 8; if (Math.abs(tmp) > 1) return null;
    const p = mod2pi(TAU - Math.acos(tmp)), t = mod2pi(-a - Math.atan2(ca - cb, d + sa - sb) + p / 2);
    return [t, p, mod2pi(mod2pi(b) - a - t + p)];
  },
};

/** Sample a list of [kind('L'|'S'|'R'), length metres] pieces from pose s every `step` m. */
export function samplePieces(s, pieces, R, step) {
  const out = [];
  let x = s.x, z = s.z, th = s.th;
  for (const [kind, L] of pieces) {
    const k = kind === 'L' ? 1 / R : kind === 'R' ? -1 / R : 0, n = Math.max(1, Math.ceil(L / step - 1e-9)), ds = L / n;
    for (let i = 0; i < n; i++) {
      if (k === 0) { x += Math.cos(th) * ds; z += Math.sin(th) * ds; }
      else { const th2 = th + k * ds; x += (Math.sin(th2) - Math.sin(th)) / k; z += (Math.cos(th) - Math.cos(th2)) / k; th = th2; }
      out.push({x, z, th, k});
    }
  }
  return out;
}

/** All valid Dubins words between poses, shortest first: [{word, pieces, length}]. */
export function dubins(s, g, R) {
  const dx = g.x - s.x, dz = g.z - s.z, D = Math.hypot(dx, dz), d = D / R, phi = Math.atan2(dz, dx);
  const a = mod2pi(s.th - phi), b = mod2pi(g.th - phi);
  const sa = Math.sin(a), sb = Math.sin(b), ca = Math.cos(a), cb = Math.cos(b), out = [];
  for (const [word, f] of Object.entries(WORDS)) {
    const r = f(a, b, d, sa, sb, ca, cb); if (!r) continue;
    const pieces = [...word].map((kind, i) => [kind, r[i] * R]);
    const end = samplePieces(s, pieces.filter(([, L]) => L > 1e-9), R, 1e9).at(-1) ?? {x: s.x, z: s.z, th: s.th};
    const err = Math.hypot(end.x - g.x, end.z - g.z) + Math.abs(Math.sin((end.th - g.th) / 2)) * 2;
    if (err > 1e-4) continue; // guard against degenerate solutions
    out.push({word, pieces: pieces.filter(([, L]) => L > 1e-9), length: r[0] * R + r[1] * R + r[2] * R});
  }
  return out.sort((p, q) => p.length - q.length);
}
