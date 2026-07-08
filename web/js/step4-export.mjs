import { api } from './api.mjs';
import { state, setStatus, goStep, toast } from './app.mjs';
import { populateForm, readForm } from './step2-edit.mjs';

// ── State ──
let currentVideoUrl = '';
let currentJobId = null;
let cancelBuildHandler = false;

// ── Step 4: Build ──
export async function doBuild() {
  state.config = readForm();
  if (!state.config) return setStatus('没有可生成的内容', 'error');
  goStep(4);

  const buildStatus = document.getElementById('buildStatus');
  const videoResult = document.getElementById('videoResult');
  const buildLog = document.getElementById('buildLog');
  const buildTimer = document.getElementById('buildTimer');
  const buildActions = document.getElementById('buildActions');

  buildStatus.style.display = '';
  videoResult.style.display = 'none';
  buildLog.textContent = '';
  buildTimer.textContent = '';
  if (buildActions) buildActions.style.display = '';
  setStatus('视频生成中...', 'working');

  cancelBuildHandler = false;
  currentJobId = null;
  const startTime = Date.now();
  const timerInterval = setInterval(() => {
    if (cancelBuildHandler) return;
    buildTimer.textContent = `已用时 ${Math.round((Date.now() - startTime) / 1000)}s`;
  }, 1000);

  try {
    // 1. POST /api/build to trigger the build
    const { jobId, issueNum } = await api('/api/build', state.config);
    currentJobId = jobId;
    buildLog.textContent += `任务已提交 (第 ${issueNum} 期)\n`;
    state.config.meta.issueNumber = issueNum;

    // 2. Poll GET /api/status every 2 seconds
    let pending = true;
    while (pending && !cancelBuildHandler) {
      await new Promise(r => setTimeout(r, 2000));
      if (cancelBuildHandler) break;

      const status = await api(`/api/status?issue=${issueNum}`);

      // Show progress if available
      if (status.progress) {
        const msg = status.progress.message || status.progress.phase || '';
        if (msg) {
          buildLog.textContent += `  ${msg}\n`;
          buildLog.scrollTop = buildLog.scrollHeight;
        }
        if (status.progress.percent != null) {
          setStatus(`视频生成中... ${status.progress.percent}%`, 'working');
        }
      }

      // Check if done
      if (status.ready) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        clearInterval(timerInterval);
        buildStatus.style.display = 'none';
        videoResult.style.display = '';
        const videoPlayer = document.getElementById('videoPlayer');
        videoPlayer.src = status.videoUrl;
        currentVideoUrl = status.videoUrl;
        setStatus(`视频已完成 (${elapsed}s)`, 'done');
        if (buildActions) buildActions.style.display = 'none';
        populatePublishInfo();
        pending = false;
      }
    }

    // Handle cancellation
    if (cancelBuildHandler) {
      clearInterval(timerInterval);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      buildLog.textContent += `\n已取消 (${elapsed}s)\n`;
      setStatus('已取消', 'error');
      if (buildActions) buildActions.style.display = 'none';
    }
  } catch(e) {
    clearInterval(timerInterval);
    if (buildActions) buildActions.style.display = 'none';
    if (cancelBuildHandler) {
      setStatus('已取消', 'error');
    } else {
      setStatus('生成失败: '+e.message, 'error');
    }
  }
}

export async function cancelBuild() {
  cancelBuildHandler = true;
  const jobId = currentJobId;
  try {
    await api('/api/build/cancel', { jobId });
  } catch (e) {
    // Still mark as cancelled even if cancel endpoint is not available
    console.warn('Cancel request failed:', e.message);
  }
}

export async function viewVideo(issueNum) {
  const padded = String(issueNum).padStart(3, '0');
  currentVideoUrl = `/output/法务视频-${padded}期.mp4`;
  // Load config so form and publish info work across steps
  try {
    const resp = await fetch(`/configs/article-${padded}.json`);
    if (resp.ok && (resp.headers.get('content-type')||'').includes('json')) {
      state.config = await resp.json();
    }
  } catch {}
  populateForm();
  goStep(4);
  document.getElementById('buildStatus').style.display = 'none';
  document.getElementById('buildLog').textContent = '';
  document.getElementById('buildTimer').textContent = '';
  document.getElementById('videoResult').style.display = '';
  document.getElementById('videoPlayer').src = currentVideoUrl;
  setStatus(`第 ${padded} 期视频`, 'done');
  populatePublishInfo();
}

export function doDownload() {
  if (!currentVideoUrl) return toast('没有可下载的视频', 'error');
  const a = document.createElement('a');
  a.href = currentVideoUrl;
  a.download = currentVideoUrl.split('/').pop();
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function doDownloadImages() {
  if (!state.config?.meta?.issueNumber) return toast('没有可下载的图片', 'error');
  const issueNum = state.config.meta.issueNumber;
  window.open(`/api/download-images/${issueNum}`, '_blank');
}

export function populatePublishInfo() {
  if (!state.config) return;
  const padded = String(state.config.meta?.issueNumber || 0).padStart(3, '0');
  const headline = state.config.cover?.headline || '';
  const title = `法务视频第${padded}期：${headline}`;
  const paras = (state.config.content?.paragraphs || []).map(p => p.text).filter(Boolean);
  const source = state.config.content?.source || '';
  const desc = `${headline}\n\n${paras.join('\n\n')}${source ? '\n\n' + source : ''}\n\n#法律 #普法 #法务视频`;
  document.getElementById('publishTitle').value = title;
  document.getElementById('publishDesc').value = desc;
}

export async function regeneratePublishInfo(btn) {
  if (!state.config) { toast('请先加载配置', 'error'); return; }
  btn.disabled = true; btn.textContent = '生成中...';
  try {
    const padded = String(state.config.meta?.issueNumber || 0).padStart(3, '0');
    const headline = state.config.cover?.headline || '';
    const paras = (state.config.content?.paragraphs || []).map(p => p.text).filter(Boolean);
    const source = state.config.content?.source || '';
    const articleText = `${headline}\n${paras.join('\n')}\n${source}`;
    const result = await api('/api/generate-publish-info', { articleText, issueNum: padded });
    if (result?.title) document.getElementById('publishTitle').value = result.title;
    if (result?.desc) document.getElementById('publishDesc').value = result.desc;
    toast('已重新生成', 'success');
  } catch(e) { toast('生成失败: '+e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = '重新生成'; }
}
