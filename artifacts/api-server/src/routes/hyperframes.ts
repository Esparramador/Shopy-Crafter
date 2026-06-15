import { Router } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { askAMR } from "../lib/amr.js";
import { logger } from "../lib/logger.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// POST /api/hyperframes/generate — generate HyperFrame (animated HTML → MP4)
// Uses fluent-ffmpeg + puppeteer to capture frames from HTML and build video
router.post("/hyperframes/generate", async (req, res) => {
  const { html, duration = 5, fps = 30, width = 1280, height = 720, title } = req.body as {
    html?: string;
    duration?: number;
    fps?: number;
    width?: number;
    height?: number;
    title?: string;
  };

  if (!html) { res.status(400).json({ error: "html requerido" }); return; }

  try {
    const puppeteer = await import("puppeteer-core");
    const ffmpegModule = await import("fluent-ffmpeg");
    const ffmpegStatic = await import("ffmpeg-static");
    const os = await import("os");
    const fs = await import("fs");
    const { promisify } = await import("util");
    const mkdir = promisify(fs.mkdir);

    const tmpDir = path.join(os.default.tmpdir(), `hf-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });

    // Launch headless browser
    const browser = await puppeteer.default.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/usr/bin/chromium-browser",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      headless: true,
    });

    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Capture frames
    const totalFrames = Math.min(duration * fps, 300); // cap at 300 frames
    const frameFiles: string[] = [];

    for (let i = 0; i < totalFrames; i++) {
      const frameFile = path.join(tmpDir, `frame-${String(i).padStart(6, "0")}.png`);
      await page.screenshot({ path: frameFile as `${string}.png`, type: "png" });
      frameFiles.push(frameFile);

      // Advance animation time
      await page.evaluate((frameIndex: number, totalFps: number) => {
        const t = frameIndex / totalFps;
        // Dispatch a custom event so HTML can react to frame time
        window.dispatchEvent(new CustomEvent("hyperframe-tick", { detail: { t, frame: frameIndex } }));
      }, i, fps);

      await page.waitForTimeout?.(1000 / fps).catch(() => new Promise(r => setTimeout(r, 1000 / fps)));
    }

    await browser.close();

    // Build MP4 from frames
    const outputFile = path.join(tmpDir, "output.mp4");
    const ffmpegPath = (ffmpegStatic as unknown as { default: string }).default ?? ffmpegStatic;

    await new Promise<void>((resolve, reject) => {
      const ff = ffmpegModule.default as typeof import("fluent-ffmpeg");
      (ff as unknown as (input: string) => import("fluent-ffmpeg").FfmpegCommand)(path.join(tmpDir, "frame-%06d.png"))
        .setFfmpegPath(ffmpegPath as string)
        .inputFPS(fps)
        .videoCodec("libx264")
        .outputOption("-crf 23")
        .outputOption("-pix_fmt yuv420p")
        .outputOption(`-vf "scale=${width}:${height}"`)
        .fps(fps)
        .output(outputFile)
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .run();
    });

    // Send file
    const stat = fs.statSync(outputFile);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", `attachment; filename="${(title ?? "hyperframe").replace(/[^a-z0-9-]/gi, "_")}.mp4"`);
    fs.createReadStream(outputFile).pipe(res);

    // Cleanup after sending
    res.on("finish", () => {
      try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ok */ }
    });
  } catch (err: unknown) {
    logger.error({ err }, "HyperFrame generation failed");
    const msg = err instanceof Error ? err.message : String(err);
    // Fallback: if puppeteer/chromium not available, return the HTML directly
    if (msg.includes("executablePath") || msg.includes("chromium") || msg.includes("ENOENT")) {
      res.status(422).json({
        error: "Chromium no disponible en este entorno. HyperFrames HTML mode activo.",
        htmlOnly: true,
        html,
        fallbackMode: true,
      });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// POST /api/hyperframes/generate-html — AI generates animated HTML for HyperFrame
router.post("/hyperframes/generate-html", async (req, res) => {
  const { prompt, type = "product-showcase", brandDna, duration = 5 } = req.body as {
    prompt?: string;
    type?: string;
    brandDna?: Record<string, string>;
    duration?: number;
  };

  if (!prompt && !brandDna) {
    res.status(400).json({ error: "prompt o brandDna requerido" }); return;
  }

  const typeDescriptions: Record<string, string> = {
    "product-showcase": "showcase animado de producto con rotación 3D, partículas y texto reveal",
    "brand-intro":      "intro de marca con logo animation, tagline typewriter y fade-out",
    "data-story":       "visualización de datos animada con counters, gráficos y timeline",
    "promo-video":      "video promocional con countdown, oferta flash y CTA animado",
    "testimonial":      "slide de testimonio con avatar animado, quote reveal y rating stars",
    "social-ad":        "anuncio para redes sociales con micro-animaciones y texto bold",
  };

  const sysPrompt = `Eres un experto en animación web y motion design. Generas HTML autocontenido que crea animaciones cinematográficas usando CSS animations, GSAP CDN y Three.js CDN cuando sea apropiado. El HTML debe ser completamente autónomo, 1280x720px, y funcionar como un frame de video.`;

  const userPrompt = `Genera un HyperFrame HTML para: ${prompt ?? `marca ${brandDna?.BRAND_NAME ?? "una empresa"} del sector ${brandDna?.SECTOR ?? "general"}`}

Tipo de HyperFrame: "${type}" — ${typeDescriptions[type] ?? "animación web"}
Duración objetivo: ${duration} segundos
Colores de marca: primario ${brandDna?.PRIMARY_COLOR ?? "#6b21a8"}, fondo oscuro

El HTML debe:
- Ser 1280x720px, autocontenido, sin iframes externos de datos
- Usar GSAP CDN (https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js) para animaciones
- Incluir animaciones de entrada staggered, counters animados si hay datos, parallax si aplica
- Ser visualmente impactante — calidad de producción de video profesional
- Responder al evento 'hyperframe-tick' de window para sincronizar con el grabador
- Incluir fuentes de Google Fonts inline si se usan

Responde SÓLO con el HTML completo, sin explicaciones.`;

  if (req.headers.accept?.includes("text/event-stream")) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    const msgs = [{ role: "system", content: sysPrompt }, { role: "user", content: userPrompt }];
    const { streamAMR } = await import("../lib/amr.js");
    await streamAMR(msgs, "claude-sonnet", res);
    return;
  }

  try {
    const html = await askAMR(
      [{ role: "system", content: sysPrompt }, { role: "user", content: userPrompt }],
      "claude-opus",
      { maxTokens: 8000 }
    );
    res.json({ html });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// POST /api/hyperframes/deck/generate — AI generates a slide deck as HTML
router.post("/hyperframes/deck/generate", async (req, res) => {
  const { topic, slides = 10, brandDna, style = "modern" } = req.body as {
    topic: string;
    slides?: number;
    brandDna?: Record<string, string>;
    style?: string;
  };

  if (!topic) { res.status(400).json({ error: "topic requerido" }); return; }

  const sysPrompt = `Eres un diseñador de presentaciones experto. Creas decks HTML animados visualmente impactantes.`;
  const userPrompt = `Genera un deck de presentación HTML completo para: "${topic}"
Marca: ${brandDna?.BRAND_NAME ?? "La empresa"} | Sector: ${brandDna?.SECTOR ?? "general"}
Número de slides: ${slides} | Estilo: ${style}
Color primario: ${brandDna?.PRIMARY_COLOR ?? "#7c3aed"}

El deck HTML debe:
- Tener exactamente ${slides} slides navegables con teclado (flechas) y clicks
- Cada slide 100vw x 100vh con diseño full-bleed
- Animaciones de transición entre slides (fade/slide/scale)
- Slide 1: portada con logo, título y subtítulo impactante
- Slides 2-${slides - 1}: contenido variado (datos, bullets, imagen+texto, quote)
- Último slide: CTA y contacto
- Progress bar o dots de navegación
- Usar GSAP CDN para animaciones
- Fuentes Google Fonts inline
- Exportable a PDF con Ctrl+P (media print optimizado)

Output: HTML completo autocontenido. Sin explicaciones.`;

  if (req.headers.accept?.includes("text/event-stream")) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    await streamAMR(
      [{ role: "system", content: sysPrompt }, { role: "user", content: userPrompt }],
      "claude-sonnet", res
    );
    return;
  }

  try {
    const html = await askAMR(
      [{ role: "system", content: sysPrompt }, { role: "user", content: userPrompt }],
      "claude-opus",
      { maxTokens: 12000 }
    );
    res.json({ html, slides, topic });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// POST /api/hyperframes/pptx/export — export HTML deck to PPTX
router.post("/hyperframes/pptx/export", async (req, res) => {
  const { slides, title = "Deck" } = req.body as {
    slides: Array<{ title: string; content: string; backgroundColor?: string }>;
    title?: string;
  };

  if (!Array.isArray(slides) || !slides.length) {
    res.status(400).json({ error: "slides array requerido" }); return;
  }

  try {
    const pptx = (await import("pptxgenjs")).default;
    const pres = new pptx();

    pres.defineLayout({ name: "LAYOUT_16x9", width: 10, height: 5.625 });
    pres.layout = "LAYOUT_16x9";

    for (const slide of slides) {
      const s = pres.addSlide();
      s.background = { color: (slide.backgroundColor ?? "#1a1a2e").replace("#", "") };
      s.addText(slide.title, {
        x: 0.5, y: 1.5, w: 9, h: 1,
        fontSize: 36, bold: true, color: "FFFFFF",
        align: "center",
      });
      s.addText(slide.content, {
        x: 0.5, y: 2.8, w: 9, h: 2,
        fontSize: 18, color: "CCCCCC",
        align: "center", wrap: true,
      });
    }

    const buffer = await pres.write({ outputType: "arraybuffer" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="${title.replace(/[^a-z0-9-]/gi, "_")}.pptx"`);
    res.send(Buffer.from(buffer as ArrayBuffer));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
