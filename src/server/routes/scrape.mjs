import { json, parseJson } from "../shared.mjs";

// ── Scraper: Fetch article content via puppeteer ──
async function scrapeUrl(url) {
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

    // Inject Readability library and extract
    const data = await page.evaluate(async () => {
      // Minimal Readability-like extraction
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

      // Extract clean text from the best element
      let text = "";
      const target = articleEl || document.body;
      const clone = target.cloneNode(true);
      // Remove noise
      const noise =
        "script,style,nav,header,footer,aside,iframe,form,noscript,.ad,.advert,.recommend,.related,.comment,.share,.social,.breadcrumb,.crumb,.sidebar,.widget,[class*=recommend],[class*=related],[class*=side],[class*=nav],[class*=menu],[class*=footer],[class*=header],[class*=tag],[class*=crumb],[class*=share],[class*=comment],[class*=ad-],[class*=advert]";
      clone.querySelectorAll(noise).forEach((el) => el.remove());

      // Extract paragraphs for cleaner text
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

      // Clean up
      text = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .join("\n");

      // Extract date and source
      const dateEl = document.querySelector(
        ".date, time, [class*=date], [class*=time]"
      );
      const date = dateEl?.textContent?.trim() || "";
      const sourceEl = document.querySelector(
        ".source, [class*=source], [class*=author], [class*=from]"
      );
      const source = sourceEl?.textContent?.trim() || "";

      return { title, text, date, source, url: location.href };
    });

    return data;
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
      json(res, { error: "Missing url" }, 400);
      return true;
    }
    const data = await scrapeUrl(url);
    json(res, data);
    return true;
  }

  return false;
}
