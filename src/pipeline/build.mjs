import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawArg = process.argv[2] || "data/articles/article-001.json";
// Auto-prefix configs/ if the file exists there and wasn't already prefixed
const config = rawArg.includes("/")
  ? rawArg
  : path.join("data", "articles", rawArg);

console.log(`📄 Config: ${config}`);
console.log("─── Generating images ───");
execFileSync("node", [path.join(__dirname, "gen-pages.mjs"), config], { stdio: "inherit" });
console.log("─── Rendering video ───");
// Use xfade capture (pure FFmpeg, no Puppeteer)
// Set CAPTURE=puppeteer env to use legacy WebGL capture
const captureScript = process.env.CAPTURE === "puppeteer" ? "capture.mjs" : "capture-xfade.mjs";
execFileSync("node", [path.join(__dirname, captureScript), config], { stdio: "inherit" });
