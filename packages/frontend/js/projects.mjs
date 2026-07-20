import { api } from "./api.mjs";

let project;
const $ = (id) => document.getElementById(id);
const esc = (value) =>
  String(value || "").replace(
    /[&<>'"]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char],
  );

function setStatus(message, busy = false) {
  $("renderStatus").textContent = message;
  document.querySelectorAll(".jy-btn").forEach((button) => (button.disabled = busy));
}

function render() {
  $("workspace").hidden = !project;
  $("projectStart").hidden = !!project;
  if (!project) return;
  $("projectTitle").textContent = project.name;
  $("assetCount").textContent = `${project.assets.length} 份素材`;
  $("sceneCount").textContent = `${project.timeline.scenes.length} 个片段`;
  $("assets").innerHTML = project.assets.length
    ? project.assets
        .map(
          (asset) =>
            `<article class="jy-asset-item"><span class="jy-asset-type">${asset.kind === "image" ? "IMG" : asset.kind === "video" ? "VID" : "AUD"}</span><div><b>${esc(asset.name)}</b><small>${esc(asset.kind)}</small></div></article>`,
        )
        .join("")
    : `<div class="jy-asset-empty"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>拖入第一份素材</span><small>图文故事至少需要一张图片或视频</small></div>`;
  const transitions = project.catalog.transitions.filter((item) => item.available || item.fallback).slice(0, 5);
  $("catalog").innerHTML =
    `<p class="jy-catalog-label">可用组件</p><div class="jy-catalog-items">${project.catalog.components.map((item) => `<span class="jy-catalog-tag">${esc(item.name)}</span>`).join("")}</div><p class="jy-catalog-label">转场效果</p><div class="jy-catalog-items">${transitions.map((item) => `<span class="jy-catalog-tag">${esc(item.name)}${item.available ? "" : " · 降级"}</span>`).join("")}</div>`;
  $("timeline").innerHTML = project.timeline.scenes.length
    ? project.timeline.scenes.map((scene, index) => sceneCard(scene, index)).join("")
    : `<div class="jy-timeline-empty">还没有片段。选择模板或让 AI 从你的素材开始编排。</div>`;
}

function sceneCard(scene, index) {
  const assets = project.assets
    .map(
      (asset) =>
        `<option value="${esc(asset.id)}" ${scene.assets?.visual === asset.id ? "selected" : ""}>${esc(asset.name)}</option>`,
    )
    .join("");
  return `<article class="jy-scene-card" data-index="${index}"><div class="jy-scene-index">${String(index + 1).padStart(2, "0")}</div><div class="jy-scene-main"><b>${esc(scene.component)}</b><input class="jy-scene-text" value="${esc(scene.text)}" aria-label="片段文案" placeholder="片段文案" /></div><div class="jy-scene-controls"><label><small>时长</small><input class="jy-scene-duration" type="number" min="2" max="12" step=".1" value="${scene.duration}" />s</label><label><small>视觉素材</small><select class="jy-scene-asset"><option value="">纯文字</option>${assets}</select></label><button class="jy-scene-remove" type="button" aria-label="删除片段" title="删除片段">×</button></div></article>`;
}

function readTimeline() {
  return {
    ...project.timeline,
    scenes: [...document.querySelectorAll(".jy-scene-card")].map((row, index) => {
      const visual = row.querySelector(".jy-scene-asset").value;
      return {
        ...project.timeline.scenes[index],
        text: row.querySelector(".jy-scene-text").value,
        duration: Number(row.querySelector(".jy-scene-duration").value),
        assets: visual ? { visual } : {},
      };
    }),
  };
}

async function refresh() {
  project = await api(`/api/projects/${project.id}`);
  render();
}

document
  .querySelectorAll("input[name=canvas]")
  .forEach((input) =>
    input.addEventListener("change", () =>
      document
        .querySelectorAll(".jy-ratio")
        .forEach((label) => label.classList.toggle("active", label.querySelector("input").checked)),
    ),
  );
$("createProject").onclick = async () => {
  project = await api("/api/projects", {
    name: $("projectName").value,
    canvas: document.querySelector("input[name=canvas]:checked").value,
  });
  render();
};
$("upload").onchange = async ({ target }) => {
  try {
    setStatus("正在导入素材…", true);
    for (const file of target.files) {
      const response = await fetch(`/api/projects/${project.id}/assets`, {
        method: "PUT",
        headers: { "Content-Type": file.type, "X-File-Name": encodeURIComponent(file.name) },
        body: file,
      });
      if (!response.ok) throw new Error((await response.json()).error);
    }
    await refresh();
    setStatus("素材已加入当前项目。");
  } catch (error) {
    setStatus(`导入失败：${error.message}`);
  } finally {
    target.value = "";
    document
      .querySelectorAll(".studio-primary, .studio-secondary, .text-action")
      .forEach((button) => (button.disabled = false));
  }
};
$("applyTemplate").onclick = async () => {
  setStatus("正在铺设成片结构…", true);
  try {
    await api(`/api/projects/${project.id}/template`, { id: "story" });
    await refresh();
    setStatus("已生成可编辑的图文故事时间线。");
  } catch (error) {
    setStatus(error.message);
  } finally {
    document
      .querySelectorAll(".studio-primary, .studio-secondary, .text-action")
      .forEach((button) => (button.disabled = false));
  }
};
$("saveTimeline").onclick = async () => {
  try {
    project.timeline = await api(`/api/projects/${project.id}/timeline`, readTimeline());
    render();
    setStatus("时间线已保存。");
  } catch (error) {
    setStatus(error.message);
  }
};
$("plan").onclick = async () => {
  try {
    setStatus("AI 正在安排镜头、节奏和素材…", true);
    project.timeline = (
      await api(`/api/projects/${project.id}/plan`, { instruction: $("instruction").value })
    ).timeline;
    render();
    setStatus("AI 草案已生成，现在可以逐段修改。");
  } catch (error) {
    setStatus(error.message);
  } finally {
    document
      .querySelectorAll(".studio-primary, .studio-secondary, .text-action")
      .forEach((button) => (button.disabled = false));
  }
};
$("timeline").onclick = (event) => {
  if (!event.target.classList.contains("remove")) return;
  project.timeline.scenes.splice(Number(event.target.closest(".scene-card").dataset.index), 1);
  render();
};
async function renderVideo(mode) {
  try {
    await $("saveTimeline").onclick();
    setStatus(mode === "preview" ? "正在生成低清预览…" : "正在导出正式 MP4…", true);
    const result = await api(`/api/projects/${project.id}/${mode}`, {});
    $("player").src = `${result.url}?${Date.now()}`;
    $("playerEmpty").hidden = true;
    setStatus(mode === "preview" ? "预览已就绪。" : "正式 MP4 已导出。");
  } catch (error) {
    setStatus(error.message);
  } finally {
    document
      .querySelectorAll(".studio-primary, .studio-secondary, .text-action")
      .forEach((button) => (button.disabled = false));
  }
}
$("preview").onclick = () => renderVideo("preview");
$("build").onclick = () => renderVideo("build");
