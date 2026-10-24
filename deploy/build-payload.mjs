// Builds a self-contained JS function for the Cloudflare connector's `execute` tool.
// It hashes the site files the same way wrangler does
// (blake3(base64(content) + extension) as hex, first 32 chars),
// embeds them, and runs: upload-token -> check-missing -> upload -> upsert-hashes -> deployment.
//
// The connector sandbox cannot call the JWT-authenticated /pages/assets/* endpoints,
// so the default mode ("worker") ships the files inside a Pages `_worker.js` instead.
// Mode "assets" is the standard Direct Upload flow, for environments where the JWT works.
//
// Usage: node deploy/build-payload.mjs [project-name] [branch] [worker|assets] > /tmp/cf-deploy.js
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { hash } = require("blake3-wasm");

const project = process.argv[2] || "coffee-map-nishimu";
const branch = process.argv[3] || "main";
const mode = process.argv[4] || "worker";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Not published as assets. `_headers` is sent as its own form field.
const EXCLUDE = new Set(["README.md", "deploy.md", "UPDATE.md", "_headers", "_redirects", "_routes.json"]);
const EXCLUDE_DIRS = new Set(["deploy", "node_modules", ".git"]);
const TYPES = {
  html: "text/html", css: "text/css", js: "application/javascript", json: "application/json",
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  ico: "image/x-icon", txt: "text/plain", xml: "application/xml", webmanifest: "application/manifest+json"
};

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = relative(root, p).split("\\").join("/");
    if (statSync(p).isDirectory()) { if (!EXCLUDE_DIRS.has(name) && !name.startsWith(".")) walk(p); continue; }
    if (EXCLUDE.has(rel) || name.startsWith(".")) continue;
    const base64 = readFileSync(p).toString("base64");
    const ext = extname(p).substring(1);
    files.push({
      path: "/" + rel,
      key: hash(base64 + ext).toString("hex").slice(0, 32),
      contentType: TYPES[ext.toLowerCase()] || "application/octet-stream",
      value: base64
    });
  }
};
walk(root);

let headers = "";
try { headers = readFileSync(join(root, "_headers"), "utf8"); } catch {}

// Parse _headers into [{pattern, headers}] so the worker can apply the same rules.
const headerRules = [];
for (const line of headers.split(/\r?\n/)) {
  if (!line.trim() || line.trim().startsWith("#")) continue;
  if (!/^\s/.test(line)) headerRules.push({ pattern: line.trim(), headers: {} });
  else if (headerRules.length) {
    const i = line.indexOf(":");
    headerRules.at(-1).headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
}

if (mode === "worker") {
  const site = Object.fromEntries(files.map((f) => [f.path, { t: f.contentType, b: f.value, e: f.key }]));
  const worker = `const SITE = ${JSON.stringify(site)};
const RULES = ${JSON.stringify(headerRules)};
const bin = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const BODY = Object.fromEntries(Object.entries(SITE).map(([p, f]) => [p, bin(f.b)]));
const match = (pattern, path) => new RegExp("^" + pattern.replace(/[.+?^\${}()|[\\]\\\\]/g, "\\\\$&").replace(/\\*/g, ".*") + "$").test(path);
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith("/")) path += "index.html";
    if (!SITE[path] && SITE[path + ".html"]) path += ".html";
    const f = SITE[path];
    if (!f) return new Response("Not Found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    const h = new Headers({ "Content-Type": f.t + (/^text\\/|json|javascript|svg/.test(f.t) ? "; charset=utf-8" : ""), ETag: '"' + f.e + '"' });
    for (const r of RULES) if (match(r.pattern, url.pathname)) for (const [k, v] of Object.entries(r.headers)) if (!h.has(k)) h.set(k, v);
    if (!h.has("Cache-Control")) h.set("Cache-Control", "public, max-age=0, must-revalidate");
    if (request.headers.get("If-None-Match") === h.get("ETag")) return new Response(null, { status: 304, headers: h });
    return new Response(request.method === "HEAD" ? null : BODY[path], { headers: h });
  }
};
`;
  process.stdout.write(`async () => {
  const P = ${JSON.stringify({ project, branch, worker })};
  const b = "----coffeemap" + Date.now();
  const part = (name, value, filename, type) => [\`--\${b}\`, \`Content-Disposition: form-data; name="\${name}"\${filename ? \`; filename="\${filename}"\` : ""}\`, ...(type ? [\`Content-Type: \${type}\`] : []), "", value].join("\\r\\n");
  const body = [part("manifest", "{}"), part("branch", P.branch), part("_worker.js", P.worker, "_worker.js", "application/javascript+module")].join("\\r\\n") + \`\\r\\n--\${b}--\\r\\n\`;
  const dep = await cloudflare.request({ method: "POST", path: \`/accounts/\${accountId}/pages/projects/\${P.project}/deployments\`, body, contentType: "multipart/form-data; boundary=" + b, rawBody: true });
  const d = dep.result;
  return { mode: "worker", files: ${JSON.stringify(files.map((f) => f.path))}, id: d.id, url: d.url, env: d.environment, aliases: d.aliases, stage: d.latest_stage };
}
`);
  process.exit(0);
}

const payload = { project, branch, files, headers };

process.stdout.write(`async () => {
  const P = ${JSON.stringify(payload)};
  const base = "https://api.cloudflare.com/client/v4";
  const tok = await cloudflare.request({ method: "GET", path: \`/accounts/\${accountId}/pages/projects/\${P.project}/upload-token\` });
  const jwt = tok.result.jwt;
  const call = async (path, body) => {
    const r = await fetch(base + path, { method: "POST", headers: { Authorization: "Bearer " + jwt, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!j.success) throw new Error(path + " " + r.status + " " + JSON.stringify(j.errors));
    return j.result;
  };
  const keys = [...new Set(P.files.map((f) => f.key))];
  const missing = await call("/pages/assets/check-missing", { hashes: keys });
  const toUpload = P.files.filter((f, i, a) => missing.includes(f.key) && a.findIndex((g) => g.key === f.key) === i);
  for (let i = 0; i < toUpload.length; i += 50) {
    await call("/pages/assets/upload", toUpload.slice(i, i + 50).map((f) => ({ key: f.key, value: f.value, metadata: { contentType: f.contentType }, base64: true })));
  }
  await call("/pages/assets/upsert-hashes", { hashes: keys });
  const manifest = Object.fromEntries(P.files.map((f) => [f.path, f.key]));
  const b = "----coffeemap" + Date.now();
  const part = (name, value, filename, type) => [\`--\${b}\`, \`Content-Disposition: form-data; name="\${name}"\${filename ? \`; filename="\${filename}"\` : ""}\`, ...(type ? [\`Content-Type: \${type}\`] : []), "", value].join("\\r\\n");
  const parts = [part("manifest", JSON.stringify(manifest)), part("branch", P.branch)];
  if (P.headers) parts.push(part("_headers", P.headers, "_headers", "text/plain"));
  const body = parts.join("\\r\\n") + \`\\r\\n--\${b}--\\r\\n\`;
  const dep = await cloudflare.request({ method: "POST", path: \`/accounts/\${accountId}/pages/projects/\${P.project}/deployments\`, body, contentType: "multipart/form-data; boundary=" + b, rawBody: true });
  const d = dep.result;
  return { uploaded: toUpload.map((f) => f.path), alreadyStored: P.files.length - toUpload.length, manifest, id: d.id, url: d.url, env: d.environment, aliases: d.aliases, stage: d.latest_stage };
}
`);
