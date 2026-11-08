import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Barrera global: ninguna prueba puede salir a tiendas ni proveedores reales
    // (solo localhost). Detalles y lista blanca TEST_NET_ALLOW en el propio archivo.
    setupFiles: ["./src/test/network-guard.ts"],
    // QR artwork and ZXing decoding are CPU-heavy; leave capacity for the API
    // workflow and avoid deadline/worker-start failures from competing suites.
    maxWorkers: 2,
  },
});
