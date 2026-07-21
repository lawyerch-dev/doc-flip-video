// ── HTTP Helpers (shared across packages) ──

export function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
  return true;
}

export function errorResponse(res, message, status = 500, details = null) {
  return json(res, { error: message, details, timestamp: new Date().toISOString() }, status);
}

export function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    req.on("data", (chunk) => {
      length += chunk.length;
      if (length > 100 * 1024 * 1024) {
        req.destroy();
        reject(new Error("请求体不能超过 100MB"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function readBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    req.on("data", (chunk) => {
      length += chunk.length;
      if (length > 100 * 1024 * 1024) {
        req.destroy();
        reject(new Error("请求体不能超过 100MB"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export async function parseJson(req) {
  const body = await readBody(req);
  return body ? JSON.parse(body) : {};
}
