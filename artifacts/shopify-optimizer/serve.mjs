import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "dist", "public");
const PORT = process.env.PORT || 19080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".mjs":  "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".glb":  "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".mp4":  "video/mp4",
  ".webm": "video/webm",
  ".mp3":  "audio/mpeg",
  ".wav":  "audio/wav",
  ".txt":  "text/plain; charset=utf-8",
  ".xml":  "application/xml",
  ".pdf":  "application/pdf",
  ".zip":  "application/zip",
};

function getCacheControl(urlPath) {
  if (urlPath === "/" || urlPath.endsWith(".html")) {
    return "public, max-age=0, must-revalidate";
  }
  if (urlPath === "/sw.js") {
    return "public, max-age=0, must-revalidate";
  }
  if (urlPath === "/manifest.json") {
    return "public, max-age=3600";
  }
  if (urlPath === "/robots.txt" || urlPath === "/sitemap.xml") {
    return "public, max-age=86400";
  }
  if (urlPath.startsWith("/assets/") && (urlPath.endsWith(".js") || urlPath.endsWith(".css") || urlPath.endsWith(".mjs"))) {
    return "public, max-age=31536000, immutable";
  }
  if (urlPath.startsWith("/assets/")) {
    return "public, max-age=86400, stale-while-revalidate=86400";
  }
  if (urlPath.startsWith("/icons/") || urlPath.startsWith("/fonts/")) {
    return "public, max-age=31536000, immutable";
  }
  if (urlPath.startsWith("/images/")) {
    return "public, max-age=604800";
  }
  return "public, max-age=3600";
}

const server = http.createServer((req, res) => {
  let urlPath = req.url.split("?")[0].split("#")[0];

  const tryFile = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";
    const cache = getCacheControl(urlPath);

    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) return false;

      res.writeHead(200, {
        "Content-Type": mime,
        "Cache-Control": cache,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      });
      fs.createReadStream(filePath).pipe(res);
      return true;
    } catch {
      return false;
    }
  };

  const abs = path.join(ROOT, urlPath);

  if (tryFile(abs)) return;
  if (tryFile(abs + ".html")) return;
  if (tryFile(path.join(abs, "index.html"))) return;

  const indexPath = path.join(ROOT, "index.html");
  try {
    const html = fs.readFileSync(indexPath);
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
    });
    res.end(html);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Shopy Crafter static server listening on port ${PORT}`);
});
