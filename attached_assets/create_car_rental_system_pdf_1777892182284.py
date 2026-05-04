#!/usr/bin/env python3
"""
SISTEMA COMPLETO PARA EMPRESA DE ALQUILER DE COCHES
Ultimate Prompt System 2026 - Adaptado a Car Rental
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from datetime import datetime

DARK = HexColor("#0A0A0A")
GOLD = HexColor("#FFD700")
NEON = HexColor("#00FF9F")
CYAN = HexColor("#00F0FF")
WHITE = HexColor("#FFFFFF")
GRAY = HexColor("#CCCCCC")
DARK_GRAY = HexColor("#1A1A1A")
BLUE = HexColor("#1F4E79")

OUTPUT = "/home/workdir/artifacts/Car_Rental_Advertising_System_2026.pdf"

def styles():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle(name='MainTitle', fontSize=12, textColor=BLUE, alignment=TA_CENTER, spaceAfter=4, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Sub', fontSize=8, textColor=NEON, alignment=TA_CENTER, spaceAfter=6))
    s.add(ParagraphStyle(name='Section', fontSize=9, textColor=BLUE, spaceBefore=6, spaceAfter=3, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='SubSection', fontSize=7.5, textColor=CYAN, spaceBefore=3, spaceAfter=2, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Body', fontSize=6.5, textColor=WHITE, alignment=TA_JUSTIFY, spaceAfter=2, leading=8))
    s.add(ParagraphStyle(name='Prompt', fontSize=5, textColor=GRAY, fontName='Courier', leading=6, leftIndent=1, rightIndent=1, spaceAfter=3, backColor=DARK_GRAY))
    s.add(ParagraphStyle(name='Footer', fontSize=5, textColor=HexColor("#888888"), alignment=TA_CENTER))
    return s

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(DARK)
    canvas.rect(0, A4[1]-18, A4[0], 18, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.setFont('Helvetica-Bold', 5)
    canvas.drawString(5, A4[1]-12, "CAR RENTAL ADVERTISING SYSTEM 2026 | Ultimate Prompt System Adaptado")
    canvas.setFillColor(DARK)
    canvas.rect(0, 0, A4[0], 12, fill=1, stroke=0)
    canvas.setFillColor(NEON)
    canvas.setFont('Helvetica', 4.5)
    canvas.drawCentredString(A4[0]/2, 3, f"Generated {datetime.now().strftime('%Y-%m-%d')} | Nivel Profesional Extremo")
    canvas.restoreState()

def build():
    doc = SimpleDocTemplate(OUTPUT, pagesize=A4, rightMargin=7, leftMargin=7, topMargin=25, bottomMargin=15)
    st = styles()
    story = []

    # COVER
    story.append(Spacer(1, 10))
    story.append(Paragraph("CAR RENTAL ADVERTISING SYSTEM 2026", st['MainTitle']))
    story.append(Paragraph("Ultimate Prompt System Adaptado a Alquiler de Coches", st['Sub']))
    story.append(Paragraph("UGC + Virtual Drive + Deconstrucción de Vehículos + Infografías Premium", st['Body']))
    story.append(Spacer(1, 5))

    # SECCIÓN 1: BRAND DNA
    story.append(Paragraph("1. BRAND DNA PARA EMPRESA DE ALQUILER DE COCHES", st['Section']))
    story.append(Paragraph("""
<b>Empresa ejemplo:</b> "LuxeDrive" – Alquiler premium de vehículos de lujo y alta gama.

<b>5-Pillar DNA:</b>
Pillar 1 – Core Offering: Alquiler de coches premium (BMW, Mercedes, Audi, Porsche, Tesla) por días/horas.
Pillar 2 – Target Audience: Profesionales 30-55 años, viajeros de negocios, parejas que buscan experiencias, influencers.
Pillar 3 – Tone of Voice: Premium pero accesible, confiable, emocionante, moderno.
Pillar 4 – Visual DNA: Negro + Dorado + Plata, iluminación dramática, coches en movimiento, interiores de lujo.
Pillar 5 – Emotional Benefit: "Libertad de conducir el coche de tus sueños sin comprarlo".
    """, st['Body']))
    story.append(Spacer(1, 4))

    # SECCIÓN 2: CONCEPTO DE CAMPAÑA
    story.append(Paragraph("2. CONCEPTO DE CAMPAÑA: \"TU COCHE. TU MOMENTO. TU LIBERTAD.\"", st['Section']))
    story.append(Paragraph("""
<b>Arco narrativo de 6 vídeos:</b>
Video 1 – El Sueño (mostrar el coche deseado)
Video 2 – La Experiencia (interior + conducción)
Video 3 – La Libertad (sin límites, sin mantenimiento, sin compromiso)
Video 4 – Resultados Reales (testimonios + datos)
Video 5 – Comparativa (antes vs después de alquilar)
Video 6 – CTA Final (reserva ahora + oferta)
    """, st['Body']))
    story.append(Spacer(1, 4))

    # SECCIÓN 3: PROMPT 1 - VIRTUAL DRIVE
    story.append(Paragraph("3. PROMPT 1: VIRTUAL DRIVE (16 SEGUNDOS) - EXPERIENCIA DE CONDUCCIÓN", st['Section']))
    story.append(Paragraph("""
16-second vertical video in premium cinematic style, golden hour lighting, smooth tracking + drone camera movement. Handsome 38-year-old professional man gets into a black BMW M4 Competition (or the specific car model you want to promote).

**TIMELINE (0-16s):**
- 0-4s (Normal speed): Exterior shot of the car, man approaching with keys, door opens smoothly.
- 4-8s (Slow motion 50%): He sits inside, starts the engine, camera pushes into interior (leather seats, digital dashboard, ambient lighting).
- 8-12s (Timelapse 2.5x + tracking): Car driving on coastal road at sunset. Camera follows from side + front angle showing performance and beauty.
- 12-16s (Slow motion 60%): Final shot of car parked in luxury location, man stepping out with confident smile. Speaks with perfect lip sync: "Este es el coche que siempre soñé. Hoy lo conduzco sin comprarlo."

**TEXT TIMELINE:**
- 5s: "TU COCHE DE LUJO" appears elegantly
- 10s: "SIN COMPROMISO" appears
- 14s: "RESERVA AHORA →" appears with arrow

Realistic car physics, accurate reflections on paint, natural interior lighting, photorealistic, 8K, high-end car advertisement quality.
    """, st['Prompt']))
    story.append(Spacer(1, 4))

    # SECCIÓN 4: PROMPT 2 - DECONSTRUCCIÓN
    story.append(Paragraph("4. PROMPT 2: DECONSTRUCCIÓN DEL COCHE (18 SEGUNDOS)", st['Section']))
    story.append(Paragraph("""
18-second vertical video in cinematic macro + 3D style, extreme detail. Starts with full black BMW M4. Camera slowly zooms into the engine (0-5s). At 5s the hood opens in slow motion revealing the twin-turbo engine. From 5-11s timelapse (3x speed) showing how the engine components work together (turbo, pistons, valves). From 11-16s reverse timelapse showing the car being "built" from individual parts (chassis → engine → body → wheels → interior). Camera ends with full car again on the road. Ultra-detailed mechanical physics, realistic metal and carbon fiber textures, scientific yet emotional, 8K, premium automotive visualization.
    """, st['Prompt']))
    story.append(Spacer(1, 4))

    # SECCIÓN 5: PROMPT 3 - INFOGRAFÍA
    story.append(Paragraph("5. PROMPT 3: INFOGRAFÍA PREMIUM (14 SEGUNDOS)", st['Section']))
    story.append(Paragraph("""
14-second vertical video in premium cinematic style, dark background with golden and cyan accents. Man standing next to the car. At 2s text "0€ MANTENIMIENTO" appears. At 5s "Desde 89€/día" appears with number counter. At 8s three benefits animate: "Sin entrada", "Seguro incluido", "Kilómetros ilimitados". At 11s text "Libertad sin límites" appears. Man speaks: "Alquila el coche de tus sueños sin comprar. Sin mantenimiento. Sin preocupaciones." Photorealistic car + infographic mix, high-end, 8K.
    """, st['Prompt']))
    story.append(Spacer(1, 4))

    # SECCIÓN 6: PROMPT 4 - CTA FINAL
    story.append(Paragraph("6. PROMPT 4: CTA FINAL + CIERRE (8 SEGUNDOS)", st['Section']))
    story.append(Paragraph("""
8-second vertical video, clean bright lighting. Man standing next to the car (BMW M4 or your model). He looks at camera with confident smile and speaks with perfect lip sync: "Este fin de semana conduce el coche que siempre quisiste. Reserva ahora y vive la experiencia."

**TEXT:**
- 2s: "TU COCHE. TU MOMENTO." appears
- 5s: "RESERVA AHORA →" appears with arrow and phone number or website

Premium, clean, high-converting, 8K.
    """, st['Prompt']))
    story.append(Spacer(1, 6))

    story.append(Paragraph("SHOPYCRAFTER – Ingeniería de E-commerce con IA | www.shopycrafter.com", st['Footer']))
    story.append(Paragraph("Sistema completo adaptado a empresas de alquiler de coches. Reemplaza el modelo de coche por el tuyo.", st['Footer']))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"✅ PDF generado: {OUTPUT}")

if __name__ == "__main__":
    build()