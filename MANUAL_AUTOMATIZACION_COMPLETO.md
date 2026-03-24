# MANUAL COMPLETO DE AUTOMATIZACION — ShopyBrain / ShopifyAI

> Manual ultra-detallado paso a paso de TODAS las funciones de automatizacion de la plataforma.
> Actualizado: Marzo 2026

---

## INDICE

1. [Configuracion Inicial de Klaviyo](#1-configuracion-inicial-de-klaviyo)
2. [Crear Emails Automatizados desde la App](#2-crear-emails-automatizados-desde-la-app)
3. [Generar Workflows Completos con IA (Chatbot)](#3-generar-workflows-completos-con-ia-chatbot)
4. [Tipos de Flows Disponibles](#4-tipos-de-flows-disponibles)
5. [Variables de Klaviyo Explicadas](#5-variables-de-klaviyo-explicadas)
6. [Automatizacion de Productos — Redesign Masivo](#6-automatizacion-de-productos--redesign-masivo)
7. [Automatizacion de Imagenes IA](#7-automatizacion-de-imagenes-ia)
8. [Tests A/B Automatizados](#8-tests-ab-automatizados)
9. [SEO Automatizado](#9-seo-automatizado)
10. [Pricing Inteligente Automatizado](#10-pricing-inteligente-automatizado)
11. [Automatizaciones del Cerebro (ShopyBrain)](#11-automatizaciones-del-cerebro-shopybrain)
12. [Notificaciones Push](#12-notificaciones-push)
13. [Comandos de Voz](#13-comandos-de-voz)
14. [Jobs Automaticos (Scheduler 24/7)](#14-jobs-automaticos-scheduler-247)
15. [Chatbot OmniCore — Absorcion Universal](#15-chatbot-omnicore--absorcion-universal)
16. [Troubleshooting / Solucion de Problemas](#16-troubleshooting--solucion-de-problemas)

---

## 1. CONFIGURACION INICIAL DE KLAVIYO

### Que es Klaviyo y por que lo usamos

Klaviyo es la plataforma de email marketing mas potente para Shopify. Tu app ShopyBrain genera todo el contenido (HTML, asuntos, logica de triggers) y Klaviyo se encarga de ENVIAR los emails a tus clientes. La app controla el cerebro; Klaviyo es el cartero.

### Paso 1: Crear cuenta en Klaviyo

1. Ve a **https://www.klaviyo.com** y crea una cuenta gratuita
2. Conecta tu tienda Shopify:
   - En Klaviyo, ve a **Settings > Integrations > Add Integration > Shopify**
   - Introduce tu dominio de tienda (ej: `mi-tienda.myshopify.com`)
   - Autoriza la conexion
3. Klaviyo empezara a sincronizar tus clientes, pedidos y productos automaticamente

### Paso 2: Obtener tu API Key privada de Klaviyo

1. En Klaviyo, ve a **Settings > API Keys** (o **Account > Settings > API Keys**)
2. Haz clic en **"Create Private API Key"**
3. Dale un nombre descriptivo, ej: `ShopyBrain Integration`
4. En los permisos, selecciona **Full Access** para:
   - Campaigns (Read/Write)
   - Flows (Read/Write)
   - Templates (Read/Write)
   - Events/Metrics (Read/Write)
   - Lists/Segments (Read/Write)
   - Profiles (Read/Write)
5. Haz clic en **"Create"**
6. **COPIA la API Key** — empieza por `pk_` y tiene muchos caracteres

### Paso 3: Configurar la API Key en tu app

1. En tu app ShopyBrain, ve al **panel de administracion**
2. La API Key de Klaviyo se configura como variable de entorno `KLAVIYO_API_KEY`
3. En Replit: ve a **Secrets** (candado) y anade:
   - Nombre: `KLAVIYO_API_KEY`
   - Valor: (pega tu API key de Klaviyo aqui)
4. Reinicia el servidor — la integracion se activa automaticamente

### Paso 4: Verificar la conexion

1. Ve a la seccion **Emails** en tu app (sidebar izquierdo > Emails)
2. Si ves la interfaz de creacion de flows sin errores, la conexion esta activa
3. Tambien puedes verificar desde el chatbot OmniCore escribiendo: `"Estado de Klaviyo"`

---

## 2. CREAR EMAILS AUTOMATIZADOS DESDE LA APP

Esta es la seccion principal. La app tiene un constructor de emails con 3 pasos que hace TODO por ti.

### PASO A PASO COMPLETO:

#### Paso 1: Ir a la seccion de Emails

1. Inicia sesion en tu app con tu email de admin
2. En el sidebar izquierdo, haz clic en **"Emails"** (icono de sobre)
3. Veras el dashboard de emails con tus flows existentes (si los hay)

#### Paso 2: Crear un nuevo Flow

1. Haz clic en el boton **"+ Nuevo"** (esquina superior)
2. Se abre el constructor de 3 pasos con las pestanas: **1. Disenar | 2. Contenido | 3. Activar**

#### Paso 3: Tab "1. Disenar" — Configurar el Flow

Aqui configuras QUE tipo de email quieres crear:

**3a. Nombre del Flow:**
- Escribe un nombre descriptivo
- Ejemplo: `"Carrito abandonado — Mi Tienda de Moda"`

**3b. Tipo de Flow (selector desplegable):**
Elige uno de los 8 tipos disponibles:

| Tipo | Que hace | Cuando se envia |
|------|----------|-----------------|
| Carrito abandonado | Recupera ventas perdidas | Cuando alguien anade productos al carrito y se va sin comprar |
| Confirmacion pedido | Confirma la compra + ofrece upsell | Inmediatamente despues de comprar |
| Bienvenida | Primera impresion perfecta | Cuando alguien se suscribe a tu lista |
| Reactivacion | Recupera clientes dormidos | Clientes que no compran hace 30+ dias |
| Solicitar resena | Pide prueba social | Dias despues de que reciban el pedido |
| VIP Upgrade | Premia a los mejores clientes | Clientes que han gastado mas de 200 euros |
| Restock | Avisa de disponibilidad | Cuando un producto vuelve a estar en stock |
| Bajada de precio | Convierte indecisos | Cuando bajas el precio de un producto |

**3c. Tono del Email:**
Selecciona como quieres que suene:
- **Urgente / Escasez** — "Solo quedan 3 unidades!"
- **Amigable / Cercano** — "Hola! Vimos que te gusto..."
- **Premium / Exclusivo** — "Has sido seleccionado..."
- **Casual / Informal** — "Ey! Te dejaste esto..."
- **Formal / Profesional** — "Estimado cliente, le informamos..."

**3d. Delay (retraso de envio):**
Cuanto tiempo esperar antes de enviar:
- Inmediato
- 1 hora despues
- 3 horas despues
- 24 horas despues
- 3 dias despues
- 7 dias despues

**3e. Proyecto asociado:**
Selecciona la tienda/proyecto para la que es este email.

**3f. Opciones extra (checkboxes):**
- Incluir descuento
- Incluir urgencia/escasez
- Incluir resenas de clientes

**3g.** Haz clic en **"Siguiente -> Contenido"**

#### Paso 4: Tab "2. Contenido" — IA Genera Todo

Aqui la magia ocurre. ShopyBrain genera todo el contenido del email automaticamente.

1. Haz clic en el boton dorado **"Generar con ShopyBrain"**
2. Espera 10-20 segundos — la IA esta trabajando
3. La IA genera automaticamente:
   - **Subject A** — primera linea de asunto (para test A/B)
   - **Subject B** — segunda linea de asunto alternativa
   - **Preview text** — el texto que aparece en la bandeja de entrada
   - **HTML completo** — email profesional responsive con:
     - Logo de tu tienda
     - Imagenes de productos
     - Boton de CTA (llamada a la accion)
     - Footer con datos legales
     - Variables de Klaviyo ya insertadas
   - **Version texto plano** — para clientes sin HTML

4. **Vista previa**: Haz clic en **"Vista previa"** para ver como se ve el email
5. Si no te gusta, haz clic en **"Regenerar"** para que la IA lo intente de nuevo
6. Cuando estes satisfecho, haz clic en **"Siguiente -> Activar en Klaviyo"**

#### Paso 5: Tab "3. Activar" — Enviar a Klaviyo

Este es el paso final. Aqui revisas todo y lo activas con un clic:

1. Revisa el resumen:
   - Tipo de flow y su trigger
   - Delay configurado
   - Tono elegido
   - Asunto A/B
   - Tamano del HTML

2. Comprueba el **"Estado en Klaviyo"**:
   - **Borrador**: aun no se ha enviado a Klaviyo
   - **Live en Klaviyo**: ya esta activo y enviando
   - **Error**: hubo un problema (ver mensaje)

3. La app muestra lo que Klaviyo creara automaticamente:
   - Template HTML en Klaviyo
   - Flow con trigger configurado
   - A/B test de asuntos activado
   - Smart sending habilitado

4. Haz clic en el boton dorado grande **"Crear y activar en Klaviyo"**
5. Espera unos segundos — la app esta:
   - Creando el template en Klaviyo
   - Creando el flow con el trigger correcto
   - Configurando el envio automatico
6. Veras el mensaje: **"Flow activado en Klaviyo exitosamente"**

**LISTO!** El email ya esta activo en tu cuenta de Klaviyo y se enviara automaticamente cuando se cumpla el trigger.

#### Paso 6: Verificar en Klaviyo (opcional)

1. Abre Klaviyo en el navegador
2. Ve a **Flows** en el menu lateral
3. Veras tu nuevo flow como **"Draft"** o **"Live"**
4. Puedes activarlo manualmente si esta en draft:
   - Haz clic en el flow
   - Haz clic en **"Review and Turn On"**
   - Confirma

---

## 3. GENERAR WORKFLOWS COMPLETOS CON IA (CHATBOT)

El chatbot OmniCore puede generar un plan completo de 6 workflows de una sola vez.

### Paso a paso:

1. Haz clic en el **boton dorado del cerebro** (esquina inferior derecha de cualquier pagina)
2. Se abre el chatbot OmniCore
3. Escribe algo como:
   - `"Genera un workflow completo de Klaviyo para mi tienda"`
   - `"Crea una estrategia de email marketing completa"`
   - `"Necesito automatizar emails para mi tienda de moda"`
4. El chatbot usa **dos IAs**:
   - **Gemini** analiza tu nicho y mercado
   - **Claude** genera el contenido completo de cada flow
5. En unos minutos, recibiras una tarjeta con **6 flows estrategicos**:
   - Carrito abandonado
   - Bienvenida
   - Post-compra / Upsell
   - Browse Abandonment (abandono de navegacion)
   - Win-back (reactivacion)
   - VIP
6. Cada flow incluye:
   - Nombre optimizado
   - Subject lines A/B
   - HTML completo
   - Trigger configurado
   - Delay recomendado
7. Puedes **activar cada flow individualmente** haciendo clic en el boton de activar de la tarjeta

---

## 4. TIPOS DE FLOWS DISPONIBLES

### Carrito Abandonado (checkout_abandoned)
- **Trigger en Klaviyo**: "Checkout Started"
- **Que hace**: Se envia cuando alguien empieza el checkout pero no completa la compra
- **Mejor delay**: 1-3 horas
- **Contenido tipico**: Imagen del producto abandonado, descuento opcional, CTA urgente
- **ROI esperado**: 5-15% de recuperacion de ventas

### Confirmacion de Pedido (order_placed)
- **Trigger en Klaviyo**: "Placed Order"
- **Que hace**: Confirma la compra y sugiere productos complementarios
- **Mejor delay**: Inmediato
- **Contenido tipico**: Resumen del pedido, tracking, productos relacionados
- **ROI esperado**: 3-8% de upsell

### Bienvenida (welcome)
- **Trigger en Klaviyo**: "Subscribed to List"
- **Que hace**: Primera impresion cuando alguien se suscribe
- **Mejor delay**: Inmediato
- **Contenido tipico**: Presentacion de marca, descuento de bienvenida, bestsellers
- **ROI esperado**: 20-30% de conversion con descuento

### Reactivacion (win_back)
- **Trigger en Klaviyo**: Basado en fecha (30+ dias sin compra)
- **Que hace**: Recupera clientes que no han comprado en mucho tiempo
- **Mejor delay**: 30 dias despues de ultima compra
- **Contenido tipico**: "Te echamos de menos", descuento exclusivo, novedades
- **ROI esperado**: 2-5% de reactivacion

### Solicitar Resena (review_requested)
- **Trigger en Klaviyo**: "Fulfilled Order"
- **Que hace**: Pide una resena del producto comprado
- **Mejor delay**: 7 dias (para que lo hayan recibido)
- **Contenido tipico**: "Como te ha ido con [producto]?", enlace a resena
- **ROI esperado**: 10-20% de resenas obtenidas

### VIP Upgrade (vip_upgrade)
- **Trigger en Klaviyo**: Basado en segmento (gastado >200 euros)
- **Que hace**: Premia a los mejores clientes con acceso exclusivo
- **Mejor delay**: Inmediato al entrar en segmento
- **Contenido tipico**: Acceso anticipado, descuento VIP, envio gratis permanente

### Restock (stock_back)
- **Trigger en Klaviyo**: Evento personalizado
- **Que hace**: Avisa cuando un producto vuelve a estar disponible
- **Mejor delay**: Inmediato
- **Contenido tipico**: "Ya disponible!", imagen del producto, CTA directo

### Bajada de Precio (price_drop)
- **Trigger en Klaviyo**: Evento personalizado
- **Que hace**: Avisa a quienes vieron un producto de que ha bajado de precio
- **Mejor delay**: Inmediato
- **Contenido tipico**: Precio anterior vs nuevo, ahorro, CTA urgente

---

## 5. VARIABLES DE KLAVIYO EXPLICADAS

Cuando la IA genera los emails, inserta **variables de Klaviyo** que se sustituyen automaticamente por los datos reales de cada cliente. Aqui tienes las mas comunes:

| Variable | Que muestra | Ejemplo |
|----------|-------------|---------|
| `{{ first_name }}` | Nombre del cliente | "Maria" |
| `{{ last_name }}` | Apellido | "Garcia" |
| `{{ email }}` | Email del cliente | "maria@gmail.com" |
| `{{ organization }}` | Nombre de tu tienda | "Mi Tienda" |
| `{{ event.ExtraContext.image_url }}` | Imagen del producto del evento | URL de la imagen |
| `{{ event.ExtraContext.product_name }}` | Nombre del producto | "Camiseta Premium" |
| `{{ event.ExtraContext.product_url }}` | URL del producto | Link directo |
| `{{ event.value }}` | Valor del pedido/carrito | "49.99" |
| `{{ event.ExtraContext.discount_code }}` | Codigo de descuento | "WELCOME10" |

**No necesitas escribir estas variables** — la IA las inserta automaticamente en el HTML segun el tipo de flow.

---

## 6. AUTOMATIZACION DE PRODUCTOS — REDESIGN MASIVO

### Que es

La IA reescribe titulos, descripciones, meta titles y meta descriptions de TODOS tus productos (o los que elijas) de una sola vez.

### Paso a paso:

1. Ve a tu proyecto > **"Redesign"** en el sidebar
2. Veras la lista de todos tus productos con su "grado" actual (A-F)
3. Tienes dos opciones de automatizacion masiva:
   - **"Redisenar Debiles (C-F)"** — solo reescribe los peores
   - **"Redisenar Todo"** — reescribe el catalogo completo
4. Haz clic en el boton que prefieras
5. La IA procesa cada producto individualmente (unos segundos por producto)
6. Puedes ver el progreso en tiempo real
7. Cuando termina, cada producto tiene:
   - Nuevo titulo optimizado para SEO
   - Nueva descripcion persuasiva
   - Nuevo meta title (60 caracteres)
   - Nueva meta description (155 caracteres)
8. **Para aplicar los cambios a Shopify**:
   - Haz clic en **"Aplicar a Shopify"** en cada producto
   - O usa el boton de aplicar masivo

### Redesign individual:

1. Haz clic en **"Redisenar"** junto a cualquier producto
2. La IA genera la propuesta en 5-10 segundos
3. Revisa el antes/despues
4. Si te gusta, haz clic en **"Aplicar a Shopify"** para publicarlo directamente

---

## 7. AUTOMATIZACION DE IMAGENES IA

### Que es

Genera imagenes profesionales para tus productos usando IA (Replicate + FLUX), sin necesidad de fotografo.

### Tipos de imagenes disponibles:

| Tipo | Descripcion |
|------|-------------|
| Hero / Studio | Foto de estudio profesional con fondo limpio |
| Lifestyle | Producto en contexto de uso real |
| Macro / Detalle | Primer plano extremo mostrando texturas |
| Unboxing | Experiencia de desempaquetado premium |
| Social Media | Foto casual para redes sociales |
| Escala | Producto junto a objeto de referencia |
| Bundle / Flat Lay | Composicion plana con varios productos |

### Paso a paso:

1. Ve a tu proyecto > **"Imagenes IA"** en el sidebar
2. Veras la lista de productos con los tipos de imagen disponibles
3. Para generar una imagen:
   - Haz clic en **"Generar"** junto al tipo de imagen que quieras
   - La IA construye un prompt profesional basado en tu producto, nicho y tono de marca
   - Replicate genera la imagen (30-60 segundos)
   - La imagen aparece en tu vault del proyecto
4. **Boost Masivo**: Haz clic en **"Boost Masivo"** para generar imagenes de todos los productos a la vez
5. Cada imagen generada incluye:
   - Alt text optimizado para SEO (generado por Claude)
   - Prompt original guardado
   - Registro en el vault del proyecto

---

## 8. TESTS A/B AUTOMATIZADOS

### Que es

Compara dos versiones de un producto (imagenes, titulos, precios) y la app mide cual convierte mejor.

### Paso a paso:

1. Ve a tu proyecto > **"A/B Testing"** en el sidebar
2. Haz clic en **"Nuevo Test"**
3. Selecciona el producto a testear
4. Define tu hipotesis (que quieres probar)
5. La app:
   - Muestra version A (original) vs version B (nueva)
   - Rastrea conversiones en tiempo real
   - Calcula confianza estadistica
6. Cuando haya suficientes datos:
   - Haz clic en **"Gana A"** o **"Gana B"**
   - La version ganadora se puede aplicar automaticamente a Shopify

---

## 9. SEO AUTOMATIZADO

### Herramientas disponibles:

1. **Auditoria SEO completa** — analiza toda tu tienda y da puntuacion
2. **Schemas JSON-LD** — genera datos estructurados para Google
3. **Meta Tags masivo** — regenera meta titles y descriptions de todos los productos
4. **Fix Alt texts** — corrige los alt texts de imagenes para SEO
5. **Sitemap** — genera sitemap XML optimizado
6. **PageSpeed** — analisis de velocidad (mobile y desktop)
7. **Keywords** — investigacion de palabras clave para tu nicho
8. **Blog Strategy** — genera plan de contenido para blog con articulos completos

### Paso a paso (ejemplo: auditar SEO):

1. Ve a tu proyecto > **"SEO Tecnico"** en el sidebar
2. Haz clic en **"Auditar SEO Completo"**
3. La IA analiza: meta tags, headings, imagenes, velocidad, schemas, etc.
4. Recibiras un informe con puntuacion y acciones recomendadas
5. Puedes aplicar las correcciones automaticamente con los botones de cada seccion

---

## 10. PRICING INTELIGENTE AUTOMATIZADO

### Que es

La IA analiza tus costes, margenes, competidores y mercado para sugerir precios optimos.

### Paso a paso:

1. Ve a tu proyecto > **"Pricing + P&L"** en el sidebar
2. La IA analiza:
   - Costes de produccion (COGs)
   - Precios de la competencia
   - Elasticidad de demanda
   - Margenes actuales
3. Genera recomendaciones de precio para cada producto
4. Puedes aplicar los nuevos precios a Shopify directamente

---

## 11. AUTOMATIZACIONES DEL CEREBRO (SHOPYBRAIN)

ShopyBrain aprende continuamente sobre e-commerce y tu nicho especifico. Estas son sus funciones automaticas:

### Dashboard (admin/shopybrain):
- Vision general del cerebro: memorias totales, dominios activos, confianza media
- Visualizacion de los dominios de conocimiento

### Memorias (admin/shopybrain/memories):
- Explorador de todas las memorias acumuladas
- Filtros: por nicho, tipo, nivel de confianza
- Cada memoria tiene: titulo, contenido, etiquetas, confianza (0-1)

### Knowledge Domains (admin/shopybrain/insights):
- 16 dominios de conocimiento especializados:
  - Product Photography, SEO, Copywriting, Pricing, Email Marketing,
  - Social Media, Conversion, UX/UI, Brand Identity, Analytics,
  - Customer Retention, Advertising, Supply Chain, Legal/Compliance,
  - Trends, Competitor Intelligence

### Sesiones de Estudio (admin/shopybrain/study):
- Trigger manual: haz clic en **"Iniciar Sesion de Estudio"**
- La IA estudia 2-14 dominios y genera nuevos insights
- Todo se guarda permanentemente en la memoria

---

## 12. NOTIFICACIONES PUSH

### Que es

Notificaciones del navegador para alertas importantes (stock critico, bajadas de precio de competidores, etc.)

### Como funciona:

1. El sistema usa VAPID keys (Web Push Protocol)
2. Se activan automaticamente al aceptar notificaciones en el navegador
3. Los triggers vienen del scheduler (jobs automaticos):
   - Stock critico de un producto
   - Cambio de precio de un competidor
   - Alerta de inventario bajo
4. No requiere configuracion adicional — funciona out-of-the-box

---

## 13. COMANDOS DE VOZ

### Que es

Control por voz de la app — di comandos en espanol y la app ejecuta acciones.

### Como usar:

1. Haz clic en el **boton del microfono** (icono en la barra superior)
2. Habla en espanol:
   - `"Ir a auditoria"` — navega a la pagina de auditoria
   - `"Dame los ingresos"` — muestra datos de revenue
   - `"Audita los productos"` — lanza una auditoria
   - `"Ve a SEO"` — navega a SEO
3. La IA interpreta tu comando y ejecuta la accion
4. Recibiras respuesta de voz con los resultados

---

## 14. JOBS AUTOMATICOS (SCHEDULER 24/7)

Tu app ejecuta 10 trabajos automaticos sin que tengas que hacer nada:

| Horario | Job | Que hace |
|---------|-----|----------|
| Cada 1h | Tokens Shopify | Renueva automaticamente los tokens de acceso de cada tienda |
| Cada 3h | Micro-learning | ShopyBrain estudia 2 dominios y genera 3 insights por sesion |
| Cada 6h | Consolidacion | Convierte insights en memorias permanentes |
| Cada 12h | Cross-synthesis | Encuentra conexiones cruzadas entre dominios |
| 1:00 AM | Deep study | Estudio profundo: 14 dominios x 5 insights = 70 insights por noche |
| 2:00 AM | Revenue | Captura snapshot de ventas de todas las tiendas |
| 3:00 AM | Real data | Integra datos reales de Shopify en el cerebro |
| 6:00 AM | Competidores | Escanea precios de la competencia |
| 7:00 AM | Inventario | Sincroniza stock + alerta si hay stock critico |
| Domingo 0:00 | Mega-synthesis | Sintesis estrategica semanal de todo lo aprendido |

**No necesitas configurar nada** — estos jobs corren automaticamente 24/7 mientras el servidor este activo.

---

## 15. CHATBOT OMNICORE — ABSORCION UNIVERSAL

### Que es

El boton dorado del cerebro (esquina inferior derecha) abre un chatbot multi-modelo que absorbe y aprende de CUALQUIER cosa.

### Que puedes hacer:

**Subir imagenes:**
- Arrastra una imagen al chatbot o usa el boton de upload
- Claude Vision analiza: composicion, colores, texturas, estilo, marca
- Todo se guarda permanentemente en ShopyBrain

**Pegar URLs:**
- Pega cualquier URL de un competidor, una tienda, un articulo
- La IA analiza el contenido completo
- Extrae: marca, productos, pricing, estrategia, audiencia

**Redes sociales:**
- Pega links de Instagram, Facebook, Twitter/X, YouTube
- La IA analiza: identidad de marca, estrategia de contenido, engagement

**Investigacion de marcas:**
- Escribe `@NombreDeMarca` o `"investiga [nombre]"`
- El motor de 8 fases investiga todo sobre esa marca:
  - Google Search (8 busquedas en paralelo)
  - Analisis de productos, social, noticias, reviews
  - Perfil completo de competidor

**Generar workflows de Klaviyo:**
- Escribe `"Genera un workflow de Klaviyo para mi tienda"`
- Recibiras 6 flows estrategicos listos para activar

---

## 16. TROUBLESHOOTING / SOLUCION DE PROBLEMAS

### "Error al enviar a Klaviyo"
- **Causa**: API Key de Klaviyo invalida o sin permisos suficientes
- **Solucion**: Verifica que la API Key tenga permisos Full Access para Flows, Templates y Events

### "No se genera el contenido del email"
- **Causa**: API de Claude (Anthropic) no disponible temporalmente
- **Solucion**: Espera 30 segundos y vuelve a intentar

### "El flow aparece como Draft en Klaviyo"
- **Normal**: Algunos flows se crean como draft por seguridad
- **Solucion**: En Klaviyo, abre el flow > "Review and Turn On" > Confirma

### "Los emails no se envian"
- **Causa 1**: El flow esta en modo Draft en Klaviyo (no activado)
- **Causa 2**: La lista de suscriptores esta vacia
- **Causa 3**: El trigger no se ha activado aun (nadie ha abandonado carrito, etc.)
- **Solucion**: Verifica en Klaviyo que el flow este en "Live" y que haya perfiles en tu lista

### "Las imagenes tardan mucho en generarse"
- **Normal**: Replicate puede tardar 30-90 segundos por imagen
- **Solucion**: Espera pacientemente. Si tarda mas de 2 minutos, la API de Replicate puede estar saturada

### "El redesign masivo se para"
- **Causa**: Timeout del servidor o rate limit de Claude
- **Solucion**: Divide el lote — usa "Redisenar Debiles" primero, luego el resto

### "No puedo ver los datos de una tienda"
- **Causa**: Token de Shopify expirado
- **Solucion**: Ve a Settings del proyecto > haz clic en "Regenerar Token"

### "La tienda esta desconectada"
- **Causa**: Se uso la funcion "Desconectar tienda" (elimina credenciales, conserva datos)
- **Solucion**: En Settings > aparece un panel dorado "Tienda desconectada" > Haz clic en "Reconectar" e introduce las nuevas credenciales

---

## RESUMEN VISUAL DE FLUJO KLAVIYO

```
TU APP (ShopyBrain)              KLAVIYO                    CLIENTE
     |                              |                          |
     |  1. Creas flow               |                          |
     |  2. IA genera HTML            |                          |
     |  3. Click "Activar"           |                          |
     |  ────────────────────>        |                          |
     |     Crea template             |                          |
     |     Crea flow + trigger       |                          |
     |     Configura A/B test        |                          |
     |                              |                          |
     |                              |  Trigger se activa        |
     |                              |  (ej: carrito abandonado) |
     |                              |  ──────────────────────>  |
     |                              |     Email enviado         |
     |                              |                          |
     |                              |  <──── Abre / Click       |
     |                              |                          |
     |  <──── Metricas (open/click)  |                          |
     |  Dashboard actualizado        |                          |
```

---

**Recuerda**: Tu app es el CEREBRO (genera contenido, logica, estrategia). Klaviyo es el CARTERO (envia los emails). Nunca necesitas abrir Klaviyo para crear contenido — todo se controla desde ShopyBrain.
