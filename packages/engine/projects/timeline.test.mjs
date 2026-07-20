import assert from "node:assert/strict";
import { validateTimeline } from "./timeline.mjs";

const assets = [{ id: "asset-image", kind: "image" }];

assert.throws(
  () =>
    validateTimeline(
      { version: 1, canvas: "vertical", scenes: [{ id: "scene-1", component: "unknown", duration: 3, assets: {} }] },
      assets,
    ),
  /未知组件/,
);

assert.throws(
  () =>
    validateTimeline(
      {
        version: 1,
        canvas: "vertical",
        scenes: [{ id: "scene-1", component: "image-story", duration: 3, assets: { visual: "/tmp/file.png" } }],
      },
      assets,
    ),
  /缺少已上传/,
);

assert.equal(
  validateTimeline(
    {
      version: 1,
      canvas: "vertical",
      scenes: [{ id: "scene-1", component: "image-story", duration: 3, assets: { visual: "asset-image" } }],
      audio: null,
    },
    assets,
  ).scenes.length,
  1,
);
