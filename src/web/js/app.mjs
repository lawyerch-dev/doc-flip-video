// ── Shared State ──
export const state = {
  config: null,
  scrapedData: null,
  previewImages: {},
  chatHistory: [],
  dirty: false,
  polling: null,
  currentStep: 1,
  currentVideoUrl: '',
};

// ── Status ──
export function setStatus(text, cls) {
  document.getElementById('statusText').textContent = text;
  document.getElementById('statusDot').className = 'dot ' + (cls || 'idle');
}

export function toast(msg, type) {
  type = type || 'info';
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ── Character count ──
export function updateCC(input, limit) {
  const el = document.getElementById('cc_' + input.id.replace('f_', ''));
  if (!el) return;
  const n = input.value.length;
  el.textContent = n + '/' + limit;
  el.className = 'char-count' + (n > limit ? ' over' : '');
}

// ── Stepper ──
export function isStepReady(n) {
  if (n === 1) return !!state.scrapedData;
  if (n === 2) return !!state.config;
  if (n === 3) return !!state.previewImages.cover;
  return false;
}

export function goStep(n) {
  document.querySelectorAll('.step-item').forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.remove('active', 'done');
    if (s < n && isStepReady(s)) el.classList.add('done');
    if (s === n) el.classList.add('active');
  });
  document.querySelectorAll('.step-panel').forEach((p, i) => {
    p.classList.toggle('active', i + 1 === n);
  });
  state.currentStep = n;
  window.dispatchEvent(new CustomEvent('stepchange', { detail: { step: n } }));
  // Auto-preview when entering Step 3
  if (n === 3 && state.config) {
    setTimeout(() => {
      if (state.previewImages.cover) {
        // Already have preview images, just load in iframe
        const issueNum = state.config.meta?.issueNumber;
        if (issueNum) {
          const dir = `data/temp/issue-${String(issueNum).padStart(3,'0')}`;
          document.getElementById('animFrame').src = `/demo.html?img=${encodeURIComponent(dir)}&autoplay=1&embed=1`;
        }
      } else if (typeof doPreview === 'function') {
        doPreview();
      }
    }, 100);
  }
}

// ── Theme ──
export function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  // Update icon
  const icon = document.querySelector('.theme-btn i');
  if (icon) icon.setAttribute('data-lucide', next === 'dark' ? 'moon' : 'sun-moon');
  if (window.lucide) lucide.createIcons();
}

// ── Modal ──
export function showModal(src) {
  document.getElementById('modalImg').src = src;
  document.getElementById('modal').classList.add('show');
}

// ── Clipboard ──
export function copyText(id) {
  const el = document.getElementById(id);
  navigator.clipboard.writeText(el.value || el.textContent)
    .then(() => toast('已复制', 'success'))
    .catch(() => {
      el.select();
      document.execCommand('copy');
      toast('已复制', 'success');
    });
}
