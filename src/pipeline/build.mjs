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
execFileSync("node", [path.join(__dirname, "capture.mjs"), config], { stdio: "inherit" });
