// Linear distance haze leaves the streets crisp and softens distant hills.
// Respect stage.setMode(): orthographic mode intentionally has no fog.
export function updateLightingFog(stage, horizon, { daylight, twilight }) {
  if (stage.mode === 'iso') stage.scene.fog = null; // WORKTREE-HOOK iso — orthographic life never uses distance fog
  if (stage.scene.fog) {
    stage.scene.fog.color.copy(horizon);
    stage.scene.fog.near = 85 - twilight * 15;
    stage.scene.fog.far = 260 - twilight * 55 - (1 - daylight) * 30;
  }
  stage.renderer.setClearColor(horizon);
}
