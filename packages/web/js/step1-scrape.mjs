import { api } from './api.mjs';
import { state, setStatus, goStep, toast } from './app.mjs';
import { populateForm } from './step2-edit.mjs';
import { loadHistory } from './history.mjs';

// ── Core scrape: calls unified /api/scrape, auto-handles article vs list ──

export async function doScrape(url) {
  url = url || document.getElementById('urlInput').value.trim();
  if (!url) return alert('请输入链接');
  document.getElementById('scrapeBtn').disabled = true;
  setStatus('正在抓取...', 'working');
  hideScrapedBox();
  hideArticleList();
  try {
    const result = await api('/api/scrape', { url });
    if (result.type === 'list') {
      // It's a list page — show article picks
      showArticleList(result.articles || []);
      document.getElementById('urlInput').value = url;
      setStatus(`已找到 ${result.total || 0} 篇文章，点击即可抓取`, 'done');
    } else {
      // It's an article — populate directly
      showScrapedResult(result);
      document.getElementById('urlInput').value = url;
      setStatus('抓取成功，请确认内容', 'done');
    }
  } catch (e) {
    setStatus('抓取失败: ' + e.message, 'error');
    state.scrapedData = null;
  } finally {
    document.getElementById('scrapeBtn').disabled = false;
  }
}

// ── Render article list (when a list page is detected) ──

function showArticleList(articles) {
  const container = document.getElementById('articleList');
  const box = document.getElementById('articleListBox');
  const loadingEl = document.getElementById('articleListLoading');
  if (loadingEl) loadingEl.style.display = 'none';
  if (!articles.length) {
    container.innerHTML = '<div class="article-list-empty">未找到文章链接</div>';
    container.style.display = '';
    box.style.display = '';
    return;
  }
  renderArticleList(articles, container);
  container.style.display = '';
  box.style.display = '';
}

function hideArticleList() {
  document.getElementById('articleListBox').style.display = 'none';
  document.getElementById('articleList').innerHTML = '';
}

function hideScrapedBox() {
  document.getElementById('scrapedBox').style.display = 'none';
  document.getElementById('panel1Actions').style.display = 'none';
}

function showScrapedResult(data) {
  state.scrapedData = data;
  document.getElementById('scrapedTitle').textContent = data.title || '(无标题)';
  document.getElementById('scrapedText').value = data.text || '';
  document.getElementById('scrapedBox').style.display = '';
  document.getElementById('panel1Actions').style.display = '';
  hideArticleList();
}

// ── Quick scrape from article list item ──

export async function quickScrape(btn) {
  const item = btn.closest('.article-item');
  const url = item.dataset.url;
  if (!url) return;
  btn.disabled = true;
  btn.textContent = '抓取中...';
  setStatus('正在抓取文章...', 'working');
  try {
    const result = await api('/api/scrape', { url });
    if (result.type === 'article') {
      showScrapedResult(result);
      document.getElementById('urlInput').value = url;
      setStatus('抓取成功，请确认内容', 'done');
      document.getElementById('scrapedBox').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      // Unexpected — shouldn't happen for an article detail URL
      setStatus('未能识别为文章页', 'error');
    }
  } catch (e) {
    setStatus('抓取失败: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '抓取';
  }
}

// ── AI generate from scraped content ──

export async function doAiGenerate() {
  if (!state.scrapedData?.text) return alert('没有可处理的内容');
  const btn = document.querySelector('#panel1Actions .btn:not(.secondary)');
  document.getElementById('aiGenSpinner').style.display = '';
  if (btn) btn.disabled = true;
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
    if (btn) btn.disabled = false;
  }
}

export async function doRegenerate() {
  if (!state.scrapedData?.text) return alert('没有原始内容，请先抓取文章');
  if (!confirm('重新生成将覆盖当前所有编辑内容，确定继续？')) return;
  const btn = document.getElementById('regenBtn');
  btn.disabled = true;
  btn.textContent = '生成中...';
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
    btn.textContent = '重新生成';
  }
}

export function resetScrape() {
  state.scrapedData = null;
  hideScrapedBox();
  hideArticleList();
  setStatus('就绪', 'idle');
}

export function pasteManual() {
  state.scrapedData = { text: '', title: '', source: '', date: '' };
  document.getElementById('scrapedTitle').textContent = '手动输入';
  document.getElementById('scrapedText').value = '';
  document.getElementById('scrapedText').removeAttribute('readonly');
  document.getElementById('scrapedBox').style.display = '';
  document.getElementById('panel1Actions').style.display = '';
  hideArticleList();
  setStatus('手动输入模式', 'idle');
}

export function loadExample() {
  document.getElementById('urlInput').value =
    'https://www.chinacourt.cn/article/detail/2026/04/id/9293429.shtml';
  document.getElementById('urlInput').focus();
}

// ── Default article list with localStorage cache ──

const DEFAULT_SOURCE = 'https://www.chinacourt.cn/article/index/id/MzAwNDAwNTBIApMEAAA.shtml';
const CACHE_KEY = 'articleListCache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function loadDefaultArticleList() {
  const listEl = document.getElementById('articleList');
  const loadingEl = document.getElementById('articleListLoading');
  const boxEl = document.getElementById('articleListBox');

  // 1. Try cache first
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.articles?.length) {
      renderArticleList(cached.articles, listEl);
      loadingEl.style.display = 'none';
      listEl.style.display = '';
      boxEl.style.display = '';
      // Background refresh (don't await)
      refreshArticleListCache(listEl, loadingEl);
      return;
    }
  } catch {}

  // 2. No cache — fetch from server
  try {
    const result = await api('/api/scrape', { url: DEFAULT_SOURCE });
    const articles = result.type === 'list' ? result.articles : [];
    if (articles.length) {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ articles, timestamp: Date.now() }));
      renderArticleList(articles, listEl);
      loadingEl.style.display = 'none';
      listEl.style.display = '';
    } else {
      loadingEl.textContent = '未找到文章';
    }
  } catch (e) {
    loadingEl.textContent = '加载失败: ' + e.message;
    loadingEl.style.color = 'var(--error)';
  }
}

async function refreshArticleListCache(listEl, loadingEl) {
  try {
    const result = await api('/api/scrape', { url: DEFAULT_SOURCE });
    const articles = result.type === 'list' ? result.articles : [];
    if (articles.length) {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ articles, timestamp: Date.now() }));
      // Only update DOM if still showing default list (user hasn't scraped)
      if (listEl.style.display !== 'none' && !document.getElementById('scrapedBox').style.display) {
        renderArticleList(articles, listEl);
      }
    }
  } catch {}
}

function renderArticleList(articles, container) {
  container = container || document.getElementById('articleList');
  container.innerHTML = articles.map((a, i) => `
    <div class="article-item" data-url="${escapeAttr(a.url)}">
      <div class="article-item-body">
        <span class="article-item-num">${i + 1}</span>
        <span class="article-item-title">${escapeHtml(a.title)}</span>
      </div>
      <button class="btn small article-scrape-btn" onclick="quickScrape(this)">抓取</button>
    </div>
  `).join('');
}

// ── Helpers ──

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
