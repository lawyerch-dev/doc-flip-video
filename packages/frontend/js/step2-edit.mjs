import { state, setStatus, updateCC } from "./app.mjs";
import { api } from "./api.mjs";

// ── Step 2: Tag-based Edit ──

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
  for (const opt of options) {
    const tag = document.createElement("span");
    tag.className = "tag" + (opt === selectedValue ? " selected" : "");
    tag.textContent = opt;
    tag.dataset.value = opt;
    tag.addEventListener("click", () => selectTag(container, tag));
    tag.addEventListener("dblclick", () => editTag(tag, containerId));
    container.appendChild(tag);
  }
}

function selectTag(container, tag) {
  container.querySelectorAll(".tag").forEach((t) => t.classList.remove("selected"));
  tag.classList.add("selected");
  // Sync hidden input
  const hiddenId = container.id.replace("tags_", "f_");
  const hidden = document.getElementById(hiddenId);
  if (hidden) {
    hidden.value = tag.dataset.value;
    state.dirty = true;
  }
}

function editTag(tag, containerId) {
  tag.contentEditable = true;
  tag.classList.add("editing");
  tag.focus();
  // Select all text
  const range = document.createRange();
  range.selectNodeContents(tag);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  const finish = () => {
    tag.contentEditable = false;
    tag.classList.remove("editing");
    tag.dataset.value = tag.textContent.trim();
    // Sync hidden input if this tag is selected
    if (tag.classList.contains("selected")) {
      const hiddenId = containerId.replace("tags_", "f_");
      const hidden = document.getElementById(hiddenId);
      if (hidden) hidden.value = tag.dataset.value;
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

// ── Paragraph tag rendering ──

function renderParagraphTags(containerId, options, selectedIndex) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const tag = document.createElement("span");
    tag.className = "tag" + (i === selectedIndex ? " selected" : "");
    tag.dataset.index = i;
    // Text + highlight badge
    const textSpan = document.createElement("span");
    textSpan.textContent = opt.text;
    tag.appendChild(textSpan);
    if (opt.highlight) {
      const hlBadge = document.createElement("span");
      hlBadge.className = "tag-hl";
      hlBadge.textContent = opt.highlight;
      tag.appendChild(hlBadge);
    }
    tag.addEventListener("click", () => selectParaTag(container, tag, containerId));
    tag.addEventListener("dblclick", () => editParaTag(tag, containerId));
    container.appendChild(tag);
  }
}

function selectParaTag(container, tag, containerId) {
  container.querySelectorAll(".tag").forEach((t) => t.classList.remove("selected"));
  tag.classList.add("selected");
  // Sync textarea + hidden inputs
  const idx = containerId.replace("tags_para_", "");
  const opt = state._paraOptions?.[idx]?.[parseInt(tag.dataset.index)];
  if (opt) {
    const paraInput = document.getElementById(`f_para_${idx}`);
    const hlInput = document.getElementById(`f_hl_${idx}`);
    if (paraInput) {
      paraInput.value = opt.text;
      updateCC(paraInput, 50);
    }
    if (hlInput) hlInput.value = opt.highlight || "";
    state.dirty = true;
  }
}

function editParaTag(tag, containerId) {
  tag.contentEditable = true;
  tag.classList.add("editing");
  tag.querySelector(".tag-hl")?.remove();
  tag.focus();
  const range = document.createRange();
  range.selectNodeContents(tag);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  const finish = () => {
    tag.contentEditable = false;
    tag.classList.remove("editing");
    if (tag.classList.contains("selected")) {
      const idx = containerId.replace("tags_para_", "");
      const paraInput = document.getElementById(`f_para_${idx}`);
      if (paraInput) paraInput.value = tag.textContent.trim();
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

// ── Populate form from config ──

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

  // Cover: tags for headline
  const headline = cover.headline || "";
  document.getElementById("f_headline").value = headline;
  renderTags("tags_headline", [headline], headline);

  document.getElementById("f_coverSource").value = cover.source || "";
  updateCC(document.getElementById("f_coverSource"), 25);

  // Content: tags for title, subtitle
  const title = content.title || "";
  document.getElementById("f_title").value = title;
  renderTags("tags_title", [title], title);

  const subtitle = content.subtitle || "";
  document.getElementById("f_subtitle").value = subtitle;
  renderTags("tags_subtitle", [subtitle], subtitle);

  document.getElementById("f_source").value = content.source || "";
  updateCC(document.getElementById("f_source"), 60);

  // Paragraphs: textarea + tag options
  const paras = content.paragraphs || [];
  state._paraOptions = {};
  const container = document.getElementById("paragraphs");
  container.innerHTML = "";
  paras.forEach((p, i) => {
    state._paraOptions[i] = [p]; // Default option is the current value
    const div = document.createElement("div");
    div.className = "tag-field";
    div.innerHTML = `
      <div class="tag-field-header">
        <span class="coze-para-num">${i + 1}</span>
        <label class="coze-field-label" style="margin:0">段落 ${i + 1} <span class="coze-limit">30-50字</span></label>
        <label class="coze-para-bold" style="margin-left:auto">
          <input type="checkbox" id="f_bold_${i}" ${p.bold ? "checked" : ""} onchange="state.dirty=true" />
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
          加粗
        </label>
      </div>
      <div class="tag-list" id="tags_para_${i}"></div>
      <textarea id="f_para_${i}" class="coze-para-input" oninput="state.dirty=true" placeholder="输入段落内容...">${p.text || ""}</textarea>
      <div class="char-count" id="cc_para_${i}"></div>
      <input type="hidden" id="f_hl_${i}" value="${p.highlight || ""}" />
    `;
    container.appendChild(div);
    updateCC(document.getElementById(`f_para_${i}`), 50);
    renderParagraphTags(`tags_para_${i}`, [p], 0);
  });
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

// ── AI Optimize ──

export async function aiOptimize(scope) {
  const config = readForm();
  if (!config) return setStatus("没有可优化的内容", "error");
  setStatus("AI 优化中...", "working");

  try {
    const result = await api("/api/generate-options", config);
    state.dirty = true;

    // Headline options
    if (result.headlineOptions?.length) {
      const current = config.cover.headline;
      const options = [...new Set([current, ...result.headlineOptions])];
      renderTags("tags_headline", options, current);
    }

    // Title options
    if (result.titleOptions?.length) {
      const current = config.content.title;
      const options = [...new Set([current, ...result.titleOptions])];
      renderTags("tags_title", options, current);
    }

    // Subtitle options
    if (result.subtitleOptions?.length) {
      const current = config.content.subtitle;
      const options = [...new Set([current, ...result.subtitleOptions])];
      renderTags("tags_subtitle", options, current);
    }

    // Paragraph options
    if (result.paragraphOptions?.length) {
      state._paraOptions = {};
      result.paragraphOptions.forEach((po, i) => {
        const currentText = document.getElementById(`f_para_${i}`)?.value || "";
        const currentHl = document.getElementById(`f_hl_${i}`)?.value || "";
        const currentOpt = { text: currentText, highlight: currentHl };
        const allOpts = [currentOpt, ...(po.options || [])];
        // Dedupe by text
        const seen = new Set();
        state._paraOptions[i] = allOpts.filter((o) => {
          if (seen.has(o.text)) return false;
          seen.add(o.text);
          return true;
        });
        renderParagraphTags(`tags_para_${i}`, state._paraOptions[i], 0);
      });
    }

    setStatus("AI 优化完成，点击标签选择", "done");
  } catch (e) {
    setStatus("AI 优化失败: " + e.message, "error");
  }
}
window.aiOptimize = aiOptimize;
