const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escapes ALL HTML — turns "<b>x</b>" into "&lt;b&gt;x&lt;/b&gt;".
 * Use for plain-text strings that must NEVER be interpreted as markup
 * (titles, handles, attribute values, etc).
 */
export function sanitizeHtml(str: unknown): string {
  return String(str ?? "").replace(/[&<>"']/g, ch => ESCAPE_MAP[ch] || ch);
}

// Tags that are SAFE to render in our internal reports/PDFs/emails. We
// intentionally allow only structural and inline-formatting tags. Anything
// else (script, style, iframe, object, embed, link, meta, form, input,
// svg, math, etc.) is stripped so it cannot execute or exfiltrate data.
const ALLOWED_TAGS = new Set([
  "p", "br", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "small", "sub", "sup", "mark", "code",
  "ul", "ol", "li",
  "blockquote", "pre",
  "div", "span", "section", "article", "header", "footer",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption",
  "a", "img",
  "figure", "figcaption",
]);

// Per-tag attribute allow-list. Everything else is dropped (including all
// `on*` event handlers and `style` to prevent CSS-based exfiltration).
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  // Allow `class` everywhere so reports can keep visual styling defined
  // in our own CSS. We never trust inline `style` from upstream HTML.
  "*": new Set(["class", "id"]),
};

const ATTR_RE = /\s([a-zA-Z_:][a-zA-Z0-9_:.\-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*)))?/g;

function safeUrl(u: string): string | null {
  const trimmed = String(u || "").trim();
  if (!trimmed) return null;
  // Only allow http(s), mailto, tel, and relative/data: image URLs.
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(trimmed)) return trimmed;
  if (/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/i.test(trimmed)) return trimmed;
  return null;
}

function escapeAttr(v: string): string {
  return v.replace(/[&<>"']/g, ch => ESCAPE_MAP[ch] || ch);
}

function rebuildAttrs(tag: string, raw: string): string {
  const out: string[] = [];
  const allowed = ALLOWED_ATTRS[tag] || new Set<string>();
  const wildcard = ALLOWED_ATTRS["*"];
  let m: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(raw)) !== null) {
    const name = (m[1] || "").toLowerCase();
    if (!name) continue;
    if (name.startsWith("on")) continue;            // strip event handlers
    if (name === "style") continue;                  // strip inline styles from upstream
    if (!allowed.has(name) && !wildcard.has(name)) continue;
    const rawVal = m[2] ?? m[3] ?? m[4] ?? "";
    let val = rawVal;
    if (name === "href" || name === "src") {
      const u = safeUrl(val);
      if (u === null) continue;
      val = u;
    }
    if (name === "target") val = "_blank";           // force safe target
    out.push(`${name}="${escapeAttr(val)}"`);
  }
  // Always add rel="noopener noreferrer" to anchors with target.
  if (tag === "a" && out.some(a => a.startsWith("target="))) {
    if (!out.some(a => a.startsWith("rel="))) out.push('rel="noopener noreferrer"');
  }
  return out.length ? " " + out.join(" ") : "";
}

/**
 * Sanitizes HTML preserving a safe subset of structural and inline tags
 * (h1-h6, p, ul/ol/li, table, strong, em, a, img, etc). Strips all script,
 * style, iframe, event handlers and inline `style` attributes. Use for
 * fields that the user has authored as RICH HTML and that must render
 * (e.g. AI-generated product descriptions, suggested bodyHtml).
 *
 * NOT a security boundary against an actively malicious author — it is a
 * conservative whitelist sanitizer for trusted internal content. For
 * untrusted user input, prefer `sanitizeHtml` (full escape).
 */
export function sanitizeRichHtml(str: unknown): string {
  let s = String(str ?? "");
  if (!s) return "";

  // 1) Drop dangerous element blocks (with content) — script/style/etc.
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<(script|style|iframe|object|embed|link|meta|form|input|textarea|select|button|svg|math)\b[\s\S]*?<\/\1>/gi, "");
  s = s.replace(/<(script|style|iframe|object|embed|link|meta|form|input|textarea|select|button|svg|math)\b[^>]*\/?>/gi, "");

  // 2) Walk every remaining tag and rebuild it with a whitelist.
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_match, tagRaw: string, attrs: string) => {
    const tag = tagRaw.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    const isClose = _match.startsWith("</");
    if (isClose) return `</${tag}>`;
    const isSelfClosing = /\/\s*$/.test(attrs) || tag === "br" || tag === "hr" || tag === "img";
    return `<${tag}${rebuildAttrs(tag, attrs)}${isSelfClosing && tag !== "br" && tag !== "hr" ? " /" : ""}>`;
  });

  return s;
}

/**
 * Smart renderer: if the input string contains HTML markup, sanitize it
 * with the rich whitelist (preserves structure). Otherwise, plain-escape
 * it. Use this in templates that may receive EITHER plain text OR rich
 * HTML in the same field — typically AI-generated content.
 */
export function renderHtmlOrText(val: unknown): string {
  const s = String(val ?? "");
  if (!s) return "";
  // Heuristic: any tag-like opener followed by a letter signals HTML.
  // We also require either a closing tag OR a self-closing slash to avoid
  // mis-detecting "<3 days" or similar plain-text false positives.
  const looksLikeHtml = /<\s*[a-zA-Z][^>]*>/.test(s)
    && (/<\/[a-zA-Z][a-zA-Z0-9]*\s*>/.test(s) || /<[a-zA-Z][^>]*\/\s*>/.test(s) || /<\s*(br|hr|img)\b/i.test(s));
  if (looksLikeHtml) return sanitizeRichHtml(s);
  return sanitizeHtml(s);
}
