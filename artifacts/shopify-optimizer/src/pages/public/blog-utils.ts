/** Utilidades de las páginas de blog y novedades (sin dependencias del navegador: valen en SSR). */
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** «3 de julio de 2026» a partir de una fecha ISO, sin zonas horarias (igual en servidor y navegador). */
export function fechaLarga(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

export function slugify(text: string): string {
  return text
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export interface TocItem { id: string; text: string }

/** Añade un id a cada <h2> del cuerpo, quita los estilos en línea heredados y devuelve el índice de contenidos. */
export function prepararCuerpo(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const usados = new Set<string>();
  const limpio = html.replace(/ style="[^"]*"/g, "");
  const conIds = limpio.replace(/<h2>([\s\S]*?)<\/h2>/g, (_m, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    let id = slugify(text) || "seccion";
    let n = 2;
    while (usados.has(id)) id = `${slugify(text)}-${n++}`;
    usados.add(id);
    toc.push({ id, text });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { html: conIds, toc };
}

/** Clase de color de la etiqueta de un artículo (dos tonos de la marca). */
export function tonoEtiqueta(tag: string): "gold" | "jade" {
  return /^(IA|Herramientas|A\/B Testing|Pagos)$/.test(tag) ? "jade" : "gold";
}
