export interface ShopyControlSolicitud {
  nombre: string;
  email: string;
  telefono: string;
  web: string;
  mensaje: string;
}

type ContactDetails = {
  name?: string;
  email?: string;
  phone?: string;
  storeUrl?: string;
  services?: readonly string[];
  niche?: string;
  customNiche?: string;
  revenue?: string;
  socialMedia?: string;
  extraInfo?: string;
  suppliers?: string;
  message?: string;
};

declare global {
  interface Window {
    shopyControl?: {
      solicitud?: (datos: ShopyControlSolicitud) => unknown;
    };
  }
}

const clean = (value?: string) => value?.trim() ?? "";

export function notifyShopyControl(contact: ContactDetails): void {
  try {
    if (typeof window === "undefined") return;
    const bridge = window.shopyControl;
    if (typeof bridge?.solicitud !== "function") return;

    const niche = clean(contact.customNiche) || clean(contact.niche);
    const services = contact.services?.map(clean).filter(Boolean) ?? [];
    const lines = [
      services.length ? `Servicios: ${services.join(", ")}` : "",
      niche ? `Nicho: ${niche}` : "",
      clean(contact.revenue) ? `Facturación: ${clean(contact.revenue)}` : "",
      clean(contact.socialMedia) ? `Redes sociales: ${clean(contact.socialMedia)}` : "",
      clean(contact.extraInfo) ? `Información extra: ${clean(contact.extraInfo)}` : "",
      clean(contact.suppliers) ? `Proveedores: ${clean(contact.suppliers)}` : "",
      clean(contact.message) ? `Mensaje: ${clean(contact.message)}` : "",
    ].filter(Boolean);

    const result = bridge.solicitud({
      nombre: clean(contact.name),
      email: clean(contact.email),
      telefono: clean(contact.phone),
      web: clean(contact.storeUrl),
      mensaje: lines.join("\n"),
    });

    // The bridge is best-effort and must never affect the confirmed form send.
    if (result && typeof (result as { then?: unknown }).then === "function") {
      void Promise.resolve(result).catch(() => {});
    }
  } catch {
    // Shopy Control is an additional copy; the primary contact request already succeeded.
  }
}
