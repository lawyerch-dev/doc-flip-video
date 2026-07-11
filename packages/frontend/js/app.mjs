// ── Shared State ──
export const state = {
  config: null,
  scrapedData: null,
  previewImages: {},
  chatHistory: [],
  dirty: false,
  currentStep: 1,
};

// ── Status ──
export function setStatus(text, cls) {
  document.getElementById("statusText").textContent = text;
  document.getElementById("statusDot").className = "dot " + (cls || "idle");
}

export function toast(msg, type) {
  type = type || "info";
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ── Character count ──
export function updateCC(input, limit) {
  const el = document.getElementById("cc_" + input.id.replace("f_", ""));
  if (!el) return;
  const n = input.value.length;
  el.textContent = n + "/" + limit;
  el.className = "char-count" + (n > limit ? " over" : "");
}

// ── Stepper ──
export function isStepReady(n) {
  if (n === 1) return !!state.scrapedData;
  if (n === 2) return !!state.config;
  if (n === 3) return !!state.config;
  if (n === 4) {
    const vp = document.getElementById("videoPlayer");
    return !!(vp?.src && !vp.src.includes("about:blank") && vp.src !== location.href);
  }
  return false;
}

export function goStep(n) {
  // Going forward: previous step must be ready
  if (n > 1 && !isStepReady(n - 1)) {
    return toast(`请先完成步骤 ${n - 1}`, "error");
  }

  document.querySelectorAll(".step-item").forEach((el) => {
    const s = parseInt(el.dataset.step);
    el.classList.remove("active", "done");
    if (s < n && isStepReady(s)) el.classList.add("done");
    if (s === n) el.classList.add("active");
  });
  document.querySelectorAll(".step-panel").forEach((p, i) => {
    p.classList.toggle("active", i + 1 === n);
  });
  state.currentStep = n;
  window.dispatchEvent(new CustomEvent("stepchange", { detail: { step: n } }));

  // Step 3: auto-preview
  if (n === 3 && state.config) {
    setTimeout(() => {
      if (state.previewImages.cover && !state.dirty) {
        const issueNum = state.config.meta?.issueNumber;
        if (issueNum) {
          const dir = `data/temp/issue-${String(issueNum).padStart(3, "0")}`;
          const tm = state.config.timing || {};
          const qs = new URLSearchParams({
            img: dir,
            w: 1080,
            h: 1840,
            settle: tm.settle || 1.2,
            cover: tm.cover || 2,
            curl: tm.curl || 2.5,
            sweep: tm.sweep || 2,
            hold: tm.hold || 1,
            final: tm.final || 2,
            autoplay: 1,
            loop: 1,
            embed: 1,
            t: Date.now(),
          });
          document.getElementById("animFrame").src = `/preview.html?${qs}`;
        }
      } else if (typeof doPreview === "function") {
        doPreview();
      }
    }, 100);
  }

  // Step 4: show video or build UI
  if (n === 4) {
    state._autoDetectVideo = true;

    const showVideo = (url, poster, padded) => {
      const vp = document.getElementById("videoPlayer");
      vp.src = url;
      if (poster) vp.poster = poster;
      document.getElementById("buildStatus").style.display = "none";
      document.getElementById("videoResult").style.display = "";
      document.getElementById("panel4Actions").style.display = "";
      setStatus(`第 ${padded} 期视频`, "done");
      window.populatePublishInfo?.();
    };

    const showNoVideo = (msg) => {
      if (!state._autoDetectVideo) return;
      document.getElementById("buildStatus").style.display = "";
      document.getElementById("buildTimer").textContent = msg;
      document.getElementById("buildLog").textContent = "";
      // Hide spinner + cancel button — nothing is building
      document.getElementById("buildSpinner").style.display = "none";
      document.getElementById("buildActions").style.display = "none";
      document.getElementById("cancelBuildBtn").style.display = "none";
      document.getElementById("videoResult").style.display = "none";
      document.getElementById("panel4Actions").style.display = "none";
    };

    if (isStepReady(4)) {
      state._autoDetectVideo = false;
      showVideo(document.getElementById("videoPlayer").src);
    } else if (state.config?.meta?.issueNumber) {
      const padded = String(state.config.meta.issueNumber).padStart(3, "0");
      const videoUrl = `/data/output/法务视频-${padded}期.mp4`;
      const posterUrl = `/data/output/法务视频-${padded}期-poster.png`;
      fetch(videoUrl, { method: "HEAD" })
        .then((r) => {
          if (!state._autoDetectVideo) return;
          state._autoDetectVideo = false;
          if (r.ok) {
            showVideo(videoUrl, posterUrl, padded);
          } else {
            showNoVideo("无视频文件，请重新生成");
          }
        })
        .catch(() => {
          if (!state._autoDetectVideo) return;
          state._autoDetectVideo = false;
          showNoVideo("无视频文件，请重新生成");
        });
    } else {
      state._autoDetectVideo = false;
      showNoVideo("请先生成视频");
    }
  }
}

// ── Theme ──
export function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute("data-theme") || "light";
  const next = current === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
}

// ── Modal ──
export function showModal(src) {
  const overlay = document.getElementById("modal");
  document.getElementById("modalImg").src = src;
  overlay.classList.add("show");
}

// ── Clipboard ──
export function copyText(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.value || el.textContent).then(() => toast("已复制", "success"));
}
