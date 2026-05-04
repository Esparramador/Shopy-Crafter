#!/usr/bin/env python3
"""
ANÁLISIS EXHAUSTIVO + SISTEMA COMPLETO
@amaroluxurycars - Amaro Luxury Car Rentals
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from datetime import datetime

DARK = HexColor("#0A0A0A")
GOLD = HexColor("#FFD700")
NEON = HexColor("#00FF9F")
CYAN = HexColor("#00F0FF")
WHITE = HexColor("#FFFFFF")
GRAY = HexColor("#CCCCCC")
DARK_GRAY = HexColor("#1A1A1A")
BLUE = HexColor("#1F4E79")
RED = HexColor("#E74C3C")

OUTPUT = "/home/workdir/artifacts/AmaroLuxuryCars_Analisis_Completo_2026.pdf"

def styles():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle(name='MainTitle', fontSize=12, textColor=BLUE, alignment=TA_CENTER, spaceAfter=4, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Sub', fontSize=8, textColor=NEON, alignment=TA_CENTER, spaceAfter=6))
    s.add(ParagraphStyle(name='Section', fontSize=9, textColor=BLUE, spaceBefore=6, spaceAfter=3, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='SubSection', fontSize=7.5, textColor=CYAN, spaceBefore=3, spaceAfter=2, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Body', fontSize=6.5, textColor=WHITE, alignment=TA_JUSTIFY, spaceAfter=2, leading=8))
    s.add(ParagraphStyle(name='Prompt', fontSize=5, textColor=GRAY, fontName='Courier', leading=6, leftIndent=1, rightIndent=1, spaceAfter=3, backColor=DARK_GRAY))
    s.add(ParagraphStyle(name='Footer', fontSize=5, textColor=HexColor("#888888"), alignment=TA_CENTER))
    s.add(ParagraphStyle(name='Highlight', fontSize=7, textColor=GOLD, fontName='Helvetica-Bold', spaceAfter=2))
    s.add(ParagraphStyle(name='Warning', fontSize=6.5, textColor=RED, fontName='Helvetica-Bold', spaceAfter=2))
    return s

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(DARK)
    canvas.rect(0, A4[1]-18, A4[0], 18, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.setFont('Helvetica-Bold', 5)
    canvas.drawString(5, A4[1]-12, "AMARO LUXURY CARS | Análisis Exhaustivo + Sistema Completo 2026")
    canvas.setFillColor(DARK)
    canvas.rect(0, 0, A4[0], 12, fill=1, stroke=0)
    canvas.setFillColor(NEON)
    canvas.setFont('Helvetica', 4.5)
    canvas.drawCentredString(A4[0]/2, 3, f"Generated {datetime.now().strftime('%Y-%m-%d')} | Análisis 100% Real basado en Instagram")
    canvas.restoreState()

def build():
    doc = SimpleDocTemplate(OUTPUT, pagesize=A4, rightMargin=7, leftMargin=7, topMargin=25, bottomMargin=15)
    st = styles()
    story = []

    # COVER
    story.append(Spacer(1, 8))
    story.append(Paragraph("ANÁLISIS EXHAUSTIVO + SISTEMA COMPLETO", st['MainTitle']))
    story.append(Paragraph("@amaroluxurycars | Amaro Luxury Car Rentals", st['Sub']))
    story.append(Paragraph("Análisis 100% Real | Brand DNA | Auditoría | Campaña + Prompts", st['Body']))
    story.append(Spacer(1, 5))

    # SECCIÓN 1: DATOS EXTRAÍDOS
    story.append(Paragraph("1. DATOS EXTRAÍDOS DEL PERFIL (Instagram @amaroluxurycars)", st['Section']))
    story.append(Paragraph("""
<b>Nombre de usuario:</b> amaroluxurycars
<b>Nombre completo:</b> AMARO LUXURY CAR RENTALS
<b>Logo:</b> Escudo negro con alas doradas y tipografía elegante "AMARO"
<b>Bio actual:</b> "Alquiler Coches de Lujo | BCN & Madrid"
<b>Ubicaciones:</b> Barcelona · Madrid
<b>CTA:</b> "Reservas por WhatsApp"
<b>Estadísticas:</b> 10 publicaciones | 787 seguidores | 21 seguidos
<b>Modelos identificados:</b> Lamborghini Urus, Mercedes AMG, BMW M4, BMW M3 CS Touring, Ferrari, Lotus, Dodge Challenger
    """, st['Body']))
    story.append(Spacer(1, 4))

    # SECCIÓN 2: BRAND DNA
    story.append(Paragraph("2. BRAND DNA EXHAUSTIVO (5 PILARES + 2 EXTRAS)", st['Section']))
    story.append(Paragraph("""
<b>PILLAR 1 – CORE OFFERING:</b>
Alquiler premium de vehículos de lujo y alta gama (superdeportivos y SUVs de élite) en Barcelona y Madrid. Modelo de negocio: alquiler por días/horas sin compromiso de compra.

<b>PILLAR 2 – TARGET AUDIENCE:</b>
Hombres y mujeres 30-55 años, alto poder adquisitivo, profesionales liberales, empresarios, influencers, parejas que buscan experiencias únicas, turistas de lujo, y amantes del automóvil que quieren probar coches imposibles de comprar.

<b>PILLAR 3 – TONE OF VOICE:</b>
Premium pero accesible. Elegante sin ser frío. Emocionante pero confiable. Lenguaje directo, moderno, con toque aspiracional ("vive la experiencia", "conduce el coche de tus sueños").

<b>PILLAR 4 – VISUAL DNA:</b>
Colores dominantes: Negro profundo + Dorado + Plata/Blanco. Iluminación dramática (golden hour, luces de ciudad, interiores minimalistas). Coches siempre en movimiento o con puertas abiertas. Composición limpia, fondo neutro o paisajes de ciudad.

<b>PILLAR 5 – EMOTIONAL BENEFIT:</b>
"Libertad absoluta de conducir el coche de tus sueños sin comprarlo, sin mantenimiento, sin límite de kilómetros."

<b>PILLAR 6 – DIFERENCIADOR CLAVE:</b>
Presencia en dos ciudades top (Barcelona + Madrid) + flota muy exclusiva (Urus, M4, M3 CS, Ferrari, Lotus, Challenger) + atención personalizada por WhatsApp.

<b>PILLAR 7 – DEBILIDAD ACTUAL:</b>
Solo 10 publicaciones y 787 seguidores = perfil muy nuevo / poco activo. Gran oportunidad de crecimiento con estrategia de contenido.
    """, st['Body']))
    story.append(Spacer(1, 4))

    # SECCIÓN 3: AUDITORÍA
    story.append(Paragraph("3. AUDITORÍA DEL PERFIL ACTUAL (FORTALEZAS + MEJORAS)", st['Section']))
    story.append(Paragraph("""
<b>✓ FORTALEZAS:</b>
- Logo profesional y memorable (alas doradas + escudo negro)
- Posicionamiento claro: "Coches de Lujo | BCN & Madrid"
- Flota muy atractiva (Urus, M4, M3 CS, Ferrari, Lotus, Challenger)
- CTA directo (WhatsApp)
- Estética visual premium (fotos de calidad)

<b>✗ PUNTOS DE MEJORA CRÍTICOS:</b>
- Solo 10 publicaciones → perfil parece inactivo o muy nuevo
- Falta de contenido dinámico (Reels / Stories / Vídeos de conducción)
- No hay testimonios ni resultados de clientes
- Bio demasiado genérica (no transmite emoción ni diferenciación)
- No hay serie de contenido recurrente (ej: "Coche de la semana", "Test Drive", "Interior 360º")
- Falta de storytelling (¿quién está detrás de Amaro? ¿por qué elegirlos?)
    """, st['Body']))
    story.append(Spacer(1, 4))

    # SECCIÓN 4: CONCEPTO
    story.append(Paragraph("4. CONCEPTO DE CAMPAÑA: \"VIVE EL COCHE QUE SUEÑAS\"", st['Section']))
    story.append(Paragraph("""
<b>Nombre de la campaña:</b> "VIVE EL COCHE QUE SUEÑAS"
<b>Claim principal:</b> "Conduce hoy el coche que siempre quisiste. Sin comprar. Sin límites."

<b>Arco narrativo de 6 vídeos:</b>
Video 1 – El Deseo (mostrar el coche soñado + emoción)
Video 2 – La Experiencia (interior + conducción real)
Video 3 – La Libertad (sin mantenimiento, sin entrada, sin compromiso)
Video 4 – Testimonios Reales (clientes felices + datos)
Video 5 – Deconstrucción (cómo funciona el alquiler + flota)
Video 6 – CTA Final (reserva ahora + oferta especial)
    """, st['Body']))
    story.append(PageBreak())

    # SECCIÓN 5: PROMPTS
    story.append(Paragraph("5. PROMPTS LISTOS PARA USAR (ADAPTADOS A AMARO)", st['Section']))

    story.append(Paragraph("PROMPT 1: VIRTUAL DRIVE - LAMBORGHINI URUS (16 seg)", st['SubSection']))
    story.append(Paragraph("""
16-second vertical video in premium cinematic style, golden hour lighting, smooth tracking + drone camera. Handsome 38-year-old man approaches a black Lamborghini Urus with Amaro logo. Opens doors, sits inside, starts engine. Camera pushes into interior (leather, digital dashboard, ambient lighting). Then car driving on coastal road at sunset. Camera follows showing performance and beauty. Final shot: car parked in luxury location, man steps out with confident smile and speaks with perfect lip sync: "Este es el coche que siempre soñé. Hoy lo conduzco sin comprarlo."

TEXT TIMELINE:
- 5s: "LAMBORGHINI URUS" appears elegantly
- 10s: "SIN COMPROMISO" appears
- 14s: "RESERVA AHORA →" appears

Realistic car physics, accurate reflections, natural interior lighting, photorealistic, 8K.
    """, st['Prompt']))
    story.append(Spacer(1, 3))

    story.append(Paragraph("PROMPT 2: DECONSTRUCCIÓN - BMW M4 (18 seg)", st['SubSection']))
    story.append(Paragraph("""
18-second vertical video in cinematic macro + 3D style. Starts with full BMW M4 Competition in black. Camera zooms into engine (0-5s). Hood opens in slow motion. From 5-11s timelapse (3x) showing how the S58 engine works (turbo, pistons, valves). From 11-16s reverse timelapse showing the car being "built" from parts. Camera ends with full car again. Ultra-detailed mechanical physics, realistic metal and carbon textures, scientific yet emotional, 8K.
    """, st['Prompt']))
    story.append(Spacer(1, 3))

    story.append(Paragraph("PROMPT 3: INFOGRAFÍA PREMIUM (14 seg)", st['SubSection']))
    story.append(Paragraph("""
14-second vertical video in premium cinematic style, dark background with gold and cyan. Man standing next to a Ferrari or Urus. At 2s text "0€ MANTENIMIENTO" appears. At 5s "Desde 149€/día" with counter. At 8s three benefits: "Sin entrada", "Seguro incluido", "Km ilimitados". At 11s "Libertad sin límites" appears. Man speaks: "Alquila el coche de tus sueños sin comprar. Sin mantenimiento. Sin preocupaciones." Photorealistic + infographic mix, high-end, 8K.
    """, st['Prompt']))
    story.append(Spacer(1, 3))

    story.append(Paragraph("PROMPT 4: CTA FINAL + CIERRE (8 seg)", st['SubSection']))
    story.append(Paragraph("""
8-second vertical video, clean bright lighting. Man standing next to a Lamborghini Urus or Ferrari. Looks at camera with confident smile and speaks with perfect lip sync: "Este fin de semana conduce el coche que siempre quisiste. Reserva ahora y vive la experiencia."

TEXT:
- 2s: "TU COCHE. TU MOMENTO." appears
- 5s: "RESERVA AHORA → WhatsApp" appears with arrow

Premium, clean, high-converting, 8K.
    """, st['Prompt']))
    story.append(Spacer(1, 6))

    story.append(Paragraph("AMARO LUXURY CAR RENTALS | Barcelona & Madrid | Reservas por WhatsApp", st['Footer']))
    story.append(Paragraph("Análisis y sistema completo generado para uso interno de Amaro Luxury Cars.", st['Footer']))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"✅ PDF generado: {OUTPUT}")

if __name__ == "__main__":
    build()