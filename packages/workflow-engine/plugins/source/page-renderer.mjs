/**
 * source:page-renderer
 *
 * 声明已由 render-images.mjs 渲染好的页面图片路径。
 * render-images.mjs 会在 workflow 引擎运行前被调用，由 run.mjs 或 index.mjs 触发。
 * 此插件只检查文件存在性并返回 descriptor。
 */

import fs from "fs";
import path from "path";
import { Plugin, mergeParams } from "../../plugin.mjs";
import { TEMP_DIR } from "../../../../config/paths.mjs";

export default class PageRendererPlugin extends Plugin {
  static meta = {
    id: "source:page-renderer",
    name: "页面渲染器",
    category: "source",
    description: "声明已由 render-images.mjs 渲染好的页面图片路径",
  };

  static paramSchema = {
    page: { type: "string", default: "cover" },
    highlight: { type: "boolean", default: false },
    configPath: { type: "string", default: "" },
  };

  static inputSchema = {};

  static outputSchema = {
    output: { type: "image" },
  };

  static async build(inputs, params, ctx) {
    const { page, highlight, configPath } = mergeParams(this.paramSchema, params);

    // 从 article config 获取 issue number
    let issueNum = "000";
    if (configPath && fs.existsSync(configPath)) {
      const article = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      issueNum = String(article.meta?.issueNumber || 0).padStart(3, "0");
    }

    const imgDir = path.join(TEMP_DIR, `issue-${issueNum}`);

    // 确定文件名
    let filename;
    if (page === "cover") {
      filename = "cover.png";
    } else if (highlight) {
      filename = "content-hl.png";
    } else {
      filename = "content-plain.png";
    }

    const imgPath = path.join(imgDir, filename);

    if (!fs.existsSync(imgPath)) {
      throw new Error(
        `页面图片不存在: ${imgPath}\n请先运行 render-images.mjs 生成图片`
      );
    }

    const label = ctx.nextLabel(page === "cover" ? "cover" : "content");
    console.log(`  📄 ${page}${highlight ? " (高亮)" : ""}: ${imgPath}`);

    return {
      type: "source-image",
      path: imgPath,
      duration: 10, // 足够长，engine 的 loop 会管理实际时长
      outputLabel: label,
    };
  }
}
