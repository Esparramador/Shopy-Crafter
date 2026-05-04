import { useState, useRef, useCallback, useEffect } from "react";

type AIActionStatus = "idle" | "running" | "success" | "error" | "cancelled";

interface AIActionProgress {
  current: number;
  total: number;
  message: string;
}

interface UseAIActionOptions {
  endpoint: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  onProgress?: (progress: AIActionProgress) => void;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  pollingIntervalMs?: number;
  pollingTimeoutMs?: number;
}

interface UseAIActionReturn<T = any> {
  execute: (body?: any) => Promise<T | null>;
  status: AIActionStatus;
  progress: AIActionProgress | null;
  result: T | null;
  error: Error | null;
  cancel: () => void;
  reset: () => void;
}

const API_BASE =
  typeof window !== "undefined" && (window as any).__API_BASE__
    ? (window as any).__API_BASE__
    : "";

const DEFAULT_POLL_TIMEOUT_MS = 5 * 60 * 1000;

function resolveEndpoint(endpoint: string): string {
  if (endpoint.startsWith("http")) return endpoint;
  if (endpoint.startsWith("/api")) return `${API_BASE}${endpoint}`;
  return `${API_BASE}/api/${endpoint}`;
}

export function useAIAction<T = any>(
  options: UseAIActionOptions,
): UseAIActionReturn<T> {
  const [status, setStatus] = useState<AIActionStatus>("idle");
  const [progress, setProgress] = useState<AIActionProgress | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    if (mountedRef.current) {
      setStatus("cancelled");
      setProgress(null);
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    if (mountedRef.current) {
      setStatus("idle");
      setProgress(null);
      setResult(null);
      setError(null);
    }
  }, []);

  const handleSSEStream = useCallback(
    async (response: Response, signal: AbortSignal): Promise<T | null> => {
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No readable stream available");

      const decoder = new TextDecoder();
      let buffer = "";
      let lastData: any = null;

      try {
        while (true) {
          if (signal.aborted) break;
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const raw = line.slice(6).trim();
              if (raw === "[DONE]") continue;
              try {
                const parsed = JSON.parse(raw);
                lastData = parsed;

                if (parsed.progress && mountedRef.current) {
                  const p: AIActionProgress = {
                    current: parsed.progress.current ?? 0,
                    total: parsed.progress.total ?? 100,
                    message: parsed.progress.message || "",
                  };
                  setProgress(p);
                  options.onProgress?.(p);
                }

                if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch (e: any) {
                if (e.message && e.message !== "Unexpected end of JSON input") {
                  throw e;
                }
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return (lastData?.result ?? lastData) as T;
    },
    [options],
  );

  const pollForResult = useCallback(
    async (jobId: string, signal: AbortSignal): Promise<T | null> => {
      const pollUrl = `${API_BASE}/api/jobs/${jobId}/status`;
      const intervalMs = options.pollingIntervalMs || 1000;
      const timeoutMs = options.pollingTimeoutMs || DEFAULT_POLL_TIMEOUT_MS;
      const deadline = Date.now() + timeoutMs;

      while (!signal.aborted && Date.now() < deadline) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, intervalMs);
          signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
        });

        const pollRes = await fetch(pollUrl, {
          credentials: "include",
          signal,
        });
        if (!pollRes.ok) continue;

        const pollData = await pollRes.json();

        if (pollData.progress && mountedRef.current) {
          const p: AIActionProgress = {
            current: pollData.progress.current ?? 0,
            total: pollData.progress.total ?? 100,
            message: pollData.progress.message || "",
          };
          setProgress(p);
          options.onProgress?.(p);
        }

        if (pollData.status === "completed" || pollData.status === "success") {
          return (pollData.result ?? pollData) as T;
        }
        if (pollData.status === "error" || pollData.status === "failed") {
          throw new Error(pollData.error || "Job failed");
        }
      }

      if (Date.now() >= deadline) {
        throw new Error("Timeout: la operación tardó demasiado");
      }

      return null;
    },
    [options],
  );

  const execute = useCallback(
    async (body?: any): Promise<T | null> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (!mountedRef.current) return null;
      setStatus("running");
      setProgress(null);
      setResult(null);
      setError(null);

      const url = resolveEndpoint(options.endpoint);

      try {
        const response = await fetch(url, {
          method: options.method || "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Error del servidor");
          let parsed: any;
          try { parsed = JSON.parse(errorText); } catch { parsed = null; }
          throw new Error(parsed?.error || parsed?.message || errorText || `HTTP ${response.status}`);
        }

        const contentType = response.headers.get("content-type") || "";
        let data: T | null;

        if (contentType.includes("text/event-stream")) {
          data = await handleSSEStream(response, controller.signal);
        } else {
          const jsonData = await response.json();
          const jobId = jsonData.jobId || jsonData.job_id;
          if (jobId) {
            data = await pollForResult(jobId, controller.signal);
          } else {
            data = jsonData as T;
          }
        }

        if (controller.signal.aborted) {
          if (mountedRef.current) setStatus("cancelled");
          return null;
        }

        if (mountedRef.current) {
          setResult(data);
          setStatus("success");
          options.onSuccess?.(data);
        }
        return data;
      } catch (err: any) {
        if (err.name === "AbortError") {
          if (mountedRef.current) setStatus("cancelled");
          return null;
        }
        const wrappedError = err instanceof Error ? err : new Error(String(err));
        if (mountedRef.current) {
          setError(wrappedError);
          setStatus("error");
          options.onError?.(wrappedError);
        }
        throw wrappedError;
      }
    },
    [options, handleSSEStream, pollForResult],
  );

  return { execute, status, progress, result, error, cancel, reset };
}

export default useAIAction;
