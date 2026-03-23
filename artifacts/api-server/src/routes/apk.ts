import { Router } from "express";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

const GITHUB_TOKEN = process.env.GITHUB_API_TOKEN ?? "";
const REPO = "Esparramador/Shopy-Crafter";
const WORKFLOW_ID = "build-apk.yml";
const RELEASE_TAG = "apk-latest";

async function ghFetch(path: string, opts: RequestInit = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(opts.headers ?? {}),
    },
  });
}

router.get("/apk/status", async (_req, res): Promise<void> => {
  if (!GITHUB_TOKEN) {
    res.json({ available: false, building: false, error: "GITHUB_API_TOKEN no configurado" });
    return;
  }
  try {
    const runsRes = await ghFetch(`/repos/${REPO}/actions/runs?per_page=5&event=push`);
    const runsData = await runsRes.json() as { workflow_runs?: Array<{ name: string; status: string; conclusion: string | null; run_number: number; created_at: string }> };
    const latest = (runsData.workflow_runs ?? []).find(r => r.name === "Build ShopyBrain APK");

    const releaseRes = await ghFetch(`/repos/${REPO}/releases/tags/${RELEASE_TAG}`);
    const releaseAvailable = releaseRes.ok;

    res.json({
      available: releaseAvailable,
      building: latest?.status === "in_progress" || latest?.status === "queued",
      lastBuild: latest ? {
        number: latest.run_number,
        status: latest.conclusion ?? latest.status,
        date: latest.created_at,
      } : null,
    });
  } catch {
    res.json({ available: false, building: false, error: "Error al consultar GitHub" });
  }
});

router.post("/apk/build", requireAdmin, async (_req, res): Promise<void> => {
  if (!GITHUB_TOKEN) {
    res.status(503).json({ success: false, error: "GITHUB_API_TOKEN no configurado en el servidor" });
    return;
  }
  try {
    const r = await ghFetch(`/repos/${REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "master" }),
    });
    if (r.status === 204) {
      res.json({ success: true, message: "Build lanzado — tardará unos 5 minutos" });
    } else {
      const err = await r.json() as { message?: string };
      res.status(500).json({ success: false, error: err.message ?? "Error al lanzar el workflow" });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : "Error desconocido" });
  }
});

router.get("/apk/download", async (req, res): Promise<void> => {
  if (!GITHUB_TOKEN) {
    res.status(503).json({ error: "Descarga no disponible — GITHUB_API_TOKEN no configurado" });
    return;
  }
  try {
    const releaseRes = await ghFetch(`/repos/${REPO}/releases/tags/${RELEASE_TAG}`);
    if (!releaseRes.ok) {
      res.status(404).json({ error: "No hay ningún APK publicado todavía. Lanza el primer build desde el panel admin." });
      return;
    }
    const release = await releaseRes.json() as { assets?: Array<{ id: number; name: string; browser_download_url: string }> };
    const asset = release.assets?.find(a => a.name.endsWith(".apk"));
    if (!asset) {
      res.status(404).json({ error: "APK no encontrado en el release" });
      return;
    }

    const assetRes = await ghFetch(`/repos/${REPO}/releases/assets/${asset.id}`, {
      headers: { Accept: "application/octet-stream" },
      redirect: "follow",
    });

    res.setHeader("Content-Disposition", "attachment; filename=\"ShopyBrain.apk\"");
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    if (assetRes.headers.get("content-length")) {
      res.setHeader("Content-Length", assetRes.headers.get("content-length")!);
    }

    const buf = await assetRes.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Error al descargar el APK" });
  }
});

export default router;
