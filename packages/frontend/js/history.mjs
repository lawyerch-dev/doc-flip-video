import { api } from "./api.mjs";
import { state, setStatus, goStep, toast } from "./app.mjs";
import { populateForm } from "./step2-edit.mjs";
import { viewVideo } from "./step4-export.mjs";

// ── Multi-select state ──
let selectMode = false;
const selected = new Set();

export function toggleSelectMode() {
  selectMode = !selectMode;
  if (!selectMode) selected.clear();
  const btn = document.getElementById("selectModeBtn");
  if (btn) btn.style.color = selectMode ? "var(--accent)" : "";
  loadHistory();
}
window.toggleSelectMode = toggleSelectMode;

export function toggleItemCheck(issueNum) {
  if (selected.has(issueNum)) selected.delete(issueNum);
  else selected.add(issueNum);
  updateMultiBar();
  // Update item highlight
  const el = document.querySelector(`.history-item[data-issue='${issueNum}']`);
  if (el) el.classList.toggle("selected", selected.has(issueNum));
}
window.toggleItemCheck = toggleItemCheck;

export function toggleSelectAll() {
  const container = document.getElementById("historyList");
  if (!container) return;
  const checkboxes = container.querySelectorAll(".history-check");
  const allChecked = checkboxes.length > 0 && [...checkboxes].every((cb) => cb.checked);
  checkboxes.forEach((cb) => {
    const num = Number(cb.dataset.issue);
    cb.checked = !allChecked;
    if (allChecked) selected.delete(num);
    else selected.add(num);
    const item = cb.closest(".history-item");
    if (item) item.classList.toggle("selected", !allChecked);
  });
  updateMultiBar();
}
window.toggleSelectAll = toggleSelectAll;

function updateMultiBar() {
  const count = document.getElementById("multiCount");
  const delBtn = document.getElementById("multiDelBtn");
  if (count) count.textContent = selected.size > 0 ? `已选 ${selected.size} 项` : "";
  if (delBtn) delBtn.disabled = selected.size === 0;
}

export async function batchDeleteSelected() {
  if (selected.size === 0) return;
  const count = selected.size;
  if (!confirm(`确定删除选中的 ${count} 个项目？`)) return;
  const nums = [...selected];
  try {
    await Promise.all(nums.map((n) => fetch(`/api/configs/${n}`, { method: "DELETE" })));
    toast(`已删除 ${count} 个项目`, "success");
    selected.clear();
    selectMode = false;
    const btn = document.getElementById("selectModeBtn");
    if (btn) btn.style.color = "";
    loadHistory();
  } catch (e) {
    toast("批量删除失败: " + e.message, "error");
  }
}
window.batchDeleteSelected = batchDeleteSelected;

// ── Sidebar Resize ──
export function initSidebarResize() {
  const sidebar = document.getElementById("sidebar");
  const handle = document.getElementById("sidebarResize");
  if (!sidebar || !handle) return;

  // Restore saved width
  const savedW = localStorage.getItem("sidebar-width");
  if (savedW) sidebar.style.width = savedW + "px";

  let dragging = false;
  let startX = 0;
  let startW = 0;

  const onPointerDown = (e) => {
    if (sidebar.classList.contains("collapsed")) return;
    dragging = true;
    startX = e.clientX;
    startW = sidebar.offsetWidth;
    handle.classList.add("active");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const newW = Math.max(180, Math.min(500, startW + dx));
    sidebar.style.width = newW + "px";
  };

  const onPointerUp = () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove("active");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    localStorage.setItem("sidebar-width", sidebar.offsetWidth);
  };

  handle.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
}

// ── History (localStorage) ──
const HISTORY_KEY = "doc-flip-projects";

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveToHistory(config) {
  if (!config?.meta?.issueNumber) return;
  const list = getHistory();
  const entry = {
    issueNum: config.meta.issueNumber,
    headline: config.cover?.headline || "",
    date: `${config.meta.year}-${String(config.meta.month).padStart(2, "0")}-${String(config.meta.day).padStart(2, "0")}`,
    config: config,
    scrapedData: state.scrapedData,
    timestamp: Date.now(),
  };
  const idx = list.findIndex((e) => e.issueNum === entry.issueNum);
  if (idx >= 0) list[idx] = entry;
  else list.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 20)));
}

export function loadFromHistory(issueNum) {
  const list = getHistory();
  const entry = list.find((e) => e.issueNum === issueNum);
  if (entry) {
    state.config = entry.config;
    // Restore original article text (if saved)
    state.scrapedData = entry.scrapedData || { text: "", title: entry.headline, source: "", date: entry.date };
    populateForm();
    toast(`已加载第 ${issueNum} 期`, "success");
    goStep(2);
  }
}
window.loadFromHistory = loadFromHistory;

export function deleteFromHistory(issueNum) {
  const list = getHistory().filter((e) => e.issueNum !== issueNum);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  renderHistory();
}
window.deleteFromHistory = deleteFromHistory;

export function renderHistory() {
  const list = getHistory();
  const container = document.getElementById("historyList");
  if (!container) return;
  if (list.length === 0) {
    container.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0">暂无历史记录</div>';
    return;
  }
  container.innerHTML = list
    .map(
      (e) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="background:var(--red);color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;white-space:nowrap">第${String(e.issueNum).padStart(3, "0")}期</span>
      <span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.headline}</span>
      <span style="font-size:11px;color:var(--muted);white-space:nowrap">${e.date}</span>
      <button class="btn small secondary" onclick="loadFromHistory(${e.issueNum})">编辑</button>
      <button class="btn small secondary" onclick="deleteFromHistory(${e.issueNum})" style="color:var(--red)">✕</button>
    </div>
  `,
    )
    .join("");
}

// ── Settings ──
export function toggleSettings() {
  const panel = document.getElementById("settingsPanel");
  const overlay = document.getElementById("settingsOverlay");
  const isOpen = panel.classList.toggle("open");
  overlay.classList.toggle("show", isOpen);
}
window.toggleSettings = toggleSettings;

export function switchSettingsTab(tab) {
  document.querySelectorAll(".settings-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  document.getElementById("settingsTabBasic").style.display = tab === "basic" ? "" : "none";
  document.getElementById("settingsTabPrompts").style.display = tab === "prompts" ? "" : "none";
}
window.switchSettingsTab = switchSettingsTab;

export async function loadSettingsUI() {
  try {
    const s = await api("/api/settings");
    document.getElementById("s_baseUrl").value = s.aiBaseUrl || "";
    document.getElementById("s_model").value = s.aiModel || "";
    document.getElementById("s_temperature").value = s.aiTemperature ?? 0.3;
    document.getElementById("s_description").value = s.defaultDescription || "";
    document.getElementById("s_defaultSource").value = s.defaultSource || "";
    document.getElementById("s_enableScoring").checked = !!s.enableScoring;
    document.getElementById("s_scoringPrompt").value = s.scoringPrompt || "";
    document.getElementById("s_headlinePrompt").value = s.headlinePrompt || "";
    document.getElementById("s_contentPrompt").value = s.contentPrompt || "";
    document.getElementById("s_publishPrompt").value = s.publishPrompt || "";
    if (s.aiKeyMasked) {
      document.getElementById("s_apiKey").value = s.aiKeyMasked;
      document.getElementById("s_apiKey").dataset.masked = "1";
    }
    const el = document.getElementById("aiStatus");
    el.textContent = s.aiConfigured ? "AI: 已配置" : "AI: 未配置";
    el.className = "ai-badge " + (s.aiConfigured ? "ok" : "err");
  } catch (e) {
    console.error("loadSettingsUI failed:", e);
  }
}

export async function saveSettingsUI() {
  const up = {
    aiBaseUrl: document.getElementById("s_baseUrl").value.trim(),
    aiModel: document.getElementById("s_model").value.trim(),
    aiTemperature: parseFloat(document.getElementById("s_temperature").value) || 0.3,
    defaultDescription: document.getElementById("s_description").value.trim(),
    defaultSource: document.getElementById("s_defaultSource").value.trim(),
    enableScoring: document.getElementById("s_enableScoring").checked,
    scoringPrompt: document.getElementById("s_scoringPrompt").value.trim(),
    headlinePrompt: document.getElementById("s_headlinePrompt").value.trim(),
    contentPrompt: document.getElementById("s_contentPrompt").value.trim(),
    publishPrompt: document.getElementById("s_publishPrompt").value.trim(),
  };
  const keyInput = document.getElementById("s_apiKey");
  const key = keyInput.value.trim();
  if (key && keyInput.dataset.masked !== "1") up.aiApiKey = key;
  keyInput.dataset.masked = "";
  try {
    const s = await api("/api/settings", up);
    document.getElementById("s_apiKey").value = "";
    document.getElementById("settingsStatus").textContent = "✓ 已保存";
    const unsavedEl = document.getElementById("settingsUnsaved");
    if (unsavedEl) unsavedEl.style.display = "none";
    const el = document.getElementById("aiStatus");
    el.textContent = s.aiConfigured ? "AI: 已配置" : "AI: 未配置";
    el.className = "ai-badge " + (s.aiConfigured ? "ok" : "err");
    setTimeout(() => (document.getElementById("settingsStatus").textContent = ""), 3000);
  } catch (e) {
    document.getElementById("settingsStatus").textContent = "✗ " + e.message;
  }
}
window.saveSettings = saveSettingsUI;

export function markSettingsDirty() {
  const el = document.getElementById("settingsUnsaved");
  if (el) el.style.display = "";
}
window.markSettingsDirty = markSettingsDirty;

export function toggleKeyVis() {
  const inp = document.getElementById("s_apiKey");
  const btn = document.getElementById("keyToggleBtn");
  if (inp.type === "password") {
    inp.type = "text";
    btn.textContent = "隐藏";
  } else {
    inp.type = "password";
    btn.textContent = "显示";
  }
}
window.toggleKeyVis = toggleKeyVis;

// ── Server-side history ──
export async function loadHistory() {
  try {
    const list = await api("/api/configs");
    const container = document.getElementById("historyList");
    if (!list.length) {
      container.innerHTML = '<div class="history-empty">暂无历史记录</div>';
      return;
    }
    // Multi-select toolbar
    let html = "";
    if (selectMode) {
      html += `
        <div class="multi-bar">
          <label><input type="checkbox" id="selectAllCheck" onchange="toggleSelectAll()" /> 全选</label>
          <span class="multi-count" id="multiCount"></span>
          <button class="btn small secondary" id="multiDelBtn" onclick="batchDeleteSelected()" disabled style="color:var(--error)">批量删除</button>
        </div>`;
    }
    html += list
      .map(
        (e) => `
      <div class="history-item${selected.has(e.issueNum) ? " selected" : ""}" data-issue="${e.issueNum}">
        <div class="history-item-top">
          ${selectMode ? `<input type="checkbox" class="history-check" data-issue="${e.issueNum}" ${selected.has(e.issueNum) ? "checked" : ""} onchange="toggleItemCheck(${e.issueNum})" />` : ""}
          <span class="history-badge">${String(e.issueNum).padStart(3, "0")}</span>
          ${e.videoReady ? '<span class="history-badge history-badge-ready"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></span>' : ""}
          <span class="history-headline" title="${e.headline}">${e.headline}</span>
        </div>
        <div class="history-item-bottom">
          <span class="history-date">${e.date}</span>
          <div class="history-actions">
            ${e.videoReady ? `<button class="history-btn history-btn-ready" onclick="viewVideo(${e.issueNum})">播放</button>` : ""}
            <button class="history-btn" onclick="editConfig(${e.issueNum})">编辑</button>
            <button class="history-btn history-btn-danger" onclick="deleteConfig(${e.issueNum})">删除</button>
          </div>
        </div>
      </div>
    `,
      )
      .join("");
    container.innerHTML = html;
    updateMultiBar();
  } catch {}
}

export async function editConfig(issueNum) {
  try {
    const padded = String(issueNum).padStart(3, "0");
    const resp = await fetch(`/data/articles/article-${padded}.json`);
    if (!resp.ok) throw new Error(`配置文件不存在 (HTTP ${resp.status})`);
    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("json")) throw new Error("配置文件不存在，返回了非 JSON 内容");
    const cfg = await resp.json();
    // Extract original article text from saved _scraped metadata
    state.scrapedData = cfg._scraped || { text: "", title: cfg.cover?.headline || "", source: "", date: "" };
    delete cfg._scraped;
    state.config = cfg;
    state.previewImages = {
      cover: `data/temp/issue-${padded}/cover.png`,
      plain: `data/temp/issue-${padded}/content-plain.png`,
      hl: `data/temp/issue-${padded}/content-hl.png`,
    };
    populateForm();
    toast(`已加载第 ${issueNum} 期`, "success");
    goStep(2);
  } catch (e) {
    toast("加载失败: " + e.message, "error");
  }
}
window.editConfig = editConfig;

export async function deleteConfig(issueNum) {
  if (!confirm(`确定删除第 ${String(issueNum).padStart(3, "0")} 期？`)) return;
  try {
    const r = await fetch(`/api/configs/${issueNum}`, { method: "DELETE" });
    if (!r.ok) throw new Error("删除失败");
    toast(`已删除第 ${issueNum} 期`, "success");
    loadHistory();
  } catch (e) {
    toast("删除失败: " + e.message, "error");
  }
}
window.deleteConfig = deleteConfig;
