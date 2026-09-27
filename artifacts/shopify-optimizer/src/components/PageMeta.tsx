import { useEffect } from "react";
import { staticSeoFor, canonicalUrl } from "@/seo/meta";

interface PageMetaProps {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  noindex?: boolean;
}

/** Props de <PageMeta> desde el registro SEO (mismos valores que el HTML prerenderizado). */
export function metaFor(path: string): PageMetaProps {
  const r = staticSeoFor(path);
  if (!r) throw new Error(`Ruta sin registro SEO: ${path}`);
  return { title: r.title, description: r.description, canonical: canonicalUrl(r), noindex: r.noindex };
}

const DEFAULT_OG_IMAGE = "https://shopycrafter.com/opengraph.jpg";

function upsertMeta(selector: string, createAttrs: Record<string, string>, content: string) {
  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    Object.entries(createAttrs).forEach(([k, v]) => el!.setAttribute(k, v));
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export default function PageMeta({ title, description, canonical, ogImage = DEFAULT_OG_IMAGE, noindex = false }: PageMetaProps) {
  useEffect(() => {
    document.title = title;

    upsertMeta('meta[name="description"]', { name: "description" }, description);

    upsertLink("canonical", canonical);

    upsertMeta('meta[property="og:title"]', { property: "og:title" }, title);
    upsertMeta('meta[property="og:description"]', { property: "og:description" }, description);
    upsertMeta('meta[property="og:url"]', { property: "og:url" }, canonical);
    upsertMeta('meta[property="og:type"]', { property: "og:type" }, "website");
    upsertMeta('meta[property="og:image"]', { property: "og:image" }, ogImage);
    upsertMeta('meta[property="og:site_name"]', { property: "og:site_name" }, "Shopy Crafter");

    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card" }, "summary_large_image");
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title" }, title);
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description" }, description);
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image" }, ogImage);
    upsertMeta('meta[name="robots"]', { name: "robots" },
      noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
  }, [title, description, canonical, ogImage, noindex]);

  return null;
}
