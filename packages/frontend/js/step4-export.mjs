import { api } from "./api.mjs";
import { state, setStatus, goStep, toast } from "./app.mjs";
import { populateForm, readForm } from "./step2-edit.mjs";

let currentJobId = null;
let cancelBuildHandler = false;

// ── Step 4: Build ──
export async function doBuild() {
  state.config = readForm();
  if (!state.config) return setStatus("没有可生成的内容", "error");
  goStep(4);
  state._autoDetectVideo = false;

  const buildLog = document.getElementById("buildLog");
  const buildTimer = document.getElementById("buildTimer");
  const buildActions = document.getElementById("buildActions");

  // Reset to build UI
  document.getElementById("buildStatus").style.display = "";
  document.getElementById("videoResult").style.display = "none";
  document.getElementById("panel4Actions").style.display = "none";
  buildLog.textContent = "";
  buildTimer.textContent = "";
  // Restore spinner and cancel button (may have been hidden by showNoVideo)
  document.getElementById("buildSpinner").style.display = "";
  document.getElementById("cancelBuildBtn").style.display = "";
  if (buildActions) buildActions.style.display = "";
  setStatus("视频生成中...", "working");

  cancelBuildHandler = false;
  currentJobId = null;
  const startTime = Date.now();
  const timerInterval = setInterval(() => {
    if (cancelBuildHandler) return;
    buildTimer.textContent = `已用时 ${Math.round((Date.now() - startTime) / 1000)}s`;
  }, 1000);

  try {
    const { jobId, issueNum } = await api("/api/build", state.config);
    currentJobId = jobId;
    buildLog.textContent += `任务已提交 (第 ${issueNum} 期)\n`;
    state.config.meta.issueNumber = issueNum;

    let pending = true;
    let shownCount = 0;
    while (pending && !cancelBuildHandler) {
      await new Promise((r) => setTimeout(r, 2000));
      if (cancelBuildHandler) break;

      const status = await api(`/api/status?issue=${issueNum}`);
      const qj = status.queueJob;
      if (qj?.progress?.length > shownCount) {
        for (let i = shownCount; i < qj.progress.length; i++) {
          buildLog.textContent += `  ${qj.progress[i]}\n`;
        }
        shownCount = qj.progress.length;
        buildLog.scrollTop = buildLog.scrollHeight;
      }

      if (qj?.status === "failed") {
        clearInterval(timerInterval);
        if (buildActions) buildActions.style.display = "none";
        setStatus(`生成失败: ${qj.error || "未知错误"}`, "error");
        pending = false;
      }

      if (status.ready && (!status.queueJob || status.queueJob.status === "done")) {
        clearInterval(timerInterval);
        const padded = String(status.issueNum || issueNum).padStart(3, "0");
        // Set videoPlayer.src — this IS the state
        const vp = document.getElementById("videoPlayer");
        vp.src = status.videoUrl;
        vp.poster = `/data/output/${encodeURIComponent(`法务视频-${padded}期-poster.png`)}`;
        // Show video result
        document.getElementById("buildStatus").style.display = "none";
        document.getElementById("videoResult").style.display = "";
        document.getElementById("panel4Actions").style.display = "";
        if (buildActions) buildActions.style.display = "none";
        setStatus(`视频已完成 (${Math.round((Date.now() - startTime) / 1000)}s)`, "done");
        regeneratePublishInfo(null);
        pending = false;
      }
    }

    if (cancelBuildHandler) {
      clearInterval(timerInterval);
      buildLog.textContent += `\n已取消\n`;
      setStatus("已取消", "error");
      if (buildActions) buildActions.style.display = "none";
    }
  } catch (e) {
    clearInterval(timerInterval);
    if (buildActions) buildActions.style.display = "none";
    setStatus(cancelBuildHandler ? "已取消" : "生成失败: " + e.message, "error");
  }
}

export async function cancelBuild() {
  cancelBuildHandler = true;
  try {
    await api("/api/build/cancel", { jobId: currentJobId });
  } catch (e) {
    console.warn("Cancel failed:", e.message);
  }
}

// ── View existing video from history ──
export async function viewVideo(issueNum) {
  const padded = String(issueNum).padStart(3, "0");
  const videoUrl = `/data/output/${encodeURIComponent(`法务视频-${padded}期.mp4`)}`;

  // Load config + set scrapedData so step 1/2 gating passes
  state.scrapedData = { text: "", title: `第 ${padded} 期`, source: "", date: "" };
  try {
    const resp = await fetch(`/data/articles/article-${padded}.json`);
    if (resp.ok && (resp.headers.get("content-type") || "").includes("json")) {
      state.config = await resp.json();
      populateForm();
    }
  } catch {}

  state.previewImages = {
    cover: `data/temp/issue-${padded}/cover.png`,
    plain: `data/temp/issue-${padded}/content-plain.png`,
    hl: `data/temp/issue-${padded}/content-hl.png`,
  };

  // Set videoPlayer.src — goStep(4) reads this
  const vp = document.getElementById("videoPlayer");
  vp.src = videoUrl;
  vp.poster = `/data/output/${encodeURIComponent(`法务视频-${padded}期-poster.png`)}`;

  goStep(4);
  setStatus(`第 ${padded} 期视频`, "done");
  populatePublishInfo();
}

// ── Download ──
export function doDownload() {
  const src = document.getElementById("videoPlayer")?.src;
  if (!src || src.includes("about:blank")) return toast("没有可下载的视频", "error");
  const a = document.createElement("a");
  a.href = src;
  a.download = decodeURIComponent(src.split("/").pop());
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function doDownloadImages() {
  if (!state.config?.meta?.issueNumber) return toast("没有可下载的图片", "error");
  window.open(`/api/download-images/${state.config.meta.issueNumber}`, "_blank");
}

// ── Publish info ──
export function populatePublishInfo() {
  if (!state.config) return;
  const padded = String(state.config.meta?.issueNumber || 0).padStart(3, "0");
  const headline = state.config.cover?.headline || "";
  const title = `法务视频第${padded}期：${headline}`;
  const paras = (state.config.content?.paragraphs || []).map((p) => p.text).filter(Boolean);
  const source = state.config.content?.source || "";
  document.getElementById("publishTitle").value = title;
  document.getElementById("publishDesc").value =
    `${headline}\n\n${paras.join("\n\n")}${source ? "\n\n" + source : ""}\n\n#法律 #普法 #法务视频`;
}

export async function regeneratePublishInfo(btn) {
  if (!state.config) {
    toast("请先加载配置", "error");
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = "生成中...";
  }
  try {
    const padded = String(state.config.meta?.issueNumber || 0).padStart(3, "0");
    const headline = state.config.cover?.headline || "";
    const paras = (state.config.content?.paragraphs || []).map((p) => p.text).filter(Boolean);
    const source = state.config.content?.source || "";
    const result = await api("/api/generate-publish-info", {
      articleText: `${headline}\n${paras.join("\n")}\n${source}`,
      issueNum: padded,
    });
    if (result?.title) document.getElementById("publishTitle").value = result.title;
    if (result?.desc) {
      // Ensure blank line before tags
      let desc = result.desc;
      const tagIdx = desc.indexOf("#");
      if (tagIdx > 0) {
        const before = desc.substring(0, tagIdx).replace(/\n+$/, "");
        desc = before + "\n\n" + desc.substring(tagIdx);
      }
      document.getElementById("publishDesc").value = desc;
    }
    toast("已重新生成", "success");
  } catch (e) {
    toast("生成失败: " + e.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "重新生成";
    }
  }
}
