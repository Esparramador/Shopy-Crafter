import DOMPurify from "dompurify";

const HTML_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    "p", "div", "span", "br", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "blockquote", "pre", "code",
    "ul", "ol", "li",
    "strong", "em", "u", "s", "b", "i", "mark", "small", "sub", "sup",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption",
    "a", "img",
    "article", "section", "aside", "header", "footer", "nav", "figure", "figcaption",
  ],
  ALLOWED_ATTR: [
    "href", "src", "alt", "title", "class", "id",
    "rel", "target",
    "width", "height",
    "colspan", "rowspan",
    "data-*",
  ],
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form",
    "input", "textarea", "button", "select", "meta", "link"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus",
    "onblur", "onchange", "onsubmit", "onkeydown", "onkeypress", "onkeyup",
    "style"],
  ALLOW_DATA_ATTR: true,
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|\/|#|\?)/i,
};

export function cleanHtml(raw: string | null | undefined): string {
  if (!raw) return "";
  const clean = DOMPurify.sanitize(String(raw), HTML_CONFIG);
  return clean.replace(/<a\s+([^>]*)>/gi, (_match, attrs) => {
    let out = attrs as string;
    if (!/\btarget\s*=/i.test(out)) out = `${out.trim()} target="_blank"`;
    if (!/\brel\s*=/i.test(out)) out = `${out.trim()} rel="noopener noreferrer"`;
    else if (!/noopener/i.test(out)) {
      out = out.replace(/\brel\s*=\s*["']([^"']*)["']/i, (_m, r) => `rel="${r} noopener noreferrer"`);
    }
    return `<a ${out}>`;
  });
}

const SVG_CONFIG: DOMPurify.Config = {
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: ["script", "foreignObject"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
};

export function cleanSvg(raw: string | null | undefined): string {
  if (!raw) return "";
  return DOMPurify.sanitize(String(raw), SVG_CONFIG);
}

export function cleanMarkdownLite(raw: string | null | undefined): string {
  if (!raw) return "";
  const text = String(raw)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br/>");
  return cleanHtml(text);
}
