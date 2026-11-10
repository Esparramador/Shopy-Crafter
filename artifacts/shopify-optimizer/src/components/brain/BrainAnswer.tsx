/**
 * La respuesta del cerebro a una pregunta suelta (paleta de comandos, buscador
 * universal): el texto, las acciones que propone con su botón «Ejecutar» y el
 * resultado de cada una. Las destructivas piden confirmación (fetchBrainAction).
 */
import { useState } from "react";
import { Play, Check, X, Loader2 } from "lucide-react";
import { cleanMarkdownLite } from "@/lib/sanitize";
import { humanizeAction, runBrainAction, type BrainActionOutcome, type BrainAnswer as Answer } from "@/lib/brain-ask";
import "./brain.css";

function paramsPreview(params: Record<string, unknown> | undefined): string {
  if (!params) return "";
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
  return parts.join(" · ");
}

export function BrainAnswerSkeleton({ label = "ShopyBrain está pensando…" }: { label?: string }) {
  return (
    <div className="brain-answer" aria-live="polite" aria-busy="true">
      <div className="brain-answer-head"><span className="brain-answer-orb" aria-hidden="true">✦</span>{label}</div>
      <div className="brain-skel" aria-hidden="true"><span /><span /><span /></div>
    </div>
  );
}

export function BrainAnswer({ answer, extra }: { answer: Answer; extra?: React.ReactNode }) {
  const [running, setRunning] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, BrainActionOutcome>>({});

  const run = async (i: number) => {
    const a = answer.actions[i];
    if (!a || running !== null) return;
    setRunning(i);
    const out = await runBrainAction(a);
    setResults(r => ({ ...r, [i]: out }));
    setRunning(null);
  };

  return (
    <div className="brain-answer" aria-live="polite">
      <div className="brain-answer-head">
        <span className="brain-answer-orb" aria-hidden="true">✦</span>
        <span>ShopyBrain</span>
        {answer.source && <span className="brain-mono" title="Motor que ha respondido">{answer.source}</span>}
        {answer.entityKnowledgeUsed && <span className="brain-pill brain-tone-jade">Usó lo que ya sabía</span>}
      </div>

      {answer.answer
        ? <div className="brain-answer-text" dangerouslySetInnerHTML={{ __html: cleanMarkdownLite(answer.answer) }} />
        : <div className="brain-answer-text" style={{ color: "var(--t3)" }}>El cerebro no ha devuelto texto.</div>}

      {answer.actions.length > 0 && (
        <div className="brain-answer-actions">
          {answer.actions.map((a, i) => {
            const res = results[i];
            return (
              <div key={`${a.action}-${i}`} className="brain-action-row">
                <span className="brain-action-name">{humanizeAction(a.action)}</span>
                <span className="brain-action-params" title={paramsPreview(a.params)}>{paramsPreview(a.params) || a.action}</span>
                <button
                  type="button"
                  className={`btn btn-sm ${res?.ok ? "btn-jade" : "btn-gold"}`}
                  onClick={() => run(i)}
                  disabled={running !== null || res?.ok === true}
                  aria-label={`Ejecutar ${humanizeAction(a.action)}`}
                >
                  {running === i ? <Loader2 size={13} className="animate-spin" /> : res?.ok ? <Check size={13} /> : <Play size={13} />}
                  {running === i ? "Ejecutando…" : res?.ok ? "Hecho" : res ? "Reintentar" : "Ejecutar"}
                </button>
                {res && (
                  <div className={`brain-action-result ${res.ok ? "is-ok" : res.cancelled ? "is-cancel" : "is-err"}`}>
                    {!res.ok && !res.cancelled && <X size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />}
                    <span dangerouslySetInnerHTML={{ __html: cleanMarkdownLite(res.message) }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {extra}
    </div>
  );
}
