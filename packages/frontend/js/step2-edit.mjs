import { state, setStatus } from "./app.mjs";
import { api } from "./api.mjs";

// ── Step 2: Card-based Edit ──

export async function loadTemplates() {
  const sel = document.getElementById("f_template");
  if (!sel) return;
  try {
    const data = await api("/api/templates");
    const templates = data.templates || data || [];
    templates.forEach((t) => {
      if (t.id === "default") return;
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.label || t.name || t.id;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.warn("Failed to load templates:", e.message);
  }
}

// ── Tag rendering ──

function renderTags(containerId, options, selectedValue) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  if (!options.length) return;
  for (const opt of options) {
    const tag = document.createElement("span");
    tag.className = "tag" + (opt === selectedValue ? " selected" : "");
    tag.textContent = opt;
    tag.dataset.value = opt;
    tag.addEventListener("click", () => {
      container.querySelectorAll(".tag").forEach((t) => t.classList.remove("selected"));
      tag.classList.add("selected");
      const hiddenId = containerId.replace("tags_", "f_");
      const hidden = document.getElementById(hiddenId);
      if (hidden) {
        hidden.value = opt;
        state.dirty = true;
      }
      // Update display value
      const displayId = containerId.replace("tags_", "v_");
      const display = document.getElementById(displayId);
      if (display) display.textContent = opt;
    });
    tag.addEventListener("dblclick", () => editTag(tag, containerId));
    container.appendChild(tag);
  }
}

function editTag(tag, containerId) {
  tag.contentEditable = true;
  tag.classList.add("editing");
  tag.focus();
  const range = document.createRange();
  range.selectNodeContents(tag);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  const finish = () => {
    tag.contentEditable = false;
    tag.classList.remove("editing");
    tag.dataset.value = tag.textContent.trim();
    if (tag.classList.contains("selected")) {
      const hiddenId = containerId.replace("tags_", "f_");
      const hidden = document.getElementById(hiddenId);
      if (hidden) hidden.value = tag.dataset.value;
      const displayId = containerId.replace("tags_", "v_");
      const display = document.getElementById(displayId);
      if (display) display.textContent = tag.dataset.value;
    }
    state.dirty = true;
  };
  tag.addEventListener("blur", finish, { once: true });
  tag.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      tag.blur();
    }
  });
}

// ── Paragraph rendering ──

function renderParagraphs(paragraphs) {
  const container = document.getElementById("paragraphs");
  if (!container) return;
  container.innerHTML = "";
  state._paraOptions = {};
  paragraphs.forEach((p, i) => {
    state._paraOptions[i] = [p];
    const div = document.createElement("div");
    div.className = "edit-card";
    div.innerHTML = `
      <div class="edit-card-header">
        <span class="edit-card-label">段落 ${i + 1}</span>
        <label class="coze-para-bold" style="margin-left:auto;font-size:12px;display:flex;align-items:center;gap:4px">
          <input type="checkbox" id="f_bold_${i}" ${p.bold ? "checked" : ""} onchange="state.dirty=true" />
          加粗
        </label>
      </div>
      <div class="edit-card-value edit-card-para" id="v_para_${i}">${escHtml(p.text || "")}</div>
      <div class="tag-list" id="tags_para_${i}"></div>
      ${p.highlight ? `<span class="tag-hl" style="margin-top:4px;display:inline-block">高亮：${escHtml(p.highlight)}</span>` : ""}
      <textarea id="f_para_${i}" style="display:none">${p.text || ""}</textarea>
      <input type="hidden" id="f_hl_${i}" value="${p.highlight || ""}" />
    `;
    container.appendChild(div);
    renderParaTags(i, [p], 0);
  });
}

function renderParaTags(paraIdx, options, selectedIdx) {
  const container = document.getElementById(`tags_para_${paraIdx}`);
  if (!container) return;
  container.innerHTML = "";
  state._paraOptions[paraIdx] = options;
  options.forEach((opt, i) => {
    const tag = document.createElement("span");
    tag.className = "tag" + (i === selectedIdx ? " selected" : "");
    tag.textContent = opt.text.substring(0, 30) + (opt.text.length > 30 ? "..." : "");
    tag.dataset.index = i;
    tag.addEventListener("click", () => {
      container.querySelectorAll(".tag").forEach((t) => t.classList.remove("selected"));
      tag.classList.add("selected");
      document.getElementById(`f_para_${paraIdx}`).value = opt.text;
      document.getElementById(`f_hl_${paraIdx}`).value = opt.highlight || "";
      const display = document.getElementById(`v_para_${paraIdx}`);
      if (display) display.textContent = opt.text;
      state.dirty = true;
    });
    tag.addEventListener("dblclick", () => editParaTag(tag, paraIdx));
    container.appendChild(tag);
  });
}

function editParaTag(tag, paraIdx) {
  tag.contentEditable = true;
  tag.classList.add("editing");
  tag.focus();
  const finish = () => {
    tag.contentEditable = false;
    tag.classList.remove("editing");
    const idx = parseInt(tag.dataset.index);
    if (state._paraOptions[paraIdx]?.[idx]) {
      state._paraOptions[paraIdx][idx].text = tag.textContent.trim();
    }
    if (tag.classList.contains("selected")) {
      document.getElementById(`f_para_${paraIdx}`).value = tag.textContent.trim();
      const display = document.getElementById(`v_para_${paraIdx}`);
      if (display) display.textContent = tag.textContent.trim();
    }
    state.dirty = true;
  };
  tag.addEventListener("blur", finish, { once: true });
  tag.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      tag.blur();
    }
  });
}

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Populate form from config ──

export function populateForm() {
  if (!state.config) return;
  const { meta, cover, content } = state.config;
  const d = new Date();

  // Hidden meta inputs
  document.getElementById("f_issueNum").value = meta?.issueNumber || "";
  document.getElementById("f_year").value = meta?.year || d.getFullYear();
  document.getElementById("f_month").value = meta?.month || d.getMonth() + 1;
  document.getElementById("f_day").value = meta?.day || d.getDate();
  document.getElementById("f_description").value = meta?.description || "";
  document.getElementById("f_template").value = meta?.template || "default";

  // Display info bar
  const dn = document.getElementById("d_issueNum");
  if (dn) dn.textContent = String(meta?.issueNumber || 0).padStart(3, "0");
  const dd = document.getElementById("d_date");
  if (dd)
    dd.textContent = `${meta?.year || d.getFullYear()}/${meta?.month || d.getMonth() + 1}/${meta?.day || d.getDate()}`;

  // Headline
  const headline = cover.headline || "";
  document.getElementById("f_headline").value = headline;
  const vh = document.getElementById("v_headline");
  if (vh) vh.textContent = headline;
  renderTags("tags_headline", [headline], headline);

  // Cover source
  document.getElementById("f_coverSource").value = cover.source || "";
  const vs = document.getElementById("v_coverSource");
  if (vs) vs.textContent = cover.source || "";

  // Title
  const title = content.title || "";
  document.getElementById("f_title").value = title;
  const vt = document.getElementById("v_title");
  if (vt) vt.textContent = title;
  renderTags("tags_title", [title], title);

  // Subtitle
  const subtitle = content.subtitle || "";
  document.getElementById("f_subtitle").value = subtitle;
  const vsub = document.getElementById("v_subtitle");
  if (vsub) vsub.textContent = subtitle;
  renderTags("tags_subtitle", [subtitle], subtitle);

  // Source
  document.getElementById("f_source").value = content.source || "";
  const vsrc = document.getElementById("v_source");
  if (vsrc) vsrc.textContent = content.source || "";

  // Paragraphs
  renderParagraphs(content.paragraphs || []);
}

// ── Read form to config ──

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
  c.content.title = document.getElementById("f_title").value;
  c.content.subtitle = document.getElementById("f_subtitle").value;
  c.content.source = document.getElementById("f_source").value;
  c.content.paragraphs = (c.content.paragraphs || []).map((_, i) => ({
    text: document.getElementById(`f_para_${i}`)?.value || "",
    highlight: document.getElementById(`f_hl_${i}`)?.value || undefined,
    bold: document.getElementById(`f_bold_${i}`)?.checked || undefined,
  }));
  return c;
}

// ── AI Optimize (per-field) ──

export async function aiOptimize(field) {
  const config = readForm();
  if (!config) return setStatus("没有可优化的内容", "error");
  setStatus("AI 生成中...", "working");
  try {
    const result = await api("/api/generate-options", { ...config, _field: field });
    state.dirty = true;

    if (field === "headline" && Array.isArray(result)) {
      const current = config.cover.headline;
      const options = [...new Set([current, ...result])];
      renderTags("tags_headline", options, current);
    } else if (field === "title" && Array.isArray(result)) {
      const current = config.content.title;
      const options = [...new Set([current, ...result])];
      renderTags("tags_title", options, current);
    } else if (field === "subtitle" && Array.isArray(result)) {
      const current = config.content.subtitle;
      const options = [...new Set([current, ...result])];
      renderTags("tags_subtitle", options, current);
    } else if (field === "paragraphs" && Array.isArray(result)) {
      result.forEach((po, i) => {
        if (!po?.options) return;
        const currentText = document.getElementById(`f_para_${i}`)?.value || "";
        const currentHl = document.getElementById(`f_hl_${i}`)?.value || "";
        const allOpts = [{ text: currentText, highlight: currentHl }, ...po.options];
        const seen = new Set();
        const deduped = allOpts.filter((o) => {
          if (seen.has(o.text)) return false;
          seen.add(o.text);
          return true;
        });
        renderParaTags(i, deduped, 0);
      });
    } else if (field === "all") {
      // Handle all-fields response
      if (result.headlineOptions) {
        const current = config.cover.headline;
        renderTags("tags_headline", [...new Set([current, ...result.headlineOptions])], current);
      }
      if (result.titleOptions) {
        const current = config.content.title;
        renderTags("tags_title", [...new Set([current, ...result.titleOptions])], current);
      }
      if (result.subtitleOptions) {
        const current = config.content.subtitle;
        renderTags("tags_subtitle", [...new Set([current, ...result.subtitleOptions])], current);
      }
      if (result.paragraphOptions) {
        result.paragraphOptions.forEach((po, i) => {
          if (!po?.options) return;
          const currentText = document.getElementById(`f_para_${i}`)?.value || "";
          const currentHl = document.getElementById(`f_hl_${i}`)?.value || "";
          const allOpts = [{ text: currentText, highlight: currentHl }, ...po.options];
          const seen = new Set();
          const deduped = allOpts.filter((o) => {
            if (seen.has(o.text)) return false;
            seen.add(o.text);
            return true;
          });
          renderParaTags(i, deduped, 0);
        });
      }
    }
    setStatus("AI 生成完成，点击标签选择", "done");
  } catch (e) {
    setStatus("AI 生成失败: " + e.message, "error");
  }
}
window.aiOptimize = aiOptimize;
