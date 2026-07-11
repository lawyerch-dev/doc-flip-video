import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { randomUUID } from "crypto";
import { ROOT, OUTPUT_DIR, TEMPLATE_PATH, ENGINE_ENTRY } from "../../config/paths.mjs";

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const defaultTemplate = JSON.parse(fs.readFileSync(TEMPLATE_PATH, "utf-8"));

function generateVideo(content) {
  const jobId = randomUUID();
  const jobDir = path.join(OUTPUT_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  const articlePath = path.join(jobDir, "article.json");
  fs.writeFileSync(articlePath, JSON.stringify(content, null, 2));

  const templatePath = path.join(jobDir, "template.json");
  fs.writeFileSync(templatePath, JSON.stringify(defaultTemplate, null, 2));

  try {
    execFileSync("node", [ENGINE_ENTRY, articlePath], {
      cwd: path.join(ROOT, "packages"),
      stdio: "pipe",
      timeout: 120000,
    });

    const generatedPath = path.join(OUTPUT_DIR, "output.mp4");
    const outputPath = path.join(jobDir, "output.mp4");

    if (fs.existsSync(generatedPath)) {
      fs.renameSync(generatedPath, outputPath);
      return { jobId, outputPath, success: true };
    }

    return { jobId, success: false, error: "Output file not found" };
  } catch (error) {
    fs.rmSync(jobDir, { recursive: true, force: true });
    return { jobId: null, success: false, error: error.message };
  }
}

const server = new Server(
  {
    name: "doc-flip-video",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "generate_video",
        description:
          "Generate a flip-page animation video from document content. Use this when you need to create a video from legal documents, official announcements, or policy content.",
        inputSchema: {
          type: "object",
          properties: {
            meta: {
              type: "object",
              description: "Document metadata",
              properties: {
                year: { type: "number", description: "Year" },
                month: { type: "number", description: "Month" },
                day: { type: "number", description: "Day" },
                issueNumber: { type: "number", description: "Issue number" },
                description: { type: "string", description: "Description text" },
              },
              required: ["year", "month", "day", "issueNumber"],
            },
            cover: {
              type: "object",
              description: "Cover page content",
              properties: {
                headline: { type: "string", description: "Main headline" },
                source: { type: "string", description: "Source citation" },
              },
              required: ["headline", "source"],
            },
            content: {
              type: "object",
              description: "Main content with highlights",
              properties: {
                title: { type: "string", description: "Section title" },
                subtitle: { type: "string", description: "Subtitle" },
                subtitleHighlight: { type: "string", description: "Keyword to highlight in subtitle" },
                paragraphs: {
                  type: "array",
                  description: "Array of paragraphs",
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string", description: "Paragraph text" },
                      bold: { type: "boolean", description: "Make text bold and red" },
                      highlight: { type: "string", description: "Keyword to highlight" },
                    },
                    required: ["text"],
                  },
                },
                source: { type: "string", description: "Source citation" },
              },
              required: ["title", "subtitle", "paragraphs"],
            },
            timing: {
              type: "object",
              description: "Animation timing (optional)",
              properties: {
                settle: { type: "number", description: "Entrance animation duration" },
                cover: { type: "number", description: "Cover hold time" },
                curl: { type: "number", description: "Page flip duration" },
                sweep: { type: "number", description: "Highlight sweep duration" },
                final: { type: "number", description: "Highlight hold time" },
              },
            },
          },
          required: ["meta", "cover", "content"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "generate_video") {
    const content = request.params.arguments;

    try {
      const result = generateVideo(content);

      if (result.success) {
        const videoBuffer = fs.readFileSync(result.outputPath);
        const base64Video = videoBuffer.toString("base64");

        // Cleanup
        setTimeout(() => {
          fs.rmSync(path.join(OUTPUT_DIR, result.jobId), { recursive: true, force: true });
        }, 5000);

        return {
          content: [
            {
              type: "text",
              text: `Video generated successfully! Job ID: ${result.jobId}`,
            },
            {
              type: "resource",
              resource: {
                uri: `file://${result.outputPath}`,
                mimeType: "video/mp4",
                text: base64Video,
              },
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `Error generating video: ${result.error}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Doc Flip Video MCP server running on stdio");
}

main().catch(console.error);
