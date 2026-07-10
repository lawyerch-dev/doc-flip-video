import { api } from './api.mjs';
import { state, setStatus, goStep, toast } from './app.mjs';
import { readForm, populateForm } from './step2-edit.mjs';
import { loadHistory } from './history.mjs';

// ── Step 3: Preview ──
export async function doPreview() {
  state.config = readForm();
  if (!state.config) return setStatus('没有可预览的内容', 'error');
  setStatus('正在生成预览...', 'working');
  try {
    const r = await api('/api/preview', state.config);
    state.previewImages = r.images;
    state.config.meta.issueNumber = r.issueNum;
    const dir = `temp/issue-${String(r.issueNum).padStart(3,'0')}`;
    document.getElementById('animFrame').src = `/demo.html?img=${encodeURIComponent(dir)}&autoplay=1&embed=1`;
    state.dirty = false;
    setStatus('预览已生成', 'done');
  } catch(e) { setStatus('预览失败: '+e.message, 'error'); }
}

// ── Step 3: Preview tabs ──
export function switchTab(btn, key) {
  btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['Cover','Plain','Hl'].forEach(k => {
    document.getElementById('view'+k).style.display = k.toLowerCase()===key ? '' : 'none';
  });
}

// ── Chat ──
export async function doChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  addMsg(msg, 'user');
  state.chatHistory.push({ role:'user', content:msg });
  if (!state.config) { addMsg('请先完成前面的步骤。', 'ai'); return; }
  setStatus('AI 处理中...', 'working');
  const thinkingEl = addMsg('正在思考...', 'ai thinking');
  try {
    const refined = await api('/api/refine', { config: state.config, message:msg, history:state.chatHistory.slice(-6) });
    thinkingEl.remove();
    if (refined && refined.cover && refined.content) {
      state.config = { ...state.config, ...refined };
      populateForm();
      state.chatHistory.push({ role:'assistant', content:'已更新' });
      addMsg('已更新内容，正在刷新预览...', 'ai');
      state.dirty = true;
      toast('内容已更新', 'success');
      // Auto-preview
      doPreview();
    } else {
      addMsg('AI 返回的内容格式不正确，请重试或换种说法。', 'ai');
      setStatus('AI 返回格式错误', 'error');
    }
  } catch(e) {
    thinkingEl.remove();
    addMsg('出错: '+e.message, 'ai');
    setStatus('AI 处理失败', 'error');
  }
}

export function addMsg(text, role) {
  const c = document.getElementById('chatMessages');
  const d = document.createElement('div');
  d.className = 'chat-msg ' + role;
  d.textContent = text;
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
  return d;
}
