import { useEffect, useState, useRef } from "react";
import type { TestStats } from "../lib/types";
import type { ABTestingAPI } from "../lib/api";

export function useTestPolling(
  api: ABTestingAPI,
  testId: string,
  opts: { enabled: boolean; pollIntervalMs?: number } = { enabled: true, pollIntervalMs: 5000 },
) {
  const [stats, setStats] = useState<TestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    if (!opts.enabled) {
      setLoading(false);
      return;
    }
    const tick = async () => {
      try {
        const s = await api.getStats(testId);
        if (!cancelled.current) {
          setStats(s);
          setError("");
        }
      } catch (e) {
        if (!cancelled.current) {
          setError(e instanceof Error ? e.message : "Polling error");
        }
      } finally {
        if (!cancelled.current) setLoading(false);
      }
    };
    tick();
    const interval = setInterval(tick, opts.pollIntervalMs ?? 5000);
    return () => {
      cancelled.current = true;
      clearInterval(interval);
    };
  }, [api, testId, opts.enabled, opts.pollIntervalMs]);

  return { stats, loading, error };
}
