/**
 * Catálogo único de acciones de ShopyBrain.
 *
 * Las acciones existen si tienen runner (BRAIN_ACTIONS, routes/shopybrain/dispatch.ts);
 * su descripción vive en catalog-docs.ts; si son destructivas lo dice
 * DESTRUCTIVE_ACTIONS (lib/shopybrain-helpers.ts). Aquí se añade en qué puertas se
 * permite cada una. Por defecto una acción es SOLO de admin: para abrirla a otra
 * puerta hay que nombrarla en GATE_ALLOWLIST, y eso se comprueba en el servidor
 * (brainRoute descarta lo que el modelo proponga fuera de lista; brainExecute lo
 * rechaza), no en el prompt.
 *
 * Puertas:
 *  - admin:  el dueño (chat de admin, Centro de mando, voz, paleta…). Todo el catálogo.
 *  - client: un cliente con sesión. Solo lectura de SU proyecto y peticiones al equipo.
 *  - public: visitante de la landing (chat, voz, contacto). Responder, abrir un lead
 *            (que lanza el Pre-Informe). Nada interno.
 */
import { BRAIN_ACTIONS } from "../../routes/shopybrain/dispatch.js";
import { DESTRUCTIVE_ACTIONS } from "../shopybrain-helpers.js";
import { CATALOG_LINES } from "./catalog-docs.js";

export type BrainGate = "admin" | "client" | "public";
export const BRAIN_GATES: readonly BrainGate[] = ["admin", "client", "public"];

export function isBrainGate(v: unknown): v is BrainGate {
  return typeof v === "string" && (BRAIN_GATES as readonly string[]).includes(v);
}

/**
 * Acciones propias de las puertas client/public. No pasan por los runners (que
 * llaman a endpoints de admin con la cookie): las implementa lib/brain/execute.ts
 * sin depender de la petición HTTP.
 */
export const NATIVE_ACTIONS = {
  request_team: {
    description: "Pasar una petición o pregunta del cliente al equipo de Shopy Crafter (llega como mensaje a su panel y avisa al equipo). Úsala cuando pida algo que solo puede hacer el equipo. Params: {content (la petición, con todo el detalle), title?}",
    gates: ["client"],
  },
  create_lead: {
    description: "Abrir una solicitud de contacto con los datos del visitante; el equipo la recibe y se prepara su Pre-Informe gratuito. Pide nombre y email antes de usarla, nunca los inventes. Params: {name, email, phone?, storeUrl?, niche?, message (qué necesita), services?: string[]}",
    gates: ["public"],
  },
} as const satisfies Record<string, { description: string; gates: readonly BrainGate[] }>;

export type NativeAction = keyof typeof NATIVE_ACTIONS;

/** Acciones que derivan la conversación a personas del equipo (decisión «handoff»). */
export const HANDOFF_ACTIONS: ReadonlySet<string> = new Set<NativeAction>(["request_team", "create_lead"]);

/**
 * Lista blanca por puerta (admin = todo BRAIN_ACTIONS). Las acciones de runner que
 * aparecen aquí no pueden tocar `req` ni la cookie de admin; catalog.test.ts lo
 * comprueba leyendo su código.
 */
export const GATE_ALLOWLIST: Record<Exclude<BrainGate, "admin">, readonly string[]> = {
  client: [
    "platform_store_status",
    "platform_list_products",
    "platform_get_product",
    "platform_get_orders",
    "list_vault_videos",
    "request_team",
  ],
  public: ["create_lead"],
};

export interface BrainActionDef {
  name: string;
  description: string;
  destructive: boolean;
  gates: BrainGate[];
  /** true = la implementa execute.ts, no un runner. */
  native: boolean;
}

const DOCS = new Map<string, string>(
  CATALOG_LINES.filter((l): l is readonly [string, string] => typeof l !== "string"),
);

function gatesFor(name: string): BrainGate[] {
  const gates: BrainGate[] = [];
  if (BRAIN_ACTIONS.includes(name)) gates.push("admin");
  if (GATE_ALLOWLIST.client.includes(name)) gates.push("client");
  if (GATE_ALLOWLIST.public.includes(name)) gates.push("public");
  return gates;
}

let cached: BrainActionDef[] | null = null;

/** Todas las acciones conocidas: las de runner y las propias de las puertas. */
export function getBrainCatalog(gate?: BrainGate): BrainActionDef[] {
  cached ??= [
    ...BRAIN_ACTIONS.map(name => ({
      name,
      description: DOCS.get(name) ?? "",
      destructive: DESTRUCTIVE_ACTIONS.has(name),
      gates: gatesFor(name),
      native: false,
    })),
    ...Object.entries(NATIVE_ACTIONS).map(([name, def]) => ({
      name,
      description: def.description,
      destructive: false,
      gates: [...def.gates],
      native: true,
    })),
  ];
  return gate ? cached.filter(a => a.gates.includes(gate)) : cached;
}

export function isActionAllowed(action: string, gate: BrainGate): boolean {
  if (gate === "admin") return BRAIN_ACTIONS.includes(action);
  return GATE_ALLOWLIST[gate].includes(action)
    && (BRAIN_ACTIONS.includes(action) || Object.prototype.hasOwnProperty.call(NATIVE_ACTIONS, action));
}

export function isNativeAction(action: string): action is NativeAction {
  return Object.prototype.hasOwnProperty.call(NATIVE_ACTIONS, action);
}

/**
 * Líneas «- acción: descripción» de las acciones de la puerta, para el prompt.
 * Admin ve el catálogo con sus secciones y notas, tal cual estaba en /search;
 * las demás puertas, solo sus acciones.
 */
export function buildActionCatalogText(gate: BrainGate): string {
  if (gate === "admin") {
    return CATALOG_LINES
      .map(l => typeof l === "string" ? l : `  - ${l[0]}: ${l[1]}`)
      .join("\n");
  }
  return getBrainCatalog(gate).map(a => `  - ${a.name}: ${a.description}`).join("\n");
}

/** Cómo debe proponer acciones el modelo (lo extrae extractActions en router.ts). */
export const ACTION_BLOCK_FORMAT = `Formato del bloque de acción (pon esto al final de tu respuesta cuando detectes una acción):
  :::ACTION:::{"action":"nombre_accion","params":{...}}:::END_ACTION:::`;
