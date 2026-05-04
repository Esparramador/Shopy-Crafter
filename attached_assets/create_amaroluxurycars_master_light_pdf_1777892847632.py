#!/usr/bin/env python3
"""
AMARO LUXURY CARS - MASTER PACKAGE 2026 (LIGHT THEME - TEXTO VISIBLE)
TODO EN UN SOLO DOCUMENTO - LISTO PARA ENTREGAR A REPLIOT
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from datetime import datetime

# LIGHT THEME - TEXTO NEGRO SOBRE FONDO BLANCO (VISIBLE)
LIGHT_BG = HexColor("#FFFFFF")
DARK_TEXT = HexColor("#1A1A1A")
GOLD = HexColor("#B8860B")
BLUE = HexColor("#1F4E79")
CYAN = HexColor("#0066CC")
GRAY = HexColor("#333333")
LIGHT_GRAY = HexColor("#F5F5F5")
WHITE = HexColor("#FFFFFF")

OUTPUT = "/home/workdir/artifacts/AmaroLuxuryCars_MASTER_PACKAGE_2026.pdf"

def styles():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle(name='MainTitle', fontSize=14, textColor=BLUE, alignment=TA_CENTER, spaceAfter=4, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Sub', fontSize=9, textColor=CYAN, alignment=TA_CENTER, spaceAfter=6))
    s.add(ParagraphStyle(name='Section', fontSize=10, textColor=BLUE, spaceBefore=8, spaceAfter=3, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='SubSection', fontSize=8, textColor=CYAN, spaceBefore=4, spaceAfter=2, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Body', fontSize=7, textColor=DARK_TEXT, alignment=TA_JUSTIFY, spaceAfter=2, leading=9))
    s.add(ParagraphStyle(name='Prompt', fontSize=5.5, textColor=DARK_TEXT, fontName='Courier', leading=6.5, leftIndent=2, rightIndent=2, spaceAfter=3, backColor=LIGHT_GRAY))
    s.add(ParagraphStyle(name='Footer', fontSize=5, textColor=GRAY, alignment=TA_CENTER))
    s.add(ParagraphStyle(name='Highlight', fontSize=7.5, textColor=GOLD, fontName='Helvetica-Bold', spaceAfter=2))
    return s

def header_footer(canvas, doc):
    canvas.saveState()
    # Header claro
    canvas.setFillColor(HexColor("#1F4E79"))
    canvas.rect(0, A4[1]-18, A4[0], 18, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont('Helvetica-Bold', 5.5)
    canvas.drawString(5, A4[1]-12, "AMARO LUXURY CARS | MASTER PACKAGE 2026 - TODO LISTO PARA REPLIOT")
    # Footer claro
    canvas.setFillColor(HexColor("#1F4E79"))
    canvas.rect(0, 0, A4[0], 12, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont('Helvetica', 4.5)
    canvas.drawCentredString(A4[0]/2, 2, f"Generated {datetime.now().strftime('%Y-%m-%d')} | Entregar directamente a RepliOT")
    canvas.restoreState()

def build():
    doc = SimpleDocTemplate(OUTPUT, pagesize=A4, rightMargin=7, leftMargin=7, topMargin=25, bottomMargin=15)
    st = styles()
    story = []

    # COVER
    story.append(Spacer(1, 10))
    story.append(Paragraph("AMARO LUXURY CARS", st['MainTitle']))
    story.append(Paragraph("MASTER PACKAGE 2026 - TODO EN UN SOLO DOCUMENTO", st['Sub']))
    story.append(Paragraph("Análisis Exhaustivo + Campaña Completa + Prompts + Estrategia 30 días", st['Body']))
    story.append(Paragraph("LISTO PARA ENTREGAR A REPLIOT", st['Highlight']))
    story.append(Spacer(1, 6))

    # INSTRUCCIONES
    story.append(Paragraph("INSTRUCCIONES PARA REPLIOT", st['Section']))
    story.append(Paragraph("""
<b>Este documento contiene TODO lo necesario para ejecutar la campaña de Amaro Luxury Cars en 2026.</b>

<b>Cómo usar este documento:</b>
1. Lee el Análisis Exhaustivo (Sección 1)
2. Usa los 6 Vídeos de la Campaña (Sección 2) - copia los prompts a Grok Imagine / Kling / Runway
3. Sigue la Estrategia de Contenido 30 días (Sección 3)
4. Usa los Prompts Adicionales cuando necesites más contenido
5. Aplica las Recomendaciones de Identidad Visual

<b>Contacto:</b> @amaroluxurycars | Reservas por WhatsApp
    """, st['Body']))
    story.append(Spacer(1, 5))

    # SECCIÓN 1: ANÁLISIS
    story.append(Paragraph("SECCIÓN 1: ANÁLISIS EXHAUSTIVO DE @amaroluxurycars", st['Section']))
    story.append(Paragraph("""
<b>DATOS DEL PERFIL:</b>
- Usuario: @amaroluxurycars
- Nombre: AMARO LUXURY CAR RENTALS
- Logo: Escudo negro con alas doradas
- Bio actual: "Alquiler Coches de Lujo | BCN & Madrid"
- Ubicaciones: Barcelona · Madrid
- Seguidores: 787 | Publicaciones: 10
- Modelos identificados: Lamborghini Urus, Mercedes AMG, BMW M4, BMW M3 CS Touring, Ferrari, Lotus, Dodge Challenger

<b>BRAND DNA (7 PILARES):</b>
1. Core Offering: Alquiler premium de superdeportivos y SUVs de lujo en Barcelona y Madrid.
2. Target Audience: Profesionales 30-55 años, empresarios, influencers, parejas que buscan experiencias.
3. Tone of Voice: Premium pero accesible, emocionante, moderno.
4. Visual DNA: Negro profundo + Dorado + Plata, iluminación dramática, coches en movimiento.
5. Emotional Benefit: "Libertad absoluta de conducir el coche de tus sueños sin comprarlo".
6. Diferenciador Clave: Presencia en dos ciudades top + flota exclusiva + atención personalizada por WhatsApp.
7. Debilidad Actual: Solo 10 publicaciones y 787 seguidores → perfil muy nuevo. Gran oportunidad de crecimiento.

<b>AUDITORÍA DEL PERFIL ACTUAL:</b>
✓ Fortalezas: Logo profesional y memorable, posicionamiento claro, flota muy atractiva, CTA directo (WhatsApp).
✗ Puntos de mejora críticos: Solo 10 publicaciones (parece inactivo), falta de contenido dinámico (Reels/Stories), bio demasiado genérica, sin testimonios, sin estrategia de contenido.
    """, st['Body']))
    story.append(Spacer(1, 4))

    # SECCIÓN 2: LOS 6 VÍDEOS
    story.append(Paragraph("SECCIÓN 2: LOS 6 VÍDEOS COMPLETOS DE LA CAMPAÑA", st['Section']))
    story.append(Paragraph("""
<b>VÍDEO 1 - EL DESEO (12 seg) - Lamborghini Urus</b>
12-second vertical video, premium cinematic style, golden hour. Black Lamborghini Urus parked in front of luxury building in Barcelona. Camera slowly orbits the car (0-6s). Doors open. Man in suit approaches and looks at the car with desire. Camera pushes into the Urus logo. He speaks with perfect lip sync: "Este es el coche que siempre soñé... y hoy lo puedo conducir sin comprarlo."

TEXT: "LAMBORGHINI URUS" at 3s | "HOY LO CONDUCES TÚ" at 8s | "RESERVA AHORA →" at 10s

<b>VÍDEO 2 - LA EXPERIENCIA (14 seg) - BMW M4</b>
14-second vertical video. Man gets into black BMW M4 Competition. Camera shows interior (leather, digital dashboard, ambient lighting) in slow motion (0-5s). Then car driving on coastal road at sunset (5-11s). Final shot: man parking and smiling. Speaks: "Este es el sonido del motor. Esta es la sensación de libertad. Sin mantenimiento. Sin límites."

TEXT: "BMW M4 COMPETITION" at 4s | "SIN LÍMITES" at 9s | "RESERVA AHORA →" at 12s

<b>VÍDEO 3 - LA LIBERTAD (10 seg)</b>
10-second vertical video. Man driving green Lamborghini Urus on highway. Camera shows him smiling, wind in hair, pure joy. Voice-over: "Sin entrada. Sin mantenimiento. Sin límite de kilómetros. Solo tú, el coche y la carretera."

TEXT: "0€ MANTENIMIENTO" at 2s | "KM ILIMITADOS" at 5s | "RESERVA AHORA →" at 8s

<b>VÍDEO 4 - TESTIMONIOS REALES (12 seg)</b>
12-second vertical video. 3 quick testimonials:
- "Alquilé el Urus para mi boda. Fue el mejor día de mi vida."
- "Llevé el M4 a una reunión de negocios. Impresioné a todos."
- "El mejor regalo de aniversario que nos hemos hecho."

TEXT: "CLIENTES REALES" | "EXPERIENCIAS REALES" | "RESERVA AHORA →"

<b>VÍDEO 5 - DECONSTRUCCIÓN (16 seg)</b>
16-second vertical video. Starts with full fleet (Urus, M4, Ferrari, Lotus). Camera zooms into each car showing details. Timelapse showing how easy it is to rent: choose car → select dates → pay → drive. Voice-over: "Elige tu coche. Elige tus fechas. Paga. Y conduce. Así de fácil."

TEXT: "ELIGE → RESERVA → CONDUCE" at 8s | "ASÍ DE FÁCIL" at 12s

<b>VÍDEO 6 - CTA FINAL (8 seg)</b>
8-second vertical video. Man standing next to a Ferrari or Urus. Looks at camera with confident smile: "Este fin de semana conduce el coche que siempre quisiste. Reserva ahora y vive la experiencia."

TEXT: "TU COCHE. TU MOMENTO." at 2s | "RESERVA AHORA → WHATSAPP" at 5s
    """, st['Body']))
    story.append(Spacer(1, 4))

    # SECCIÓN 3: ESTRATEGIA 30 DÍAS
    story.append(Paragraph("SECCIÓN 3: ESTRATEGIA DE CONTENIDO 30 DÍAS PARA INSTAGRAM", st['Section']))
    story.append(Paragraph("""
<b>SEMANA 1 - AWARENESS (Días 1-7)</b>
Lunes: Foto del logo + claim "Vive el coche que sueñas"
Martes: Reel - "Los 5 coches más deseados de Amaro" (15 seg)
Miércoles: Foto de interior de Urus + texto "Este es tu futuro asiento"
Jueves: Reel - Time-lapse de un coche llegando limpio
Viernes: Foto de cliente + testimonio corto
Sábado: Stories con poll "Ferrari o Lamborghini?"
Domingo: Foto de flota completa + "Elige tu fin de semana"

<b>SEMANA 2 - CONSIDERATION (Días 8-14)</b>
Lunes: Reel - "Cómo alquilar un superdeportivo en 3 minutos"
Martes: Foto de M4 CS Touring + specs
Miércoles: Reel - Conducción real (carretera de noche)
Jueves: Foto de interior + "Esto es lo que sientes al sentarte"
Viernes: Testimonio en vídeo (15 seg)
Sábado: Stories - "Pregúntame lo que quieras sobre alquilar"
Domingo: Foto de oferta especial de la semana

<b>SEMANA 3 - CONVERSION (Días 15-21)</b>
Lunes: Reel - "Los 3 errores que cometen los que alquilan por primera vez"
Martes: Foto de Urus + precio "Desde 299€/día"
Miércoles: Reel - "Por qué el Urus es el SUV más deseado del mundo"
Jueves: Foto de cliente feliz + "Este fin de semana podría ser el tuyo"
Viernes: Oferta flash "20% off en reservas de mayo"
Sábado: Stories con countdown de la oferta
Domingo: Foto de flota + "Elige tu coche. Reserva hoy."

<b>SEMANA 4 - RETENTION + UGC (Días 22-30)</b>
Lunes: Reel - "Los 5 momentos más épicos de nuestros clientes"
Martes: Foto de Lotus + "El coche más subestimado de nuestra flota"
Miércoles: Reel - "Un día en la vida de un cliente de Amaro"
Jueves: Foto de interior de Ferrari + "Esto no se compra. Se vive."
Viernes: Testimonio en vídeo largo (30 seg)
Sábado: Stories - "Danos tu opinión y gana un día gratis"
Domingo: Foto de todos los coches + "Gracias por soñar con nosotros"
    """, st['Body']))
    story.append(Spacer(1, 4))

    # SECCIÓN 4: PROMPTS ADICIONALES
    story.append(Paragraph("SECCIÓN 4: PROMPTS ADICIONALES (LISTOS PARA USAR)", st['Section']))
    story.append(Paragraph("""
<b>PROMPT - TESTIMONIO REAL (15 seg)</b>
15-second vertical video. Real client (or actor) standing next to a Urus: "Alquilé el Lamborghini Urus para mi boda. Fue el mejor día de mi vida. Todo el mundo se quedó mirando. Amaro me lo puso facilísimo. Reservaré otra vez sin duda."

<b>PROMPT - INTERIOR 360º (10 seg)</b>
10-second vertical video. 360º slow rotation inside a Ferrari or Urus. Voice-over: "Este es el interior que solo unos pocos pueden disfrutar... hasta hoy."

<b>PROMPT - COMPARATIVA ANTES/DESPUÉS (12 seg)</b>
12-second vertical video. Split screen: Left = "Antes: soñando con el coche". Right = "Después: conduciendo el Urus". Text: "Deja de soñar. Empieza a conducir."
    """, st['Prompt']))
    story.append(Spacer(1, 4))

    # SECCIÓN 5: IDENTIDAD VISUAL
    story.append(Paragraph("SECCIÓN 5: RECOMENDACIONES DE IDENTIDAD VISUAL", st['Section']))
    story.append(Paragraph("""
<b>Logo actual:</b> Muy bueno (alas doradas + escudo negro). Mantenerlo.

<b>Paleta de colores recomendada:</b>
- Negro profundo (#0A0A0A)
- Dorado metálico (#D4AF37)
- Plata / Blanco roto (#F5F5F5)
- Rojo acento para Ferrari (#C41E3A)

<b>Tipografía recomendada:</b>
- Títulos: Montserrat Bold o Neue Haas Grotesk
- Cuerpo: Inter o Satoshi

<b>Estilo fotográfico:</b>
- Siempre coches limpios y brillantes
- Iluminación dorada o azulada (nunca luz plana)
- Fondos minimalistas o paisajes de ciudad
- Puertas abiertas o capó abierto cuando sea posible
- Modelos diversos (hombres y mujeres 30-50 años)

<b>Hashtags recomendados:</b>
#AmaroLuxuryCars #AlquilerCochesLujo #Barcelona #Madrid #LamborghiniUrus #Ferrari #BMWM4 #ExperienciaUnica #SinCompromiso
    """, st['Body']))
    story.append(Spacer(1, 6))

    story.append(Paragraph("AMARO LUXURY CAR RENTALS | Barcelona & Madrid | Reservas por WhatsApp", st['Footer']))
    story.append(Paragraph("MASTER PACKAGE 2026 - TODO LISTO PARA REPLIOT. Contacto: @amaroluxurycars", st['Footer']))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"✅ PDF MASTER PACKAGE (LIGHT THEME) generado: {OUTPUT}")

if __name__ == "__main__":
    build()