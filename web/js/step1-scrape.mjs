import { api } from './api.mjs';
import { state, setStatus, goStep, toast } from './app.mjs';
import { populateForm } from './step2-edit.mjs';
import { loadHistory } from './history.mjs';

// ── Step 1: Scrape ──

export async function doScrape() {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) return alert('请输入链接');
  document.getElementById('scrapeBtn').disabled = true;
  setStatus('正在抓取文章...', 'working');
  document.getElementById('scrapedBox').style.display = 'none';
  try {
    state.scrapedData = await api('/api/scrape', { url });
    document.getElementById('scrapedTitle').textContent = state.scrapedData.title || '(无标题)';
    document.getElementById('scrapedText').value = state.scrapedData.text || '';
    document.getElementById('scrapedBox').style.display = '';
    setStatus('抓取成功，请确认内容', 'done');
  } catch (e) {
    setStatus('抓取失败: ' + e.message, 'error');
    state.scrapedData = null;
  } finally {
    document.getElementById('scrapeBtn').disabled = false;
  }
}

export async function doAiGenerate() {
  if (!state.scrapedData?.text) return alert('没有可处理的内容');
  const btn = document.querySelector('#scrapedBox .btn');
  document.getElementById('aiGenSpinner').style.display = '';
  btn.disabled = true;
  setStatus('AI 正在生成内容...', 'working');
  try {
    state.config = await api('/api/generate-config', {
      text: state.scrapedData.text,
      sourceInfo: state.scrapedData.source || state.scrapedData.date || '',
    });
    populateForm();
    setStatus('内容已生成', 'done');
    goStep(2);
  } catch (e) {
    setStatus('AI 生成失败: ' + e.message, 'error');
  } finally {
    document.getElementById('aiGenSpinner').style.display = 'none';
    btn.disabled = false;
  }
}

export async function doRegenerate() {
  if (!state.scrapedData?.text) return alert('没有原始内容，请先抓取文章');
  if (!confirm('重新生成将覆盖当前所有编辑内容，确定继续？')) return;
  const btn = document.getElementById('regenBtn');
  btn.disabled = true;
  btn.textContent = '⏳ 生成中...';
  setStatus('AI 正在重新生成内容...', 'working');
  try {
    state.config = await api('/api/generate-config', {
      text: state.scrapedData.text,
      sourceInfo: state.scrapedData.source || state.scrapedData.date || '',
    });
    populateForm();
    setStatus('内容已重新生成', 'done');
    toast('内容已重新生成', 'success');
  } catch (e) {
    setStatus('重新生成失败: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 重新生成';
  }
}

export function resetScrape() {
  state.scrapedData = null;
  document.getElementById('scrapedBox').style.display = 'none';
  setStatus('就绪', 'idle');
}

export function pasteManual() {
  state.scrapedData = { text: '', title: '', source: '', date: '' };
  document.getElementById('scrapedTitle').textContent = '手动输入';
  document.getElementById('scrapedText').value = '';
  document.getElementById('scrapedText').removeAttribute('readonly');
  document.getElementById('scrapedBox').style.display = '';
  setStatus('手动输入模式', 'idle');
}

export function loadExample() {
  document.getElementById('urlInput').value =
    'https://www.chinacourt.cn/article/detail/2026/04/id/9293429.shtml';
  document.getElementById('urlInput').focus();
}
