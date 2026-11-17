// Rough ms/frame for post on vs off (requestAnimationFrame timing is unreliable
// under headless SwiftShader, so we render N frames back-to-back and force GPU
// completion once). Exposes window.__perf. Only runs on ?perf=1 so normal page
// loads and screenshots are untouched.
export function maybeMeasurePerf(renderer, post, getCamera, frames = 20) {
  if (new URLSearchParams(location.search).get('perf') !== '1') return;
  const gl = renderer.getContext();
  const was = post.options.post;
  const px = new Uint8Array(4);
  const bench = (on) => {
    post.setOptions({ post: on });
    post.render(getCamera());
    const t = performance.now();
    for (let i = 0; i < frames; i++) post.render(getCamera());
    // gl.finish() doesn't block under ANGLE/SwiftShader; a 1px readback does.
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return (performance.now() - t) / frames;
  };
  const off = bench(false);
  const on = bench(true);
  post.setOptions({ post: was });
  post.render(getCamera());
  window.__perf = { frames, msPerFrameOff: +off.toFixed(2), msPerFrameOn: +on.toFixed(2) };
}
