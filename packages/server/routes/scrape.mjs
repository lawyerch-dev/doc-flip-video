import { json, errorResponse, parseJson } from "../shared.mjs";

// ── Launch a shared puppeteer browser instance ──
async function launchBrowser() {
  const puppeteer = await import("puppeteer");
  return puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
}

// ── URL pattern heuristics: is this likely a list/index page? ──
function looksLikeListPage(url) {
  return /\/article\/index\/|\/article\/list|\/page\/\d+|\/category|\/tag\/|\/archives/i.test(url);
}

// ── Extract article links from a page ──
function extractArticleLinks() {
  const links = document.querySelectorAll("a");
  const results = [];
  const seen = new Set();
  links.forEach((a) => {
    const href = a.href;
    const text = a.textContent?.trim();
    if (!href || !text || text.length < 8) return;
    if (!/(?:\/article\/detail\/|\/article\/\d|\/\d{4}\/\d{2}.*\.shtml|\/content_\d|\/\d+\.html)/.test(href)) return;
    if (seen.has(href)) return;
    seen.add(href);
    results.push({ title: text.substring(0, 120), url: href });
  });
  return results;
}

// ── Extract article content from a page ──
function extractArticleContent() {
  // 1. Try <article> tag first
  let articleEl = document.querySelector("article");
  // 2. Try common content selectors
  if (!articleEl || articleEl.innerText.length < 200) {
    const sels = [
      ".article_content",
      ".article-content",
      ".text_content",
      "#Content",
      ".content",
      ".article",
      ".detail_content",
      ".TRS_Editor",
      ".pages_content",
      "#fontzoom",
      "main",
    ];
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el && el.innerText.trim().length > 200) {
        articleEl = el;
        break;
      }
    }
  }

  // Get title
  const h1 = document.querySelector("h1");
  const title = h1?.textContent?.trim() || document.title;

  // Extract clean text
  let text = "";
  const target = articleEl || document.body;
  const clone = target.cloneNode(true);
  const noise =
    "script,style,nav,header,footer,aside,iframe,form,noscript,.ad,.advert,.recommend,.related,.comment,.share,.social,.breadcrumb,.crumb,.sidebar,.widget,[class*=recommend],[class*=related],[class*=side],[class*=nav],[class*=menu],[class*=footer],[class*=header],[class*=tag],[class*=crumb],[class*=share],[class*=comment],[class*=ad-],[class*=advert]";
  clone.querySelectorAll(noise).forEach((el) => el.remove());

  const paras = clone.querySelectorAll("p");
  if (paras.length >= 3) {
    text = Array.from(paras)
      .map((p) => p.innerText.trim())
      .filter((t) => t.length > 10)
      .join("\n");
  }
  if (!text || text.length < 100) {
    text = clone.innerText;
  }

  text = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");

  const dateEl = document.querySelector(".date, time, [class*=date], [class*=time]");
  const date = dateEl?.textContent?.trim() || "";
  const sourceEl = document.querySelector(".source, [class*=source], [class*=author], [class*=from]");
  const source = sourceEl?.textContent?.trim() || "";

  return { title, text, date, source, url: location.href };
}

// ── Smart scrape: auto-detect article vs list page ──
async function smartScrape(url) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    );
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });

    // Fast path: URL pattern clearly indicates list/index page
    if (looksLikeListPage(url)) {
      const articles = await page.evaluate(extractArticleLinks);
      return { type: "list", articles, total: articles.length };
    }

    // Otherwise, try to extract as article first
    const data = await page.evaluate(extractArticleContent);

    // If we got substantial content, it's an article
    if (data.text && data.text.length >= 200) {
      return { type: "article", ...data };
    }

    // Content is thin — might be a list page. Try extracting links.
    const articles = await page.evaluate(extractArticleLinks);
    if (articles.length >= 3) {
      return { type: "list", articles, total: articles.length };
    }

    // Could be a short article or an unrecognized page — return what we have
    return { type: "article", ...data };
  } finally {
    await browser.close();
  }
}

/**
 * @param {string} method
 * @param {string} urlPath
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {URLSearchParams} params
 * @returns {Promise<boolean>} true if this route handled the request
 */
export async function register(method, urlPath, req, res, params) {
  if (method === "POST" && urlPath === "/api/scrape") {
    const { url } = await parseJson(req);
    if (!url) {
      errorResponse(res, "Missing url", 400);
      return true;
    }
    try {
      const result = await smartScrape(url);
      json(res, result);
    } catch (e) {
      errorResponse(res, "抓取失败: " + e.message, 500);
    }
    return true;
  }

  // Keep fetch-list as backward-compatible alias
  if (method === "POST" && urlPath === "/api/fetch-list") {
    const { url } = await parseJson(req);
    if (!url) {
      errorResponse(res, "Missing url", 400);
      return true;
    }
    try {
      const result = await smartScrape(url);
      if (result.type === "list") {
        json(res, { articles: result.articles, total: result.total });
      } else {
        // It's an article — return as single-item list for backward compat
        json(res, { articles: [{ title: result.title, url: result.url }], total: 1 });
      }
    } catch (e) {
      errorResponse(res, "获取文章列表失败: " + e.message, 500);
    }
    return true;
  }

  return false;
}
