#!/usr/bin/env python3
"""
ShopyCrafter - UGC + Lip Sync 6-Second Micro-Clips Kit (Real Woman Talking Head Style)
All 22 clips optimized for Grok Imagine - Perfect Lip Sync + Authentic UGC Feel
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
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

OUTPUT = "/home/workdir/artifacts/ShopyCrafter_UGC_LipSync_6sec_Kit.pdf"

def styles():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle(name='TitleMain', fontSize=18, textColor=GOLD, alignment=TA_CENTER, spaceAfter=6, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Sub', fontSize=10, textColor=NEON, alignment=TA_CENTER, spaceAfter=12))
    s.add(ParagraphStyle(name='Section', fontSize=11, textColor=GOLD, spaceBefore=10, spaceAfter=5, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='ClipTitle', fontSize=9, textColor=CYAN, spaceBefore=6, spaceAfter=2, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Body', fontSize=8, textColor=WHITE, alignment=TA_JUSTIFY, spaceAfter=3, leading=10))
    s.add(ParagraphStyle(name='Prompt', fontSize=6, textColor=GRAY, fontName='Courier', leading=7.5, leftIndent=2, rightIndent=2, spaceAfter=5, backColor=DARK_GRAY))
    s.add(ParagraphStyle(name='Footer', fontSize=7, textColor=HexColor("#888888"), alignment=TA_CENTER))
    s.add(ParagraphStyle(name='Highlight', fontSize=9, textColor=GOLD, fontName='Helvetica-Bold', spaceAfter=4))
    return s

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(DARK)
    canvas.rect(0, A4[1]-28, A4[0], 28, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.setFont('Helvetica-Bold', 7)
    canvas.drawString(12, A4[1]-18, "SHOPYCRAFTER | UGC + Lip Sync 6-Second Kit (Grok Imagine)")
    canvas.setFillColor(DARK)
    canvas.rect(0, 0, A4[0], 20, fill=1, stroke=0)
    canvas.setFillColor(NEON)
    canvas.setFont('Helvetica', 6)
    canvas.drawCentredString(A4[0]/2, 6, f"Generated {datetime.now().strftime('%Y-%m-%d')} | Real Woman Talking Head + Perfect Lip Sync | www.shopycrafter.com")
    canvas.restoreState()

def build():
    doc = SimpleDocTemplate(OUTPUT, pagesize=A4, rightMargin=12, leftMargin=12, topMargin=40, bottomMargin=25)
    st = styles()
    story = []

    # COVER
    story.append(Spacer(1, 40))
    story.append(Paragraph("SHOPYCRAFTER", st['TitleMain']))
    story.append(Paragraph("UGC + LIP SYNC 6-SECOND MICRO-CLIPS KIT", st['Sub']))
    story.append(Paragraph("Real Woman Talking Head Style • Perfect Lip Sync • Authentic Vlog Feel", st['Body']))
    story.append(Paragraph("22 Hyper-Detailed Clips for Grok Imagine", st['Body']))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Ingeniería de E-commerce con IA", st['Highlight']))
    story.append(PageBreak())

    # INSTRUCTIONS
    story.append(Paragraph("INSTRUCCIONES PARA GROK IMAGINE (UGC + LIP SYNC)", st['Section']))
    story.append(Paragraph("""
    <b>Estilo general (añade al inicio de cada prompt):</b><br/>
    "6-second vertical video in realistic UGC vlog style, natural lighting, slight handheld camera feel, authentic talking-head aesthetic, real person speaking directly to camera with perfect lip sync"<br/><br/>
    <b>Personaje (Crafter - Mujer real):</b><br/>
    "Confident 30-year-old Spanish woman, modern professional look, black blazer with subtle neon green details, short hair with neon green highlights, warm and expert expression, natural skin texture, speaking directly to camera"<br/><br/>
    <b>Lip Sync (importante):</b><br/>
    Siempre incluye: "perfect lip sync — her mouth moves naturally and exactly in sync with the voice, realistic mouth movements"<br/><br/>
    <b>Consejo:</b> Usa la misma imagen de referencia de Crafter (mujer real) en todos los clips para máxima consistencia.
    """, st['Body']))
    story.append(Spacer(1, 6))

    # CONCATENATION TABLE
    story.append(Paragraph("TABLA DE CONCATENACIÓN (Master Cut 2:10)", st['Section']))
    concat_data = [
        ["Video", "Duración", "Clips", "Archivos recomendados"],
        ["Video 1 - Command Center", "22s", "4 clips", "V1_C1 + V1_C2 + V1_C3 + V1_C4"],
        ["Video 2 - Lupa", "20s", "4 clips", "V2_C1 + V2_C2 + V2_C3 + V2_C4"],
        ["Video 3 - Robotic Blueprint", "24s", "4 clips", "V3_C1 + V3_C2 + V3_C3 + V3_C4"],
        ["Video 4 - Dashboard", "18s", "3 clips", "V4_C1 + V4_C2 + V4_C3"],
        ["Video 5 - Split-Screen", "25s", "4 clips", "V5_C1 + V5_C2 + V5_C3 + V5_C4"],
        ["Video 6 - Hero CTA", "20s", "3 clips", "V6_C1 + V6_C2 + V6_C3 (+ V6_C4 opcional)"],
    ]
    t = Table(concat_data, colWidths=[3.8*cm, 1.6*cm, 1.3*cm, 8.5*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), GOLD),
        ('TEXTCOLOR', (0, 0), (-1, 0), DARK),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('BACKGROUND', (0, 1), (-1, -1), DARK_GRAY),
        ('TEXTCOLOR', (0, 1), (-1, -1), WHITE),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, GOLD),
    ]))
    story.append(t)
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Transiciones recomendadas:</b> Golden Light Wipe o Soft Dissolve entre clips. Mantén música continua de fondo.", st['Body']))
    story.append(PageBreak())

    # ALL 22 CLIPS - UGC + LIP SYNC STYLE
    all_clips = [
        # VIDEO 1
        ("VIDEO 1 – COMMAND CENTER (22s)", [
            ("Clip 1.1 (0-6s)", "Direct to camera introduction",
             "6-second vertical video in realistic UGC vlog style, natural lighting, slight handheld camera feel, authentic talking-head aesthetic. Confident 30-year-old Spanish woman (Crafter: modern professional look, black blazer with subtle neon green details, short hair with neon green highlights, warm and expert expression, natural skin texture) speaking directly to camera with perfect lip sync — her mouth moves naturally and exactly in sync with the voice. She looks at camera with energy and says: \"Imagina que tu tienda Shopify tuviera un equipo completo de ingenieros de e-commerce trabajando 24 horas al día, 7 días a la semana…\". Soft golden and green light accents in modern bright workspace background. Natural, trustworthy, expert vlog style, high quality."),
            ("Clip 1.2 (6-12s)", "Second line + subtle gesture",
             "6-second vertical video in realistic UGC vlog style. Same woman continues speaking directly to camera with perfect lip sync and natural hand gestures. She says with confidence: \"…con IA que analiza, prueba y optimiza cada detalle sin parar.\" Slight natural camera movement, warm lighting, modern clean background with subtle golden reflections. Authentic expert vlog feel, realistic skin texture, high detail."),
            ("Clip 1.3 (12-18s)", "Powerful statement + smile",
             "6-second vertical video in realistic UGC vlog style. Woman speaks directly to camera with perfect lip sync, slight smile and confident expression: \"Esto es ShopyCrafter.\" Natural head movement, warm authentic lighting. Subtle golden particles appear softly in background. Trustworthy, modern, professional vlog style."),
            ("Clip 1.4 (18-22s)", "Logo + call to action",
             "6-second vertical video in realistic UGC vlog style. Same woman smiles at camera. Large elegant gold text appears: \"Si ShopyCrafter gestionara tu tienda\". ShopyCrafter logo + tagline \"Ingeniería de E-commerce con IA\" appears bottom right with soft glow. Natural lighting, authentic ending feel. Premium but real UGC quality."),
        ]),
        # VIDEO 2
        ("VIDEO 2 – LUPA DE PRECISIÓN (20s)", [
            ("Clip 2.1 (0-6s)", "First line + direct gaze",
             "6-second vertical video in realistic UGC vlog style, natural lighting. Confident woman speaking directly to camera with perfect lip sync: \"Cada píxel. Cada palabra. Cada botón.\" Natural expression, slight head tilt, modern workspace background with soft green and golden accents. Authentic vlog feel, high quality."),
            ("Clip 2.2 (6-12s)", "Second line + emphasis",
             "6-second vertical video in realistic UGC vlog style. Same woman continues with perfect lip sync, more emphasis in voice and slight forward lean: \"ShopyCrafter no solo ve tu tienda… la disecciona, la entiende y la mejora en tiempo real.\" Natural gestures, warm lighting, trustworthy expert tone. Realistic skin and hair movement."),
            ("Clip 2.3 (12-18s)", "Results + smile",
             "6-second vertical video in realistic UGC vlog style. Woman speaks with energy and perfect lip sync: conversion numbers appear softly on screen as she says the line. She smiles confidently at the end. Golden light accents. Authentic, results-focused vlog style."),
            ("Clip 2.4 (18-20s)", "Logo + tagline",
             "6-second vertical video in realistic UGC vlog style. Woman smiles at camera. Gold headline: \"Análisis profundo. Resultados reales.\" Logo + tagline appears naturally. Clean, professional but real UGC ending."),
        ]),
        # VIDEO 3
        ("VIDEO 3 – ROBOTIC BLUEPRINT (24s)", [
            ("Clip 3.1 (0-6s)", "Opening line + direct to camera",
             "6-second vertical video in realistic UGC vlog style. Confident woman speaking directly to camera with perfect lip sync: \"No contratamos gente. Construimos inteligencia.\" Natural expression, modern tech workspace, subtle green and golden lighting. Authentic expert vlog feel."),
            ("Clip 3.2 (6-12s)", "Second line + natural gesture",
             "6-second vertical video in realistic UGC vlog style. Same woman continues with perfect lip sync and natural hand movements: \"ShopyCrafter ensambla, prueba y perfecciona tu tienda como si tuvieras un equipo de 20 especialistas trabajando sin parar.\" Warm lighting, slight camera movement, real skin texture."),
            ("Clip 3.3 (12-18s)", "Powerful statement + smile",
             "6-second vertical video in realistic UGC vlog style. Woman speaks with conviction and perfect lip sync: \"Construimos tu tienda perfecta.\" She smiles confidently. Subtle golden light effects. Trustworthy, modern, authentic vlog style."),
            ("Clip 3.4 (18-24s)", "Logo + closing",
             "6-second vertical video in realistic UGC vlog style. Woman smiles at camera. Gold text: \"Construimos tu tienda perfecta\". Logo + tagline appears elegantly. Natural lighting, premium but real UGC quality."),
        ]),
        # VIDEO 4
        ("VIDEO 4 – DASHBOARD DORADO (18s)", [
            ("Clip 4.1 (0-6s)", "First result + energy",
             "6-second vertical video in realistic UGC vlog style. Woman speaks directly to camera with perfect lip sync and excited but professional energy: \"+347% de conversión en 90 días.\" Natural expression, modern background with golden accents. Authentic results-focused vlog feel."),
            ("Clip 4.2 (6-12s)", "Second result + gesture",
             "6-second vertical video in realistic UGC vlog style. Same woman continues with perfect lip sync and natural hand gesture: \"+89% de ingresos por sesión.\" Warm lighting, slight smile, trustworthy expert tone."),
            ("Clip 4.3 (12-18s)", "Final statement + logo",
             "6-second vertical video in realistic UGC vlog style. Woman looks at camera with confidence: \"+347% conversión\". Gold text appears. Logo + \"Pide tu diagnóstico gratis\" at the end. Authentic, high-converting UGC style."),
        ]),
        # VIDEO 5
        ("VIDEO 5 – SPLIT-SCREEN (25s)", [
            ("Clip 5.1 (0-6s)", "Left side explanation",
             "6-second vertical video in realistic UGC vlog style. Woman speaking directly to camera with perfect lip sync: \"Izquierda: tu tienda hoy.\" Natural, honest expression. Modern clean background. Authentic vlog feel."),
            ("Clip 5.2 (6-12s)", "Right side + transformation",
             "6-second vertical video in realistic UGC vlog style. Woman continues with energy and perfect lip sync: \"Derecha: tu tienda con ShopyCrafter.\" Slight forward lean, confident smile. Golden accents appear softly."),
            ("Clip 5.3 (12-18s)", "Key message",
             "6-second vertical video in realistic UGC vlog style. Woman speaks with conviction and perfect lip sync: \"La diferencia no es magia. Es ingeniería con IA.\" Natural head movement, expert tone, warm lighting."),
            ("Clip 5.4 (18-25s)", "Logo + final",
             "6-second vertical video in realistic UGC vlog style. Woman smiles confidently. Gold text: \"Antes. Después. ShopyCrafter.\" Logo appears naturally. Authentic, emotional, high-quality UGC ending."),
        ]),
        # VIDEO 6
        ("VIDEO 6 – HERO CTA (20s)", [
            ("Clip 6.1 (0-6s)", "Opening statement",
             "6-second vertical video in realistic UGC vlog style. Confident woman speaking directly to camera with perfect lip sync and warm expert tone: \"ShopyCrafter no es otra herramienta.\" Natural expression, modern workspace, subtle golden lighting. Authentic vlog feel."),
            ("Clip 6.2 (6-12s)", "Emotional line + direct gaze",
             "6-second vertical video in realistic UGC vlog style. Same woman continues with perfect lip sync, looking straight at camera with inspiring expression: \"Es el equipo de e-commerce que siempre quisiste… pero con IA que nunca duerme.\" Natural, trustworthy, emotional but professional."),
            ("Clip 6.3 (12-18s)", "Final CTA + smile",
             "6-second vertical video in realistic UGC vlog style. Woman smiles warmly and speaks with perfect lip sync: \"Gestionamos tu Shopify. Tú solo vendes.\" Gold text appears elegantly. Logo + \"Solicita tu diagnóstico gratuito de 48h\". Authentic, high-converting UGC ending."),
            ("Clip 6.4 (18-20s) - Opcional", "Logo hold",
             "6-second vertical video in realistic UGC vlog style. Clean hold with ShopyCrafter logo centered, soft golden particles, tagline \"Ingeniería de E-commerce con IA\". Natural lighting, premium but real UGC quality."),
        ]),
    ]

    for video_title, clips in all_clips:
        story.append(Paragraph(video_title, st['Section']))
        for clip_title, desc, prompt in clips:
            story.append(Paragraph(f"<b>{clip_title}</b> — {desc}", st['ClipTitle']))
            story.append(Paragraph(prompt, st['Prompt']))
        story.append(Spacer(1, 4))

    story.append(PageBreak())

    # FINAL TIPS
    story.append(Paragraph("CONSEJOS FINALES PARA MEJORES RESULTADOS", st['Section']))
    story.append(Paragraph("""
    <b>1. Lip Sync en Grok Imagine:</b><br/>
    Añade siempre al final del prompt: "perfect lip sync, mouth moves naturally and exactly with the voice, realistic mouth movements, natural speaking"<br/><br/>
    <b>2. Consistencia de personaje:</b><br/>
    Usa la misma foto de referencia de la mujer (Crafter) en todos los clips. Esto es clave para que parezca la misma persona.<br/><br/>
    <b>3. Edición:</b><br/>
    - Usa transiciones suaves (Golden Light Wipe o Soft Dissolve)<br/>
    - Mantén la misma música de fondo continua<br/>
    - Aplica ligero color grading uniforme (golden highlights + natural skin tones)<br/><br/>
    <b>4. UGC Tips que funcionan muy bien:</b><br/>
    - Ligero movimiento de cámara (handheld feel)<br/>
    - Iluminación natural de ventana + luz suave<br/>
    - Expresiones faciales reales y sonrisas naturales<br/>
    - Pausas naturales y ritmo de habla real
    """, st['Body']))
    story.append(Spacer(1, 12))
    story.append(Paragraph("SHOPYCRAFTER – Ingeniería de E-commerce con IA", st['Sub']))
    story.append(Paragraph("Listo para generar. ¡Que queden espectaculares y conviertan!", st['Highlight']))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"✅ PDF generado: {OUTPUT}")

if __name__ == "__main__":
    build()