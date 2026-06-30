import { useState, useEffect, useCallback, useRef } from "react";
import { Shield, Search, ChevronRight, Tag, Lock, Target, BookOpen, X, ExternalLink, AlertTriangle, Loader2, Grid3X3, List, ScanLine, Globe, ChevronDown, ChevronUp, Swords, ShieldCheck, History, RotateCw } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface SkillMeta {
  id: string;
  name: string;
  description: string;
  subdomain: string;
  tags: string[];
  mitre_attack: string[];
  nist_csf: string[];
  overview: string;
  when_to_use: string[];
}
interface Domain { name: string; count: number; }

interface ProjectLite { id: number; name: string; shopDomain: string; }

type Severity = "critical" | "high" | "medium" | "low" | "info";

interface ScanFinding {
  id: string;
  category: string;
  severity: Severity;
  title: string;
  description: string;
  evidence?: string;
  attackerPerspective: string;
  hardeningSteps: string[];
  mitreAttack: string[];
  nistCsf: string[];
  relatedSkills: { id: string; name: string }[];
}

interface ScanResult {
  id?: number;
  url: string;
  scannedAt: string;
  techStack: any;
  findings: ScanFinding[];
  score: number;
  countsBySeverity: Record<Severity, number>;
}

interface ScanHistoryItem { id: number; url: string; score: number; summary: string; scannedAt: string; }

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "#e0405a", high: "#e2664f", medium: "#c8a84b", low: "#4fa3e2", info: "#7070a0",
};
const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Crítico", high: "Alto", medium: "Medio", low: "Bajo", info: "Info",
};
const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

function scoreColor(score: number) {
  if (score >= 80) return "#5db88a";
  if (score >= 50) return "#c8a84b";
  return "#e0405a";
}

// ─── Score gauge ──────────────────────────────────────────────────────────────
function ScoreGauge({ score }: { score: number }) {
  const c = scoreColor(score);
  const r = 42, circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);
  return (
    <div style={{ position: "relative", width: 110, height: 110, flexShrink: 0 }}>
      <svg width={110} height={110} viewBox="0 0 110 110">
        <circle cx={55} cy={55} r={r} fill="none" stroke="#1e1e2e" strokeWidth={9} />
        <circle cx={55} cy={55} r={r} fill="none" stroke={c} strokeWidth={9} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 55 55)" style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: c }}>{score}</div>
        <div style={{ fontSize: 9, color: "#7070a0", letterSpacing: 0.5 }}>/ 100</div>
      </div>
    </div>
  );
}

// ─── Finding card ─────────────────────────────────────────────────────────────
function FindingCard({ finding }: { finding: ScanFinding }) {
  const [open, setOpen] = useState(false);
  const c = SEVERITY_COLORS[finding.severity];
  return (
    <div style={{ background: "#0d0d18", border: `1px solid ${open ? c + "55" : "#1e1e2e"}`, borderRadius: 10, overflow: "hidden", transition: "border-color 0.15s" }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer" }}>
        <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 12, background: `${c}22`, color: c, fontWeight: 700, letterSpacing: 0.3, flexShrink: 0, textTransform: "uppercase" }}>
          {SEVERITY_LABELS[finding.severity]}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#e8e8f0" }}>{finding.title}</div>
          <div style={{ fontSize: 10, color: "#7070a0", marginTop: 1 }}>{finding.category}</div>
        </div>
        {open ? <ChevronUp size={14} color="#7070a0" /> : <ChevronDown size={14} color="#7070a0" />}
      </div>
      {open && (
        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11.5, color: "#c0c0d8", lineHeight: 1.6 }}>{finding.description}</div>
          {finding.evidence && (
            <div style={{ fontSize: 10.5, color: "#5db88a", background: "#09091a", border: "1px solid #1e1e2e", borderRadius: 6, padding: "6px 10px", fontFamily: "monospace", overflowX: "auto" }}>
              {finding.evidence}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "#1a0a08", border: "1px solid rgba(226,102,79,0.25)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: "#e2664f" }}>
              <Swords size={12} /> Perspectiva del atacante
            </div>
            <div style={{ fontSize: 11.5, color: "#d0a8a0", lineHeight: 1.6 }}>{finding.attackerPerspective}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "#0a1a0a", border: "1px solid rgba(93,184,138,0.25)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: "#5db88a" }}>
              <ShieldCheck size={12} /> Plan de blindaje
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 3 }}>
              {finding.hardeningSteps.map((s, i) => (
                <li key={i} style={{ fontSize: 11.5, color: "#a8d0b8", lineHeight: 1.5 }}>{s}</li>
              ))}
            </ul>
          </div>
          {(finding.mitreAttack?.length > 0 || finding.nistCsf?.length > 0) && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {finding.mitreAttack?.map(m => (
                <span key={m} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 12, background: "#1a0a08", color: "#e06060", border: "1px solid rgba(220,80,80,0.25)", fontWeight: 600 }}>⚔️ {m}</span>
              ))}
              {finding.nistCsf?.map(n => (
                <span key={n} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 12, background: "#0a1a0a", color: "#5db88a", border: "1px solid rgba(93,184,138,0.25)", fontWeight: 600 }}>🛡 {n}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Scanner panel ────────────────────────────────────────────────────────────
function ScannerPanel() {
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [severityFilter, setSeverityFilter] = useState<Severity | "">("");

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/projects-list`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : [];
        setProjects(list);
        if (list.length > 0) {
          setProjectId(String(list[0].id));
          setUrl(list[0].shopDomain || "");
        }
      })
      .catch(() => {});
  }, []);

  const loadHistory = useCallback((pid: string) => {
    if (!pid) { setHistory([]); return; }
    fetch(`${API_BASE}/api/projects/${pid}/security-scan/history`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setHistory(Array.isArray(d) ? d : []))
      .catch(() => setHistory([]));
  }, []);

  useEffect(() => { loadHistory(projectId); }, [projectId, loadHistory]);

  const handleProjectChange = (pid: string) => {
    setProjectId(pid);
    const p = projects.find(p => String(p.id) === pid);
    if (p) setUrl(p.shopDomain || "");
  };

  const runScan = async () => {
    if (!projectId) { setError("Selecciona un proyecto primero"); return; }
    if (!url.trim()) { setError("Indica una URL a escanear"); return; }
    setScanning(true); setError(""); setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/security-scan/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error ejecutando el escaneo");
      setResult(data);
      loadHistory(projectId);
    } catch (e: any) {
      setError(e.message || "Error desconocido");
    } finally {
      setScanning(false);
    }
  };

  const loadHistoryScan = async (id: number) => {
    setScanning(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/security-scan/${id}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error cargando escaneo");
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Error desconocido");
    } finally {
      setScanning(false);
    }
  };

  const filteredFindings = (result?.findings || [])
    .filter(f => !severityFilter || f.severity === severityFilter)
    .slice()
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "16px 20px", overflowY: "auto", flex: 1 }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", background: "#0d0d18", border: "1px solid #1e1e2e", borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 9, color: "#7070a0", textTransform: "uppercase", letterSpacing: 0.5 }}>Proyecto</label>
          <select value={projectId} onChange={e => handleProjectChange(e.target.value)}
            style={{ background: "#13131f", border: "1px solid #252535", borderRadius: 8, color: "#e8e8f0", fontSize: 12, padding: "8px 10px", minWidth: 180, outline: "none" }}>
            {projects.length === 0 && <option value="">Sin proyectos</option>}
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 240 }}>
          <label style={{ fontSize: 9, color: "#7070a0", textTransform: "uppercase", letterSpacing: 0.5 }}>URL a escanear</label>
          <div style={{ position: "relative" }}>
            <Globe size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#7070a0" }} />
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="midominio.com"
              style={{ width: "100%", paddingLeft: 28, paddingRight: 8, paddingTop: 8, paddingBottom: 8, background: "#13131f", border: "1px solid #252535", borderRadius: 8, color: "#e8e8f0", fontSize: 12, boxSizing: "border-box", outline: "none" }} />
          </div>
        </div>
        <button onClick={runScan} disabled={scanning}
          style={{ display: "flex", alignItems: "center", gap: 7, background: scanning ? "#252535" : "#c8a84b", border: "none", borderRadius: 8, color: scanning ? "#7070a0" : "#08080f", fontWeight: 700, fontSize: 12, padding: "9px 16px", cursor: scanning ? "not-allowed" : "pointer" }}>
          {scanning ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <ScanLine size={14} />}
          {scanning ? "Escaneando…" : "Escanear sitio"}
        </button>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#1a0a08", border: "1px solid rgba(220,80,80,0.3)", borderRadius: 8, color: "#e06060", fontSize: 12 }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* Result column */}
        <div style={{ flex: 2, minWidth: 320, display: "flex", flexDirection: "column", gap: 14 }}>
          {result ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 18, background: "#0d0d18", border: "1px solid #1e1e2e", borderRadius: 10, padding: 16 }}>
                <ScoreGauge score={result.score} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 12, color: "#7070a0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{result.url}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {SEVERITY_ORDER.map(sev => (
                      <button key={sev} onClick={() => setSeverityFilter(f => f === sev ? "" : sev)}
                        style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, padding: "4px 9px", borderRadius: 12, background: severityFilter === sev ? `${SEVERITY_COLORS[sev]}33` : `${SEVERITY_COLORS[sev]}18`, color: SEVERITY_COLORS[sev], border: `1px solid ${SEVERITY_COLORS[sev]}${severityFilter === sev ? "88" : "33"}`, fontWeight: 700, cursor: "pointer" }}>
                        {SEVERITY_LABELS[sev]} · {result.countsBySeverity[sev] ?? 0}
                      </button>
                    ))}
                  </div>
                  {result.techStack && (
                    <div style={{ fontSize: 10, color: "#404060" }}>
                      Stack detectado: {[result.techStack.cms, result.techStack.framework, result.techStack.ecommerce].filter(Boolean).join(" · ") || "no identificado"}
                    </div>
                  )}
                </div>
              </div>

              {filteredFindings.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 8 }}>
                  <ShieldCheck size={28} color="#5db88a" />
                  <div style={{ color: "#7070a0", fontSize: 12 }}>Sin hallazgos en esta categoría</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {filteredFindings.map(f => <FindingCard key={f.id} finding={f} />)}
                </div>
              )}
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 10, background: "#0d0d18", border: "1px solid #1e1e2e", borderRadius: 10 }}>
              <ScanLine size={32} color="#252535" />
              <div style={{ color: "#404060", fontSize: 13 }}>Selecciona un proyecto e indica la URL para lanzar un escaneo de seguridad pasivo</div>
            </div>
          )}
        </div>

        {/* History column */}
        <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, color: "#7070a0", textTransform: "uppercase", letterSpacing: 0.5 }}>
            <History size={12} /> Historial
          </div>
          {history.length === 0 ? (
            <div style={{ fontSize: 11, color: "#404060", padding: "10px 0" }}>Sin escaneos previos para este proyecto.</div>
          ) : (
            history.map(h => (
              <div key={h.id} onClick={() => loadHistoryScan(h.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "#0d0d18", border: "1px solid #1e1e2e", borderRadius: 8, cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = scoreColor(h.score) + "55"}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = "#1e1e2e"}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", border: `2px solid ${scoreColor(h.score)}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: scoreColor(h.score), flexShrink: 0 }}>
                  {h.score}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "#e8e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.url}</div>
                  <div style={{ fontSize: 9.5, color: "#404060" }}>{new Date(h.scannedAt).toLocaleString("es-ES")}</div>
                </div>
                <RotateCw size={11} color="#404060" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Color per subdomain ─────────────────────────────────────────────────────
const DOMAIN_COLORS: Record<string, string> = {
  "cloud-security": "#4fa3e2", "threat-hunting": "#c8a84b", "threat-intelligence": "#7e6dd6",
  "network-security": "#5db88a", "web-application-security": "#e2664f", "digital-forensics": "#4ecdc4",
  "malware-analysis": "#e2664f", "identity-access-management": "#b36e6e", "soc-operations": "#4fa3e2",
  "red-teaming": "#e87c5a", "container-security": "#5db88a", "security-operations": "#7e6dd6",
  "ot-ics-security": "#c8a84b", "api-security": "#4fa3e2", "incident-response": "#e2664f",
  "vulnerability-management": "#c8a84b", "penetration-testing": "#e87c5a", "devsecops": "#5db88a",
  "zero-trust-architecture": "#7e6dd6", "endpoint-security": "#4fa3e2", "cryptography": "#4ecdc4",
  "phishing-defense": "#c8a84b", "ai-security": "#7e6dd6", "mobile-security": "#5db88a",
  "ransomware-defense": "#e2664f", "compliance-governance": "#b36e6e", "supply-chain-security": "#c8a84b",
};
function domainColor(d: string) { return DOMAIN_COLORS[d] || "#7070a0"; }

function domainLabel(d: string) {
  return d.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}

// ─── Markdown renderer (minimal) ─────────────────────────────────────────────
function MarkdownBlock({ md }: { md: string }) {
  const html = md
    .replace(/^#{4}\s+(.+)$/gm, '<h4 style="color:#c8a84b;font-size:13px;margin:14px 0 5px">$1</h4>')
    .replace(/^#{3}\s+(.+)$/gm, '<h3 style="color:#c8a84b;font-size:14px;margin:16px 0 6px">$1</h3>')
    .replace(/^#{2}\s+(.+)$/gm, '<h2 style="color:#c8a84b;font-size:15px;margin:18px 0 8px;border-bottom:1px solid rgba(200,168,75,0.2);padding-bottom:4px">$1</h2>')
    .replace(/^#{1}\s+(.+)$/gm, '<h1 style="color:#c8a84b;font-size:18px;margin:20px 0 10px">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e8e8f0">$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:#13131f;color:#5db88a;padding:1px 5px;border-radius:3px;font-size:11px">$1</code>')
    .replace(/^- (.+)$/gm, '<li style="margin:3px 0;color:#c0c0d8">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li style="margin:3px 0;color:#c0c0d8">$1. $2</li>')
    .replace(/\n\n/g, '</p><p style="margin:8px 0;color:#c0c0d8">')
    .replace(/```([\s\S]+?)```/g, '<pre style="background:#09091a;border:1px solid #1e1e2e;border-radius:6px;padding:10px;overflow-x:auto;font-size:11px;color:#5db88a;margin:10px 0">$1</pre>');
  return <div dangerouslySetInnerHTML={{ __html: `<p style="margin:8px 0;color:#c0c0d8">${html}</p>` }} style={{ lineHeight: 1.7, fontSize: 12 }} />;
}

// ─── Skill card ───────────────────────────────────────────────────────────────
function SkillCard({ skill, onClick, view }: { skill: SkillMeta; onClick: () => void; view: "grid" | "list" }) {
  const c = domainColor(skill.subdomain);
  if (view === "list") {
    return (
      <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#0d0d18", border: "1px solid #1e1e2e", borderRadius: 8, cursor: "pointer", transition: "border-color 0.15s, background 0.15s" }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = c; (e.currentTarget as HTMLDivElement).style.background = "#10101c"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1e1e2e"; (e.currentTarget as HTMLDivElement).style.background = "#0d0d18"; }}>
        <div style={{ width: 3, height: 36, background: c, borderRadius: 2, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#e8e8f0", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {skill.name.replace(/-/g, " ")}
          </div>
          <div style={{ fontSize: 11, color: "#7070a0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{skill.description}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
          <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 12, background: `${c}22`, color: c, fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap" }}>{domainLabel(skill.subdomain)}</span>
          <ChevronRight size={12} color="#404060" />
        </div>
      </div>
    );
  }
  return (
    <div onClick={onClick} style={{ padding: "14px", background: "#0d0d18", border: "1px solid #1e1e2e", borderRadius: 10, cursor: "pointer", transition: "border-color 0.15s, background 0.15s, transform 0.1s", display: "flex", flexDirection: "column", gap: 8 }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = c; (e.currentTarget as HTMLDivElement).style.background = "#10101c"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1e1e2e"; (e.currentTarget as HTMLDivElement).style.background = "#0d0d18"; }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 12, background: `${c}22`, color: c, fontWeight: 700, letterSpacing: 0.3 }}>{domainLabel(skill.subdomain)}</span>
        <ChevronRight size={11} color="#404060" />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#e8e8f0", lineHeight: 1.3 }}>{skill.name.replace(/-/g, " ")}</div>
      <div style={{ fontSize: 11, color: "#6868a0", lineHeight: 1.5, flex: 1 }}>{skill.description.slice(0, 90)}{skill.description.length > 90 ? "…" : ""}</div>
      {skill.mitre_attack?.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {skill.mitre_attack.slice(0, 3).map(m => (
            <span key={m} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "#1a0a08", color: "#e06060", fontWeight: 600, border: "1px solid rgba(220,80,80,0.2)" }}>{m}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Skill detail drawer ──────────────────────────────────────────────────────
function SkillDrawer({ skillId, onClose }: { skillId: string; onClose: () => void }) {
  const [data, setData] = useState<{ content: string; meta: SkillMeta } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true); setError(""); setData(null);
    fetch(`${API_BASE}/api/cybersec/skill/${encodeURIComponent(skillId)}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || "Error"); }))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [skillId]);

  const c = data ? domainColor(data.meta?.subdomain || "") : "#7070a0";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex" }}>
      <div onClick={onClose} style={{ flex: 1, background: "rgba(0,0,0,0.6)" }} />
      <div style={{ width: 680, maxWidth: "90vw", background: "#0a0a14", borderLeft: `1px solid ${c}44`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: `1px solid #1e1e2e`, flexShrink: 0 }}>
          <div style={{ width: 4, height: 32, background: c, borderRadius: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {data && <div style={{ fontSize: 9, color: c, fontWeight: 700, letterSpacing: 0.5, marginBottom: 2 }}>{domainLabel(data.meta?.subdomain || "")}</div>}
            <div style={{ fontSize: 14, fontWeight: 800, color: "#e8e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {data ? data.meta?.name?.replace(/-/g, " ") || skillId : skillId.replace(/-/g, " ")}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#7070a0", cursor: "pointer", padding: 4, display: "flex" }}><X size={18} /></button>
        </div>

        {/* Meta badges */}
        {data?.meta && (
          <div style={{ display: "flex", gap: 6, padding: "10px 18px", borderBottom: "1px solid #1e1e2e", flexWrap: "wrap", flexShrink: 0 }}>
            {data.meta.tags?.slice(0, 6).map(t => (
              <span key={t} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 12, background: "#13131f", color: "#7070a0", border: "1px solid #252535" }}>{t}</span>
            ))}
            {data.meta.mitre_attack?.slice(0, 4).map(m => (
              <span key={m} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 12, background: "#1a0a08", color: "#e06060", border: "1px solid rgba(220,80,80,0.25)", fontWeight: 600 }}>⚔️ {m}</span>
            ))}
            {data.meta.nist_csf?.slice(0, 3).map(n => (
              <span key={n} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 12, background: "#0a1a0a", color: "#5db88a", border: "1px solid rgba(93,184,138,0.25)", fontWeight: 600 }}>🛡 {n}</span>
            ))}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 12 }}>
              <Loader2 size={28} color="#c8a84b" style={{ animation: "spin 1s linear infinite" }} />
              <div style={{ color: "#7070a0", fontSize: 12 }}>Cargando skill…</div>
            </div>
          )}
          {error && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 12 }}>
              <AlertTriangle size={28} color="#e06060" />
              <div style={{ color: "#e06060", fontSize: 13 }}>{error}</div>
            </div>
          )}
          {data && <MarkdownBlock md={data.content} />}
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 18px", borderTop: "1px solid #1e1e2e", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 10, color: "#404060" }}>Fuente: Anthropic Cybersecurity Skills Repository · MITRE ATT&amp;CK v19.1</div>
          <a href={`https://github.com/mukul975/Anthropic-Cybersecurity-Skills/tree/main/skills/${skillId}`} target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#7070a0", textDecoration: "none" }}>
            Ver en GitHub <ExternalLink size={10} />
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SecurityLab() {
  const [skills, setSkills]         = useState<SkillMeta[]>([]);
  const [domains, setDomains]       = useState<Domain[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [domain, setDomain]         = useState("");
  const [view, setView]             = useState<"grid" | "list">("grid");
  const [drawerSkillId, setDrawer]  = useState<string | null>(null);
  const [page, setPage]             = useState(0);
  const [tab, setTab]               = useState<"catalog" | "scanner">("scanner");
  const PAGE = 60;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback((q: string, dom: string, p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(PAGE), offset: String(p * PAGE) });
    if (q.trim()) params.set("q", q.trim());
    if (dom) params.set("domain", dom);
    fetch(`${API_BASE}/api/cybersec/catalog?${params}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setSkills(d.skills || []); setTotal(d.total || 0); if (d.domains) setDomains(d.domains); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load("", "", 0); }, [load]);

  const handleSearch = (v: string) => {
    setSearch(v); setPage(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(v, domain, 0), 350);
  };
  const handleDomain = (d: string) => { setDomain(d); setPage(0); load(search, d, 0); };
  const handlePage = (p: number) => { setPage(p); load(search, domain, p); };

  const totalPages = Math.ceil(total / PAGE);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#080810", color: "#e8e8f0", fontFamily: "inherit", overflow: "hidden" }}>
      {/* ── Top bar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid #1e1e2e", flexShrink: 0, background: "#0d0d18" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Shield size={20} color="#c8a84b" />
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#e8e8f0" }}>Security Lab</div>
            <div style={{ fontSize: 10, color: "#7070a0" }}>817 skills · MITRE ATT&amp;CK v19.1 · NIST CSF 2.0 · 30 dominios</div>
          </div>
        </div>

        {/* Tab toggle */}
        <div style={{ display: "flex", gap: 2, background: "#13131f", padding: 3, borderRadius: 7, border: "1px solid #1e1e2e" }}>
          <button onClick={() => setTab("scanner")} style={{ display: "flex", alignItems: "center", gap: 6, background: tab === "scanner" ? "#c8a84b" : "none", border: "none", borderRadius: 5, color: tab === "scanner" ? "#08080f" : "#7070a0", cursor: "pointer", padding: "5px 12px", fontSize: 11.5, fontWeight: 700 }}>
            <ScanLine size={13} /> Escáner
          </button>
          <button onClick={() => setTab("catalog")} style={{ display: "flex", alignItems: "center", gap: 6, background: tab === "catalog" ? "#c8a84b" : "none", border: "none", borderRadius: 5, color: tab === "catalog" ? "#08080f" : "#7070a0", cursor: "pointer", padding: "5px 12px", fontSize: 11.5, fontWeight: 700 }}>
            <BookOpen size={13} /> Catálogo
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {tab === "catalog" && (
          <>
            {/* Search */}
            <div style={{ position: "relative", width: 280 }}>
              <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#7070a0" }} />
              <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Buscar skills, técnicas, herramientas…"
                style={{ width: "100%", paddingLeft: 28, paddingRight: 8, paddingTop: 7, paddingBottom: 7, background: "#13131f", border: "1px solid #252535", borderRadius: 8, color: "#e8e8f0", fontSize: 12, boxSizing: "border-box", outline: "none" }} />
            </div>

            {/* View toggle */}
            <div style={{ display: "flex", gap: 2, background: "#13131f", padding: 3, borderRadius: 7, border: "1px solid #1e1e2e" }}>
              {(["grid", "list"] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{ background: view === v ? "#c8a84b" : "none", border: "none", borderRadius: 5, color: view === v ? "#08080f" : "#7070a0", cursor: "pointer", padding: "4px 8px", display: "flex", alignItems: "center" }}>
                  {v === "grid" ? <Grid3X3 size={13} /> : <List size={13} />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {tab === "scanner" ? (
        <ScannerPanel />
      ) : (
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── Left sidebar: domains ── */}
        <div style={{ width: 200, flexShrink: 0, background: "#0a0a14", borderRight: "1px solid #1e1e2e", overflowY: "auto", padding: "10px 0" }}>
          <div style={{ padding: "4px 14px 8px", fontSize: 9, fontWeight: 700, color: "#404060", letterSpacing: 1, textTransform: "uppercase" }}>Dominios</div>
          <button onClick={() => handleDomain("")} style={{ width: "100%", padding: "7px 14px", background: !domain ? "rgba(200,168,75,0.12)" : "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", color: !domain ? "#c8a84b" : "#8080a0", fontSize: 11, fontWeight: !domain ? 700 : 400, textAlign: "left" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Grid3X3 size={11} />Todos</span>
            <span style={{ fontSize: 9, background: "#13131f", padding: "1px 6px", borderRadius: 10, color: "#7070a0" }}>{domains.reduce((a, d) => a + d.count, 0)}</span>
          </button>
          {domains.map(d => (
            <button key={d.name} onClick={() => handleDomain(d.name)} style={{ width: "100%", padding: "7px 14px", background: domain === d.name ? `${domainColor(d.name)}18` : "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", color: domain === d.name ? domainColor(d.name) : "#7070a0", fontSize: 11, fontWeight: domain === d.name ? 700 : 400, textAlign: "left", borderLeft: domain === d.name ? `2px solid ${domainColor(d.name)}` : "2px solid transparent", transition: "all 0.15s" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10 }}>{domainLabel(d.name)}</span>
              <span style={{ fontSize: 9, background: "#13131f", padding: "1px 6px", borderRadius: 10, color: "#404060", flexShrink: 0 }}>{d.count}</span>
            </button>
          ))}
        </div>

        {/* ── Main content ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Stats bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: 11, color: "#7070a0" }}>
              {loading ? "Cargando…" : `${total} skills ${domain ? `en ${domainLabel(domain)}` : "totales"}${search ? ` para "${search}"` : ""}`}
            </div>
            <div style={{ flex: 1 }} />
            {totalPages > 1 && (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button onClick={() => handlePage(Math.max(0, page - 1))} disabled={page === 0} style={{ background: "none", border: "1px solid #252535", borderRadius: 5, color: "#7070a0", cursor: page === 0 ? "not-allowed" : "pointer", padding: "3px 9px", fontSize: 11 }}>‹</button>
                <span style={{ fontSize: 11, color: "#7070a0" }}>{page + 1} / {totalPages}</span>
                <button onClick={() => handlePage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} style={{ background: "none", border: "1px solid #252535", borderRadius: 5, color: "#7070a0", cursor: page >= totalPages - 1 ? "not-allowed" : "pointer", padding: "3px 9px", fontSize: 11 }}>›</button>
              </div>
            )}
          </div>

          {/* Domain header banner */}
          {domain && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: `${domainColor(domain)}11`, border: `1px solid ${domainColor(domain)}33`, borderRadius: 10 }}>
              <Shield size={16} color={domainColor(domain)} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: domainColor(domain) }}>{domainLabel(domain)}</div>
                <div style={{ fontSize: 10, color: "#7070a0" }}>{domains.find(d => d.name === domain)?.count || 0} skills disponibles en este dominio</div>
              </div>
              <button onClick={() => handleDomain("")} style={{ marginLeft: "auto", background: "none", border: "none", color: "#7070a0", cursor: "pointer", padding: 4, display: "flex" }}><X size={14} /></button>
            </div>
          )}

          {/* Skills grid/list */}
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200 }}>
              <Loader2 size={28} color="#c8a84b" style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : skills.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 10 }}>
              <Search size={32} color="#252535" />
              <div style={{ color: "#404060", fontSize: 13 }}>No se encontraron skills</div>
            </div>
          ) : (
            <div style={view === "grid" ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 } : { display: "flex", flexDirection: "column", gap: 6 }}>
              {skills.map(s => (
                <SkillCard key={s.id} skill={s} onClick={() => setDrawer(s.id)} view={view} />
              ))}
            </div>
          )}

          {/* Info cards at bottom */}
          {!search && !domain && page === 0 && !loading && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 10 }}>
              {[
                { icon: <Target size={18} color="#e06060" />, title: "MITRE ATT&CK v19.1", desc: "Skills mapeadas a técnicas y tácticas del framework MITRE ATT&CK para detección y defensa.", c: "#e06060" },
                { icon: <Lock size={18} color="#5db88a" />, title: "NIST CSF 2.0", desc: "Alineadas con las funciones Govern, Identify, Protect, Detect, Respond y Recover.", c: "#5db88a" },
                { icon: <BookOpen size={18} color="#c8a84b" />, title: "30 Dominios", desc: "Cloud Security, Threat Hunting, Red Team, Forensics, Malware Analysis y 25 más.", c: "#c8a84b" },
              ].map(({ icon, title, desc, c }) => (
                <div key={title} style={{ padding: "14px 16px", background: "#0d0d18", border: `1px solid ${c}22`, borderRadius: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    {icon}
                    <div style={{ fontSize: 12, fontWeight: 700, color: c }}>{title}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#6868a0", lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* ── Skill detail drawer ── */}
      {drawerSkillId && <SkillDrawer skillId={drawerSkillId} onClose={() => setDrawer(null)} />}

      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}
