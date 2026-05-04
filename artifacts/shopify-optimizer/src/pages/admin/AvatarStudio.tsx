import { useEffect, useState } from "react";
import { useListProjects } from "@workspace/api-client-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

type AvatarPreset = {
  id: string;
  name: string;
  niche: string;
  gender: string;
  defaultLanguage: string;
  defaultVoiceId: string;
  personaPrompt: string;
  visualArchetype: string;
};

type AvatarLibrary = {
  library: AvatarPreset[];
  grouped: Record<string, AvatarPreset[]>;
};

type Mode = "talking" | "product";

const ASPECTS = ["9:16", "16:9", "1:1"] as const;
const VOICE_MODELS = [
  { id: "eleven_multilingual_v2", label: "Multilingual v2 (calidad alta, ES/EN)" },
  { id: "eleven_turbo_v2_5", label: "Turbo v2.5 (rápido)" },
  { id: "eleven_flash_v2_5", label: "Flash v2.5 (instantáneo)" },
];
const VIDEO_MODELS = [
  { id: "kling-master", label: "Kling Master (calidad cinemática)" },
  { id: "kling-1.6", label: "Kling 1.6 (rápido)" },
  { id: "runway-gen3", label: "Runway Gen3 (foto-real)" },
];
const IMAGE_MODELS = [
  { id: "nano-banana", label: "Nano Banana (recomendado)" },
  { id: "ideogram-v3", label: "Ideogram v3" },
  { id: "flux-schnell", label: "Flux Schnell (rápido)" },
];

export default function AvatarStudio() {
  const { data: projects } = useListProjects() as { data: Array<{ id: number; name: string }> | undefined };
  const [projectId, setProjectId] = useState<number | null>(null);
  const [library, setLibrary] = useState<AvatarLibrary | null>(null);
  const [mode, setMode] = useState<Mode>("talking");
  const [avatarId, setAvatarId] = useState<string>("");
  const [customAvatar, setCustomAvatar] = useState<File | null>(null);
  const [customPresenter, setCustomPresenter] = useState<File | null>(null);
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productVaultId, setProductVaultId] = useState<string>("");
  const [script, setScript] = useState<string>("");
  const [voiceId, setVoiceId] = useState<string>("");
  const [voiceModel, setVoiceModel] = useState<string>("eleven_multilingual_v2");
  const [language, setLanguage] = useState<string>("es");
  const [aspect, setAspect] = useState<typeof ASPECTS[number]>("9:16");
  const [imageModel, setImageModel] = useState<string>("nano-banana");
  const [videoModel, setVideoModel] = useState<string>("kling-master");
  const [applyLipSync, setApplyLipSync] = useState<boolean>(true);

  const [busy, setBusy] = useState<boolean>(false);
  const [progress, setProgress] = useState<string>("");
  const [result, setResult] = useState<{ vaultId: number; sizeBytes: number; durationSec: number; videoUrl?: string } | null>(null);
  const [error, setError] = useState<string>("");

  // Preselect project & load library
  useEffect(() => {
    if (projects && projects.length && projectId === null) setProjectId(projects[0].id);
  }, [projects, projectId]);

  useEffect(() => {
    fetch(`${API}/api/fs-pro/avatars/library`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j) setLibrary(j); })
      .catch(() => {});
  }, []);

  const selectedAvatar = library?.library.find(a => a.id === avatarId) || null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    if (projectId === null || projectId === undefined) { setError("Selecciona un proyecto"); return; }
    if (!script.trim()) { setError("Escribe el guion (script)"); return; }
    if (!avatarId && !(mode === "talking" ? customAvatar : customPresenter)) {
      setError("Selecciona un avatar o sube una foto personalizada");
      return;
    }
    if (mode === "product" && !productImage && !productVaultId.trim()) {
      setError("Sube una imagen del producto o indica un productVaultId");
      return;
    }

    setBusy(true);
    setProgress("Generando avatar (imagen → video → voz → mux → lip-sync)... esto puede tardar 1-3 min");

    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      fd.append("script", script);
      if (avatarId) fd.append("avatarId", avatarId);
      if (voiceId.trim()) fd.append("voiceId", voiceId.trim());
      if (voiceModel) fd.append("voiceModel", voiceModel);
      if (language) fd.append("language", language);
      if (aspect) fd.append("aspect", aspect);
      if (imageModel) fd.append("imageModel", imageModel);
      if (videoModel) fd.append("videoModel", videoModel);
      fd.append("applyLipSync", applyLipSync ? "true" : "false");

      let endpoint = "";
      if (mode === "talking") {
        endpoint = `${API}/api/fs-pro/avatar/talking`;
        if (customAvatar) fd.append("customAvatar", customAvatar);
      } else {
        endpoint = `${API}/api/fs-pro/avatar/product`;
        if (productImage) fd.append("product", productImage);
        if (productVaultId.trim()) fd.append("productVaultId", productVaultId.trim());
        if (customPresenter) fd.append("customPresenter", customPresenter);
      }

      const r = await fetch(endpoint, { method: "POST", credentials: "include", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);

      setResult({
        vaultId: j.vaultId,
        sizeBytes: j.sizeBytes,
        durationSec: j.durationSec,
        videoUrl: `${API}/api/projects/${projectId}/vault/file/${j.vaultId}/download`,
      });
      setProgress("");
    } catch (err: any) {
      setError(err?.message || "Error generando avatar");
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  const niches = library ? Object.keys(library.grouped) : [];

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto", color: "var(--t1)" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: "var(--gold)" }}>🎬 Avatar Studio</h1>
        <p style={{ color: "var(--t3)", fontSize: 13, marginTop: 4 }}>
          Genera videos de avatares hablando o avatares mostrando productos. Pipeline integrado multi-motor.
          Pipeline: imagen → video → voz ElevenLabs → mux → lip-sync (Replicate cudanexus/lipsync-v2).
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button onClick={() => setMode("talking")} style={modeBtnStyle(mode === "talking")}>
          🗣 Talking Avatar
        </button>
        <button onClick={() => setMode("product")} style={modeBtnStyle(mode === "product")}>
          🛍 Product Avatar (persona + producto)
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* COLUMNA IZQUIERDA */}
        <div style={cardStyle}>
          <Section title="1. Proyecto">
            <select value={projectId ?? ""} onChange={e => setProjectId(parseInt(e.target.value))} style={inputStyle}>
              <option value="">— Selecciona —</option>
              {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Section>

          <Section title="2. Avatar (presentador)">
            {niches.length === 0 ? (
              <p style={{ color: "var(--t3)", fontSize: 12 }}>Cargando librería de avatares…</p>
            ) : (
              <>
                <select value={avatarId} onChange={e => setAvatarId(e.target.value)} style={inputStyle}>
                  <option value="">— Sin avatar de la librería (usar foto custom) —</option>
                  {niches.map(niche => (
                    <optgroup key={niche} label={niche.toUpperCase()}>
                      {library!.grouped[niche].map(a => (
                        <option key={a.id} value={a.id}>{a.name} · {a.gender} · {a.defaultLanguage}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {selectedAvatar && (
                  <div style={{ marginTop: 8, padding: 10, background: "var(--ink2)", borderRadius: 6, fontSize: 11, color: "var(--t2)" }}>
                    <div><b>Persona:</b> {selectedAvatar.personaPrompt.slice(0, 200)}…</div>
                    <div style={{ marginTop: 4 }}><b>Voz por defecto:</b> {selectedAvatar.defaultVoiceId} ({selectedAvatar.defaultLanguage})</div>
                  </div>
                )}
              </>
            )}

            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 12, color: "var(--t3)" }}>O sube tu propia foto de presentador (opcional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={e => mode === "talking" ? setCustomAvatar(e.target.files?.[0] || null) : setCustomPresenter(e.target.files?.[0] || null)}
                style={{ ...inputStyle, padding: 6 }}
              />
            </div>
          </Section>

          {mode === "product" && (
            <Section title="3. Producto (imagen)">
              <input
                type="file"
                accept="image/*"
                onChange={e => setProductImage(e.target.files?.[0] || null)}
                style={{ ...inputStyle, padding: 6 }}
              />
              <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 6 }}>
                O usa un Vault ID si la imagen ya está guardada en el repositorio:
              </p>
              <input
                type="text"
                placeholder="productVaultId (opcional)"
                value={productVaultId}
                onChange={e => setProductVaultId(e.target.value)}
                style={inputStyle}
              />
            </Section>
          )}

          <Section title={mode === "product" ? "4. Configuración técnica" : "3. Configuración técnica"}>
            <Row>
              <Field label="Aspecto">
                <select value={aspect} onChange={e => setAspect(e.target.value as typeof ASPECTS[number])} style={inputStyle}>
                  {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Idioma (código)">
                <input type="text" value={language} onChange={e => setLanguage(e.target.value)} placeholder="es" style={inputStyle} />
              </Field>
            </Row>
            <Row>
              <Field label="Modelo de imagen">
                <select value={imageModel} onChange={e => setImageModel(e.target.value)} style={inputStyle}>
                  {IMAGE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </Field>
              <Field label="Modelo de video">
                <select value={videoModel} onChange={e => setVideoModel(e.target.value)} style={inputStyle}>
                  {VIDEO_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </Field>
            </Row>
            <Row>
              <Field label="Modelo de voz (ElevenLabs)">
                <select value={voiceModel} onChange={e => setVoiceModel(e.target.value)} style={inputStyle}>
                  {VOICE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </Field>
              <Field label="Voice ID custom (opcional)">
                <input type="text" value={voiceId} onChange={e => setVoiceId(e.target.value)} placeholder="ID ElevenLabs" style={inputStyle} />
              </Field>
            </Row>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 8 }}>
              <input type="checkbox" checked={applyLipSync} onChange={e => setApplyLipSync(e.target.checked)} />
              Aplicar lip-sync con Replicate (recomendado)
            </label>
          </Section>
        </div>

        {/* COLUMNA DERECHA */}
        <div style={cardStyle}>
          <Section title="Guion (script)">
            <textarea
              value={script}
              onChange={e => setScript(e.target.value)}
              placeholder={mode === "talking"
                ? "Hola, soy Sofía y hoy te quiero contar 3 secretos que cambiarán tu manera de comprar online…"
                : "Mira esta camiseta. La tela es 100% algodón orgánico, el corte es slim fit, y a 29€ es de las mejores compras de la temporada…"}
              rows={10}
              style={{ ...inputStyle, fontFamily: "inherit", lineHeight: 1.5 }}
            />
            <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>
              {script.trim().split(/\s+/).filter(Boolean).length} palabras · ~{Math.max(4, Math.min(10, Math.round(script.trim().split(/\s+/).filter(Boolean).length / 2.5)))}s de video
            </div>
          </Section>

          <button
            type="submit"
            disabled={busy}
            style={{
              width: "100%", padding: "14px 20px", marginTop: 12,
              background: busy ? "var(--ink2)" : "linear-gradient(135deg, var(--gold), #d4af3a)",
              color: busy ? "var(--t3)" : "#0a0a0f",
              border: "none", borderRadius: 8, cursor: busy ? "wait" : "pointer",
              fontSize: 14, fontWeight: 700, transition: "0.2s",
            }}
          >
            {busy ? "⏳ Generando…" : `🎬 Generar ${mode === "talking" ? "Talking Avatar" : "Product Avatar"}`}
          </button>

          {progress && (
            <div style={{ marginTop: 12, padding: 12, background: "var(--ink2)", borderRadius: 6, fontSize: 12, color: "var(--t2)" }}>
              {progress}
            </div>
          )}
          {error && (
            <div style={{ marginTop: 12, padding: 12, background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.4)", borderRadius: 6, fontSize: 12, color: "#ff8080" }}>
              ❌ {error}
            </div>
          )}
          {result && (
            <div style={{ marginTop: 12, padding: 14, background: "rgba(80,200,120,0.07)", border: "1px solid rgba(80,200,120,0.3)", borderRadius: 6 }}>
              <div style={{ fontSize: 13, color: "var(--gold)", fontWeight: 600, marginBottom: 8 }}>
                ✅ Video generado · {(result.sizeBytes / 1024 / 1024).toFixed(1)} MB · {result.durationSec}s
              </div>
              <div style={{ fontSize: 12, color: "var(--t2)" }}>Vault ID: {result.vaultId}</div>
              {result.videoUrl && (
                <video
                  src={result.videoUrl}
                  controls
                  style={{ width: "100%", maxHeight: 360, marginTop: 10, borderRadius: 6, background: "#000" }}
                />
              )}
              <a
                href={result.videoUrl}
                download={`avatar-${result.vaultId}.mp4`}
                style={{ display: "inline-block", marginTop: 8, padding: "6px 12px", background: "var(--ink2)", border: "1px solid var(--ink3)", borderRadius: 6, color: "var(--gold)", fontSize: 12, textDecoration: "none" }}
              >
                ⬇ Descargar MP4
              </a>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--gold)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, color: "var(--t3)", marginBottom: 3 }}>{label}</label>
      {children}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--ink)",
  border: "1px solid var(--ink3)",
  borderRadius: 10,
  padding: 16,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "var(--ink2)",
  border: "1px solid var(--ink3)",
  borderRadius: 6,
  color: "var(--t1)",
  fontSize: 12,
  outline: "none",
};

function modeBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "10px 16px",
    background: active ? "linear-gradient(135deg, var(--gold), #d4af3a)" : "var(--ink2)",
    color: active ? "#0a0a0f" : "var(--t2)",
    border: `1px solid ${active ? "var(--gold)" : "var(--ink3)"}`,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "0.2s",
  };
}
