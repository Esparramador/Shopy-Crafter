import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import gsap from "gsap";
import PageMeta from "@/components/PageMeta";
import ShopLayout from "./ShopLayout";
import { API, apiJson, assetUrl, cart, coverOf, euros, minQty, unitPrice, type Field, type Media, type Product } from "./shop-api";
import { SITE_URL } from "@/seo/meta";
import type { PreviewShape } from "@/components/shop/Shop3D";

const ProductPreview3D = lazy(() => import("@/components/shop/Shop3D").then(m => ({ default: m.ProductPreview3D })));

/** Productos con vista 3D: forma y campo cuya imagen se previsualiza. */
const PREVIEW: Record<string, { shape: PreviewShape; field: string; sample: string }> = {
  "tarjetas-metalicas": { shape: "card-metal", field: "logo", sample: "/tienda-media/tarjeta-shopycrafter-delante.webp" },
  "kit-expositor-tarjetas": { shape: "card-metal", field: "logo", sample: "/tienda-media/tarjeta-shopycrafter-delante.webp" },
  "tarjeta-foto-aluminio": { shape: "card-metal", field: "foto", sample: "/tienda-media/tarjeta-foto-aluminio-paisaje.webp" },
  "foto-madera-peana": { shape: "wood-photo", field: "foto", sample: "/tienda-media/tarjeta-foto-aluminio-paisaje.webp" },
  "marco-madera-foto": { shape: "wood-frame", field: "foto", sample: "/tienda-media/tarjeta-foto-aluminio-paisaje.webp" },
  "panoramica-madera": { shape: "wood-pano", field: "foto", sample: "/tienda-media/tarjeta-foto-aluminio-paisaje.webp" },
  "placa-qr-madera": { shape: "wood-plaque", field: "logo", sample: "/tienda-media/placa-resenas-madera.webp" },
};

interface Uploaded { id: string; name: string; preview: string | null }

function Gallery({ media, name, preview }: { media: Media[]; name: string; preview: React.ReactNode | null }) {
  const slides = preview ? ["3d", ...media.map((_, i) => i)] : media.map((_, i) => i);
  const [i, setI] = useState(0);
  const cur = slides[i];
  if (slides.length === 0) return <div className="shop-gallery-main shop-card-noimg"><span>{name}</span></div>;
  return (
    <div className="shop-gallery">
      <div className="shop-gallery-main">
        {cur === "3d" ? preview : (() => {
          const m = media[cur as number];
          return m.type === "video"
            ? <video key={m.url} src={assetUrl(m.url)} poster={m.poster ? assetUrl(m.poster) : undefined} controls muted autoPlay loop playsInline aria-label={m.alt} />
            : <img key={m.url} src={assetUrl(m.url)} alt={m.alt || name} />;
        })()}
      </div>
      {slides.length > 1 && (
        <div className="shop-thumbs" role="tablist" aria-label="Fotos y vídeos">
          {slides.map((s, k) => {
            const m = s === "3d" ? null : media[s as number];
            return (
              <button key={k} type="button" role="tab" aria-selected={k === i} className={k === i ? "on" : ""} onClick={() => setI(k)}
                aria-label={s === "3d" ? "Vista 3D" : m?.alt || `Imagen ${k + 1}`}>
                {s === "3d" ? <span className="shop-thumb-3d">3D</span>
                  : m!.type === "video" ? <><img src={assetUrl(m!.poster ?? "")} alt="" /><span className="shop-thumb-play" aria-hidden="true">▶</span></>
                  : <img src={assetUrl(m!.url)} alt="" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UploadField({ f, value, onChange }: { f: Field; value: Uploaded[]; onChange: (v: Uploaded[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const max = f.maxFiles ?? 1;
  const pick = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = [...list].slice(0, Math.max(0, max - value.length));
    if (files.length === 0) { setErr(`Máximo ${max} ${max === 1 ? "archivo" : "archivos"}`); return; }
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      files.forEach(file => fd.append("files", file));
      const r = await fetch(`${API}/shop/uploads`, { method: "POST", body: fd, credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "No se pudo subir");
      const added: Uploaded[] = (d.files as Array<{ id: string; name: string; mime: string }>).map((u, k) => ({
        id: u.id, name: u.name, preview: u.mime.startsWith("image/") ? URL.createObjectURL(files[k]) : null,
      }));
      onChange([...value, ...added]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="shop-field">
      <label htmlFor={`f-${f.key}`}>{f.label}{f.required && <span aria-hidden="true"> *</span>}</label>
      {f.help && <small id={`h-${f.key}`}>{f.help}</small>}
      <div className="shop-upload">
        {value.map(u => (
          <div key={u.id} className="shop-upload-item">
            {u.preview ? <img src={u.preview} alt="" /> : <span className="shop-upload-doc" aria-hidden="true">PDF</span>}
            <span>{u.name}</span>
            <button type="button" aria-label={`Quitar ${u.name}`} onClick={() => onChange(value.filter(x => x.id !== u.id))}>×</button>
          </div>
        ))}
        {value.length < max && (
          <label className="shop-upload-add">
            <input id={`f-${f.key}`} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
              multiple={max > 1} disabled={busy} aria-describedby={f.help ? `h-${f.key}` : undefined}
              onChange={e => { void pick(e.target.files); e.currentTarget.value = ""; }} />
            {busy ? "Subiendo…" : value.length ? "Añadir más" : "Elegir archivo"}
          </label>
        )}
      </div>
      {err && <span className="shop-field-err" role="alert">{err}</span>}
    </div>
  );
}

export default function ShopProduct() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const [p, setP] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [variant, setVariant] = useState("");
  const [qty, setQty] = useState(1);
  const [addons, setAddons] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, Uploaded[]>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setP(null); setError(null);
    apiJson<Product>(`/shop/products/${encodeURIComponent(slug ?? "")}`)
      .then(prod => {
        setP(prod);
        const v = prod.variants[0];
        setVariant(v?.key ?? "");
        setQty(v ? minQty(prod, v) : 1);
      })
      .catch(e => setError(e instanceof Error ? e.message : "Error"));
  }, [slug]);

  useEffect(() => {
    if (!p || !root.current || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from(".shop-pd-info > *", { y: 24, opacity: 0, duration: 0.7, stagger: 0.05, ease: "power3.out" });
      gsap.from(".shop-gallery", { scale: 0.96, opacity: 0, duration: 0.9, ease: "power3.out" });
    }, root);
    return () => ctx.revert();
  }, [p]);

  const v = p?.variants.find(x => x.key === variant) ?? p?.variants[0];
  const unit = p && v ? unitPrice(v, qty) : 0;
  const addonTotal = p ? p.addons.filter(a => addons.includes(a.key)).reduce((s, a) => s + (a.perUnit ? a.cents * qty : a.cents), 0) : 0;
  const total = unit * qty + addonTotal;

  const previewCfg = p ? PREVIEW[p.slug] : undefined;
  const previewImg = previewCfg ? (files[previewCfg.field]?.find(u => u.preview)?.preview ?? assetUrl(previewCfg.sample)) : null;
  const preview = previewCfg ? (
    <Suspense fallback={<div className="shop-preview-empty">Cargando vista 3D…</div>}>
      <ProductPreview3D shape={previewCfg.shape} image={previewImg} alt={`${p!.name} en 3D`} />
    </Suspense>
  ) : null;

  const qtyChoices = useMemo(() => {
    if (!p || !v) return [];
    if (p.qtyOptions.length) return p.qtyOptions;
    return [];
  }, [p, v]);

  const addToCart = (goToCart: boolean) => {
    if (!p || !v) return;
    setFormErr(null);
    for (const f of p.fields) {
      if (!f.required) continue;
      const ok = f.type === "upload" ? (files[f.key]?.length ?? 0) > 0 : (values[f.key] ?? "").trim() !== "";
      if (!ok) { setFormErr(`Falta «${f.label}»`); document.getElementById(`f-${f.key}`)?.focus(); return; }
    }
    const fields: Record<string, string | string[]> = {};
    const names: Record<string, string> = {};
    for (const f of p.fields) {
      if (f.type === "upload") {
        const ups = files[f.key] ?? [];
        if (ups.length) { fields[f.key] = ups.map(u => u.id); ups.forEach(u => { names[u.id] = u.name; }); }
      } else if ((values[f.key] ?? "").trim()) fields[f.key] = values[f.key].trim();
    }
    cart.add({
      slug: p.slug, name: p.name, image: coverOf(p), kind: p.kind, variant: v.key, variantName: v.name, qty,
      addons, fields, files: names, estimateCents: total,
    });
    if (goToCart) navigate("/tienda/carrito");
    else { setAdded(true); setTimeout(() => setAdded(false), 2500); }
  };

  if (error) return <ShopLayout><div className="shop-wrap shop-empty"><h1>No encontramos este producto</h1><p>{error}</p><Link href="/tienda" className="shop-btn shop-btn-gold">Volver a la tienda</Link></div></ShopLayout>;
  if (!p || !v) return <ShopLayout><div className="shop-wrap shop-pd"><div className="shop-gallery shop-skel" /><div className="shop-skel" style={{ height: 420 }} /></div></ShopLayout>;

  const min = minQty(p, v);
  return (
    <ShopLayout>
      <PageMeta title={`${p.name} — Tienda Shopy Crafter`} description={p.tagline} canonical={`${SITE_URL}/tienda/${p.slug}`} />
      <div ref={root} className="shop-wrap">
        <nav className="shop-crumbs" aria-label="Migas de pan"><Link href="/tienda">Tienda</Link> / <span>{p.categoryLabel}</span></nav>
        <div className="shop-pd">
          <Gallery media={p.media} name={p.name} preview={preview} />
          <div className="shop-pd-info">
            <span className="shop-card-cat">{p.categoryLabel}</span>
            <h1>{p.name}</h1>
            <p className="shop-pd-tag">{p.tagline}</p>
            {p.kind === "quote" ? (
              <div className="shop-pd-quote">
                <p>Este servicio se hace a medida: te preparamos un presupuesto cerrado antes de empezar.</p>
                <Link href="/contacto" className="shop-btn shop-btn-gold">Pedir presupuesto</Link>
              </div>
            ) : (
              <form className="shop-pd-form" onSubmit={e => { e.preventDefault(); addToCart(true); }} noValidate>
                <div className="shop-price" aria-live="polite">
                  <strong>{euros(total)}</strong>
                  {qty > 1 && <span>{euros(unit)} / ud. · {qty} unidades</span>}
                  <small>IVA incluido{p.kind === "physical" ? " · envío aparte, gratis desde 60 €" : ""}</small>
                </div>

                {p.variants.length > 1 && (
                  <fieldset className="shop-field">
                    <legend>Opción</legend>
                    <div className="shop-seg">
                      {p.variants.map(x => (
                        <label key={x.key} className={x.key === v.key ? "on" : ""}>
                          <input type="radio" name="variant" value={x.key} checked={x.key === v.key}
                            onChange={() => { setVariant(x.key); setQty(q => Math.max(q, minQty(p, x))); }} />
                          <span>{x.name}</span><em>{euros(x.tiers[0].unitCents)}</em>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}

                {p.maxQty > 1 && (
                  <fieldset className="shop-field">
                    <legend>Cantidad</legend>
                    {qtyChoices.length ? (
                      <div className="shop-seg shop-seg-qty">
                        {qtyChoices.map(n => (
                          <label key={n} className={n === qty ? "on" : ""}>
                            <input type="radio" name="qty" value={n} checked={n === qty} onChange={() => setQty(n)} />
                            <span>{n} uds.</span><em>{euros(unitPrice(v, n))}/ud.</em>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="shop-stepper">
                        <button type="button" aria-label="Menos" disabled={qty <= min} onClick={() => setQty(q => Math.max(min, q - 1))}>−</button>
                        <input type="number" inputMode="numeric" min={min} max={p.maxQty} value={qty} aria-label="Cantidad"
                          onChange={e => { const n = Math.floor(Number(e.target.value)); if (Number.isFinite(n)) setQty(Math.min(p.maxQty, Math.max(min, n))); }} />
                        <button type="button" aria-label="Más" disabled={qty >= p.maxQty} onClick={() => setQty(q => Math.min(p.maxQty, q + 1))}>+</button>
                        {v.tiers.length > 1 && <small>{v.tiers.slice(1).map(t => `desde ${t.min}: ${euros(t.unitCents)}/ud.`).join(" · ")}</small>}
                      </div>
                    )}
                  </fieldset>
                )}

                {p.addons.length > 0 && (
                  <fieldset className="shop-field">
                    <legend>Extras</legend>
                    {p.addons.map(a => (
                      <label key={a.key} className="shop-check">
                        <input type="checkbox" checked={addons.includes(a.key)} onChange={e => setAddons(xs => e.target.checked ? [...xs, a.key] : xs.filter(k => k !== a.key))} />
                        <span><b>{a.name}</b>{a.description && <small>{a.description}</small>}</span>
                        <em>+{euros(a.cents)}{a.perUnit ? "/ud." : ""}</em>
                      </label>
                    ))}
                  </fieldset>
                )}

                {p.fields.length > 0 && (
                  <fieldset className="shop-field shop-perso">
                    <legend>Personalización</legend>
                    {p.fields.map(f => f.type === "upload" ? (
                      <UploadField key={f.key} f={f} value={files[f.key] ?? []} onChange={vals => setFiles(s => ({ ...s, [f.key]: vals }))} />
                    ) : (
                      <div key={f.key} className="shop-field">
                        <label htmlFor={`f-${f.key}`}>{f.label}{f.required && <span aria-hidden="true"> *</span>}</label>
                        {f.help && <small id={`h-${f.key}`}>{f.help}</small>}
                        {f.type === "textarea" ? (
                          <textarea id={`f-${f.key}`} rows={3} maxLength={f.max} required={f.required} value={values[f.key] ?? ""}
                            aria-describedby={f.help ? `h-${f.key}` : undefined} onChange={e => setValues(s => ({ ...s, [f.key]: e.target.value }))} />
                        ) : f.type === "select" ? (
                          <select id={`f-${f.key}`} required={f.required} value={values[f.key] ?? ""} onChange={e => setValues(s => ({ ...s, [f.key]: e.target.value }))}>
                            <option value="">Elige…</option>
                            {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input id={`f-${f.key}`} type={f.type === "url" ? "url" : f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"}
                            maxLength={f.max} required={f.required} value={values[f.key] ?? ""} placeholder={f.type === "url" ? "https://" : undefined}
                            aria-describedby={f.help ? `h-${f.key}` : undefined} onChange={e => setValues(s => ({ ...s, [f.key]: e.target.value }))} />
                        )}
                      </div>
                    ))}
                  </fieldset>
                )}

                {formErr && <p className="shop-error" role="alert">{formErr}</p>}
                <div className="shop-pd-actions">
                  <button type="submit" className="shop-btn shop-btn-gold">Añadir y pagar</button>
                  <button type="button" className="shop-btn shop-btn-ghost" onClick={() => addToCart(false)}>{added ? "Añadido ✓" : "Añadir al carrito"}</button>
                </div>
                <p className="shop-pd-lead">{p.kind === "physical" ? `Producción en ${p.leadDays} días laborables tras aprobar la prueba.` : `Entrega en ${p.leadDays} días laborables tras recibir tu material.`}</p>
              </form>
            )}
            {p.demoUrl && (
              <a className="shop-demo" href={assetUrl(p.demoUrl)} target="_blank" rel="noopener">Ver un ejemplo →</a>
            )}
          </div>
        </div>

        <section className="shop-pd-details">
          <div>
            <h2>Cómo es</h2>
            {p.description.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
          </div>
          {p.features.length > 0 && (
            <div>
              <h2>Incluye</h2>
              <ul className="shop-feats">{p.features.map(f => <li key={f}>{f}</li>)}</ul>
            </div>
          )}
        </section>
      </div>
    </ShopLayout>
  );
}
