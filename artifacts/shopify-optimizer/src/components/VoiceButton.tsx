import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function VoiceButton() {
  const [listening, setListening] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [location, navigate] = useLocation();

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

    recognition.onerror = () => {
      setListening(false);
      setTranscript("Error de reconocimiento");
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  const startListening = () => {
    setListening(true);
    setShowBubble(true);
    setTranscript("Escuchando...");
    setResponse("");
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

  const processVoiceCommand = async (text: string) => {
    stopListening();
    setTranscript(`"${text}"`);
    setResponse("Procesando...");

    try {
      const res = await fetch(`${API_BASE}/api/voice/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ transcript: text, currentPage: location }),
      });
      const data = await res.json();
      setResponse(data.response);

      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(data.response);
        utterance.lang = "es-ES";
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      }

      if (data.action?.type === "navigate" && data.action.params?.path) {
        navigate(data.action.params.path);
      }
    } catch {
      setResponse("Error al procesar el comando. Inténtalo de nuevo.");
    }

    setTimeout(() => setShowBubble(false), 5000);
  };

  if (!supported) return null;

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
          animation: listening ? "pulse 1s infinite" : "none",
        }}
      >
        {listening ? "🔴" : "🎙"}
      </button>

      {showBubble && (
        <div style={{
          position: "fixed", bottom: 152, right: 24, zIndex: 901,
          background: "var(--ink2)", border: "1px solid var(--ink3)",
          borderRadius: 14, padding: "14px 18px",
          maxWidth: 280, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          animation: "fadeIn 0.2s ease",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              {listening ? "🔴 Escuchando" : "🎙 Voz"}
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
        </div>
      )}
    </>
  );
}
