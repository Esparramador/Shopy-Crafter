import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort  = process.env.PORT;
const isBuild  = process.argv.includes("build");
const isProd   = process.env.NODE_ENV === "production";

if (!rawPort && !isBuild) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = rawPort ? Number(rawPort) : 3000;

if (!isBuild && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath && !isBuild) {
  throw new Error("BASE_PATH environment variable is required but was not provided.");
}

export default defineConfig({
  base: basePath,

  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(!isProd && process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then(m =>
            m.cartographer({ root: path.resolve(import.meta.dirname, "..") })
          ),
          await import("@replit/vite-plugin-dev-banner").then(m => m.devBanner()),
        ]
      : []),
  ],

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },

  root: path.resolve(import.meta.dirname),

  build: {
    outDir:     path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    cssCodeSplit: true,
    sourcemap:  false,
    target:     "es2020",

    // Raise chunk-size warning threshold — Three.js & Fabric are inherently large
    chunkSizeWarningLimit: 1100,

    // Disable automatic modulepreload injection.
    // With a single SPA entry, Vite would emit <link rel="modulepreload"> for every
    // vendor chunk — including Three.js, D3, and heavy admin bundles — on every page,
    // even on lightweight public content pages (/blog, /changelog, /casos-de-exito)
    // that never touch those libraries. Turning this off lets browsers load each
    // chunk on-demand only when a lazy route actually needs it, which meaningfully
    // reduces the initial parse/compile work for public content pages.
    modulePreload: false,

    rollupOptions: {
      output: {
        // Content-hashed file names for long-term cache
        // SSR builds override entryFileNames to avoid hash so prerender.mjs can find the bundle predictably
        entryFileNames:  process.env.SSR_BUILD === "1" ? "[name].js" : "assets/[name]-[hash].js",
        chunkFileNames:  "assets/[name]-[hash].js",
        assetFileNames:  "assets/[name]-[hash][extname]",

        // Manual chunks: keep heavy vendor libs in separate cacheable files
        manualChunks(id) {
          // React core — changes very rarely
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "vendor-react";
          }
          // Router
          if (id.includes("node_modules/wouter")) {
            return "vendor-router";
          }
          // Data fetching
          if (id.includes("node_modules/@tanstack/react-query")) {
            return "vendor-query";
          }
          // Radix UI / Shadcn (large component lib)
          if (id.includes("node_modules/@radix-ui")) {
            return "vendor-radix";
          }
          // Three.js core (heavy — isolated so it's only loaded by 3D pages)
          if (id.includes("node_modules/three/")) {
            return "vendor-three-core";
          }
          // React Three Fiber
          if (id.includes("node_modules/@react-three/fiber")) {
            return "vendor-three-fiber";
          }
          // React Three Drei (large, many sub-modules)
          if (id.includes("node_modules/@react-three/drei")) {
            return "vendor-drei";
          }
          // Framer Motion
          if (id.includes("node_modules/framer-motion")) {
            return "vendor-motion";
          }
          // Lucide icons
          if (id.includes("node_modules/lucide-react")) {
            return "vendor-icons";
          }
          // Fabric.js — canvas graphics (CardStudio only)
          if (id.includes("node_modules/fabric")) {
            return "vendor-fabric";
          }
          // Konva / react-konva — canvas lib (CardStudio only)
          if (id.includes("node_modules/konva") || id.includes("node_modules/react-konva")) {
            return "vendor-konva";
          }
          // D3 — data visualisation
          if (id.includes("node_modules/d3") || id.includes("node_modules/d3-")) {
            return "vendor-d3";
          }
          // JSZip — zip file generation
          if (id.includes("node_modules/jszip")) {
            return "vendor-jszip";
          }
          // All other node_modules
          if (id.includes("node_modules/")) {
            return "vendor-misc";
          }
        },
      },
    },

    minify: "esbuild",
  },

  server: {
    port,
    host:         "0.0.0.0",
    allowedHosts: true,
    hmr:          { clientPort: 443 },
    fs:           { strict: true, deny: ["**/.*"] },
    proxy: {
      "/api":     { target: "http://localhost:8080", changeOrigin: true, secure: false },
      "/shopify": { target: "http://localhost:8080", changeOrigin: true, secure: false },
    },
  },

  preview: {
    port,
    host:         "0.0.0.0",
    allowedHosts: true,
  },
});
