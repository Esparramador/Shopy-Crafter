/**
 * Precios por plataforma y configurador de la landing.
 *
 * Todo sale del API: /api/billing/packs (packs con su precio vigente y lo que incluyen) y
 * /api/tienda/services (servicios de pago único). Ningún precio vive en el front.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

const API = `${(import.meta.env.BASE_URL ?? "").replace(/\/$/, "")}/api`;

export type PackPlatform = "shopify" | "woocommerce" | "prestashop" | "stripe";

export interface PackPlan {
  id: string; name: string; summary: string; priceMonthly: number; priceAnnual: number;
  featured: boolean; badge: string | null; lines: string[];
}
export interface PlatformPacks {
  key: PackPlatform; label: string; extras: string[]; included: string[];
  plans: PackPlan[];
  custom: { id: string; name: string; lines: string[] } | null;
}
export interface PacksData { platforms: PlatformPacks[]; annualMonths: number; taxNote: string }

const BRAND: Record<PackPlatform, string> = {
  shopify: "#95bf47", woocommerce: "#96588a", prestashop: "#df0067", stripe: "#635bff",
};

const eur = (n: number) => `${n.toLocaleString("es-ES", { maximumFractionDigits: 2 })} €`;

/** Packs del API. `null` mientras carga; `error` si no se pudo. */
export function usePacks(): { data: PacksData | null; error: string | null } {
  const [data, setData] = useState<PacksData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = (attempt = 1) => {
      fetch(`${API}/billing/packs`)
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((d: PacksData) => { if (alive) setData(d); })
        .catch(() => {
          if (!alive) return;
          if (attempt < 3) setTimeout(() => load(attempt + 1), 1500 * attempt);
          else setError("No se pudieron cargar los precios. Recarga la página o escríbenos.");
        });
    };
    load();
    return () => { alive = false; };
  }, []);
  return { data, error };
}

function PlatformTabs({ platforms, value, onChange, idPrefix }: {
  platforms: PlatformPacks[]; value: PackPlatform; onChange: (p: PackPlatform) => void; idPrefix: string;
}) {
  return (
    <div className="lxk-tabs" role="tablist" aria-label="Plataforma de tu negocio">
      {platforms.map(p => (
        <button
          key={p.key} type="button" role="tab" id={`${idPrefix}-${p.key}`}
          aria-selected={value === p.key}
          className={value === p.key ? "on" : ""}
          style={{ ["--lxk-brand" as string]: BRAND[p.key] }}
          onClick={() => onChange(p.key)}
        >
          <span className="lxk-dot" aria-hidden="true" />{p.label}
        </button>
      ))}
    </div>
  );
}

function BillingToggle({ annual, onChange, months }: { annual: boolean; onChange: (a: boolean) => void; months: number }) {
  const saving = Math.round((1 - months / 12) * 100);
  return (
    <div className="lx-billing" role="group" aria-label="Periodo de facturación">
      <button type="button" className={!annual ? "on" : ""} onClick={() => onChange(false)}>Mensual</button>
      <button type="button" className={annual ? "on" : ""} onClick={() => onChange(true)}>
        Anual{saving > 0 ? <span>−{saving}%</span> : null}
      </button>
    </div>
  );
}

function monthlyOf(p: PackPlan, annual: boolean): number {
  return annual ? Math.round((p.priceAnnual / 12) * 100) / 100 : p.priceMonthly;
}

// ── Precios ──────────────────────────────────────────────────────────────────

export function PackPricing({ data, error, onChoose, onQuote }: {
  data: PacksData | null; error: string | null;
  onChoose: (plan: PackPlan, platform: PlatformPacks, annual: boolean) => void;
  onQuote: (platform: PlatformPacks) => void;
}) {
  const [platform, setPlatform] = useState<PackPlatform>("shopify");
  const [annual, setAnnual] = useState(false);
  const current = data?.platforms.find(p => p.key === platform) ?? data?.platforms[0] ?? null;

  if (error) return <p className="lxk-error">{error}</p>;
  if (!data || !current) return <div className="lxk-skeleton" aria-busy="true" aria-label="Cargando precios" />;

  return (
    <div className="lxk-pricing">
      <PlatformTabs platforms={data.platforms} value={current.key} onChange={setPlatform} idPrefix="lxk-price" />
      <BillingToggle annual={annual} onChange={setAnnual} months={data.annualMonths} />
      <div className="lxk-plans" role="tabpanel" aria-labelledby={`lxk-price-${current.key}`}>
        {current.plans.map(plan => (
          <article key={plan.id} className={`lx-plan${plan.featured ? " lx-plan-featured" : ""}`}>
            {plan.badge && <div className="lx-plan-badge">{plan.badge}</div>}
            <h3 className="lx-plan-name">{plan.name}</h3>
            <div className="lx-plan-price">
              <span className="lx-plan-amount">{eur(monthlyOf(plan, annual))}</span>
              <span className="lx-plan-per">/mes + IVA</span>
            </div>
            <div className="lx-plan-note">{annual ? `${eur(plan.priceAnnual)} al año` : plan.summary}</div>
            <ul className="lx-plan-feats">{plan.lines.map(l => <li key={l}>{l}</li>)}</ul>
            <button type="button" className={`lx-plan-cta${plan.featured ? " gold" : ""}`} onClick={() => onChoose(plan, current, annual)}>
              Elegir {plan.name}
            </button>
          </article>
        ))}
        {current.custom && (
          <article className="lx-plan lxk-custom">
            <h3 className="lx-plan-name">{current.custom.name}</h3>
            <div className="lx-plan-price"><span className="lx-plan-amount lx-plan-quote">A medida</span></div>
            <div className="lx-plan-note">Presupuesto cerrado según alcance</div>
            <ul className="lx-plan-feats">{current.custom.lines.map(l => <li key={l}>{l}</li>)}</ul>
            <button type="button" className="lx-plan-cta" onClick={() => onQuote(current)}>Pedir presupuesto</button>
          </article>
        )}
      </div>
      <div className="lx-common">
        <span className="lx-common-title">Incluido en todos los packs de {current.label}</span>
        <ul>{[...current.included, ...current.extras].map(f => <li key={f}>{f}</li>)}</ul>
      </div>
    </div>
  );
}

// ── Configurador ─────────────────────────────────────────────────────────────

interface Service {
  id: number; name: string; icon?: string | null; short_desc?: string | null;
  price_eur: number | string | null; billing_interval: string | null;
}

export interface ConfiguratorResult {
  platform: PlatformPacks; plan: PackPlan | null; custom: boolean; annual: boolean;
  services: Service[]; monthly: number; oneTime: number; summary: string;
}

export function PackConfigurator({ data, error, loggedInClient, onSubmit }: {
  data: PacksData | null; error: string | null; loggedInClient: boolean;
  onSubmit: (r: ConfiguratorResult) => void;
}) {
  const [platform, setPlatform] = useState<PackPlatform>("shopify");
  const [planId, setPlanId] = useState<string | null>(null);
  const [annual, setAnnual] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [picked, setPicked] = useState<number[]>([]);

  useEffect(() => {
    fetch(`${API}/tienda/services`)
      .then(r => (r.ok ? r.json() : []))
      .then((rows: Service[]) => setServices(Array.isArray(rows) ? rows : []))
      .catch(() => setServices([]));
  }, []);

  const current = data?.platforms.find(p => p.key === platform) ?? null;
  // Al cambiar de plataforma, el pack elegido deja de valer si no es de esa plataforma.
  useEffect(() => {
    if (!current || !planId || planId === "personalizado") return;
    if (!current.plans.some(p => p.id === planId)) setPlanId(null);
  }, [current, planId]);

  const plan = current?.plans.find(p => p.id === planId) ?? null;
  const custom = planId === "personalizado";
  const chosenServices = services.filter(s => picked.includes(s.id));
  const priced = (s: Service) => Number(s.price_eur) > 0 && (s.billing_interval === "one_time" || s.billing_interval === "month");

  const totals = useMemo(() => {
    let monthly = plan ? monthlyOf(plan, annual) : 0;
    let oneTime = 0;
    for (const s of chosenServices) {
      if (!priced(s)) continue;
      if (s.billing_interval === "month") monthly += Number(s.price_eur);
      else oneTime += Number(s.price_eur);
    }
    return { monthly: Math.round(monthly * 100) / 100, oneTime: Math.round(oneTime * 100) / 100 };
  }, [plan, annual, chosenServices]);

  if (error) return <p className="lxk-error">{error}</p>;
  if (!data || !current) return <div className="lxk-skeleton" aria-busy="true" aria-label="Cargando configurador" />;

  const hasQuote = custom || chosenServices.some(s => !priced(s));
  const canSubmit = !!plan || custom || chosenServices.length > 0;

  const summaryText = () => {
    const lines = [`Configurador · Plataforma: ${current.label}`];
    if (plan) lines.push(`Pack ${plan.name} (${annual ? "anual" : "mensual"}): ${eur(monthlyOf(plan, annual))}/mes + IVA`);
    if (custom) lines.push("Pack A medida: quiero presupuesto");
    for (const s of chosenServices) {
      lines.push(`Extra: ${s.name}${priced(s) ? ` (${eur(Number(s.price_eur))}${s.billing_interval === "month" ? "/mes" : ""} + IVA)` : " (presupuesto)"}`);
    }
    if (totals.monthly > 0) lines.push(`Total mensual: ${eur(totals.monthly)} + IVA`);
    if (totals.oneTime > 0) lines.push(`Total pago único: ${eur(totals.oneTime)} + IVA`);
    return lines.join("\n");
  };

  const submitLabel = loggedInClient && plan && !hasQuote && chosenServices.length === 0
    ? "Contratar el pack"
    : hasQuote || !loggedInClient ? "Enviar mi configuración" : "Contratar el pack";

  return (
    <div className="lxk-config">
      <div className="lxk-steps">
        <section className="lxk-step" aria-labelledby="lxk-s1">
          <h3 id="lxk-s1"><span>1</span>¿Dónde vende tu negocio?</h3>
          <PlatformTabs platforms={data.platforms} value={current.key} onChange={setPlatform} idPrefix="lxk-conf" />
        </section>

        <section className="lxk-step" aria-labelledby="lxk-s2">
          <h3 id="lxk-s2"><span>2</span>Elige tu pack</h3>
          <BillingToggle annual={annual} onChange={setAnnual} months={data.annualMonths} />
          <div className="lxk-options">
            {current.plans.map(p => (
              <button key={p.id} type="button" aria-pressed={planId === p.id}
                className={`lxk-option${planId === p.id ? " on" : ""}`} onClick={() => setPlanId(planId === p.id ? null : p.id)}>
                <span className="lxk-option-head"><strong>{p.name}</strong><em>{eur(monthlyOf(p, annual))}/mes</em></span>
                <span className="lxk-option-text">{p.lines.slice(0, 3).join(" · ")}</span>
              </button>
            ))}
            {current.custom && (
              <button type="button" aria-pressed={custom} className={`lxk-option${custom ? " on" : ""}`}
                onClick={() => setPlanId(custom ? null : "personalizado")}>
                <span className="lxk-option-head"><strong>{current.custom.name}</strong><em>Presupuesto</em></span>
                <span className="lxk-option-text">{current.custom.lines.slice(0, 3).join(" · ")}</span>
              </button>
            )}
          </div>
        </section>

        <section className="lxk-step" aria-labelledby="lxk-s3">
          <h3 id="lxk-s3"><span>3</span>Añade extras (opcional)</h3>
          {services.length === 0 ? (
            <p className="lxk-muted">No hay servicios publicados ahora mismo.</p>
          ) : (
            <div className="lxk-extras">
              {services.map(s => {
                const on = picked.includes(s.id);
                return (
                  <label key={s.id} className={`lxk-extra${on ? " on" : ""}`}>
                    <input type="checkbox" checked={on} onChange={() => setPicked(v => (on ? v.filter(x => x !== s.id) : [...v, s.id]))} />
                    <span className="lxk-extra-ico" aria-hidden="true">{s.icon || "✦"}</span>
                    <span className="lxk-extra-body">
                      <strong>{s.name}</strong>
                      {s.short_desc && <small>{s.short_desc}</small>}
                    </span>
                    <span className="lxk-extra-price">
                      {priced(s) ? `${eur(Number(s.price_eur))}${s.billing_interval === "month" ? "/mes" : ""}` : "Presupuesto"}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          <p className="lxk-muted">¿Tarjetas de aluminio, placas QR o regalos 3D? Están en la <Link href="/tienda">tienda</Link>.</p>
        </section>
      </div>

      <aside className="lxk-summary" aria-live="polite">
        <h3>Tu configuración</h3>
        <dl>
          <div><dt>Plataforma</dt><dd>{current.label}</dd></div>
          <div><dt>Pack</dt><dd>{plan ? `${plan.name} · ${annual ? "anual" : "mensual"}` : custom ? "A medida" : "Sin elegir"}</dd></div>
          {chosenServices.map(s => (
            <div key={s.id}><dt>{s.name}</dt><dd>{priced(s) ? `${eur(Number(s.price_eur))}${s.billing_interval === "month" ? "/mes" : ""}` : "Presupuesto"}</dd></div>
          ))}
        </dl>
        <div className="lxk-total">
          <div><span>Mensual</span><strong>{eur(totals.monthly)}</strong></div>
          <div><span>Pago único</span><strong>{eur(totals.oneTime)}</strong></div>
          {annual && plan && <p>Pack anual: {eur(plan.priceAnnual)} en un solo cobro.</p>}
          <p>{data.taxNote}. {hasQuote ? "Lo marcado como presupuesto te lo cerramos antes de empezar." : ""}</p>
        </div>
        <button type="button" className="lx-plan-cta gold" disabled={!canSubmit}
          onClick={() => onSubmit({ platform: current, plan, custom, annual, services: chosenServices, ...totals, summary: summaryText() })}>
          {submitLabel}
        </button>
        {!canSubmit && <p className="lxk-muted">Elige un pack o algún extra.</p>}
      </aside>
    </div>
  );
}
