import { useState } from "react";
import {
  Pause, Play, X, FileText, Trophy,
  Image as ImageIcon, DollarSign, AlertTriangle,
} from "lucide-react";
import { ActionButton } from "./ActionButton";
import { useTestPolling } from "../hooks/useABTesting";
import type { ABTest, TestStatus, PriceTestConfig } from "../lib/types";
import type { ABTestingAPI } from "../lib/api";

interface Props {
  test: ABTest;
  api: ABTestingAPI;
  onUpdate: () => void;
}

export function ActiveTestCard({ test, api, onUpdate }: Props) {
  const { stats, loading } = useTestPolling(api, test.id, {
    enabled: test.status === "running",
    pollIntervalMs: 5000,
  });
  const [expanded, setExpanded] = useState(true);

  const isImage = test.config.type === "image";
  const config = test.config;

  const variantALabel = isImage
    ? "Imagen original"
    : `€${(config as PriceTestConfig).controlPrice.toFixed(2)}`;
  const variantBLabel = isImage
    ? "Variante IA"
    : `€${(config as PriceTestConfig).challengerPrice.toFixed(2)}`;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex justify-between items-start">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {test.product.imageUrl && (
            <img src={test.product.imageUrl} alt="" className="w-12 h-12 rounded object-cover bg-slate-800 flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              {isImage ? (
                <span className="bg-violet-500/20 text-violet-300 text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider flex items-center gap-1">
                  <ImageIcon className="w-2.5 h-2.5" /> Imagen
                </span>
              ) : (
                <span className="bg-teal-500/20 text-teal-300 text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider flex items-center gap-1">
                  <DollarSign className="w-2.5 h-2.5" /> Precio
                </span>
              )}
              <StatusBadge status={test.status} />
            </div>
            <h3 className="text-sm font-semibold text-slate-100 truncate">{test.product.title}</h3>
            <p className="text-[10px] text-slate-500 mt-1 line-clamp-1" title={config.hypothesis}>
              {config.hypothesis}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-3">
          {test.status === "running" && (
            <ActionButton
              variant="ghost" size="sm" icon={<Pause className="w-3 h-3" />}
              onAction={async () => { await api.pauseTest(test.id); onUpdate(); }}
            >
              Pausar
            </ActionButton>
          )}
          {test.status === "paused" && (
            <ActionButton
              variant="ghost" size="sm" icon={<Play className="w-3 h-3" />}
              onAction={async () => { await api.resumeTest(test.id); onUpdate(); }}
            >
              Reanudar
            </ActionButton>
          )}
          {(test.status === "running" || test.status === "paused") && (
            <ActionButton
              variant="ghost" size="sm" icon={<X className="w-3 h-3" />}
              confirmMessage="¿Cancelar test? Los datos recogidos hasta ahora se conservarán pero no se podrán continuar."
              onAction={async () => { await api.cancelTest(test.id); onUpdate(); }}
            >
              Cancelar
            </ActionButton>
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <VariantStatsCard
              label="Control (A)"
              variantLabel={variantALabel}
              stats={stats?.variantA}
              isWinner={stats?.winner === "A"}
              loading={loading && !stats}
            />
            <VariantStatsCard
              label="Challenger (B)"
              variantLabel={variantBLabel}
              stats={stats?.variantB}
              isWinner={stats?.winner === "B"}
              loading={loading && !stats}
              accent
            />
          </div>

          {stats && (
            <div className="bg-slate-950 rounded-md p-3 mb-3">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Confianza estadística
                  </span>
                  <span className={`text-xs font-semibold ${stats.isSignificant ? "text-teal-400" : "text-amber-400"}`}>
                    {stats.confidence.toFixed(1)}%
                  </span>
                  {stats.isSignificant && <Trophy className="w-3 h-3 text-teal-400" />}
                </div>
                <div className="text-[10px] text-slate-400">
                  {stats.daysElapsed}d / {stats.daysElapsed + stats.daysRemaining}d
                  · {stats.visitorsTotal.toLocaleString()} visitas
                </div>
              </div>

              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all ${stats.isSignificant ? "bg-teal-400" : "bg-amber-400"}`}
                  style={{ width: `${Math.min(stats.confidence, 100)}%` }}
                />
              </div>

              {!stats.isSignificant && stats.confidence < 80 && (
                <p className="text-[10px] text-slate-500 mt-2 flex items-start gap-1">
                  <AlertTriangle className="w-2.5 h-2.5 text-amber-400 mt-0.5 flex-shrink-0" />
                  Aún no significativo. Necesita más tráfico para conclusiones válidas.
                </p>
              )}
            </div>
          )}

          {stats?.isSignificant && stats.winner && (
            <div className="bg-teal-500/10 border border-teal-500/30 rounded-md p-3 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs text-teal-300 font-semibold">
                  🏆 Ganador detectado: Variante {stats.winner}
                </p>
                <p className="text-[10px] text-teal-400 mt-0.5">
                  Confianza {stats.confidence.toFixed(1)}% — listo para aplicar
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <ActionButton
                  variant="ghost" size="sm" icon={<FileText className="w-3 h-3" />}
                  loadingText="Generando..." successText="Listo"
                  onAction={async () => {
                    const { reportUrl } = await api.generateReport(test.id);
                    if (!reportUrl) throw new Error("No se generó el informe");
                    const w = window.open(reportUrl, "_blank", "noopener");
                    if (!w) throw new Error("Bloqueado por el navegador. Permite ventanas emergentes.");
                  }}
                >
                  Reporte
                </ActionButton>
                <ActionButton
                  variant="primary" size="sm" icon={<Trophy className="w-3 h-3" />}
                  confirmMessage={`¿Aplicar variante ${stats.winner} al producto en Shopify? Esta acción modifica el producto en tu tienda real.`}
                  loadingText="Aplicando..." successText="Aplicado"
                  onAction={async () => {
                    await api.declareWinner(test.id, stats.winner!);
                    onUpdate();
                  }}
                >
                  Aplicar ganador
                </ActionButton>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-center py-1.5 text-[10px] text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition border-t border-slate-800"
      >
        {expanded ? "Contraer ▲" : "Expandir ▼"}
      </button>
    </div>
  );
}

function VariantStatsCard({
  label, variantLabel, stats, isWinner, loading, accent,
}: {
  label: string; variantLabel: string;
  stats?: { visitors: number; conversions: number; conversionRate: number; revenue: number; aov: number };
  isWinner?: boolean; loading?: boolean; accent?: boolean;
}) {
  return (
    <div className={`
      rounded-lg p-3 border
      ${isWinner
        ? "bg-teal-500/10 border-teal-500/40"
        : accent
          ? "bg-cyan-500/5 border-cyan-500/20"
          : "bg-slate-950 border-slate-800"}
    `}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{label}</span>
        {isWinner && <Trophy className="w-3 h-3 text-teal-400" />}
      </div>
      <p className="text-sm text-slate-100 font-medium mb-3 truncate">{variantLabel}</p>

      {loading ? (
        <div className="space-y-2">
          <div className="h-3 bg-slate-800 rounded animate-pulse" />
          <div className="h-3 bg-slate-800 rounded animate-pulse w-3/4" />
        </div>
      ) : stats ? (
        <div className="space-y-1.5 text-xs">
          <Row label="Visitas" value={stats.visitors.toLocaleString()} />
          <Row label="Conversiones" value={stats.conversions.toLocaleString()} />
          <Row label="Tasa conversión" value={`${(stats.conversionRate * 100).toFixed(2)}%`} highlight={isWinner} />
          <Row label="Revenue" value={`€${stats.revenue.toFixed(0)}`} />
          <Row label="AOV" value={`€${stats.aov.toFixed(2)}`} />
        </div>
      ) : (
        <p className="text-xs text-slate-600 italic">Sin datos aún</p>
      )}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`tabular-nums font-medium ${highlight ? "text-teal-400" : "text-slate-200"}`}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: TestStatus }) {
  const map: Record<TestStatus, { label: string; color: string }> = {
    draft:     { label: "Borrador",   color: "bg-slate-700 text-slate-300" },
    running:   { label: "● Activo",    color: "bg-teal-500/20 text-teal-300" },
    paused:    { label: "⏸ Pausado",   color: "bg-amber-500/20 text-amber-300" },
    completed: { label: "✓ Completado", color: "bg-cyan-500/20 text-cyan-300" },
    cancelled: { label: "✕ Cancelado",  color: "bg-slate-700 text-slate-500" },
  };
  const s = map[status];
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${s.color}`}>
      {s.label}
    </span>
  );
}
