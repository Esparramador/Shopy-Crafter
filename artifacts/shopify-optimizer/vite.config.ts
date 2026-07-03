import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

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

// During builds (production deployment), always use "/" — assets are served from root.
// During dev, use BASE_PATH (Replit path-based routing proxy requires it).
const viteBase = isBuild ? "/" : basePath;

export default defineConfig({
  base: viteBase,

  plugins: [
    react(),
    tailwindcss(),
    {
      // Cache-Control para la build de producción servida con `vite preview`.
      // Los assets con hash de contenido (/assets/*.js|css|fuentes) son inmutables;
      // medios (vídeos/imágenes) reciben max-age largo; el HTML nunca se cachea
      // para que cada deploy entregue las referencias de assets más recientes.
      name: "cache-control-headers",
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = (req.url || "").split("?")[0];
          if (/\/assets\/(?!videos\/).*\.(js|mjs|css|woff2?|ttf|otf|eot)$/i.test(url)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          } else if (/\.(mp4|webm|mov|jpe?g|png|webp|avif|gif|svg|ico)$/i.test(url)) {
            res.setHeader("Cache-Control", "public, max-age=2592000");
          } else if (/\.html?$/i.test(url) || url === "/" || !/\.[a-z0-9]+$/i.test(url)) {
            res.setHeader("Cache-Control", "no-cache");
          }
          next();
        });
      },
    },
    ...(!isProd ? [await import("@replit/vite-plugin-runtime-error-modal").then(m => m.default())] : []),
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

    rollupOptions: {
      output: {
        // Content-hashed file names for long-term cache
        entryFileNames:  "assets/[name]-[hash].js",
        chunkFileNames:  "assets/[name]-[hash].js",
        assetFileNames:  "assets/[name]-[hash][extname]",

        // Manual chunks: keep heavy vendor libs in separate cacheable files
        manualChunks(id) {
          // React core — changes very rarely.
          // CRITICAL: scheduler + react runtime deps MUST live in the SAME chunk as
          // react/react-dom. If scheduler lands in vendor-misc, vendor-react imports it
          // back from vendor-misc while vendor-misc imports react from vendor-react,
          // creating a circular ESM chunk dependency. In production that cycle evaluates
          // with `React` still undefined → "Cannot set properties of undefined (setting
          // 'Children')" → React never initializes → blank/black screen (SSR shell stays).
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/") ||
            id.includes("node_modules/react-is/") ||
            id.includes("node_modules/use-sync-external-store/")
          ) {
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
      "/api":              { target: "http://localhost:8080", changeOrigin: true, secure: false },
      "^/shopify(/|\\?|$)": { target: "http://localhost:8080", changeOrigin: true, secure: false },
    },
  },

  preview: {
    port,
    host:         "0.0.0.0",
    allowedHosts: true,
  },
});
