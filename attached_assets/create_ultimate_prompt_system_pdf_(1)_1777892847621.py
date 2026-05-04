#!/usr/bin/env python3
"""
ULTIMATE PROMPT SYSTEM 2026
Lógica de Timeline + Time Lapses + Prompts Hiper Detallados
UGC + Virtual Try-On + Deconstrucción + Infografías Premium (Nano Banana Style en Video Real)
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

OUTPUT = "/home/workdir/artifacts/Ultimate_Prompt_System_2026.pdf"

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
    canvas.drawString(5, A4[1]-12, "ULTIMATE PROMPT SYSTEM 2026 | Timeline + Lapses + UGC + Try-On + Deconstrucción + Infografías")
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
    story.append(Paragraph("ULTIMATE PROMPT SYSTEM 2026", st['MainTitle']))
    story.append(Paragraph("Lógica de Timeline + Time Lapses + Prompts Hiper Detallados", st['Sub']))
    story.append(Paragraph("UGC + Virtual Try-On + Deconstrucción + Infografías Premium (Nano Banana Style en Video 100% Real)", st['Body']))
    story.append(Spacer(1, 5))

    # SECCIÓN 1: LÓGICA
    story.append(Paragraph("1. LÓGICA DE LOS PROMPTS CON TIMELINE + TIME LAPSES", st['Section']))
    story.append(Paragraph("""
    Las plataformas profesionales (Seedance 2.0, Pollo.ai, Omneky, Nano Banana Video) no usan prompts simples. Usan <b>estructura de Timeline por capas</b>:
    """, st['Body']))
    story.append(Paragraph("<b>CAPA 1 - Timeline General:</b> Divide el vídeo en bloques de tiempo (0-4s, 4-8s, 8-12s, etc.)", st['Body']))
    story.append(Paragraph("<b>CAPA 2 - Speed Control:</b> Normal / Slow Motion (50-70%) / Timelapse (2x-4x) / Reverse", st['Body']))
    story.append(Paragraph("<b>CAPA 3 - Camera Movement:</b> Tracking / Orbit / Push-in / Dolly / Handheld / Parallax", st['Body']))
    story.append(Paragraph("<b>CAPA 4 - Subject Action:</b> Qué hace el modelo/persona/objeto en cada bloque de tiempo", st['Body']))
    story.append(Paragraph("<b>CAPA 5 - Text/Infografía:</b> Cuándo aparece, cómo aparece, cuánto dura, cómo desaparece", st['Body']))
    story.append(Paragraph("<b>CAPA 6 - Physics & Details:</b> Fabric physics, metal reflections, shadows, adhesion, micro-details", st['Body']))
    story.append(Paragraph("<b>CAPA 7 - Quality Boosters:</b> 8K, photorealistic, natural skin, realistic lighting, film grain, etc.", st['Body']))
    story.append(Spacer(1, 4))

    # SECCIÓN 2: PROMPT 1 - 16 SEGUNDOS CON TIME LAPSES
    story.append(Paragraph("2. PROMPT 1: 16 SEGUNDOS - FULL OUTFIT + 3 RELOJES + TIME LAPSES (A + Timeline)", st['Section']))
    story.append(Paragraph("""
    16-second vertical video in premium cinematic UGC style, natural daylight with soft golden reflections, smooth camera movement.

    **TIMELINE DETALLADO (0-16s):**
    - 0-4s (Normal speed 100%): Medium tracking shot. Man walking naturally wearing full outfit + 3 watches. Camera follows smoothly.
    - 4-7s (Slow motion 50%): He stops, turns slightly. Camera orbits 25 degrees around him showing all 3 watches from different angles.
    - 7-10s (Timelapse 2.8x speed): Extreme close-up on Watch 1 (main silver chronograph). Watch details, metal reflections and wrist curvature highlighted in fast but smooth motion.
    - 10-13s (Normal speed): He adjusts Watch 2 on right wrist naturally. Camera pushes in slightly showing perfect adhesion.
    - 13-16s (Slow motion 60%): Final pose looking directly at camera with confident smile. Speaks with perfect lip sync: "Este es el outfit completo con los 3 relojes que uso todos los días. Todo encaja perfecto."

    **TEXT TIMELINE:**
    - 3s: Elegant gold text "RELOJ 1" pops in left with soft glow
    - 6s: "RELOJ 2" pops in center
    - 9s: "RELOJ 3" pops in right
    - 12s: All texts fade out elegantly
    - 14s: Final CTA "Pide tu diagnóstico gratis →" appears with cinematic fade

    All 3 watches have perfect body adhesion, realistic metal reflections, accurate wrist curvature, natural shadows, photorealistic textures. Natural skin, realistic fabric movement, premium lighting, 8K, high-end advertisement quality.
    """, st['Prompt']))
    story.append(Spacer(1, 4))

    # SECCIÓN 3: PROMPT 2 - 10 SEGUNDOS
    story.append(Paragraph("3. PROMPT 2: 10 SEGUNDOS - VERSIÓN CONDENSADA (Derivada de la de 16s)", st['Section']))
    story.append(Paragraph("""
    10-second vertical video in premium cinematic UGC style. Man wearing full outfit with the 3 specific watches.

    **TIMELINE (0-10s):**
    - 0-3.5s (Normal speed): Medium tracking shot walking + showing all 3 watches clearly
    - 3.5-6.5s (Slow motion 55%): Camera orbits 20 degrees around him focusing on the watches
    - 6.5-10s (Normal speed): He stops, looks at camera and speaks with perfect lip sync: "Este es el outfit completo con los 3 relojes que uso todos los días."

    **TEXT:**
    - 2.5s: "RELOJ 1 • RELOJ 2 • RELOJ 3" appears elegantly with soft glow
    - 7.5s: "Pide tu diagnóstico gratis →" appears with cinematic fade

    Perfect Virtual Try-On on all 3 watches, realistic metal physics, natural movement, natural skin, 8K, high-converting quality.
    """, st['Prompt']))
    story.append(Spacer(1, 4))

    # SECCIÓN 4: PROMPT 3 - 6 SEGUNDOS
    story.append(Paragraph("4. PROMPT 3: 6 SEGUNDOS - VERSIÓN ULTRA DIRECTA (Derivada de la de 16s)", st['Section']))
    story.append(Paragraph("""
    6-second vertical video in premium cinematic UGC style. Man wearing full outfit with the 3 specific watches.

    **TIMELINE (0-6s):**
    - 0-2.5s (Normal speed): Medium shot showing all 3 watches clearly with natural movement
    - 2.5-6s (Slow motion 65%): He looks at camera with confident smile and speaks with perfect lip sync: "Este es el outfit completo con los 3 relojes que uso todos los días."

    **TEXT:**
    - 1.8s: "3 RELOJES. 1 OUTFIT." appears elegantly
    - 4s: "Pide tu diagnóstico gratis →" appears with soft glow

    Perfect body adhesion on all watches, realistic metal reflections, natural skin, 8K, high-converting.
    """, st['Prompt']))
    story.append(PageBreak())

    # SECCIÓN 5: DECONSTRUCCIÓN
    story.append(Paragraph("5. PROMPT 4: DECONSTRUCCIÓN DE RELOJ (Estilo Nano Banana en Video Real)", st['Section']))
    story.append(Paragraph("""
    18-second vertical video in cinematic macro style, extreme detail, scientific yet beautiful. Starts with man wearing the silver chronograph watch (Watch 1). Camera slowly zooms into the watch (0-5s). At 5s the watch case opens in slow motion showing internal mechanism. From 5-11s timelapse (3x speed) showing how the movement is assembled piece by piece with realistic physics. From 11-16s reverse timelapse showing the watch being deconstructed back to individual components (gears, springs, hands, dial). Camera ends with full watch again on wrist. Ultra-detailed macro, realistic metal and mechanical physics, 8K, photorealistic, premium product visualization quality.
    """, st['Prompt']))
    story.append(Spacer(1, 4))

    # SECCIÓN 6: INFOGRAFÍA PREMIUM
    story.append(Paragraph("6. PROMPT 5: INFOGRAFÍA PREMIUM EN VIDEO REAL (Nano Banana Style)", st['Section']))
    story.append(Paragraph("""
    14-second vertical video in premium cinematic style, dark background with golden and cyan accents, smooth motion graphics mixed with real footage. Man wearing the full outfit appears in center. At 2s elegant gold text "347% MÁS CONVERSIONES" appears above him with subtle particle effect. At 5s three animated stats appear around him: "2.4s → 0.8s tiempo de carga", "89% más valor por sesión", "4.2x retorno en ads". Each stat has realistic number counter animation and icon. At 10s text "RESULTADOS REALES" appears. Man speaks with perfect lip sync: "Esto es lo que pasa cuando usas los 3 relojes correctos con el outfit correcto." Photorealistic, ultra-detailed, high-end infographic video quality, 8K.
    """, st['Prompt']))
    story.append(Spacer(1, 4))

    # SECCIÓN 7: LÓGICA FINAL
    story.append(Paragraph("7. LÓGICA FINAL PARA PROMPTS HIPER MEGA PROFESIONALES", st['Section']))
    story.append(Paragraph("""
    <b>Regla de Oro:</b> Siempre estructura el prompt en <b>7 capas</b>:
    1. Duración + Estilo general
    2. Timeline por bloques de tiempo (0-Xs, X-Ys, Y-Zs)
    3. Speed Control por bloque (Normal / Slow / Timelapse / Reverse)
    4. Camera Movement por bloque
    5. Subject Action + Physics (fabric, metal, adhesion, shadows)
    6. Text/Infografía con timing exacto
    7. Quality Boosters finales

    Esta estructura es la que usan <b>Seedance 2.0, Pollo.ai, Omneky y Nano Banana Video</b> para generar contenido a nivel profesional extremo.
    """, st['Body']))
    story.append(Spacer(1, 6))

    story.append(Paragraph("SHOPYCRAFTER – Ingeniería de E-commerce con IA | www.shopycrafter.com", st['Footer']))
    story.append(Paragraph("Este sistema replica el nivel de prompting de las plataformas más avanzadas de IA publicitaria en 2026.", st['Footer']))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"✅ PDF generado: {OUTPUT}")

if __name__ == "__main__":
    build()