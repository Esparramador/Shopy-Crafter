import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "€0.00";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "€0.00";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(num);
}

export function getGradeColor(grade: string | null | undefined): string {
  switch (grade?.toUpperCase()) {
    case "A": return "text-[#00d68f] bg-[#00d68f]/10 border-[#00d68f]/20";
    case "B": return "text-[#00b4d8] bg-[#00b4d8]/10 border-[#00b4d8]/20";
    case "C": return "text-[#ffd32a] bg-[#ffd32a]/10 border-[#ffd32a]/20";
    case "D": return "text-[#ff8c42] bg-[#ff8c42]/10 border-[#ff8c42]/20";
    case "F": return "text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/20";
    default: return "text-muted-foreground bg-muted border-border";
  }
}

export function timeSince(dateStr: string | null, labels?: { never?: string; today?: string; yesterday?: string }): string {
  if (!dateStr) return labels?.never ?? "Nunca";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (labels) {
    if (days === 0) return labels.today ?? "Hoy";
    if (days === 1) return labels.yesterday ?? "Ayer";
    return `Hace ${days} días`;
  }
  return `hace ${days}d`;
}

export function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#eab308";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}
