# Tienda, accesibilidad y SEO — diseño aprobado

## Objetivo

Hacer más fácil regresar desde cualquier pantalla de la tienda, presentar de forma clara los servicios disponibles, completar la cobertura de accesibilidad y mejorar la indexación y el rendimiento sin prometer puntuaciones que dependen del dispositivo o de la red.

## Alcance

1. **Navegación de la tienda**
   - Añadir controles visibles «Atrás» e «Inicio» al encabezado común de `/tienda/*`.
   - «Inicio» siempre enlaza a la landing.
   - «Atrás» utiliza el historial interno cuando existe y, al entrar directamente, conduce a un destino seguro dentro del sitio.
   - Mantener objetivos táctiles y disposición legible en móvil.

2. **Sitemap e indexación**
   - Conservar el sitemap estático generado desde el registro de rutas SEO públicas.
   - Añadir las fichas de productos con `visible = TRUE`, de forma dinámica y sin incluir carrito, confirmación, login, admin ni área de cliente.
   - Mantener `robots.txt` apuntando a todos los sitemaps que Google deba consultar.
   - Verificar que las URLs sean absolutas, canónicas, respondan correctamente y estén permitidas para rastreo.
   - No intentar enviar los sitemaps a Search Console sin acceso autorizado a esa cuenta; entregar las URLs para que el propietario las registre.

3. **Metadatos y texto alternativo**
   - Revisar las rutas de toda la aplicación para que las imágenes informativas tengan `alt` descriptivo y las decorativas `alt=""`.
   - Revisar títulos y descripciones únicos en las rutas públicas indexables.
   - Mantener fuera del sitemap las rutas privadas y de transacción, con `noindex` donde corresponda.

4. **Proyectos**
   - Suprimir «Quiero algo así» para Comic Crafter en la tarjeta, el diseño alternativo de tarjeta y el diálogo de detalle.
   - Mantener el resto de la información de Comic Crafter y los CTA de los demás proyectos.

5. **Catálogo de tienda**
   - Conservar los productos y servicios existentes; el catálogo actual ya contiene tarjetas, placas QR, expositores, regalos 3D, landing, web corporativa, rediseño de tienda, vídeo 3D y app nativa.
   - Incorporar como servicios de presupuesto las ofertas solicitadas que faltan: auditoría SEO, optimización PageSpeed/Core Web Vitals e informes mensuales.
   - No inventar precios. Usar el flujo de presupuesto existente y separar claramente productos físicos, servicios web y vídeo/animación.

6. **Rendimiento**
   - Medir la landing, la tienda y una ficha de producto en móvil y escritorio antes y después.
   - Priorizar imágenes, carga diferida de 3D, JavaScript/CSS y recursos de terceros.
   - Usar 100/100 en PageSpeed como objetivo de optimización, no como garantía universal; registrar las puntuaciones y métricas reales de cada prueba.

## Alternativas consideradas

- **Solo navegación y sitemap actual:** cambio pequeño, pero no añade fichas de producto ni resuelve las necesidades de accesibilidad y rendimiento indicadas.
- **Revisión pública de SEO únicamente:** más útil para indexación, pero deja fuera la revisión de accesibilidad que el propietario pidió para toda la aplicación.
- **Alcance aprobado:** navegación en la tienda, sitemap de rutas públicas y productos visibles, texto alternativo en toda la aplicación, CTA corregido solo para Comic Crafter, servicios de presupuesto y optimización medida. Es la opción seleccionada.

## Criterios de aceptación

- Todas las páginas de tienda permiten volver a una ruta interna segura y volver a la landing.
- El sitemap público enumera las rutas indexables y todos los productos visibles; no contiene rutas privadas ni de transacción.
- `robots.txt` referencia el sitemap o sitemaps vigentes.
- No quedan imágenes informativas sin texto alternativo; las decorativas no se anuncian a lectores de pantalla.
- Las páginas públicas tienen metadatos descriptivos y canónicos coherentes.
- Comic Crafter no muestra «Quiero algo así» en ningún formato de tarjeta o detalle; los demás proyectos conservan sus CTA.
- Los servicios existentes siguen disponibles y los nuevos servicios de presupuesto no muestran precios inventados.
- Las pruebas de rendimiento se documentan con dispositivo, página y métricas; cualquier puntuación inferior a 100 se informa con sus causas, no se oculta.

## Validación de arquitectura

El sitio estático ya genera `sitemap.xml` durante el prerender, mientras que el catálogo visible vive en la base de datos del API. La implementación debe resolver esa separación de forma dinámica —preferentemente mediante un sitemap público del API referenciado desde `robots.txt` junto al sitemap estático— y comprobar la ruta publicada antes de darla por válida.
