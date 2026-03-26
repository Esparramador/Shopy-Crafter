const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function sanitizeHtml(str: unknown): string {
  return String(str ?? "").replace(/[&<>"']/g, ch => ESCAPE_MAP[ch] || ch);
}
