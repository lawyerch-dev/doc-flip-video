/**
 * 转场效果目录
 *
 * 前后端共用。包含所有 GLSL 和标准转场的信息。
 */

const EFFECTS = [
  // 翻页类
  { id: "page-curl", name: "翻页", category: "翻页", shader: "gl_InvertedPageCurl", params: [] },
  {
    id: "simple-curl",
    name: "简单翻页",
    category: "翻页",
    shader: "gl_SimplePageCurl",
    params: [
      { name: "angle", type: "int", default: "80", desc: "卷角角度" },
      { name: "radius", type: "float", default: "0.15", desc: "卷曲半径" },
    ],
  },
  {
    id: "book-curl",
    name: "书本翻页",
    category: "翻页",
    shader: "gl_SimpleBookCurl",
    params: [
      { name: "angle", type: "int", default: "80" },
      { name: "radius", type: "float", default: "0.15" },
    ],
  },
  // 几何类
  {
    id: "diamond",
    name: "菱形展开",
    category: "几何",
    shader: "gl_Diamond",
    params: [{ name: "smooth", type: "float", default: "0.2", desc: "边缘模糊" }],
  },
  {
    id: "double-diamond",
    name: "双菱形",
    category: "几何",
    shader: "gl_DoubleDiamond",
    params: [{ name: "smooth", type: "float", default: "0.05" }],
  },
  { id: "star", name: "星形", category: "几何", shader: "gl_StarWipe", params: [] },
  { id: "bowtie", name: "蝴蝶结", category: "几何", shader: "gl_Bowtie", params: [] },
  { id: "pinwheel", name: "风车", category: "几何", shader: "gl_Pinwheel", params: [] },
  // 动感类
  {
    id: "bounce",
    name: "弹跳",
    category: "动感",
    shader: "gl_Bounce",
    params: [
      { name: "bounces", type: "float", default: "3", desc: "弹跳次数" },
      { name: "direction", type: "int", default: "0", desc: "0=下 1=左 2=上 3=右" },
    ],
  },
  {
    id: "flower",
    name: "花朵绽放",
    category: "动感",
    shader: "gl_Flower",
    params: [{ name: "smooth", type: "float", default: "0.1" }],
  },
  {
    id: "bars",
    name: "条纹",
    category: "动感",
    shader: "gl_Bars",
    params: [{ name: "vertical", type: "bool", default: "0" }],
  },
  {
    id: "curtain",
    name: "幕布",
    category: "动感",
    shader: "gl_StageCurtains",
    params: [
      { name: "bumps", type: "int", default: "6" },
      { name: "drop", type: "float", default: "3" },
    ],
  },
  { id: "swap", name: "交换", category: "动感", shader: "gl_Swap", params: [] },
  // 优雅类
  {
    id: "fan-in",
    name: "扇形展开",
    category: "优雅",
    shader: "gl_FanIn",
    params: [{ name: "smooth", type: "float", default: "0.2" }],
  },
  {
    id: "fan-out",
    name: "扇形退出",
    category: "优雅",
    shader: "gl_FanOut",
    params: [{ name: "smooth", type: "float", default: "0.2" }],
  },
  {
    id: "cross-out",
    name: "十字退出",
    category: "优雅",
    shader: "gl_CrossOut",
    params: [{ name: "smooth", type: "float", default: "0.1" }],
  },
  { id: "corner-vanish", name: "角落消失", category: "优雅", shader: "gl_CornerVanish", params: [] },
  {
    id: "exponential-swish",
    name: "指数甩动",
    category: "优雅",
    shader: "gl_Exponential_Swish",
    params: [
      { name: "zoom", type: "float", default: "1" },
      { name: "angle", type: "float", default: "0" },
    ],
  },
  // 3D
  { id: "cube", name: "立方体", category: "3D", shader: "gl_cube", params: [] },
  // 基础
  { id: "dissolve", name: "溶解", category: "基础", shader: "dissolve", params: [] },
  { id: "wipeleft", name: "向左擦除", category: "基础", shader: "wipeleft", params: [] },
  { id: "pushright", name: "向右推挤", category: "基础", shader: "pushright", params: [] },
  { id: "zoomin", name: "放大", category: "基础", shader: "zoomin", params: [] },
];

export function getEffect(id) {
  return EFFECTS.find((e) => e.id === id);
}

export function isGLSL(id) {
  const e = getEffect(id);
  return e ? e.shader.startsWith("gl_") : false;
}

export function getCategories() {
  const cats = {};
  for (const e of EFFECTS) {
    (cats[e.category] ??= []).push(e);
  }
  return cats;
}

export default EFFECTS;
