/**
 * Corta una promesa que tarda demasiado. Antes había cuatro copias (una que ni
 * siquiera cortaba); esta además limpia el temporizador cuando la promesa acaba.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = "operación"): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout ${Math.round(ms / 1000)}s: ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
