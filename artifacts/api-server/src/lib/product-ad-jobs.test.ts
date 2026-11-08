import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  rows: [] as Array<Record<string, any>>,
  vaultFiles: [] as Array<Record<string, any>>,
  query: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  pool: { query: database.query },
}));

import {
  createProductAdJob,
  getLatestProductAdJob,
  markRunningProductAdJobsInterrupted,
  updateProductAdJob,
} from "./product-ad-jobs.js";

function installMemoryDatabase() {
  database.query.mockImplementation(async (query: string, params: unknown[] = []) => {
    if (/^\s*CREATE TABLE|^\s*CREATE INDEX|^\s*ALTER TABLE|^\s*UPDATE product_ad_jobs SET instance_id/i.test(query)) {
      return { rows: [], rowCount: 0 };
    }
    if (query.includes("INSERT INTO product_ad_jobs")) {
      const alreadyRunning = database.rows.some(
        row => row.project_id === params[1] && row.product_id === params[2] && row.status === "running",
      );
      if (alreadyRunning) return { rows: [], rowCount: 0 };
      const now = new Date();
      const row = {
        id: params[0],
        project_id: params[1],
        product_id: params[2],
        kind: params[3],
        instance_id: params[4],
        status: "running",
        stage: "starting",
        message: null,
        provider_tasks: [],
        vault_id: null,
        video_url: null,
        result: null,
        error: null,
        created_at: now,
        updated_at: now,
      };
      database.rows.push(row);
      return { rows: [row], rowCount: 1 };
    }
    if (query.includes("UPDATE product_ad_jobs") && query.includes("provider_tasks = CASE")) {
      const row = database.rows.find(item => item.id === params[0]);
      if (row?.status === "running") {
        row.status = params[1] ?? row.status;
        row.stage = params[2] ?? row.stage;
        if (params[3]) row.message = params[4];
        if (params[5]) row.provider_tasks.push(...JSON.parse(String(params[5])));
        if (params[6]) row.vault_id = params[7];
        if (params[8]) row.video_url = params[9];
        if (params[10]) row.result = JSON.parse(String(params[11]));
        if (params[12]) row.error = params[13];
        row.updated_at = new Date();
      }
      return { rows: [], rowCount: row ? 1 : 0 };
    }
    if (query.includes("SET status = 'interrupted'")) {
      const interrupted = database.rows.filter(row => row.status === "running" && row.instance_id !== params[0]);
      for (const row of interrupted) {
        row.status = "interrupted";
        row.stage = "interrupted";
        row.message = "El servidor se reinició antes de confirmar el resultado.";
        row.error ||= "SERVER_RESTARTED";
      }
      return { rows: interrupted.map(row => ({ id: row.id })), rowCount: interrupted.length };
    }
    if (query.includes("FROM project_files")) {
      return { rows: database.vaultFiles, rowCount: database.vaultFiles.length };
    }
    if (query.includes("SET status = 'completed'") && query.includes("vault_id = $2")) {
      const row = database.rows.find(item => item.id === params[0]);
      if (row && ["running", "interrupted", "failed"].includes(row.status)) {
        row.status = "completed";
        row.stage = "completed";
        row.message = "Anuncio recuperado del Vault tras reiniciar el servidor.";
        row.vault_id = params[1];
        row.video_url = params[2];
        row.result = { success: true, vaultId: params[1], videoUrl: params[2] };
        row.error = null;
        return { rows: [{ id: row.id }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (query.includes("SELECT * FROM product_ad_jobs")) {
      const [idOrProjectId, projectOrProductId, maybeProductId] = params;
      const row = maybeProductId !== undefined
        ? database.rows.find(item => item.id === idOrProjectId && item.project_id === projectOrProductId && item.product_id === maybeProductId)
        : database.rows
          .filter(item => item.project_id === idOrProjectId
            && item.product_id === projectOrProductId
            && (!query.includes("status = 'running'") || item.status === "running"))
          .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0];
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    throw new Error(`Unexpected query in in-memory product ad job test: ${query}`);
  });
}

describe("recuperación de anuncios del producto", () => {
  beforeEach(() => {
    database.rows.length = 0;
    database.vaultFiles.length = 0;
    database.query.mockReset();
    installMemoryDatabase();
  });

  it("conserva el identificador del proveedor tras simular un reinicio del servidor", async () => {
    const { job } = await createProductAdJob({
      projectId: 12,
      productId: "shopify-456",
      kind: "smart-cinematic",
    });
    await updateProductAdJob(job.id, {
      stage: "video",
      message: "Generando escena 2.",
      providerTask: {
        provider: "replicate",
        taskId: "prediction-test-123",
        model: "kwaivgi/kling-v3-video",
        sceneIndex: 2,
      },
    });

    // A new module instance represents a process restart; only the mocked
    // PostgreSQL rows survive, just as in production.
    vi.resetModules();
    const restarted = await import("./product-ad-jobs.js");
    const count = await restarted.markRunningProductAdJobsInterrupted();
    const recovered = await restarted.getLatestProductAdJob(12, "shopify-456");

    expect(count).toBe(1);
    expect(recovered?.status).toBe("interrupted");
    expect(recovered?.providerTasks).toEqual([
      expect.objectContaining({
        provider: "replicate",
        taskId: "prediction-test-123",
        model: "kwaivgi/kling-v3-video",
        sceneIndex: 2,
      }),
    ]);
  });

  it("recupera el MP4 ya guardado aunque el navegador pierda la respuesta", async () => {
    const { job } = await createProductAdJob({
      projectId: 12,
      productId: "shopify-456",
      kind: "smart-cinematic",
    });
    await updateProductAdJob(job.id, {
      status: "completed",
      stage: "completed",
      vaultId: 81,
      videoUrl: "/api/projects/12/vault/81/download",
      result: {
        success: true,
        vaultId: 81,
        videoUrl: "/api/projects/12/vault/81/download",
      },
    });

    vi.resetModules();
    const restarted = await import("./product-ad-jobs.js");
    const recovered = await restarted.getLatestProductAdJob(12, "shopify-456");

    expect(recovered).toMatchObject({
      id: job.id,
      status: "completed",
      vaultId: 81,
      videoUrl: "/api/projects/12/vault/81/download",
      result: { success: true },
    });
  });

  it("reconcilia el trabajo con el Vault tras un reinicio entre guardar y responder", async () => {
    const { job } = await createProductAdJob({
      projectId: 12,
      productId: "shopify-456",
      kind: "smart-cinematic",
    });
    database.vaultFiles.push({
      id: 83,
      project_id: 12,
      product_id: "shopify-456",
      category: "smart_cinematic_ad",
      metadata: JSON.stringify({ adJobId: job.id }),
    });

    vi.resetModules();
    const restarted = await import("./product-ad-jobs.js");
    expect(await restarted.recoverProductAdJobsFromVault()).toBe(1);
    const recovered = await restarted.getLatestProductAdJob(12, "shopify-456");

    expect(recovered).toMatchObject({
      status: "completed",
      vaultId: 83,
      videoUrl: "/api/projects/12/vault/83/download",
    });
  });

  it("impide que un progreso tardío sobrescriba una generación ya terminada", async () => {
    const { job } = await createProductAdJob({
      projectId: 12,
      productId: "shopify-456",
      kind: "smart-quick",
    });
    await updateProductAdJob(job.id, { status: "completed", stage: "completed", vaultId: 82 });
    await updateProductAdJob(job.id, { stage: "video", message: "progreso tardío" });

    const latest = await getLatestProductAdJob(12, "shopify-456");
    expect(latest?.status).toBe("completed");
    expect(latest?.stage).toBe("completed");
    expect(latest?.message).toBeNull();
  });

  it("devuelve el trabajo activo en vez de iniciar una generación duplicada", async () => {
    const first = await createProductAdJob({
      projectId: 12,
      productId: "shopify-456",
      kind: "smart-cinematic",
    });
    const duplicate = await createProductAdJob({
      projectId: 12,
      productId: "shopify-456",
      kind: "smart-cinematic",
    });

    expect(first.created).toBe(true);
    expect(duplicate.created).toBe(false);
    expect(duplicate.job.id).toBe(first.job.id);
    expect(database.rows).toHaveLength(1);
  });
});
