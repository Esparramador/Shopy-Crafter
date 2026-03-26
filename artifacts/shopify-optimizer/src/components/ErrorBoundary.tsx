import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
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

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          background: "var(--ink, #0a0a0f)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}>
          <div style={{
            background: "var(--card, #141420)",
            border: "1px solid var(--border, #2a2a3a)",
            borderRadius: 12,
            padding: 32,
            maxWidth: 480,
            width: "100%",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#x26A0;&#xFE0F;</div>
            <h2 style={{ color: "var(--foreground, #fff)", margin: "0 0 8px", fontSize: 20, fontWeight: 600 }}>
              Algo salió mal
            </h2>
            <p style={{ color: "var(--muted-foreground, #999)", margin: "0 0 24px", fontSize: 14 }}>
              Ha ocurrido un error inesperado. Puedes intentar recargar la página o volver al inicio.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre style={{
                background: "rgba(255,0,0,0.1)",
                border: "1px solid rgba(255,0,0,0.2)",
                borderRadius: 8,
                padding: 12,
                marginBottom: 24,
                fontSize: 11,
                color: "#ff6b6b",
                textAlign: "left",
                overflow: "auto",
                maxHeight: 120,
              }}>
                {this.state.error.message}
              </pre>
            )}
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={this.handleReload}
                style={{
                  background: "var(--gold, #f4c542)",
                  color: "var(--ink, #0a0a0f)",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 20px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Recargar página
              </button>
              <button
                onClick={this.handleGoHome}
                style={{
                  background: "transparent",
                  color: "var(--foreground, #fff)",
                  border: "1px solid var(--border, #2a2a3a)",
                  borderRadius: 8,
                  padding: "10px 20px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Ir al inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
