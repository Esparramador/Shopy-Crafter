#!/usr/bin/env python3
"""
3 PROMPTS FINALES - CTA + Virtual Try-On de 3 Relojes
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
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

OUTPUT = "/home/workdir/artifacts/3_Prompts_Finales_CTA_3_Relojes.pdf"

def styles():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle(name='MainTitle', fontSize=13, textColor=BLUE, alignment=TA_CENTER, spaceAfter=5, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Sub', fontSize=9, textColor=NEON, alignment=TA_CENTER, spaceAfter=8))
    s.add(ParagraphStyle(name='Section', fontSize=9, textColor=BLUE, spaceBefore=6, spaceAfter=3, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Body', fontSize=6.5, textColor=WHITE, alignment=TA_LEFT, spaceAfter=2, leading=8))
    s.add(ParagraphStyle(name='Prompt', fontSize=5.5, textColor=GRAY, fontName='Courier', leading=6.5, leftIndent=2, rightIndent=2, spaceAfter=4, backColor=DARK_GRAY))
    s.add(ParagraphStyle(name='Footer', fontSize=5, textColor=HexColor("#888888"), alignment=TA_CENTER))
    return s

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(DARK)
    canvas.rect(0, A4[1]-18, A4[0], 18, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.setFont('Helvetica-Bold', 5.5)
    canvas.drawString(6, A4[1]-12, "3 PROMPTS FINALES | CTA + Virtual Try-On de 3 Relojes")
    canvas.setFillColor(DARK)
    canvas.rect(0, 0, A4[0], 12, fill=1, stroke=0)
    canvas.setFillColor(NEON)
    canvas.setFont('Helvetica', 4.5)
    canvas.drawCentredString(A4[0]/2, 3, f"Generated {datetime.now().strftime('%Y-%m-%d')} | Listos para usar")
    canvas.restoreState()

def build():
    doc = SimpleDocTemplate(OUTPUT, pagesize=A4, rightMargin=8, leftMargin=8, topMargin=25, bottomMargin=15)
    st = styles()
    story = []

    # COVER
    story.append(Spacer(1, 12))
    story.append(Paragraph("3 PROMPTS FINALES", st['MainTitle']))
    story.append(Paragraph("CTA + Virtual Try-On de 3 Relojes Específicos", st['Sub']))
    story.append(Spacer(1, 6))

    # PROMPT 1
    story.append(Paragraph("1. VERSIÓN A + D (8-12 SEGUNDOS) - CTA + TEXTO ANIMADO ELABORADO", st['Section']))
    story.append(Paragraph("""
8-12 second vertical video in premium cinematic UGC style, clean bright lighting with soft reflections. Handsome 28-year-old Spanish man standing confidently wearing full outfit with perfect Virtual Try-On of the 3 specific watches you provided.

Watch 1 (Main Silver Chronograph) - [Insert Watch 1 Image] - sits perfectly on left wrist with realistic metal reflections and accurate wrist curvature.
Watch 2 (Second Watch) - [Insert Watch 2 Image] - shown on right wrist or held in hand.
Watch 3 (Third Watch/Accessory) - [Insert Watch 3 Image] - shown clearly with perfect adhesion.

TEXT ANIMATION TIMELINE:
- 2.5s: Elegant gold text "RELOJ 1" pops in left with soft glow + fade
- 5s: "RELOJ 2" pops in center
- 7.5s: "RELOJ 3" pops in right
- 9s: All 3 texts fade out elegantly

He speaks with perfect lip sync and strong tone: "Estos son los 3 relojes que uso todos los días. Todo encaja perfecto."

At 10s final CTA appears: "Pide tu diagnóstico gratis →"

Perfect body adhesion on all watches, realistic metal physics, natural skin, 8K, high-converting quality.
    """, st['Prompt']))
    story.append(Spacer(1, 6))

    # PROMPT 2
    story.append(Paragraph("2. VERSIÓN 10 SEGUNDOS (CONDENSADA)", st['Section']))
    story.append(Paragraph("""
10-second vertical video in premium cinematic UGC style. Man wearing full outfit with the 3 specific watches.

TIMELINE (0-10s):
- 0-3.5s (Normal speed): Medium tracking shot walking + showing all 3 watches clearly
- 3.5-6.5s (Slow motion 55%): Camera orbits 20 degrees around him focusing on the watches
- 6.5-10s (Normal speed): He stops, looks at camera and speaks with perfect lip sync: "Este es el outfit completo con los 3 relojes que uso todos los días."

TEXT:
- 2.5s: "RELOJ 1 • RELOJ 2 • RELOJ 3" appears elegantly with soft glow
- 7.5s: "Pide tu diagnóstico gratis →" appears with cinematic fade

Perfect Virtual Try-On on all 3 watches, realistic metal physics, natural movement, natural skin, 8K, high-converting quality.
    """, st['Prompt']))
    story.append(Spacer(1, 6))

    # PROMPT 3
    story.append(Paragraph("3. VERSIÓN 6 SEGUNDOS (ULTRA DIRECTA)", st['Section']))
    story.append(Paragraph("""
6-second vertical video in premium cinematic UGC style. Man wearing full outfit with the 3 specific watches.

TIMELINE (0-6s):
- 0-2.5s (Normal speed): Medium shot showing all 3 watches clearly with natural movement
- 2.5-6s (Slow motion 65%): He looks at camera with confident smile and speaks with perfect lip sync: "Este es el outfit completo con los 3 relojes que uso todos los días."

TEXT:
- 1.8s: "3 RELOJES. 1 OUTFIT." appears elegantly
- 4s: "Pide tu diagnóstico gratis →" appears with soft glow

Perfect body adhesion on all watches, realistic metal reflections, natural skin, 8K, high-converting.
    """, st['Prompt']))
    story.append(Spacer(1, 8))

    story.append(Paragraph("SHOPYCRAFTER – Ingeniería de E-commerce con IA | www.shopycrafter.com", st['Footer']))
    story.append(Paragraph("3 prompts listos para copiar y pegar. Reemplaza [Insert Watch X Image] con tus imágenes reales.", st['Footer']))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"✅ PDF generado: {OUTPUT}")

if __name__ == "__main__":
    build()