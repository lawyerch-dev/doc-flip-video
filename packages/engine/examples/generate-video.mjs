#!/usr/bin/env node
/**
 * 示例：通过简化 API 生成视频
 *
 * 用法: node packages/engine/examples/generate-video.mjs
 */
import { generateVideo } from "../generate.mjs";

const result = await generateVideo({
  // 最小输入：只需标题 + 段落
  title: "未保价货物遇违规签收丢失，责任谁担？",
  source: "来源：中国法院网",
  paragraphs: [
    {
      text: "快递员没打通电话，直接放门口，系统点'本人签收'。结果货物丢了，法院认定这是重大违约。承运人没安全送达，就得赔。",
      highlight: "快递员没打通电话，直接放门口，系统点'本人签收'。结果货物丢了",
    },
    {
      text: "用户下单时强制阅读快件服务协议，保价条款加红加粗。既然给了保价选项，用户不选就得按协议赔。最终判赔运费9倍，360多元。",
      highlight: "既然给了保价选项，用户不选就得按协议赔",
    },
  ],
});

console.log("\n🎉 生成结果:", result);
