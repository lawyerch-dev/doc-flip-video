import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = process.argv[2] || "article.json";

console.log(`📄 Config: ${config}`);
console.log("─── Generating images ───");
execFileSync("node", [path.join(__dirname, "gen-pages.mjs"), config], { stdio: "inherit" });
console.log("─── Rendering video ───");
execFileSync("node", [path.join(__dirname, "capture.mjs"), config], { stdio: "inherit" });
