import { state, setStatus } from "./app.mjs";
import { api } from "./api.mjs";

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

  document.getElementById("d_issueNum").textContent = String(meta?.issueNumber || 0).padStart(3, "0");
  document.getElementById("d_date").textContent =
    `${meta?.year || d.getFullYear()}/${meta?.month || d.getMonth() + 1}/${meta?.day || d.getDate()}`;

  document.getElementById("f_headline").value = cover.headline || "";
  document.getElementById("v_headline").textContent = cover.headline || "";
  document.getElementById("f_title").value = cover.headline || "";
  setTags("tags_headline", [cover.headline || "输入标题"], cover.headline || "输入标题");

  document.getElementById("f_coverSource").value = cover.source || "";
  document.getElementById("v_coverSource").textContent = cover.source || "";

  document.getElementById("f_title").value = content.title || "";
  document.getElementById("v_title").textContent = content.title || "";
  setTags("tags_title", [content.title || "输入内容标题"], content.title || "输入内容标题");

  document.getElementById("f_subtitle").value = content.subtitle || "";
  document.getElementById("v_subtitle").textContent = content.subtitle || "";
  setTags("tags_subtitle", [content.subtitle || "输入副标题"], content.subtitle || "输入副标题");

  document.getElementById("f_source").value = content.source || "";
  document.getElementById("v_source").textContent = content.source || "";

  const pContainer = document.getElementById("paragraphs");
  pContainer.innerHTML = "";
  (content.paragraphs || []).forEach((p, i) => {
    const div = document.createElement("div");
    div.className = "edit-card";
    div.innerHTML = `
      <div class="edit-card-header">
        <span class="edit-card-label">段落 ${i + 1}</span>
        <label style="margin-left:auto;font-size:12px;display:flex;align-items:center;gap:4px">
          <input type="checkbox" id="f_bold_${i}" ${p.bold ? "checked" : ""} onchange="state.dirty=true"> 加粗
        </label>
      </div>
      <div class="edit-card-value edit-card-para" id="v_para_${i}">${esc(p.text || "")}</div>
      <div class="tag-list" id="tags_para_${i}"></div>
      ${p.highlight ? `<span class="tag-hl" style="margin-top:4px;display:inline-block">高亮：${esc(p.highlight)}</span>` : ""}
      <textarea id="f_para_${i}" style="display:none">${p.text || ""}</textarea>
      <input type="hidden" id="f_hl_${i}" value="${p.highlight || ""}">
    `;
    pContainer.appendChild(div);
    setTags(`tags_para_${i}`, [{ t: p.text, hl: p.highlight }], p.text);
  });
}

function setTags(containerId, options, selected) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = "";
  options.forEach((opt, i) => {
    const tag = document.createElement("span");
    const val = opt.t || opt;
    const isSel = val === (selected.t || selected);
    tag.className = "tag" + (isSel ? " selected" : "");
    tag.textContent = val.length > 40 ? val.substring(0, 40) + "..." : val;
    tag.setAttribute("data-idx", i);
    if (opt.hl) {
      const b = document.createElement("span");
      b.className = "tag-hl";
      b.textContent = opt.hl;
      tag.appendChild(b);
    }
    tag.onclick = () => selectOption(containerId, opt, i);
    tag.ondblclick = () => editTag(containerId, tag, i);
    el.appendChild(tag);
  });
}

function selectOption(containerId, opt, idx) {
  const el = document.getElementById(containerId);
  el.querySelectorAll(".tag").forEach((t) => t.classList.remove("selected"));
  el.children[idx].classList.add("selected");
  const val = opt.t || opt;
  if (containerId === "tags_para_" + containerId.replace("tags_para_", "")) {
    // paragraph - update textarea and hidden
    const i = containerId.replace("tags_para_", "");
    document.getElementById(`f_para_${i}`).value = val;
    document.getElementById(`f_hl_${i}`).value = opt.hl || "";
    document.getElementById(`v_para_${i}`).textContent = val;
  } else {
    const key = containerId.replace("tags_", "");
    document.getElementById(`f_${key}`).value = val;
    document.getElementById(`v_${key}`).textContent = val;
    // Sync headline to title
    if (key === "headline") {
      document.getElementById("f_title").value = val;
    }
  }
  state.dirty = true;
}

function editTag(containerId, tag, idx) {
  tag.contentEditable = true;
  tag.classList.add("editing");
  tag.focus();
  const sel = window.getSelection();
  sel.selectAllChildren(tag);
  const done = () => {
    tag.contentEditable = false;
    tag.classList.remove("editing");
    const val = tag.textContent.trim();
    tag.textContent = val;
    if (tag.classList.contains("selected")) {
      selectOption(containerId, val, idx);
    }
    state.dirty = true;
  };
  tag.addEventListener("blur", done, { once: true });
  tag.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      tag.blur();
    }
  });
}

function esc(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

export async function aiOptimize(field) {
  const cfg = readForm();
  if (!cfg) return;
  setStatus("AI 生成中...", "working");
  try {
    const r = await api("/api/generate-options", { ...cfg, _field: field });
    state.dirty = true;
    if (field === "headline" && Array.isArray(r)) {
      const cur = cfg.cover.headline;
      const opts = [...new Set([cur, ...r])];
      setTags("tags_headline", opts, cur);
    } else if (field === "title" && Array.isArray(r)) {
      const cur = cfg.content.title;
      setTags("tags_title", [...new Set([cur, ...r])], cur);
    } else if (field === "subtitle" && Array.isArray(r)) {
      const cur = cfg.content.subtitle;
      setTags("tags_subtitle", [...new Set([cur, ...r])], cur);
    } else if (field === "paragraphs" && Array.isArray(r)) {
      r.forEach((po, i) => {
        if (!po?.options) return;
        const curT = document.getElementById(`f_para_${i}`)?.value || "";
        const curH = document.getElementById(`f_hl_${i}`)?.value || "";
        const opts = [{ t: curT, hl: curH }, ...po.options.map((o) => ({ t: o.text, hl: o.highlight }))];
        const seen = new Set();
        const deduped = opts.filter((o) => {
          if (seen.has(o.t)) return false;
          seen.add(o.t);
          return true;
        });
        setTags(`tags_para_${i}`, deduped, 0);
      });
    } else if (field === "all" && !Array.isArray(r)) {
      if (r.headlineOptions)
        setTags("tags_headline", [...new Set([cfg.cover.headline, ...r.headlineOptions])], cfg.cover.headline);
      if (r.titleOptions)
        setTags("tags_title", [...new Set([cfg.content.title, ...r.titleOptions])], cfg.content.title);
      if (r.subtitleOptions)
        setTags("tags_subtitle", [...new Set([cfg.content.subtitle, ...r.subtitleOptions])], cfg.content.subtitle);
      if (r.paragraphOptions) {
        r.paragraphOptions.forEach((po, i) => {
          if (!po?.options) return;
          const curT = document.getElementById(`f_para_${i}`)?.value || "";
          const curH = document.getElementById(`f_hl_${i}`)?.value || "";
          const opts = [{ t: curT, hl: curH }, ...po.options.map((o) => ({ t: o.text, hl: o.highlight }))];
          const seen = new Set();
          const deduped = opts.filter((o) => {
            if (seen.has(o.t)) return false;
            seen.add(o.t);
            return true;
          });
          setTags(`tags_para_${i}`, deduped, 0);
        });
      }
    }
    setStatus("点击标签选择", "done");
  } catch (e) {
    setStatus("AI 失败: " + e.message, "error");
  }
}
window.aiOptimize = aiOptimize;
