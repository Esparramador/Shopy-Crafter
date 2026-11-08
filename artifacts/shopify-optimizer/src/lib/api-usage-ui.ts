/** Ayudas puras del panel de Costes IA (probadas en api-usage-ui.test.ts). */

/** Nombre de archivo que manda el servidor en Content-Disposition, o el de reserva. */
export function filenameFromDisposition(header: string | null | undefined, fallback: string): string {
  return header?.match(/filename="([^"]+)"/)?.[1] ?? fallback;
}

/** Cuerpo de providerThresholds: todos los motores; vacío o 0 = sin tope (null, el servidor lo borra). */
export function providerBudgetsPayload(providers: readonly string[], values: Record<string, string>): Record<string, number | null> {
  return Object.fromEntries(providers.map(p => {
    const v = parseFloat(values[p] ?? "");
    return [p, Number.isFinite(v) && v > 0 ? v : null];
  }));
}

export interface ProjectCostInput {
  projectId: number | null; projectName: string | null; shopDomain: string | null;
  costUsd: number | string; calls: number | string;
}
export interface RankedProject {
  projectId: number | null; name: string; shopDomain: string | null;
  costUsd: number; calls: number; pct: number;
}

/** Top N proyectos por coste, con el % sobre el total de TODOS (no solo del top). */
export function rankProjects(rows: ProjectCostInput[], limit = 10): RankedProject[] {
  const norm = rows.map(r => ({
    projectId: r.projectId,
    name: r.projectName ?? (r.projectId ? `Proyecto #${r.projectId}` : "Sin proyecto (plataforma)"),
    shopDomain: r.shopDomain,
    costUsd: Number(r.costUsd) || 0,
    calls: Number(r.calls) || 0,
  }));
  const total = norm.reduce((s, r) => s + r.costUsd, 0);
  return norm
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, limit)
    .map(r => ({ ...r, pct: total > 0 ? (r.costUsd / total) * 100 : 0 }));
}
