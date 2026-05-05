import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, Image as ImageIcon, DollarSign, Loader2, AlertTriangle,
  Trophy, History, Sparkles,
} from "lucide-react";
import { ActionButton } from "./components/ActionButton";
import { ImageTestWizard } from "./components/ImageTestWizard";
import { PriceTestWizard } from "./components/PriceTestWizard";
import { ActiveTestCard } from "./components/ActiveTestCard";
import { createABTestingAPI } from "./lib/api";
import type { ABTest, ABTestingKPIs, TestHistoryEntry } from "./lib/types";

interface Props {
  projectId: number;
}

export default function ABTestingModule({ projectId }: Props) {
  const api = useMemo(() => createABTestingAPI(projectId), [projectId]);

  const [kpis, setKpis] = useState<ABTestingKPIs | null>(null);
  const [activeTests, setActiveTests] = useState<ABTest[]>([]);
  const [history, setHistory] = useState<TestHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const [showWizardMenu, setShowWizardMenu] = useState(false);
  const [imageWizardOpen, setImageWizardOpen] = useState(false);
  const [priceWizardOpen, setPriceWizardOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [k, tests, hist] = await Promise.all([
        api.getKPIs(),
        api.getActiveTests(),
        api.getHistory(20),
      ]);
      setKpis(k);
      setActiveTests(tests);
      setHistory(hist);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Cargando A/B Testing...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-slate-950 p-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-red-300 font-medium mb-1">Error al cargar A/B Testing</p>
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <ActionButton variant="secondary" size="sm" onAction={async () => loadData()}>
            Reintentar
          </ActionButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
          <span className="text-xs text-teal-400 uppercase tracking-widest font-semibold">
            A/B Testing Engine · v2.0
          </span>
        </div>
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">
              A/B Testing inteligente con datos reales
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Imágenes generadas con IA · Precios contrastados con competencia · Decisiones basadas en evidencia
            </p>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowWizardMenu(!showWizardMenu)}
              className="px-4 py-2 bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold rounded-md transition flex items-center gap-2 shadow-lg shadow-violet-500/20"
            >
              <Plus className="w-4 h-4" />
              Nuevo Test
            </button>
            {showWizardMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowWizardMenu(false)} />
                <div className="absolute top-full mt-1 right-0 z-20 bg-slate-900 border border-slate-700 rounded-md shadow-2xl overflow-hidden min-w-[260px]">
                  <button
                    onClick={() => { setShowWizardMenu(false); setImageWizardOpen(true); }}
                    className="w-full p-3 flex items-start gap-3 hover:bg-slate-800 transition text-left"
                  >
                    <div className="w-8 h-8 rounded-md bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-4 h-4 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-100">Test de Imagen</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Genera variantes IA y compara con la imagen actual
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => { setShowWizardMenu(false); setPriceWizardOpen(true); }}
                    className="w-full p-3 flex items-start gap-3 hover:bg-slate-800 transition text-left border-t border-slate-800"
                  >
                    <div className="w-8 h-8 rounded-md bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                      <DollarSign className="w-4 h-4 text-teal-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-100">Test de Precio</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Análisis de competencia + proveedores alternativos
                      </p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KPICard label="Tests activos" value={kpis.activeTests.toString()} color="teal" />
          <KPICard
            label="Tests completados"
            value={kpis.completedTests.toString()}
            sublabel={`${kpis.testsThisMonth} este mes`}
            color="cyan"
          />
          <KPICard
            label="Win rate"
            value={`${kpis.winRate.toFixed(0)}%`}
            sublabel="Tests con ganador"
            color="violet"
          />
          <KPICard
            label="Revenue impact 30d"
            value={`€${kpis.revenueImpact30d.toFixed(0)}`}
            sublabel={`Confianza avg ${kpis.avgConfidence.toFixed(0)}%`}
            color="amber"
          />
        </div>
      )}

      {kpis && kpis.totalLearnings > 0 && (
        <div className="bg-gradient-to-r from-violet-500/10 via-violet-500/5 to-transparent border border-violet-500/20 rounded-lg p-4 mb-6 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-violet-200">Aprendizajes acumulados</p>
            <p className="text-xs text-slate-300 mt-0.5">
              <span className="text-violet-300 font-semibold">{kpis.totalLearnings}</span>{" "}
              insights de tests pasados ya integrados en ShopyBrain para mejorar futuras predicciones.
            </p>
          </div>
        </div>
      )}

      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Tests Activos</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Stats actualizadas en tiempo real cada 5 segundos
            </p>
          </div>
          <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-1 rounded">
            {activeTests.length}
          </span>
        </div>

        {activeTests.length === 0 ? (
          <div className="bg-slate-900 border border-dashed border-slate-700 rounded-xl p-10 text-center">
            <Trophy className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-300 font-medium mb-1">Aún no hay tests activos</p>
            <p className="text-xs text-slate-500 mb-4">
              Crea tu primer A/B test para empezar a medir impacto real
            </p>
            <button
              onClick={() => setShowWizardMenu(true)}
              className="px-4 py-2 bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium rounded-md transition inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Crear primer test
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTests.map((test) => (
              <ActiveTestCard key={test.id} test={test} api={api} onUpdate={loadData} />
            ))}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-400" />
                Historial de tests
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Últimos {history.length} tests completados
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/50 text-xs text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Producto</th>
                  <th className="text-left px-3 py-3 font-semibold">Tipo</th>
                  <th className="text-left px-3 py-3 font-semibold">Hipótesis</th>
                  <th className="text-center px-3 py-3 font-semibold">Ganador</th>
                  <th className="text-right px-3 py-3 font-semibold">Lift</th>
                  <th className="text-right px-3 py-3 font-semibold">Revenue</th>
                  <th className="text-right px-4 py-3 font-semibold">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-800 hover:bg-slate-900/50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {entry.productImageUrl && (
                          <img src={entry.productImageUrl} alt="" className="w-7 h-7 rounded object-cover bg-slate-800" />
                        )}
                        <span className="text-xs text-slate-200 truncate max-w-[200px]" title={entry.productTitle}>
                          {entry.productTitle}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {entry.type === "image" && (
                        <span className="text-[10px] text-violet-400 flex items-center gap-1">
                          <ImageIcon className="w-2.5 h-2.5" /> Imagen
                        </span>
                      )}
                      {entry.type === "price" && (
                        <span className="text-[10px] text-teal-400 flex items-center gap-1">
                          <DollarSign className="w-2.5 h-2.5" /> Precio
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[10px] text-slate-400 line-clamp-1 max-w-[200px]" title={entry.hypothesis}>
                        {entry.hypothesis}
                      </span>
                    </td>
                    <td className="text-center px-3 py-3">
                      {entry.winnerVariant ? (
                        <span className="text-[10px] font-semibold text-teal-400">
                          {entry.winnerVariant} 🏆
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600">Sin ganador</span>
                      )}
                    </td>
                    <td className="text-right px-3 py-3 tabular-nums">
                      <span className={`text-xs font-medium ${entry.conversionLift > 0 ? "text-teal-400" : "text-red-400"}`}>
                        {entry.conversionLift > 0 ? "+" : ""}{entry.conversionLift.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-right px-3 py-3 tabular-nums">
                      <span className="text-xs text-slate-300">
                        {entry.revenueImpact > 0 ? "+" : ""}€{entry.revenueImpact.toFixed(0)}
                      </span>
                    </td>
                    <td className="text-right px-4 py-3 text-[10px] text-slate-500">
                      {entry.completedAt ? new Date(entry.completedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ImageTestWizard
        open={imageWizardOpen}
        api={api}
        onClose={() => setImageWizardOpen(false)}
        onCreated={() => loadData()}
      />
      <PriceTestWizard
        open={priceWizardOpen}
        api={api}
        onClose={() => setPriceWizardOpen(false)}
        onCreated={() => loadData()}
      />
    </div>
  );
}

function KPICard({
  label, value, sublabel, color,
}: {
  label: string; value: string; sublabel?: string;
  color: "teal" | "cyan" | "violet" | "amber";
}) {
  const borderColor = {
    teal: "border-l-teal-500",
    cyan: "border-l-cyan-500",
    violet: "border-l-violet-500",
    amber: "border-l-amber-500",
  }[color];

  return (
    <div className={`bg-slate-900 border border-slate-800 ${borderColor} border-l-2 rounded-lg p-4`}>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-slate-100">{value}</p>
      {sublabel && <p className="text-[10px] text-slate-500 mt-1">{sublabel}</p>}
    </div>
  );
}
