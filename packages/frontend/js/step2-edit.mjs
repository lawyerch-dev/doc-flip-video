import { state, setStatus } from "./app.mjs";
import { updateCC } from "./app.mjs";
import { api } from "./api.mjs";

// ── Step 2: Edit ──

export async function loadTemplates() {
  const sel = document.getElementById("f_template");
  if (!sel) return;
  try {
    const data = await api("/api/templates");
    const templates = data.templates || data || [];
    // Keep the default option, append API results
    templates.forEach((t) => {
      if (t.id === "default") return;
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.label || t.name || t.id;
      sel.appendChild(opt);
    });
  } catch (e) {
    // Templates endpoint may not exist yet; silently degrade
    console.warn("Failed to load templates:", e.message);
  }
}

export function populateForm() {
  if (!state.config) return;
  const { meta, cover, content } = state.config;
  const d = new Date();
  document.getElementById("f_issueNum").value = meta?.issueNumber || "";
  document.getElementById("f_year").value = meta?.year || d.getFullYear();
  document.getElementById("f_month").value = meta?.month || d.getMonth() + 1;
  document.getElementById("f_day").value = meta?.day || d.getDate();
  document.getElementById("f_description").value = meta?.description || "";
  document.getElementById("f_template").value = meta?.template || "default";
  document.getElementById("f_headline").value = cover.headline || "";
  document.getElementById("f_coverSource").value = cover.source || "";
  document.getElementById("f_title").value = cover.headline || "";
  document.getElementById("f_subtitle").value = content.subtitle || "";
  document.getElementById("f_source").value = content.source || "";
  ["f_headline|20", "f_coverSource|25", "f_title|20", "f_subtitle|20", "f_source|60"].forEach((s) => {
    const [id, lim] = s.split("|");
    updateCC(document.getElementById(id), parseInt(lim));
  });
  const c = document.getElementById("paragraphs");
  c.innerHTML = "";
  (content.paragraphs || []).forEach((p, i) => {
    const d = document.createElement("div");
    d.className = "coze-para-editor";
    d.innerHTML = `<div class="coze-para-header">
        <span class="coze-para-num">${i + 1}</span>
        <span class="coze-para-label">段落 ${i + 1}</span>
        <span class="coze-para-limit">30-50字</span>
      </div>
      <textarea id="f_para_${i}" class="coze-para-input" oninput="updateCC(this,50);state.dirty=true" placeholder="输入段落内容...">${p.text || ""}</textarea>
      <div class="char-count" id="cc_para_${i}"></div>
      <div class="coze-para-tools">
        <div class="coze-para-hl-group">
          <span class="coze-para-hl-label">高亮</span>
          <input type="text" id="f_hl_${i}" value="${p.highlight || ""}" oninput="state.dirty=true" placeholder="标记核心关键词" class="coze-para-hl-input" />
        </div>
      </div>`;
    c.appendChild(d);
    updateCC(document.getElementById(`f_para_${i}`), 50);
  });
}

export function readForm() {
  if (!state.config || !state.config.cover || !state.config.content) return null;
  const c = JSON.parse(JSON.stringify(state.config));
  const d = new Date();
  c.meta.issueNumber = parseInt(document.getElementById("f_issueNum").value) || c.meta.issueNumber;
  c.meta.year = parseInt(document.getElementById("f_year").value) || d.getFullYear();
  c.meta.month = parseInt(document.getElementById("f_month").value) || d.getMonth() + 1;
  c.meta.day = parseInt(document.getElementById("f_day").value) || d.getDate();
  c.meta.description = document.getElementById("f_description").value || c.meta.description;
  c.meta.template = document.getElementById("f_template").value || "default";
  c.cover.headline = document.getElementById("f_headline").value;
  c.cover.source = document.getElementById("f_coverSource").value;
  c.content.title = c.cover.headline;
  c.content.subtitle = document.getElementById("f_subtitle").value;
  c.content.source = document.getElementById("f_source").value;
  c.content.paragraphs = (c.content.paragraphs || []).map((_, i) => ({
    text: document.getElementById(`f_para_${i}`)?.value || "",
    highlight: document.getElementById(`f_hl_${i}`)?.value || undefined,
  }));
  return c;
}
