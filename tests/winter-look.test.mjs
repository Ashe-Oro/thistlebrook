import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {TOWN_RULE} from '../src/compiler/town-rules.js';
import winter from '../src/skins/winter.js';
import {
  WINTER_LOOK, hexLuma, analyzeSnowHistogram, renderSyntheticSnowIso, snowAlbedo,
} from '../src/astra/skin/winter-look.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test(`${TOWN_RULE.winterLook}: winter skin data keeps shadow-to-highlight spread and avoids a white cap`, () => {
  const s = winter.material.snow;
  assert(s.shadow && s.highlight && s.color);
  const spread = hexLuma(s.highlight) - hexLuma(s.shadow);
  assert(spread >= WINTER_LOOK.minShadowHighlight, `skin spread ${spread.toFixed(3)}`);
  assert(hexLuma(s.highlight) <= WINTER_LOOK.maxHighlightLuma, `highlight ${s.highlight} too close to white`);
  assert(winter.material.wrap.floor <= WINTER_LOOK.maxWrapFloor, 'wrap floor too high');
  assert(winter.post.haze.day <= WINTER_LOOK.maxHazeDay, 'day haze would wash the snow');
  assert.equal(winter.material.side.space, 'world');
});

test(`${TOWN_RULE.winterLook}: the shader has three snow bands, exposure, AO, lips and tracks`, () => {
  const src = read('src/astra/skin/material.js');
  for (const token of ['uSkinSnowShadow', 'uSkinSnowHigh', 'uSkinSnowDetail', 'expose', 'tracks', 'lip']) {
    assert.match(src, new RegExp(token), token);
  }
});

test(`${TOWN_RULE.winterLook}: a headless isometric snow field meets the histogram targets`, () => {
  const {width, height, data} = renderSyntheticSnowIso(240, 160, winter.material.snow);
  const stats = analyzeSnowHistogram(data, width, height);
  assert(stats.ok, stats.reason + ' ' + JSON.stringify({spread: stats.spread, bands: stats.bands, nearWhite: stats.nearWhite}));
  // A flat wash of the old highlight colour must fail the same check.
  const flat = new Uint8ClampedArray(240 * 160 * 4);
  flat.fill(255);
  assert.equal(analyzeSnowHistogram(flat, 240, 160).ok, false);
  const mid = snowAlbedo({up: 1, slope: 0, noise: 0.5, ao: 0.2, track: 0, snow: winter.material.snow});
  assert(mid.every((c) => c < 0.98), 'mid snow should not be pure white');
});

test(`${TOWN_RULE.winterLook}: a captured winter still, if present, keeps the same contour`, () => {
  const url = new URL('../shots/rules-audit/winter-histogram.json', import.meta.url);
  if (!existsSync(url)) return;
  const rows = JSON.parse(readFileSync(url, 'utf8'));
  assert(rows.length > 0);
  for (const row of rows) {
    assert(row.snowPixels > 200, `${row.file} has too few snow pixels`);
    assert(row.ok, `${row.file}: ${row.reason}`);
  }
});
