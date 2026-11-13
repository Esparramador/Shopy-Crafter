// createActionStreamFilter(): en streaming, el cliente nunca ve los bloques
// :::ACTION:::, lleguen como lleguen partidos, y el texto normal no se pierde.
import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", async (orig) => {
  process.env.DATABASE_URL ||= "postgres://test@127.0.0.1:9/none"; // el Pool no conecta
  return { ...(await orig<object>()) };
});

import { createActionStreamFilter } from "./router.js";

function run(chunks: string[]): string {
  let out = "";
  const f = createActionStreamFilter(t => { out += t; });
  for (const c of chunks) f.push(c);
  f.end();
  return out;
}

describe("createActionStreamFilter", () => {
  it("quita un bloque partido en cualquier punto", () => {
    const full = 'Hola.\n:::ACTION:::{"action":"request_team","params":{}}:::END_ACTION:::\nAdiós.';
    for (let i = 1; i < full.length; i++) {
      expect(run([full.slice(0, i), full.slice(i)])).toBe("Hola.\n\nAdiós.");
    }
    expect(run(full.split(""))).toBe("Hola.\n\nAdiós.");
  });

  it("deja pasar los dos puntos normales y lo retenido sale al final", () => {
    expect(run(["Abrimos a las 10:", "30. Ratio 3:", "1 :"])).toBe("Abrimos a las 10:30. Ratio 3:1 :");
    expect(run(["Fin ::"])).toBe("Fin ::");
  });

  it("un bloque sin cerrar no se enseña", () => {
    expect(run(['Vale.:::ACTION:::{"action":"x"'])).toBe("Vale.");
  });

  it("varios bloques seguidos", () => {
    expect(run(["A:::ACTION:::{}:::END_ACTION:::B:::ACTION:::{}:::END_ACTION:::C"])).toBe("ABC");
  });
});
