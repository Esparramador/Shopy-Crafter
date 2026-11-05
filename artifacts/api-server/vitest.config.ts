import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // QR artwork and ZXing decoding are CPU-heavy; leave capacity for the API
    // workflow and avoid deadline/worker-start failures from competing suites.
    maxWorkers: 2,
  },
});
