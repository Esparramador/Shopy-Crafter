import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const EXECUTABLE_ACTIONS = [
  "store_status", "list_products", "list_all_products", "create_product",
  "edit_product", "change_price", "set_product_status", "regenerate_token",
  "get_scopes", "delete_product", "search_product", "publish_product",
  "get_orders", "scan_store", "search_suppliers", "modify_audit_filter",
  "diagnose_app", "inspect_code", "fix_code", "list_source_files",
  "analyze_component",
];

function pickSpanishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find(v => v.lang === "es-ES" && v.localService)
    || voices.find(v => v.lang === "es-ES")
    || voices.find(v => v.lang.startsWith("es"))
    || null;
}

function speakSpanish(text: string) {
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "es-ES";
  utterance.rate = 1.0;
  const voice = pickSpanishVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

export function VoiceButton() {
  const [listening, setListening] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [actionResult, setActionResult] = useState("");
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const listeningRef = useRef(false);
  const executingRef = useRef(false);
  const [location, navigate] = useLocation();
  const locationRef = useRef(location);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { listeningRef.current = listening; }, [listening]);
  useEffect(() => { locationRef.current = location; }, [location]);

  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {};
    }
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    setSupported(true);

    const recognition = new SpeechRecognition();
    recognition.lang = "es-ES";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setTranscript(t);
      if (e.results[0].isFinal) {
        processVoiceCommand(t);
      }
    };

    recognition.onerror = (e: any) => {
      setListening(false);
      const errorMessages: Record<string, string> = {
        "not-allowed": "Micrófono no permitido. Actívalo en los ajustes del navegador.",
        "no-speech": "No se detectó voz. Inténtalo de nuevo.",
        "audio-capture": "No se encontró micrófono. Conecta uno.",
        "network": "Error de red. Comprueba tu conexión.",
        "aborted": "Reconocimiento cancelado.",
        "service-not-available": "Servicio de voz no disponible en este navegador.",
      };
      setTranscript(errorMessages[e.error] || `Error: ${e.error || "desconocido"}`);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.altKey && ev.key === "v") {
        ev.preventDefault();
        if (!recognitionRef.current) return;
        if (listeningRef.current) {
          recognitionRef.current.stop();
          setListening(false);
        } else {
          setListening(true);
          setShowBubble(true);
          setTranscript("Escuchando...");
          setResponse("");
          setActionResult("");
          recognitionRef.current.start();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const startListening = () => {
    setListening(true);
    setShowBubble(true);
    setTranscript("Escuchando...");
    setResponse("");
    setActionResult("");
    recognitionRef.current?.start();
  };

  const stopListening = () => {
    setListening(false);
    recognitionRef.current?.stop();
  };

  const toggleVoice = () => {
    if (listening) stopListening();
    else startListening();
  };

  const executeAction = async (actionType: string, params: Record<string, unknown>): Promise<string> => {
    try {
      const res = await fetch(`${API_BASE}/api/shopybrain/execute-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: actionType, params }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error" }));
        return `Error: ${err.error || res.statusText}`;
      }
      const data = await res.json();
      return data.message || "Acción completada.";
    } catch {
      return "Error ejecutando la acción.";
    }
  };

  const processVoiceCommand = async (text: string) => {
    stopListening();
    setTranscript(`"${text}"`);
    setResponse("Procesando...");
    setActionResult("");
    executingRef.current = true;

    const currentLocation = locationRef.current;
    const projectIdFromUrl = currentLocation.match(/\/projects\/(\d+)/)?.[1];

    try {
      const res = await fetch(`${API_BASE}/api/voice/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ transcript: text, currentPage: currentLocation, projectId: projectIdFromUrl }),
      });
      const data = await res.json();
      setResponse(data.response);

      speakSpanish(data.response);

      if (data.action?.type === "navigate" && data.action.params?.path) {
        navigate(data.action.params.path);
      } else if (data.action?.type && data.confidence >= 0.6 && EXECUTABLE_ACTIONS.includes(data.action.type)) {
        setActionResult("Ejecutando...");
        const result = await executeAction(data.action.type, data.action.params || {});
        setActionResult(result);

        const shortResult = result.length > 120 ? result.slice(0, 120) + "..." : result;
        speakSpanish(shortResult);
      }
    } catch {
      setResponse("Error al procesar el comando. Inténtalo de nuevo.");
    }

    executingRef.current = false;
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    bubbleTimerRef.current = setTimeout(() => {
      if (!executingRef.current) {
        setShowBubble(false);
      }
    }, 12000);
  };

  if (!supported) {
    return (
      <button
        title="Comando de voz no disponible en este navegador. Usa Chrome o Edge."
        disabled
        style={{
          position: "fixed", bottom: 88, right: 24, zIndex: 900,
          width: 52, height: 52, borderRadius: "50%",
          background: "var(--ink3)", border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, opacity: 0.3, cursor: "not-allowed",
        }}
      >🎙</button>
    );
  }

  return (
    <>
      <button
        onClick={toggleVoice}
        title="Comando de voz (Alt+V)"
        aria-label="Activar comando de voz"
        style={{
          position: "fixed", bottom: 88, right: 24, zIndex: 900,
          width: 52, height: 52, borderRadius: "50%",
          background: listening
            ? "var(--crim)"
            : "linear-gradient(135deg, var(--gold), var(--gold2))",
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, color: "#000",
          boxShadow: listening
            ? "0 0 0 4px rgba(220,53,69,0.3), 0 4px 16px rgba(0,0,0,0.4)"
            : "0 4px 16px rgba(200,168,75,0.4)",
          transition: "all 0.2s",
          animation: listening ? "pulse 1.5s ease-in-out infinite" : "none",
        }}
      >
        {listening ? "🔴" : "🎙"}
      </button>

      {showBubble && (
        <div style={{
          position: "fixed", bottom: 152, right: 24, zIndex: 901,
          background: "var(--ink2)", border: "1px solid var(--ink3)",
          borderRadius: 14, padding: "14px 18px",
          maxWidth: 300, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          animation: "fadeIn 0.2s ease",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              {listening ? "🔴 Escuchando" : "🎙 Voz Shopy Crafter"}
            </span>
            <button
              onClick={() => setShowBubble(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t4)", fontSize: 16 }}
            >×</button>
          </div>
          {transcript && (
            <p style={{ fontSize: 13, color: "var(--t)", marginBottom: 6, fontStyle: "italic" }}>{transcript}</p>
          )}
          {response && (
            <p style={{ fontSize: 12, color: "var(--t3)", borderTop: "1px solid var(--ink3)", paddingTop: 8, marginTop: 6, lineHeight: 1.5 }}>
              {response}
            </p>
          )}
          {actionResult && (
            <p style={{
              fontSize: 11, color: actionResult.startsWith("Error") ? "var(--crim)" : "var(--jade)",
              borderTop: "1px solid var(--ink3)", paddingTop: 6, marginTop: 6, lineHeight: 1.4,
              fontWeight: 600,
            }}>
              {actionResult}
            </p>
          )}
        </div>
      )}
    </>
  );
}
