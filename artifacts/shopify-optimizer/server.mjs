/**
 * Servidor de producción del front: compresión, caché inmutable de /assets y 404 real,
 * cosas que el hosting estático de Replit no da. Resuelve cada ruta a su HTML plano del prerender.
 */
import express from 'express';
import compression from 'compression';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), 'dist/public');
const app = express();
app.disable('x-powered-by');
app.use(compression());
app.use((_req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
  next();
});
app.use('/assets', express.static(join(DIST, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
app.use(express.static(DIST, { index: false, redirect: false, maxAge: '7d', setHeaders: (res, p) => { if (/\.html$|\/sw\.js$/.test(p)) res.set('Cache-Control', 'no-cache'); } }));
app.use((req, res) => {
  const clean = req.path.replace(/\/+$/, '') || '/';
  const flat = clean === '/' ? 'index.html' : `${clean.slice(1).replace(/\//g, '__')}.html`;
  for (const f of [flat, join(clean.slice(1), 'index.html')]) {
    if (!f.includes('..') && existsSync(join(DIST, f))) return res.set('Cache-Control', 'no-cache').sendFile(join(DIST, f));
  }
  // Rutas privadas y dinámicas del SPA: las pinta la app.
  if (/^\/(home|admin|client|project|new-project|login|invite|reset-password|forgot-password|help|oauth-success|tienda\/|blog\/)/.test(clean)) return res.set('Cache-Control', 'no-cache').sendFile(join(DIST, 'index.html'));
  res.status(404).set('Cache-Control', 'no-cache').sendFile(join(DIST, 'index.html'));
});
app.listen(Number(process.env.PORT) || 19080, '0.0.0.0');
