/**
 * source:audio-picker
 *
 * 从指定目录随机选择一首背景音乐。
 */

import fs from "fs";
import path from "path";
import { Plugin, ROOT, mergeParams } from "../../plugin.mjs";

export default class AudioPickerPlugin extends Plugin {
  static meta = {
    id: "source:audio-picker",
    name: "背景音乐选择器",
    category: "source",
    description: "从 assets/music 随机选择一首背景音乐",
  };

  static paramSchema = {
    dir: { type: "string", default: "assets/music" },
  };

  static inputSchema = {};

  static outputSchema = {
    output: { type: "audio" },
  };

  static async build(inputs, params, ctx) {
    const { dir } = mergeParams(this.paramSchema, params);
    const musicDir = path.join(ROOT, dir);

    let musicFile = null;
    if (fs.existsSync(musicDir)) {
      const files = fs.readdirSync(musicDir).filter((f) => f.match(/\.(mp3|wav|ogg|m4a)$/i));
      if (files.length > 0) {
        musicFile = path.join(musicDir, files[Math.floor(Math.random() * files.length)]);
      }
    }

    if (musicFile) {
      console.log(`  🎵 背景音乐: ${path.basename(musicFile)}`);
    } else {
      console.log(`  🎵 无背景音乐`);
    }

    return {
      type: musicFile ? "source-audio" : "source-audio",
      path: musicFile,
      outputLabel: musicFile ? ctx.nextLabel("audio") : null,
    };
  }
}
