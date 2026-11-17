// Post-process chain for the cel town. Toggleable; ?post=0 falls back to a
// plain renderer.render identical to the baseline. Inspired by
// jankeesvw/isometric-helenaveen (ideas only — that repo has no licence, so no
// code from it is used here).
//
// CHAIN (device-pixel render targets, linear light until the final pass):
//   1. scene  -> sceneRT  (colour; MSAA x4; own depth renderbuffer)
//   2. prepass-> prepassRT (MeshNormalMaterial, inverted-hull outlines hidden;
//      carries a DepthTexture) — gives CLEAN depth + view-space normals for the
//      ink, so ink comes from real geometry, not the hulls. Only when
//      edges/normals are on.
//   3. Kuwahara (radius uKuwahara) : painterly, edge-preserving smoothing.
//   4. Edge ink : darken the near side of depth steps (multiply by ~0.58, a la
//      helenaveen) + normal discontinuities; depth threshold is relative for
//      perspective, absolute for ortho.
//   5. Grade : optional palette quantise + saturation/contrast/warm/vignette.
//   6. Output : linear -> sRGB to the screen.
//
// DEFAULT PARAMS (tuned on shots/post-*, see options.js DEFAULTS):
//   edges on, normals OFF (?normals=1 to opt in), kuwahara r=3 with ink
//   protection, grade on (sat 1.06, contrast 1.05, warm 0.02, vignette 0.14,
//   done in sRGB space), quant 0 (off), hull ON (inverted hulls give the bold
//   silhouette; post depth ink adds a softer inner line). inkMul 0.55,
//   depthThresh 0.03 (relative, persp) / 0.6 (ortho), inkWidth 1.2.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
//
// v3 ink polish:
//   * inkFade (default on, ?inkFade=0 off): in perspective the screen-space
//     ink strength and width, and the inverted-hull thickness (toon.js
//     HULL_FADE), are full up to the town-core depth (where the view axis hits
//     the ground) and fall linearly to 35% at twice that depth.
//   * foliageMask (default on, ?foliageMask=0 off): meshes flagged
//     userData.foliage (tree/bush crowns, builder puffs) are also put on
//     FOLIAGE_LAYER; after the normal prepass they are redrawn (depth equal)
//     with alpha 0.5, so the normal target's alpha marks foliage. The edge
//     pass then skips crease (normal) ink between two foliage pixels; depth
//     (silhouette) ink on crowns is unchanged.
import { DEFAULTS } from './options.js';
import { HULL_FADE } from '../toon.js';
import { kuwaharaMaterial, edgeMaterial, gradeMaterial, outputMaterial, hullCompositeMaterial } from './shaders.js';

// Inverted-hull outline meshes live on their own layer so the post chain can
// draw them AFTER the Kuwahara pass (otherwise the filter eats the thin ink).
export const HULL_LAYER = 1;
// Foliage meshes (also on layer 0) for the prepass foliage-flag redraw.
export const FOLIAGE_LAYER = 2;
const FADE_MIN = 0.35;

const MSAA = 4; // colour-RT multisampling (WebGL2; sceneRT has no depth texture)

export function createPost(renderer, scene, camera, opts = {}) {
  const options = { ...DEFAULTS, ...opts };
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);

  const colorRT = (samples) => new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType, // linear HDR-ish working buffer, no banding
    depthBuffer: true, samples,
  });
  const sceneRT = colorRT(MSAA);
  const rtA = colorRT(0);
  const rtB = colorRT(0);
  // Hull ink layer: scene depth (depth-only) + hulls on top, alpha = coverage.
  const hullRT = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.UnsignedByteType, depthBuffer: true, samples: MSAA });
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
  const hullComp = hullCompositeMaterial();
  const _clear = new THREE.Color();

  // Prepass target carries a depth texture (clean depth for the ink) + normals.
  const depthTexture = new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType);
  const prepassRT = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.UnsignedByteType, depthBuffer: true, depthTexture });

  const normalMat = new THREE.MeshNormalMaterial();
  // Alpha 0.5 flags foliage. NoBlending (not NormalBlending) so three does not
  // define OPAQUE (which forces alpha to 1) and the alpha is written as-is; a
  // small polygon offset makes the equal-depth redraw reliably pass.
  const foliageNormalMat = new THREE.MeshNormalMaterial({
    opacity: 0.5, blending: THREE.NoBlending, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const _fwd = new THREE.Vector3();
  const kuwahara = kuwaharaMaterial();
  const edge = edgeMaterial();
  const grade = gradeMaterial();
  const output = outputMaterial();
  const quad = new FullScreenQuad();

  function setHullVisible(v) {
    scene.traverse((o) => {
      if (o.userData && o.userData.outline) { o.visible = v; o.layers.set(HULL_LAYER); }
      else if (o.userData && o.userData.foliage) o.layers.enable(FOLIAGE_LAYER);
    });
  }

  // View depth of the town core: where the view axis meets the ground. 0 when
  // fading is off (ortho, ?inkFade=0, or looking at the sky).
  function fadeDistance(cam) {
    if (!options.inkFade || cam.isOrthographicCamera) return 0;
    cam.getWorldDirection(_fwd);
    if (_fwd.y > -0.02) return 0;
    return Math.min(cam.far * 0.5, Math.max(5, cam.position.y / -_fwd.y));
  }

  function texel(mat) { mat.uniforms.uTexel && mat.uniforms.uTexel.value.set(1 / size.x, 1 / size.y); }

  // Run a fullscreen pass src->dst (dst null = screen). Ping-pongs rtA/rtB.
  let last = null;
  function pass(mat, src, toScreen) {
    mat.uniforms.tDiffuse.value = src;
    const dst = toScreen ? null : (last === rtA ? rtB : rtA);
    renderer.setRenderTarget(dst);
    quad.material = mat;
    quad.render(renderer);
    if (!toScreen) last = dst;
    return dst && dst.texture;
  }

  function render(cam = camera) {
    const mask = cam.layers.mask;
    const fadeDist = fadeDistance(cam);
    HULL_FADE.uFadeDist.value = fadeDist;
    HULL_FADE.uFadeMin.value = FADE_MIN;
    if (!options.post) {
      cam.layers.enable(0); cam.layers.enable(HULL_LAYER);
      renderer.setRenderTarget(null); renderer.render(scene, cam);
      cam.layers.mask = mask;
      return;
    }
    last = null;

    // Everything but the hulls.
    cam.layers.set(0);
    renderer.setRenderTarget(sceneRT);
    renderer.render(scene, cam);

    const wantPrepass = options.edges || options.normals;
    if (wantPrepass) {
      scene.overrideMaterial = normalMat;
      renderer.setRenderTarget(prepassRT);
      renderer.render(scene, cam);
      if (options.foliageMask && options.normals) {
        // Redraw only the foliage (equal depth passes LessEqual) with alpha 0.5.
        const auto = renderer.autoClear;
        const bg = scene.background; scene.background = null; // a Color bg would force a clear
        renderer.autoClear = false;
        scene.overrideMaterial = foliageNormalMat;
        cam.layers.set(FOLIAGE_LAYER);
        renderer.render(scene, cam);
        cam.layers.set(0);
        renderer.autoClear = auto;
        scene.background = bg;
      }
      scene.overrideMaterial = null;
    }

    if (options.hull) {
      // Depth-only scene, then the hulls (alpha 1) over a transparent clear.
      renderer.getClearColor(_clear);
      const a = renderer.getClearAlpha();
      const auto = renderer.autoClear;
      const bg = scene.background; scene.background = null;
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(hullRT);
      renderer.clear();
      renderer.autoClear = false;
      scene.overrideMaterial = depthOnly;
      renderer.render(scene, cam);
      scene.overrideMaterial = null;
      cam.layers.set(HULL_LAYER);
      renderer.render(scene, cam);
      renderer.autoClear = auto;
      renderer.setClearColor(_clear, a);
      scene.background = bg;
    }
    cam.layers.mask = mask;

    let read = sceneRT.texture;
    if (options.kuwahara > 0) {
      texel(kuwahara);
      kuwahara.uniforms.uRadius.value = options.kuwahara;
      kuwahara.uniforms.uStride.value = options.kuwahara > 3 ? 2 : 1;
      read = pass(kuwahara, read, false);
    }
    if (options.hull) {
      hullComp.uniforms.tHull.value = hullRT.texture;
      read = pass(hullComp, read, false);
    }
    if (options.edges) {
      texel(edge);
      edge.uniforms.tDepth.value = depthTexture;
      edge.uniforms.tNormal.value = prepassRT.texture;
      edge.uniforms.uUseNormal.value = options.normals;
      edge.uniforms.uNear.value = cam.near;
      edge.uniforms.uFar.value = cam.far;
      edge.uniforms.uIsOrtho.value = !!cam.isOrthographicCamera;
      scene.userData.isoPost?.(cam, edge.uniforms, size); // WORKTREE-HOOK iso — world-per-pixel depth threshold
      edge.uniforms.uFadeDist.value = fadeDist;
      edge.uniforms.uFadeMin.value = FADE_MIN;
      edge.uniforms.uFoliageMask.value = !!options.foliageMask;
      for (const [k, u] of [['inkMul', 'uInkMul'], ['inkMix', 'uInkMix'], ['inkWidth', 'uWidth'], ['normalWeight', 'uNormalWeight'], ['depthThresh', 'uDepthThresh']]) {
        if (options[k] != null) edge.uniforms[u].value = options[k];
      }
      read = pass(edge, read, false);
    }
    if (options.grade || options.quant > 0) {
      grade.uniforms.uQuant.value = options.quant;
      // Grade knobs collapse toward neutral when grade is off but quant is on.
      grade.uniforms.uSat.value = options.grade ? 1.1 : 1.0;
      grade.uniforms.uContrast.value = options.grade ? 1.1 : 1.0;
      grade.uniforms.uWarm.value = options.grade ? 0.025 : 0.0;
      grade.uniforms.uVignette.value = options.grade ? 0.2 : 0.0;
      scene.userData.lightingPolish?.grade(grade.uniforms, options); // WORKTREE-HOOK lighting
      read = pass(grade, read, false);
    }
    pass(output, read, true);
  }

  function setSize(w, h) {
    const pr = renderer.getPixelRatio();
    size.set(Math.floor(w * pr), Math.floor(h * pr));
    for (const rt of [sceneRT, rtA, rtB, prepassRT, hullRT]) rt.setSize(size.x, size.y);
  }

  function setOptions(o) {
    Object.assign(options, o);
    if ('hull' in o) setHullVisible(options.hull);
  }

  // Apply the initial hull visibility once (pages call again after buildTown).
  setHullVisible(options.hull);

  return { render, setSize, setOptions, setHullVisible, options };
}
