import { useState } from "react";
import {
  FLOW_TEMPLATES, ALL_ANIMATIONS, ANIM_CATEGORIES,
  FLOW_STAGE_LABELS, CHARACTER_PROMPTS, MESHY_CHARACTERS,
  type FlowTemplate, type FlowStage, type MeshyCharacter,
} from "@/lib/meshyModels";
import ModelViewer3D from "@/components/ModelViewer3D";
import { Copy, CheckCircle2, Sparkles, Zap, Info } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FlowConfig {
  intro: number;
  idle: number;
  interact: number;
  success: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAnimForChar(charId: string, actionId: number) {
  const char = MESHY_CHARACTERS.find(c => c.id === charId);
  const animDef = ALL_ANIMATIONS.find(a => a.action_id === actionId);
  if (!animDef || !char) return null;
  return char.animations.find(a => a.name === animDef.id) ?? null;
}

function hasAnim(charId: string, actionId: number): boolean {
  return !!getAnimForChar(charId, actionId);
}

// ── Stage pill ────────────────────────────────────────────────────────────────

function StagePill({
  stage, actionId, charId, selected, onClick,
}: {
  stage: FlowStage; actionId: number; charId: string; selected: boolean; onClick: () => void;
}) {
  const animDef = ALL_ANIMATIONS.find(a => a.action_id === actionId);
  const available = hasAnim(charId, actionId);
  const stageInfo = FLOW_STAGE_LABELS[stage];

  return (
    <button
      onClick={onClick}
      disabled={!available}
      style={{
        padding: "8px 14px", borderRadius: 10, border: "1px solid", cursor: available ? "pointer" : "not-allowed",
        background: selected ? `${stageInfo.color}22` : "rgba(255,255,255,0.02)",
        borderColor: selected ? stageInfo.color : available ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
        color: selected ? stageInfo.color : available ? "var(--l-t2)" : "#444",
        textAlign: "left", width: "100%", transition: "all 0.15s",
        opacity: available ? 1 : 0.45,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 2, color: selected ? stageInfo.color : "#666" }}>
        {stageInfo.icon} {stageInfo.label.toUpperCase()}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600 }}>{animDef?.label ?? `Action ${actionId}`}</div>
      {!available && <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>No disponible para este personaje</div>}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AnimationFlowPicker() {
  const riggedChars = MESHY_CHARACTERS.filter(c => c.rigStatus === "rigged");

  const [selectedChar, setSelectedChar] = useState<MeshyCharacter>(riggedChars[0]);
  const [activeStage, setActiveStage] = useState<FlowStage>("intro");
  const [flowConfig, setFlowConfig] = useState<FlowConfig>(() => {
    // Default from first template
    const t = FLOW_TEMPLATES[0];
    return { intro: t.stages.intro.action_id, idle: t.stages.idle.action_id, interact: t.stages.interact.action_id, success: t.stages.success.action_id };
  });
  const [activeTemplate, setActiveTemplate] = useState<string>(FLOW_TEMPLATES[0].id);
  const [animCatFilter, setAnimCatFilter] = useState("all");
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"flow" | "library" | "prompts">("flow");

  const currentAnimDef = ALL_ANIMATIONS.find(a => a.action_id === flowConfig[activeStage]);
  const previewAnim = currentAnimDef ? getAnimForChar(selectedChar.id, currentAnimDef.action_id) : null;

  const applyTemplate = (t: FlowTemplate) => {
    setActiveTemplate(t.id);
    setFlowConfig({
      intro:    t.stages.intro.action_id,
      idle:     t.stages.idle.action_id,
      interact: t.stages.interact.action_id,
      success:  t.stages.success.action_id,
    });
    setActiveStage("intro");
  };

  const setStageAnim = (stage: FlowStage, actionId: number) => {
    setFlowConfig(prev => ({ ...prev, [stage]: actionId }));
    setActiveTemplate("custom");
  };

  const copyPrompt = (text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedPrompt(id);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  const STAGES: FlowStage[] = ["intro", "idle", "interact", "success"];

  const filteredAnims = animCatFilter === "all"
    ? ALL_ANIMATIONS
    : ALL_ANIMATIONS.filter(a => a.category === animCatFilter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: 0 }}>
        {([
          { id: "flow",    label: "🎬 Flujo Visme",      desc: "Configura entrada/espera/acción/éxito" },
          { id: "library", label: "📚 Librería (20 anims)", desc: "Todas las animaciones disponibles" },
          { id: "prompts", label: "✏️ Prompts IA",        desc: "Genera personajes compatibles" },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: "7px 14px", border: "none", cursor: "pointer", borderRadius: "6px 6px 0 0",
            fontSize: 12, fontWeight: activeTab === t.id ? 600 : 400,
            background: activeTab === t.id ? "rgba(212,168,67,0.15)" : "transparent",
            color: activeTab === t.id ? "var(--l-gold)" : "var(--l-t3)",
            borderBottom: activeTab === t.id ? "2px solid var(--l-gold)" : "2px solid transparent",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ FLUJO VISME ══════════════════════════════════════════════════ */}
      {activeTab === "flow" && (
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16 }}>

          {/* LEFT: templates + char picker */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Character */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--l-t4)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Personaje</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {riggedChars.map(c => (
                  <button key={c.id} onClick={() => setSelectedChar(c)} style={{
                    padding: "6px 10px", border: "1px solid", borderRadius: 8, cursor: "pointer",
                    textAlign: "left", display: "flex", alignItems: "center", gap: 8, transition: "all 0.12s",
                    borderColor: selectedChar.id === c.id ? "var(--l-gold)" : "rgba(255,255,255,0.08)",
                    background: selectedChar.id === c.id ? "rgba(212,168,67,0.08)" : "transparent",
                  }}>
                    <span style={{ fontSize: 18 }}>{c.emoji}</span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--l-t)" }}>{c.name}</div>
                      <div style={{ fontSize: 9, color: "var(--l-t4)" }}>{c.animations.length} animaciones</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Templates */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--l-t4)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Plantillas</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {FLOW_TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => applyTemplate(t)} style={{
                    padding: "7px 10px", border: "1px solid", borderRadius: 8, cursor: "pointer",
                    textAlign: "left", transition: "all 0.12s",
                    borderColor: activeTemplate === t.id ? "var(--l-gold)" : "rgba(255,255,255,0.08)",
                    background: activeTemplate === t.id ? "rgba(212,168,67,0.08)" : "transparent",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: activeTemplate === t.id ? "var(--l-gold)" : "var(--l-t)" }}>{t.name}</div>
                    <div style={{ fontSize: 9, color: "var(--l-t4)", marginTop: 2, lineHeight: 1.4 }}>{t.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: viewer + flow config */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Stage selector bar */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              {STAGES.map(stage => (
                <button
                  key={stage}
                  onClick={() => setActiveStage(stage)}
                  style={{
                    padding: "8px 10px", borderRadius: 10, border: "2px solid", cursor: "pointer", textAlign: "center", transition: "all 0.15s",
                    borderColor: activeStage === stage ? FLOW_STAGE_LABELS[stage].color : "rgba(255,255,255,0.08)",
                    background: activeStage === stage ? `${FLOW_STAGE_LABELS[stage].color}18` : "rgba(255,255,255,0.02)",
                  }}
                >
                  <div style={{ fontSize: 14 }}>{FLOW_STAGE_LABELS[stage].icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: activeStage === stage ? FLOW_STAGE_LABELS[stage].color : "var(--l-t3)", letterSpacing: "0.05em" }}>
                    {FLOW_STAGE_LABELS[stage].label.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 9, color: "var(--l-t4)", marginTop: 2 }}>
                    {ALL_ANIMATIONS.find(a => a.action_id === flowConfig[stage])?.label_short ?? "-"}
                  </div>
                </button>
              ))}
            </div>

            {/* 3D Viewer + animation picker */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 12 }}>

              {/* Viewer */}
              <ModelViewer3D
                glbPath={selectedChar.glbPath}
                animations={previewAnim ? [previewAnim] : []}
                characterName={`${selectedChar.emoji} ${selectedChar.name} — ${FLOW_STAGE_LABELS[activeStage].icon} ${FLOW_STAGE_LABELS[activeStage].label}`}
                height={360}
                autoRotate={false}
              />

              {/* Animation picker for current stage */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, overflowY: "auto", maxHeight: 420 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: FLOW_STAGE_LABELS[activeStage].color, letterSpacing: "0.06em", marginBottom: 4 }}>
                  {FLOW_STAGE_LABELS[activeStage].icon} ANIMACIÓN PARA "{FLOW_STAGE_LABELS[activeStage].label.toUpperCase()}"
                </div>
                {ALL_ANIMATIONS.map(anim => {
                  const avail = hasAnim(selectedChar.id, anim.action_id);
                  const isCurrent = flowConfig[activeStage] === anim.action_id;
                  return (
                    <button
                      key={anim.action_id}
                      onClick={() => avail && setStageAnim(activeStage, anim.action_id)}
                      disabled={!avail}
                      style={{
                        padding: "6px 8px", borderRadius: 7, border: "1px solid", cursor: avail ? "pointer" : "not-allowed",
                        textAlign: "left", transition: "all 0.1s",
                        background: isCurrent ? `${FLOW_STAGE_LABELS[activeStage].color}22` : avail ? "rgba(255,255,255,0.02)" : "transparent",
                        borderColor: isCurrent ? FLOW_STAGE_LABELS[activeStage].color : avail ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                        opacity: avail ? 1 : 0.35,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: isCurrent ? 700 : 400, color: isCurrent ? FLOW_STAGE_LABELS[activeStage].color : "var(--l-t2)" }}>
                        {anim.label}
                      </div>
                      <div style={{ fontSize: 9, color: "var(--l-t4)", marginTop: 1 }}>
                        {anim.looping ? "🔄 Loop" : `⏱ ${(anim.duration_ms/1000).toFixed(1)}s`}
                        {!avail && " · sin GLB"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Flow summary */}
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--l-t4)", letterSpacing: "0.06em", marginBottom: 8 }}>FLUJO CONFIGURADO</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {STAGES.map((stage, i) => {
                  const animDef = ALL_ANIMATIONS.find(a => a.action_id === flowConfig[stage]);
                  const avail = hasAnim(selectedChar.id, flowConfig[stage]);
                  const si = FLOW_STAGE_LABELS[stage];
                  return (
                    <>
                      <div key={stage} style={{
                        padding: "4px 10px", borderRadius: 20, fontSize: 11,
                        background: avail ? `${si.color}18` : "rgba(255,71,87,0.1)",
                        border: `1px solid ${avail ? si.color + "44" : "rgba(255,71,87,0.3)"}`,
                        color: avail ? si.color : "#ff4757",
                      }}>
                        {si.icon} {animDef?.label_short}
                      </div>
                      {i < 3 && <span style={{ color: "#444", fontSize: 12 }}>→</span>}
                    </>
                  );
                })}
              </div>
              {/* Export config */}
              <button
                onClick={() => copyPrompt(JSON.stringify({ char: selectedChar.id, flow: flowConfig }, null, 2), "flow")}
                style={{ marginTop: 8, padding: "4px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer", border: "1px solid rgba(212,168,67,0.3)", background: "rgba(212,168,67,0.08)", color: "var(--l-gold)", display: "flex", alignItems: "center", gap: 5 }}
              >
                {copiedPrompt === "flow" ? <CheckCircle2 size={11} /> : <Copy size={11} />}
                {copiedPrompt === "flow" ? "¡Copiado!" : "Copiar config JSON"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ LIBRERÍA ══════════════════════════════════════════════════════ */}
      {activeTab === "library" && (
        <div>
          {/* Category filter */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {[{ id:"all", label:"Todas (20)" }, ...ANIM_CATEGORIES.map(c => ({ id: c.id, label: c.label }))].map(c => (
              <button key={c.id} onClick={() => setAnimCatFilter(c.id)} style={{
                padding: "4px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer", border: "1px solid",
                borderColor: animCatFilter === c.id ? "var(--l-gold)" : "rgba(255,255,255,0.1)",
                background: animCatFilter === c.id ? "rgba(212,168,67,0.15)" : "transparent",
                color: animCatFilter === c.id ? "var(--l-gold)" : "var(--l-t3)",
              }}>
                {c.label}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {filteredAnims.map(anim => {
              const charAvailability = MESHY_CHARACTERS
                .filter(c => c.rigStatus === "rigged" && c.animations.some(a => a.name === anim.id))
                .map(c => c.emoji);
              const phaseInfo = FLOW_STAGE_LABELS[anim.visme_phase as FlowStage] ?? { color: "#888", icon: "🎬", label: anim.visme_phase };
              return (
                <div key={anim.action_id} style={{ padding: "12px 14px", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, background: "rgba(255,255,255,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--l-t)" }}>{anim.label}</span>
                      <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 6px", borderRadius: 8, background: "rgba(255,255,255,0.06)", color: "var(--l-t4)" }}>
                        action_id={anim.action_id}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: `${phaseInfo.color}18`, color: phaseInfo.color, border: `1px solid ${phaseInfo.color}44` }}>
                      {phaseInfo.icon} {phaseInfo.label}
                    </span>
                  </div>

                  <div style={{ fontSize: 10, color: "var(--l-jade)", fontFamily: "monospace", marginBottom: 6 }}>{anim.name}</div>

                  <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
                    {anim.best_for.map(b => (
                      <span key={b} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 6, background: "rgba(255,255,255,0.05)", color: "var(--l-t4)" }}>{b}</span>
                    ))}
                  </div>

                  {/* Character availability */}
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: "var(--l-t4)" }}>Disponible:</span>
                    {charAvailability.length > 0
                      ? charAvailability.map(e => <span key={e} style={{ fontSize: 14 }}>{e}</span>)
                      : <span style={{ fontSize: 9, color: "#ff4757" }}>Ningún personaje aún</span>
                    }
                    <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--l-t4)" }}>
                      {anim.looping ? "🔄 Loop" : `⏱ ${(anim.duration_ms/1000).toFixed(1)}s`}
                    </span>
                  </div>

                  {/* Trigger chips */}
                  <div style={{ marginTop: 8, display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {anim.triggers.map(tr => (
                      <span key={tr} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 5, background: "rgba(212,168,67,0.08)", color: "#d4a84388", fontFamily: "monospace" }}>{tr}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ PROMPTS IA ════════════════════════════════════════════════════ */}
      {activeTab === "prompts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(212,168,67,0.06)", border: "1px solid rgba(212,168,67,0.2)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
              <Info size={13} style={{ color: "var(--l-gold)" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--l-gold)" }}>Cómo generar personajes compatibles con animaciones</span>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: "var(--l-t3)", lineHeight: 1.6 }}>
              Para que el auto-rig de Meshy funcione, el personaje debe tener <strong>proporciones humanoides, A-pose o T-pose, y sin accesorios que bloqueen las articulaciones</strong>. Usa estos prompts como base en Texto → 3D o Imagen → 3D.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 12 }}>
            {CHARACTER_PROMPTS.map(p => (
              <div key={p.id} style={{ padding: "14px 16px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, background: "rgba(255,255,255,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--l-t)" }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: "var(--l-t4)", marginTop: 2 }}>{p.subtitle}</div>
                  </div>
                  <div style={{ fontSize: 10, padding: "3px 8px", borderRadius: 10, background: "rgba(100,220,160,0.1)", color: "var(--l-jade)", border: "1px solid rgba(100,220,160,0.25)" }}>
                    {p.compatible_actions.length} acciones compat.
                  </div>
                </div>

                {/* Prompt box */}
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: "var(--l-t3)", marginBottom: 3 }}>Prompt base (Texto → 3D):</div>
                  <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)", fontSize: 11, color: "var(--l-t2)", lineHeight: 1.5, fontFamily: "monospace" }}>
                    {p.base_prompt}
                  </div>
                  <button
                    onClick={() => copyPrompt(p.base_prompt, p.id + "_prompt")}
                    style={{ position: "absolute", top: 24, right: 6, padding: "3px 6px", borderRadius: 5, background: "rgba(212,168,67,0.15)", border: "1px solid rgba(212,168,67,0.3)", color: "var(--l-gold)", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", gap: 4 }}
                  >
                    {copiedPrompt === p.id + "_prompt" ? <CheckCircle2 size={10} /> : <Copy size={10} />}
                    {copiedPrompt === p.id + "_prompt" ? "✓" : "Copiar"}
                  </button>
                </div>

                {/* Negative */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: "var(--l-t3)", marginBottom: 3 }}>Negative prompt:</div>
                  <div style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,71,87,0.06)", border: "1px solid rgba(255,71,87,0.15)", fontSize: 10, color: "#ff475788", lineHeight: 1.4, fontFamily: "monospace" }}>
                    {p.negative}
                  </div>
                  <button
                    onClick={() => copyPrompt(p.negative, p.id + "_neg")}
                    style={{ marginTop: 4, padding: "2px 8px", borderRadius: 5, background: "transparent", border: "1px solid rgba(255,71,87,0.2)", color: "#ff475788", cursor: "pointer", fontSize: 9, display: "inline-flex", alignItems: "center", gap: 3 }}
                  >
                    {copiedPrompt === p.id + "_neg" ? <CheckCircle2 size={9} /> : <Copy size={9} />} Copiar negativo
                  </button>
                </div>

                {/* Tip */}
                <div style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(212,168,67,0.06)", border: "1px solid rgba(212,168,67,0.15)" }}>
                  <span style={{ fontSize: 10, color: "var(--l-gold)" }}>💡 {p.tip}</span>
                </div>

                {/* Compatible actions */}
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 9, color: "var(--l-t4)", marginBottom: 4 }}>Animaciones compatibles:</div>
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {p.compatible_actions.map(id => {
                      const anim = ALL_ANIMATIONS.find(a => a.action_id === id);
                      return anim ? (
                        <span key={id} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 5, background: "rgba(255,255,255,0.05)", color: "var(--l-t4)" }}>
                          {anim.label_short}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Full generation workflow */}
          <div style={{ padding: "14px 16px", border: "1px solid rgba(100,220,160,0.25)", borderRadius: 12, background: "rgba(100,220,160,0.04)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--l-jade)", marginBottom: 8 }}>🔄 Workflow para cualquier personaje nuevo</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {[
                { step: "1", icon: "✏️", title: "Elige un prompt", desc: "Copia el prompt base según el tipo de personaje que quieres" },
                { step: "2", icon: "🧊", title: "Genera en Meshy", desc: "Usa Texto→3D o sube imagen en la Fábrica. Meshy-6 + A-pose" },
                { step: "3", icon: "🦴", title: "Auto-rig",        desc: "El pipeline genera el rig automáticamente si es humanoide" },
                { step: "4", icon: "💃", title: "Aplica animaciones",desc: "Elige un flujo Visme (intro/idle/interact/success) y asigna las animaciones disponibles" },
              ].map(s => (
                <div key={s.step} style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--l-t)", marginBottom: 3 }}>Paso {s.step}: {s.title}</div>
                  <div style={{ fontSize: 10, color: "var(--l-t4)", lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
