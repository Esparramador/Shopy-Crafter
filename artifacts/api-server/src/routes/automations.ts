import { Router } from "express";
import {
  runRevenueSnapshots,
  runInventorySync,
  runCompetitorScans,
  runOmnicoreRealDataIntegration,
  runOmniCoreMicroLearning,
  runOmniCoreMemoryConsolidation,
  runOmniCoreCrossConnections,
  runOmniCoreDailyDeepStudy,
  runOmniCoreMegaSynthesis,
  runTokenRefresh,
} from "../lib/scheduler.js";
import { logger } from "../lib/logger.js";

const router = Router();

interface CronJobInfo {
  id: string;
  name: string;
  schedule: string;
  description: string;
  category: string;
  lastRunTime: string | null;
  lastRunResult: string | null;
  nextRunTime: string | null;
  status: "idle" | "running" | "error";
}

const jobRunning = new Map<string, boolean>();
const jobLastRun = new Map<string, { time: string; result: string }>();

function parseNextRun(schedule: string): string {
  const now = new Date();
  const parts = schedule.split(" ");
  const [min, hour, dom, mon, dow] = parts;

  if (min.startsWith("*/") || hour.startsWith("*/")) {
    const interval = min.startsWith("*/")
      ? parseInt(min.slice(2)) * 60 * 1000
      : parseInt(hour.slice(2)) * 60 * 60 * 1000;
    const offset = min.startsWith("*/") ? 0 : parseInt(min) * 60 * 1000;
    const base = Math.ceil((now.getTime() + offset) / interval) * interval;
    return new Date(base).toISOString();
  }

  if (hour !== "*" && min !== "*") {
    const next = new Date(now);
    next.setHours(parseInt(hour), parseInt(min), 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    if (dow !== "*") {
      const targetDay = parseInt(dow);
      while (next.getDay() !== targetDay) {
        next.setDate(next.getDate() + 1);
      }
    }
    return next.toISOString();
  }

  return new Date(now.getTime() + 3600000).toISOString();
}

const JOBS: CronJobInfo[] = [
  {
    id: "micro-learning",
    name: "Micro-Learning",
    schedule: "0 */3 * * *",
    description: "2 dominios × 3 insights cada 3 horas",
    category: "Aprendizaje",
    lastRunTime: null, lastRunResult: null, nextRunTime: null, status: "idle",
  },
  {
    id: "memory-consolidation",
    name: "Consolidación de Memoria",
    schedule: "30 */6 * * *",
    description: "Promueve insights de alta confianza a memorias permanentes",
    category: "Aprendizaje",
    lastRunTime: null, lastRunResult: null, nextRunTime: null, status: "idle",
  },
  {
    id: "cross-synthesis",
    name: "Síntesis Cruzada",
    schedule: "0 */12 * * *",
    description: "Conexiones entre dominios cada 12 horas",
    category: "Aprendizaje",
    lastRunTime: null, lastRunResult: null, nextRunTime: null, status: "idle",
  },
  {
    id: "daily-deep-study",
    name: "Estudio Profundo Diario",
    schedule: "0 1 * * *",
    description: "Todos los dominios × 5 insights a la 1am",
    category: "Aprendizaje",
    lastRunTime: null, lastRunResult: null, nextRunTime: null, status: "idle",
  },
  {
    id: "revenue-snapshots",
    name: "Revenue Snapshots",
    schedule: "0 2 * * *",
    description: "Captura diaria de revenue desde Shopify a las 2am",
    category: "Datos",
    lastRunTime: null, lastRunResult: null, nextRunTime: null, status: "idle",
  },
  {
    id: "real-data-integration",
    name: "Integración Datos Reales",
    schedule: "0 3 * * *",
    description: "Integra datos reales de tiendas en OmniCore a las 3am",
    category: "Datos",
    lastRunTime: null, lastRunResult: null, nextRunTime: null, status: "idle",
  },
  {
    id: "competitor-scans",
    name: "Escaneo de Competidores",
    schedule: "0 6 * * *",
    description: "Escaneo diario de precios de competidores a las 6am",
    category: "Datos",
    lastRunTime: null, lastRunResult: null, nextRunTime: null, status: "idle",
  },
  {
    id: "inventory-sync",
    name: "Sincronización Inventario",
    schedule: "0 7 * * *",
    description: "Sync diario de inventario + alertas de stock a las 7am",
    category: "Datos",
    lastRunTime: null, lastRunResult: null, nextRunTime: null, status: "idle",
  },
  {
    id: "mega-synthesis",
    name: "Mega-Síntesis Semanal",
    schedule: "0 0 * * 0",
    description: "Síntesis estratégica semanal los domingos a medianoche",
    category: "Aprendizaje",
    lastRunTime: null, lastRunResult: null, nextRunTime: null, status: "idle",
  },
  {
    id: "token-refresh",
    name: "Renovación Tokens Shopify",
    schedule: "5 */20 * * *",
    description: "Renueva tokens Shopify cada 20h (4h de margen)",
    category: "Sistema",
    lastRunTime: null, lastRunResult: null, nextRunTime: null, status: "idle",
  },
];

const JOB_RUNNERS: Record<string, () => Promise<void>> = {
  "micro-learning": runOmniCoreMicroLearning,
  "memory-consolidation": runOmniCoreMemoryConsolidation,
  "cross-synthesis": runOmniCoreCrossConnections,
  "daily-deep-study": runOmniCoreDailyDeepStudy,
  "revenue-snapshots": runRevenueSnapshots,
  "real-data-integration": runOmnicoreRealDataIntegration,
  "competitor-scans": runCompetitorScans,
  "inventory-sync": runInventorySync,
  "mega-synthesis": runOmniCoreMegaSynthesis,
  "token-refresh": runTokenRefresh,
};

router.get("/automations/jobs", async (req, res): Promise<void> => {
  const jobs = JOBS.map(job => {
    const lastRun = jobLastRun.get(job.id);
    const isRunning = jobRunning.get(job.id) ?? false;
    return {
      ...job,
      lastRunTime: lastRun?.time ?? null,
      lastRunResult: lastRun?.result ?? null,
      nextRunTime: parseNextRun(job.schedule),
      status: isRunning ? "running" as const : "idle" as const,
    };
  });
  res.json(jobs);
});

router.post("/automations/jobs/:jobId/run", async (req, res): Promise<void> => {
  const jobId = req.params.jobId;
  if (!Object.prototype.hasOwnProperty.call(JOB_RUNNERS, jobId)) {
    res.status(404).json({ error: "Job no encontrado" });
    return;
  }
  const runner = JOB_RUNNERS[jobId]; // nosemgrep: unsafe-dynamic-method
  if (!runner) {
    res.status(404).json({ error: "Job no encontrado" });
    return;
  }

  if (jobRunning.get(jobId)) {
    res.status(409).json({ error: "El job ya está en ejecución" });
    return;
  }

  jobRunning.set(jobId, true);
  res.json({ success: true, message: `Job ${jobId} iniciado` });

  const startTime = new Date().toISOString();
  try {
    await runner();
    jobLastRun.set(jobId, { time: startTime, result: "success" });
    logger.info({ jobId }, "Manual job execution completed successfully");
  } catch (err) {
    jobLastRun.set(jobId, { time: startTime, result: "error" });
    logger.error({ jobId, err }, "Manual job execution failed");
  } finally {
    jobRunning.set(jobId, false);
  }
});

export default router;
