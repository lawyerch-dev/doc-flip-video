import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { randomUUID } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const OUTPUT_DIR = path.join(__dirname, "..", "output");
const TEMPLATE_PATH = path.join(__dirname, "..", "template.json");

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Default template
const defaultTemplate = JSON.parse(fs.readFileSync(TEMPLATE_PATH, "utf-8"));

function generateVideo(content) {
  const jobId = randomUUID();
  const jobDir = path.join(OUTPUT_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  // Create article.json for this job
  const articlePath = path.join(jobDir, "article.json");
  fs.writeFileSync(articlePath, JSON.stringify(content, null, 2));

  // Create template.json for this job
  const templatePath = path.join(jobDir, "template.json");
  fs.writeFileSync(templatePath, JSON.stringify(defaultTemplate, null, 2));

  // Generate video
  const outputPath = path.join(jobDir, "output.mp4");
  
  try {
    execFileSync("node", [
      path.join(__dirname, "build.mjs"),
      articlePath,
    ], {
      cwd: path.join(__dirname, ".."),
      stdio: "pipe",
      timeout: 120000, // 2 minutes timeout
    });

    // Move output to job directory
    const generatedPath = path.join(__dirname, "..", "output", "output.mp4");
    if (fs.existsSync(generatedPath)) {
      fs.renameSync(generatedPath, outputPath);
    }

    return { jobId, outputPath };
  } catch (error) {
    // Cleanup on error
    fs.rmSync(jobDir, { recursive: true, force: true });
    throw error;
  }
}

functionhandleRequest(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // Generate video
  if (req.method === "POST" && req.url === "/generate") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const content = JSON.parse(body);
        
        // Validate required fields
        if (!content.meta || !content.cover || !content.content) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing required fields: meta, cover, content" }));
          return;
        }

        const { jobId, outputPath } = generateVideo(content);

        // Return video file
        const stat = fs.statSync(outputPath);
        res.writeHead(200, {
          "Content-Type": "video/mp4",
          "Content-Length": stat.size,
          "Content-Disposition": `attachment; filename="${jobId}.mp4"`,
        });
        fs.createReadStream(outputPath).pipe(res);

        // Cleanup after sending
        fs.createReadStream(outputPath).on("end", () => {
          setTimeout(() => {
            fs.rmSync(path.join(OUTPUT_DIR, jobId), { recursive: true, force: true });
          }, 5000);
        });
      } catch (error) {
        console.error("Generation error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
}

const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`🚀 Doc Flip Video API running on port ${PORT}`);
  console.log(`   POST /generate - Generate video from JSON`);
  console.log(`   GET  /health   - Health check`);
});
