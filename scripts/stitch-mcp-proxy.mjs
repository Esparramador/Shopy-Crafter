#!/usr/bin/env node
/**
 * Stitch MCP Proxy — ShopyBrain
 * ─────────────────────────────────────────────────────────────────────────────
 * Acts as a local MCP server that forwards requests to the Stitch MCP endpoint
 * (https://stitch.googleapis.com/mcp), injecting the STITCH_API_KEY header.
 *
 * Usage (Replit MCP config):
 *   command = "node scripts/stitch-mcp-proxy.mjs"
 *
 * Requires:
 *   STITCH_API_KEY environment variable (from stitch.withgoogle.com Settings > API Keys)
 */

import http from "http";
import https from "https";
import { Buffer } from "buffer";

const STITCH_MCP_URL = "https://stitch.googleapis.com/mcp";
const PROXY_PORT = process.env.STITCH_PROXY_PORT ? parseInt(process.env.STITCH_PROXY_PORT) : 4123;
const API_KEY = process.env.STITCH_API_KEY || process.env.GOOGLE_API_KEY || "";

if (!API_KEY) {
  process.stderr.write("[stitch-proxy] WARNING: No STITCH_API_KEY set. Requests will be rejected by Stitch.\n");
}

const server = http.createServer(async (req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    const url = new URL(STITCH_MCP_URL);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + (req.url !== "/" ? req.url : ""),
      method: req.method || "POST",
      headers: {
        ...req.headers,
        host: url.hostname,
        "X-Goog-Api-Key": API_KEY,
        "content-type": req.headers["content-type"] || "application/json",
        "content-length": body.length,
      },
    };
    delete options.headers["connection"];

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on("error", (err) => {
      process.stderr.write(`[stitch-proxy] Upstream error: ${err.message}\n`);
      if (!res.headersSent) {
        res.writeHead(502, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "Stitch upstream error", message: err.message }));
      }
    });

    proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(PROXY_PORT, "127.0.0.1", () => {
  process.stderr.write(`[stitch-proxy] Stitch MCP proxy listening on http://127.0.0.1:${PROXY_PORT}\n`);
  process.stderr.write(`[stitch-proxy] Forwarding to ${STITCH_MCP_URL}\n`);
  process.stderr.write(`[stitch-proxy] API key: ${API_KEY ? "✅ set (" + API_KEY.slice(0, 8) + "...)" : "❌ NOT SET"}\n`);
});

process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());
