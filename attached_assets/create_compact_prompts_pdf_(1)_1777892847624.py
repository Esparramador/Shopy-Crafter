#!/usr/bin/env python3
"""
ShopyCrafter - Compact 6-Second UGC + Lip Sync Prompts (Copy-Paste Ready)
Only the 22 prompts in short, easy-to-copy format
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Preformatted
from datetime import datetime

DARK = HexColor("#0A0A0A")
GOLD = HexColor("#FFD700")
NEON = HexColor("#00FF9F")
CYAN = HexColor("#00F0FF")
WHITE = HexColor("#FFFFFF")
GRAY = HexColor("#CCCCCC")
DARK_GRAY = HexColor("#1A1A1A")

OUTPUT = "/home/workdir/artifacts/ShopyCrafter_Compact_UGC_Prompts.pdf"

def styles():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle(name='MainTitle', fontSize=14, textColor=GOLD, alignment=TA_CENTER, spaceAfter=8, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Sub', fontSize=9, textColor=NEON, alignment=TA_CENTER, spaceAfter=10))
    s.add(ParagraphStyle(name='Video', fontSize=9, textColor=CYAN, spaceBefore=8, spaceAfter=3, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='ClipTitle', fontSize=7, textColor=NEON, spaceBefore=2, spaceAfter=1, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Prompt', fontSize=6, textColor=GRAY, fontName='Courier', leading=7, leftIndent=2, rightIndent=2, spaceAfter=4, backColor=DARK_GRAY))
    s.add(ParagraphStyle(name='Footer', fontSize=6, textColor=HexColor("#888888"), alignment=TA_CENTER))
    return s

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(DARK)
    canvas.rect(0, A4[1]-24, A4[0], 24, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.setFont('Helvetica-Bold', 7)
    canvas.drawString(10, A4[1]-16, "SHOPYCRAFTER | Compact UGC + Lip Sync Prompts (Copy-Paste Ready)")
    canvas.setFillColor(DARK)
    canvas.rect(0, 0, A4[0], 18, fill=1, stroke=0)
    canvas.setFillColor(NEON)
    canvas.setFont('Helvetica', 6)
    canvas.drawCentredString(A4[0]/2, 5, f"Generated {datetime.now().strftime('%Y-%m-%d')} | 22 Prompts | www.shopycrafter.com")
    canvas.restoreState()

def build():
    doc = SimpleDocTemplate(OUTPUT, pagesize=A4, rightMargin=10, leftMargin=10, topMargin=35, bottomMargin=22)
    st = styles()
    story = []

    story.append(Paragraph("SHOPYCRAFTER - COMPACT UGC + LIP SYNC PROMPTS", st['MainTitle']))
    story.append(Paragraph("22 prompts listos para copiar y pegar en Grok Imagine (6 segundos cada uno)", st['Sub']))
    story.append(Paragraph("Estilo: Real woman talking head + Perfect lip sync + Authentic UGC feel", st['Sub']))
    story.append(Spacer(1, 6))

    prompts = [
        # VIDEO 1
        ("VIDEO 1 – COMMAND CENTER (22s)", [
            ("V1_C1 (0-6s)", "6-second vertical video in realistic UGC vlog style, natural lighting, slight handheld camera feel, authentic talking-head aesthetic. Confident 30-year-old Spanish woman (Crafter: modern professional look, black blazer with subtle neon green details, short hair with neon green highlights, warm and expert expression, natural skin texture) speaking directly to camera with perfect lip sync — her mouth moves naturally and exactly in sync with the voice. She looks at camera with energy and says: \"Imagina que tu tienda Shopify tuviera un equipo completo de ingenieros de e-commerce trabajando 24 horas al día, 7 días a la semana…\". Soft golden and green light accents in modern bright workspace background. Natural, trustworthy, expert vlog style, high quality."),
            ("V1_C2 (6-12s)", "6-second vertical video in realistic UGC vlog style. Same woman continues speaking directly to camera with perfect lip sync and natural hand gestures. She says with confidence: \"…con IA que analiza, prueba y optimiza cada detalle sin parar.\" Slight natural camera movement, warm lighting, modern clean background with subtle golden reflections. Authentic expert vlog feel, realistic skin texture, high detail."),
            ("V1_C3 (12-18s)", "6-second vertical video in realistic UGC vlog style. Woman speaks directly to camera with perfect lip sync, slight smile and confident expression: \"Esto es ShopyCrafter.\" Natural head movement, warm authentic lighting. Subtle golden particles appear softly in background. Trustworthy, modern, professional vlog style."),
            ("V1_C4 (18-22s)", "6-second vertical video in realistic UGC vlog style. Same woman smiles at camera. Large elegant gold text appears: \"Si ShopyCrafter gestionara tu tienda\". ShopyCrafter logo + tagline \"Ingeniería de E-commerce con IA\" appears bottom right with soft glow. Natural lighting, authentic ending feel. Premium but real UGC quality."),
        ]),
        # VIDEO 2
        ("VIDEO 2 – LUPA (20s)", [
            ("V2_C1 (0-6s)", "6-second vertical video in realistic UGC vlog style, natural lighting. Confident woman speaking directly to camera with perfect lip sync: \"Cada píxel. Cada palabra. Cada botón.\" Natural expression, slight head tilt, modern workspace background with soft green and golden accents. Authentic vlog feel, high quality."),
            ("V2_C2 (6-12s)", "6-second vertical video in realistic UGC vlog style. Same woman continues with perfect lip sync, more emphasis in voice and slight forward lean: \"ShopyCrafter no solo ve tu tienda… la disecciona, la entiende y la mejora en tiempo real.\" Natural gestures, warm lighting, trustworthy expert tone. Realistic skin and hair movement."),
            ("V2_C3 (12-18s)", "6-second vertical video in realistic UGC vlog style. Woman speaks with energy and perfect lip sync: conversion numbers appear softly on screen as she says the line. She smiles confidently at the end. Golden light accents. Authentic, results-focused vlog style."),
            ("V2_C4 (18-20s)", "6-second vertical video in realistic UGC vlog style. Woman smiles at camera. Gold headline: \"Análisis profundo. Resultados reales.\" Logo + tagline appears naturally. Clean, professional but real UGC ending."),
        ]),
        # VIDEO 3
        ("VIDEO 3 – ROBOTIC BLUEPRINT (24s)", [
            ("V3_C1 (0-6s)", "6-second vertical video in realistic UGC vlog style. Confident woman speaking directly to camera with perfect lip sync: \"No contratamos gente. Construimos inteligencia.\" Natural expression, modern tech workspace, subtle green and golden lighting. Authentic expert vlog feel."),
            ("V3_C2 (6-12s)", "6-second vertical video in realistic UGC vlog style. Same woman continues with perfect lip sync and natural hand movements: \"ShopyCrafter ensambla, prueba y perfecciona tu tienda como si tuvieras un equipo de 20 especialistas trabajando sin parar.\" Warm lighting, slight camera movement, real skin texture."),
            ("V3_C3 (12-18s)", "6-second vertical video in realistic UGC vlog style. Woman speaks with conviction and perfect lip sync: \"Construimos tu tienda perfecta.\" She smiles confidently. Subtle golden light effects. Trustworthy, modern, authentic vlog style."),
            ("V3_C4 (18-24s)", "6-second vertical video in realistic UGC vlog style. Woman smiles at camera. Gold text: \"Construimos tu tienda perfecta\". Logo + tagline appears elegantly. Natural lighting, premium but real UGC quality."),
        ]),
        # VIDEO 4
        ("VIDEO 4 – DASHBOARD (18s)", [
            ("V4_C1 (0-6s)", "6-second vertical video in realistic UGC vlog style. Woman speaks directly to camera with perfect lip sync and excited but professional energy: \"+347% de conversión en 90 días.\" Natural expression, modern background with golden accents. Authentic results-focused vlog feel."),
            ("V4_C2 (6-12s)", "6-second vertical video in realistic UGC vlog style. Same woman continues with perfect lip sync and natural hand gesture: \"+89% de ingresos por sesión.\" Warm lighting, slight smile, trustworthy expert tone."),
            ("V4_C3 (12-18s)", "6-second vertical video in realistic UGC vlog style. Woman looks at camera with confidence: \"+347% conversión\". Gold text appears. Logo + \"Pide tu diagnóstico gratis\" at the end. Authentic, high-converting UGC style."),
        ]),
        # VIDEO 5
        ("VIDEO 5 – SPLIT-SCREEN (25s)", [
            ("V5_C1 (0-6s)", "6-second vertical video in realistic UGC vlog style. Woman speaking directly to camera with perfect lip sync: \"Izquierda: tu tienda hoy.\" Natural, honest expression. Modern clean background. Authentic vlog feel."),
            ("V5_C2 (6-12s)", "6-second vertical video in realistic UGC vlog style. Woman continues with energy and perfect lip sync: \"Derecha: tu tienda con ShopyCrafter.\" Slight forward lean, confident smile. Golden accents appear softly."),
            ("V5_C3 (12-18s)", "6-second vertical video in realistic UGC vlog style. Woman speaks with conviction and perfect lip sync: \"La diferencia no es magia. Es ingeniería con IA.\" Natural head movement, expert tone, warm lighting."),
            ("V5_C4 (18-25s)", "6-second vertical video in realistic UGC vlog style. Woman smiles confidently. Gold text: \"Antes. Después. ShopyCrafter.\" Logo appears naturally. Authentic, emotional, high-quality UGC ending."),
        ]),
        # VIDEO 6
        ("VIDEO 6 – HERO CTA (20s)", [
            ("V6_C1 (0-6s)", "6-second vertical video in realistic UGC vlog style. Confident woman speaking directly to camera with perfect lip sync and warm expert tone: \"ShopyCrafter no es otra herramienta.\" Natural expression, modern workspace, subtle golden lighting. Authentic vlog feel."),
            ("V6_C2 (6-12s)", "6-second vertical video in realistic UGC vlog style. Same woman continues with perfect lip sync, looking straight at camera with inspiring expression: \"Es el equipo de e-commerce que siempre quisiste… pero con IA que nunca duerme.\" Natural, trustworthy, emotional but professional."),
            ("V6_C3 (12-18s)", "6-second vertical video in realistic UGC vlog style. Woman smiles warmly and speaks with perfect lip sync: \"Gestionamos tu Shopify. Tú solo vendes.\" Gold text appears elegantly. Logo + \"Solicita tu diagnóstico gratuito de 48h\". Authentic, high-converting UGC ending."),
            ("V6_C4 (18-20s)", "6-second vertical video in realistic UGC vlog style. Clean hold with ShopyCrafter logo centered, soft golden particles, tagline \"Ingeniería de E-commerce con IA\". Natural lighting, premium but real UGC quality."),
        ]),
    ]

    for video_title, clips in prompts:
        story.append(Paragraph(video_title, st['Video']))
        for clip_name, prompt in clips:
            story.append(Paragraph(f"<b>{clip_name}</b>", st['ClipTitle']))
            story.append(Paragraph(prompt, st['Prompt']))
        story.append(Spacer(1, 3))

    story.append(Spacer(1, 8))
    story.append(Paragraph("SHOPYCRAFTER – Ingeniería de E-commerce con IA | www.shopycrafter.com", st['Footer']))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"✅ PDF compacto generado: {OUTPUT}")

if __name__ == "__main__":
    build()