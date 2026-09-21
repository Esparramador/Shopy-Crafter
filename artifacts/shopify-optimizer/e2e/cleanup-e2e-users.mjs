// Borra los usuarios de prueba que dejaron ejecuciones antiguas del E2E de voz
// (email e2e-voz-*@e2e.invalid) usando DELETE /api/admin/users/:id.
//
// Uso:  pnpm --filter @workspace/shopify-optimizer run e2e:cleanup-users
// Env:  ADMIN_PASSWORD (obligatoria), E2E_ADMIN_EMAIL, E2E_BASE_URL (por defecto
//       https://$REPLIT_DEV_DOMAIN). Con DRY_RUN=1 solo lista, no borra.

const BASE = (process.env.E2E_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`).replace(/\/$/, "");
const EMAIL = process.env.E2E_ADMIN_EMAIL || "craftershopy@gmail.com";
const PASSWORD = process.env.ADMIN_PASSWORD;
const DRY_RUN = process.env.DRY_RUN === "1";
const E2E_EMAIL = /^e2e-voz-[a-z0-9_-]+@e2e\.invalid$/i;

if (!PASSWORD) { console.error("Falta ADMIN_PASSWORD"); process.exit(1); }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!login.ok) { console.error(`Login admin falló: ${login.status}`); process.exit(1); }
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
if (!cookie) { console.error("El login no devolvió cookie de sesión"); process.exit(1); }
const headers = { cookie };

const users = await (await fetch(`${BASE}/api/admin/users`, { headers })).json();
const targets = users.filter((u) => u.role === "client" && E2E_EMAIL.test(u.email));
console.log(`${targets.length} usuario(s) de prueba encontrados${DRY_RUN ? " (DRY_RUN, no se borra nada)" : ""}`);

let failed = 0;
for (const u of targets) {
  if (DRY_RUN) { console.log(`  - ${u.email} (${u.id}, ${u.isActive ? "activo" : "inactivo"})`); continue; }
  const r = await fetch(`${BASE}/api/admin/users/${u.id}`, { method: "DELETE", headers });
  const body = await r.text().catch(() => "");
  console.log(`  ${r.ok ? "✓" : "✗"} ${u.email} → ${r.status}${r.ok ? "" : ` ${body.slice(0, 120)}`}`);
  if (!r.ok) failed++;
}
if (!DRY_RUN) {
  const after = await (await fetch(`${BASE}/api/admin/users`, { headers })).json();
  const left = after.filter((u) => E2E_EMAIL.test(u.email)).length;
  console.log(`Quedan ${left} usuario(s) de prueba en el listado`);
  if (left > 0 || failed > 0) process.exit(1);
}
