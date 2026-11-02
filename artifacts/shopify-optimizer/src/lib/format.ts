// Formatos comunes del panel (antes copiados en varias pantallas).

/** 1536 → "1.5 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Hora relativa corta para listas de mensajes: "ahora", "5m", "3h" o "02 nov". */
export function fmtRelativeShort(d: string, now: Date = new Date()): string {
  const dt = new Date(d);
  const diffMin = Math.floor((now.getTime() - dt.getTime()) / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h`;
  return dt.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}
