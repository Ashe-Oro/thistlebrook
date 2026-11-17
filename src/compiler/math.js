// Native transcendental functions can differ by an ulp between JS engines.
// Use the same IEEE-754 arithmetic in the compiler on both paths. Rounding
// native results alone still disagrees when a result hits a rounding boundary.
// These series cover town geometry angles, with error below 1e-14; sqrt is
// the hardware square root. Rendering continues to use native Three.js math.
const PI = Math.PI, HALF_PI = PI / 2, QUARTER_PI = PI / 4, TAU = PI * 2;

function reduce(x) {
  x %= TAU;
  if (x > PI) x -= TAU;
  if (x < -PI) x += TAU;
  return x;
}

function sin(x) {
  x = reduce(x);
  if (x > HALF_PI) x = PI - x;
  if (x < -HALF_PI) x = -PI - x;
  let term = x, sum = x;
  for (let n = 1; n <= 12; n++) {
    term *= -x * x / ((2 * n) * (2 * n + 1));
    sum += term;
  }
  return sum;
}

function cos(x) {
  x = Math.abs(reduce(x));
  const sign = x > HALF_PI ? -1 : 1;
  if (x > HALF_PI) x = PI - x;
  let term = 1, sum = 1;
  for (let n = 1; n <= 12; n++) {
    term *= -x * x / ((2 * n - 1) * (2 * n));
    sum += term;
  }
  return sign * sum;
}

function atan(x) {
  const sign = x < 0 || Object.is(x, -0) ? -1 : 1;
  x = Math.abs(x);
  const invert = x > 1;
  if (invert) x = 1 / x;
  const shift = x > 0.41421356237309503; // tan(pi/8)
  if (shift) x = (x - 1) / (x + 1);
  let term = x, sum = x;
  for (let n = 1; n <= 24; n++) {
    term *= -x * x;
    sum += term / (2 * n + 1);
  }
  if (shift) sum += QUARTER_PI;
  if (invert) sum = HALF_PI - sum;
  return sign * sum;
}

function atan2(y, x) {
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
  if (y === 0) return x < 0 || Object.is(x, -0) ? (Object.is(y, -0) ? -PI : PI) : y;
  if (x === 0) return y < 0 ? -HALF_PI : HALF_PI;
  if (!Number.isFinite(x) && !Number.isFinite(y)) return atan2(Math.sign(y), Math.sign(x));
  const a = atan(Math.abs(y / x));
  return (y < 0 ? -1 : 1) * (x < 0 ? PI - a : a);
}

function hypot(...values) {
  const largest = Math.max(0, ...values.map(Math.abs));
  if (largest === 0 || largest === Infinity) return largest;
  let sum = 0;
  for (const value of values) sum += (value / largest) * (value / largest);
  return largest * Math.sqrt(sum);
}

export const math = Object.create(Math);
Object.assign(math, {
  sin, cos, atan, atan2, hypot,
  tan: (x) => sin(x) / cos(x),
  asin: (x) => atan2(x, Math.sqrt((1 - x) * (1 + x))),
});
