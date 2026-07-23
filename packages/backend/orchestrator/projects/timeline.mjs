import { CANVASES, COMPONENTS, TEMPLATES, transitions } from "./catalog.mjs";

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function emptyTimeline(canvas) {
  return { version: 1, canvas, scenes: [], audio: null };
}

export function applyTemplate(id, canvas, assets = []) {
  const template = TEMPLATES.find((item) => item.id === id);
  if (!template) throw new Error("未知模板");
  const visual = assets.find((asset) => asset.kind === "image" || asset.kind === "video");
  return {
    ...emptyTimeline(canvas),
    scenes: template.scenes
      .filter((scene) => scene.component !== "image-story" || visual)
      .map((scene, index) => ({
        id: `scene-${index + 1}`,
        ...scene,
        assets: scene.component === "image-story" ? { visual: visual.id } : {},
      })),
  };
}

export function validateTimeline(timeline, assets) {
  if (!timeline || timeline.version !== 1 || !CANVASES[timeline.canvas] || !Array.isArray(timeline.scenes)) {
    throw new Error("时间线格式或画布无效");
  }
  if (timeline.scenes.length > 20) throw new Error("场景不能超过 20 个");
  const assetIds = new Set(assets.map((asset) => asset.id));
  const transitionIds = new Map(transitions().map((transition) => [transition.id, transition]));
  let total = 0;
  const scenes = timeline.scenes.map((scene, index) => {
    if (!scene || !ID.test(scene.id || "")) throw new Error(`场景 ${index + 1} 的 ID 无效`);
    const component = COMPONENTS.find((item) => item.id === scene.component);
    if (!component) throw new Error(`场景 ${index + 1} 使用了未知组件`);
    const duration = Number(scene.duration);
    if (!Number.isFinite(duration) || duration < component.minDuration || duration > component.maxDuration) {
      throw new Error(`场景 ${index + 1} 时长必须在 ${component.minDuration}-${component.maxDuration} 秒`);
    }
    const sceneAssets = scene.assets && typeof scene.assets === "object" ? scene.assets : {};
    for (const slot of component.assets) {
      if (!assetIds.has(sceneAssets[slot])) throw new Error(`场景 ${index + 1} 缺少已上传的 ${slot} 素材`);
    }
    let transition = null;
    if (index && scene.transition) {
      transition = transitionIds.get(scene.transition.id);
      if (!transition) throw new Error(`场景 ${index + 1} 使用了未知转场`);
      const transitionDuration = Number(scene.transition.duration || 0.6);
      if (!Number.isFinite(transitionDuration) || transitionDuration < 0.2 || transitionDuration >= duration) {
        throw new Error(`场景 ${index + 1} 的转场时长无效`);
      }
      transition = { id: transition.id, duration: transitionDuration };
    }
    total += duration;
    return {
      id: scene.id,
      component: component.id,
      duration,
      text: String(scene.text || "").slice(0, 160),
      assets: sceneAssets,
      transition,
    };
  });
  if (total > 90) throw new Error("总时长不能超过 90 秒");
  let audio = null;
  if (timeline.audio) {
    if (!assetIds.has(timeline.audio.asset)) throw new Error("背景音频未上传");
    audio = { asset: timeline.audio.asset, volume: Math.max(0, Math.min(1, Number(timeline.audio.volume ?? 0.3))) };
  }
  return { version: 1, canvas: timeline.canvas, scenes, audio };
}
