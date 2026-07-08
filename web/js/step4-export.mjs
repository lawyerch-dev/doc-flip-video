import { api } from './api.mjs';
import { state, setStatus, goStep, toast } from './app.mjs';
import { populateForm, readForm } from './step2-edit.mjs';

// ── State ──
let currentVideoUrl = '';

// ── Step 4: Build ──
export async function doBuild() {
  state.config = readForm();
  if (!state.config) return setStatus('没有可生成的内容', 'error');
  goStep(4);
  document.getElementById('buildStatus').style.display = '';
  document.getElementById('videoResult').style.display = 'none';
  document.getElementById('buildLog').textContent = '';
  document.getElementById('buildTimer').textContent = '';
  setStatus('视频生成中...', 'working');
  const startTime = Date.now();
  const timerInterval = setInterval(() => {
    document.getElementById('buildTimer').textContent = `已用时 ${Math.round((Date.now() - startTime) / 1000)}s`;
  }, 1000);

  try {
    const resp = await fetch('/api/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.config),
    });
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Process complete SSE messages (terminated by \n\n)
      while (buffer.includes('\n\n')) {
        const idx = buffer.indexOf('\n\n');
        const msg = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 2);
        if (!msg.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(msg.slice(6));
          if (data.type === 'log') {
            const logEl = document.getElementById('buildLog');
            logEl.textContent += data.text + '\n';
            logEl.scrollTop = logEl.scrollHeight;
          } else if (data.type === 'done') {
            clearInterval(timerInterval);
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            if (data.ready && data.videoUrl) {
              document.getElementById('buildStatus').style.display = 'none';
              document.getElementById('videoResult').style.display = '';
              document.getElementById('videoPlayer').src = data.videoUrl;
              currentVideoUrl = data.videoUrl;
              setStatus(`视频已完成 (${elapsed}s)`, 'done');
              populatePublishInfo();
            } else {
              setStatus(`生成失败 (${elapsed}s)`, 'error');
            }
          }
        } catch {}
      }
    }
  } catch(e) {
    clearInterval(timerInterval);
    setStatus('生成失败: '+e.message, 'error');
  }
}

export async function viewVideo(issueNum) {
  const padded = String(issueNum).padStart(3, '0');
  currentVideoUrl = `/output/法务视频-${padded}期.mp4`;
  // Load config so form and publish info work across steps
  try {
    const resp = await fetch(`/configs/article-${padded}.json`);
    if (resp.ok) state.config = await resp.json();
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
  btn.disabled = true; btn.textContent = '⏳ 生成中...';
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
  finally { btn.disabled = false; btn.textContent = '🔄 重新生成'; }
}
