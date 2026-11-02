import type { Request, Response } from "express";

/** Lo que recibe cada grupo de acciones del cerebro (antes, variables del handler). */
export interface BrainActionCtx {
  req: Request;
  res: Response;
  action: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
  resolveStripeAccountId: (rawId?: string) => Promise<string | null>;
}

/** La acción no pertenece a este grupo. */
export const NOT_HANDLED = Symbol("brain-action-not-handled");

/**
 * Resultado de un grupo: el objeto `result` (se responde con él), `undefined`
 * (la acción ya respondió por su cuenta) o NOT_HANDLED.
 */
export type BrainActionOutcome = Record<string, unknown> | undefined | typeof NOT_HANDLED;
export type BrainActionRunner = (ctx: BrainActionCtx) => Promise<BrainActionOutcome>;
