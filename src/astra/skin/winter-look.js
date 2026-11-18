// OWNER: rules-audit lane. Measurable winter-look targets and a headless
// histogram so TOWN-15 can fail an audit without opening a browser. The same
// numbers are documented in docs/WINTER-LOOK.md.
export const WINTER_LOOK = Object.freeze({
  minSpread: 0.22,       // p90 - p10 luminance among snow pixels
  minBands: 3,           // distinct luma buckets that each hold enough snow
  bandShare: 0.08,       // minimum share of snow pixels in a counted band
  bins: 8,
  maxNearWhite: 0.12,    // share of snow pixels with luma > nearWhiteLuma
  nearWhiteLuma: 0.96,
  minSnowLuma: 0.42,
  maxSnowChroma: 0.22,
  minShadowHighlight: 0.22, // skin-data highlight luma minus shadow luma
  maxHighlightLuma: 0.96,
  maxWrapFloor: 0.38,
  maxHazeDay: 0.08,
});

export function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function hexToRgb(hex) {
  const n = hex.replace('#', '');
  const v = parseInt(n.length === 3 ? n.split('').map((c) => c + c).join('') : n, 16);
  return [(v >> 16) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

export const hexLuma = (hex) => luma(...hexToRgb(hex));

export function isSnowPixel(r, g, b) {
  const y = luma(r, g, b);
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  return y >= WINTER_LOOK.minSnowLuma && y <= 0.995 && chroma < WINTER_LOOK.maxSnowChroma;
}

/** Sample one snow albedo the way the winter skin shader mixes its three bands. */
export function snowAlbedo({up = 1, slope = 0, noise = 0.5, ao = 0.2, track = 0, snow}) {
  const band = Math.min(1, Math.max(0, up * 0.4 + noise * 0.38 - ao * 0.42 - slope * 0.22 - track * 0.35));
  const shadow = hexToRgb(snow.shadow), mid = hexToRgb(snow.color), high = hexToRgb(snow.highlight);
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const slush = hexToRgb(snow.slush);
  let col = band < 0.5 ? lerp(shadow, mid, band * 2) : lerp(mid, high, band * 2 - 1);
  if (track > 0) col = lerp(col, slush, Math.min(1, track));
  return col;
}

export function analyzeSnowHistogram(pixels, width, height) {
  const snow = [];
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i] / 255, g = pixels[i + 1] / 255, b = pixels[i + 2] / 255;
    if (pixels[i + 3] < 16) continue;
    if (isSnowPixel(r, g, b)) snow.push(luma(r, g, b));
  }
  const total = snow.length;
  const empty = {
    snowPixels: 0, spread: 0, bands: 0, nearWhite: 1, p10: 0, p90: 0, mean: 0,
    ok: false, reason: 'no snow pixels',
  };
  if (!total) return empty;
  snow.sort((a, b) => a - b);
  const at = (p) => snow[Math.min(total - 1, Math.max(0, Math.floor(p * (total - 1))))];
  const p10 = at(0.1), p90 = at(0.9), spread = p90 - p10;
  const mean = snow.reduce((s, v) => s + v, 0) / total;
  const nearWhite = snow.filter((y) => y > WINTER_LOOK.nearWhiteLuma).length / total;
  const counts = Array(WINTER_LOOK.bins).fill(0);
  for (const y of snow) counts[Math.min(WINTER_LOOK.bins - 1, Math.floor(y * WINTER_LOOK.bins))]++;
  const bands = counts.filter((c) => c / total >= WINTER_LOOK.bandShare).length;
  const reasons = [];
  if (spread < WINTER_LOOK.minSpread) reasons.push(`spread ${spread.toFixed(3)} < ${WINTER_LOOK.minSpread}`);
  if (bands < WINTER_LOOK.minBands) reasons.push(`bands ${bands} < ${WINTER_LOOK.minBands}`);
  if (nearWhite > WINTER_LOOK.maxNearWhite) reasons.push(`near-white ${(nearWhite * 100).toFixed(1)}% > ${WINTER_LOOK.maxNearWhite * 100}%`);
  return { snowPixels: total, spread, bands, nearWhite, p10, p90, mean, width, height, ok: reasons.length === 0, reason: reasons.join('; ') };
}

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return hash2(ix, iy) * (1 - u) * (1 - v) + hash2(ix + 1, iy) * u * (1 - v)
    + hash2(ix, iy + 1) * (1 - u) * v + hash2(ix + 1, iy + 1) * u * v;
}

/** Top-down isometric heightfield rendered in software for a headless histogram. */
export function renderSyntheticSnowIso(width = 240, height = 160, snow) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height;
    // Isometric ground: sunlit drifts, shaded banks, a slushy path and a roof.
    const wx = (u - 0.5) * 20 + (v - 0.5) * 12;
    const wz = (v - 0.5) * 20 - (u - 0.5) * 12;
    const hill = Math.exp(-(wx * wx + (wz - 2) * (wz - 2)) / 22) * 2.8
      + Math.exp(-((wx - 6) ** 2 + (wz + 4) ** 2) / 14) * 2.0;
    const n = noise(wx * 0.45, wz * 0.45) * 0.45 + noise(wx * 2.2, wz * 2.2) * 0.3 + noise(wx * 8, wz * 8) * 0.25;
    const path = Math.abs(wx * 0.4 + wz) < 0.85;
    const roof = (Math.abs(wx + 5) < 2.4 && Math.abs(wz - 3) < 1.8) ? 1 : 0;
    const shadeBank = wx < -3 && wz > 0;
    const slope = Math.min(1, Math.abs(wx) * 0.12 + hill * 0.25 + (roof ? 0.15 : 0));
    const up = roof ? 0.95 : shadeBank ? 0.35 : Math.max(0.15, 1 - slope * 0.55);
    const ao = shadeBank ? 0.85 : Math.min(1, (1 - n) * 0.6 + (path ? 0.25 : 0) + (1 - up) * 0.4);
    const track = path ? 0.85 : 0;
    const [r, g, b] = snowAlbedo({up, slope, noise: shadeBank ? 0.08 : roof ? 0.95 : n, ao, track, snow});
    const i = (y * width + x) * 4;
    data[i] = Math.round(r * 255); data[i + 1] = Math.round(g * 255);
    data[i + 2] = Math.round(b * 255); data[i + 3] = 255;
  }
  return { width, height, data };
}

/** Side-light axis used by the skin shader, for TOWN-14 yaw checks. */
export function sideLightAxis(normalWorld, viewMatrix, space) {
  const [x, y, z] = normalWorld;
  const nViewX = viewMatrix[0] * x + viewMatrix[4] * y + viewMatrix[8] * z;
  return space === 'world' ? x : nViewX;
}

export function sideContribution(normalWorld, viewMatrix, {strength = 1, space = 'view'} = {}) {
  const axis = sideLightAxis(normalWorld, viewMatrix, space);
  const left = Math.pow(Math.max(0, -axis), 1.6);
  const right = Math.pow(Math.max(0, axis), 1.6);
  return (right - left) * strength;
}

export function yawViewMatrix(radians) {
  const c = Math.cos(radians), s = Math.sin(radians);
  // Column-major 4x4, rotation about Y, looking along -Z after yaw.
  return [
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
  ];
}
