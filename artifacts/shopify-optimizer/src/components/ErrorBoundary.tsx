import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallbackRoute?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = this.props.fallbackRoute || "/home";
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(135deg, #080810 0%, #0d0d1a 50%, #080810 100%)",
          fontFamily: "'Geist', system-ui, sans-serif", padding: 24,
        }}>
          <div style={{
            maxWidth: 520, width: "100%", textAlign: "center",
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(200,168,75,0.15)",
            borderRadius: 16, padding: "48px 40px", backdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(200,168,75,0.08)",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16, lineHeight: 1 }}>🔧</div>
            <div style={{
              fontSize: 72, fontWeight: 800, lineHeight: 1,
              background: "linear-gradient(135deg, #c8a84b 0%, #e8d48b 50%, #c8a84b 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              marginBottom: 8, letterSpacing: -2,
            }}>500</div>
            <h2 style={{
              fontSize: 22, fontWeight: 700, color: "#f0f0f5", marginBottom: 12,
              fontFamily: "'Instrument Serif', Georgia, serif", margin: "0 0 12px",
            }}>
              Algo salió mal
            </h2>
            <p style={{ fontSize: 15, color: "rgba(240,240,245,0.55)", lineHeight: 1.6, marginBottom: 24, margin: "0 0 24px" }}>
              Ha ocurrido un error inesperado. Puedes intentar recargar la página o volver al inicio.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre style={{
                background: "rgba(232,69,88,0.08)", border: "1px solid rgba(232,69,88,0.2)",
                borderRadius: 8, padding: 12, marginBottom: 24, fontSize: 11,
                color: "#e84558", textAlign: "left", overflow: "auto", maxHeight: 120,
              }}>
                {this.state.error.message}
              </pre>
            )}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={this.handleRetry} style={{
                padding: "12px 28px", borderRadius: 8, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg, #c8a84b, #a08838)", color: "#080810",
                fontSize: 14, fontWeight: 600, letterSpacing: 0.3,
              }}>
                Reintentar
              </button>
              <button onClick={this.handleReload} style={{
                padding: "12px 28px", borderRadius: 8, cursor: "pointer",
                background: "transparent", border: "1px solid rgba(200,168,75,0.3)",
                color: "#c8a84b", fontSize: 14, fontWeight: 500,
              }}>
                Recargar Página
              </button>
              <button onClick={this.handleGoHome} style={{
                padding: "12px 28px", borderRadius: 8, cursor: "pointer",
                background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(240,240,245,0.55)", fontSize: 14, fontWeight: 500,
              }}>
                Ir al Inicio
              </button>
            </div>
            <div style={{
              marginTop: 40, paddingTop: 20, borderTop: "1px solid rgba(200,168,75,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#c8a84b", letterSpacing: 1.5 }}>
                SHOPY CRAFTER
              </span>
              <span style={{ fontSize: 11, color: "rgba(240,240,245,0.3)" }}>
                — IA para tu eCommerce
              </span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
