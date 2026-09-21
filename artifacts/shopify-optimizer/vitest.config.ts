import { defineConfig } from "vitest/config";

// Standalone config: the app's vite.config.ts pulls in SSR/prerender plugins
// that unit tests do not need. Tests run in Node against pure modules.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
