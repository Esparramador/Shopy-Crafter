#!/usr/bin/env python3
"""
Advanced Prompt Engineering for Professional AI Advertising Platforms
How Pollo.ai, Omneky, Seedance 2.0 and similar tools work
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

OUTPUT = "/home/workdir/artifacts/Advanced_Prompt_Engineering_Pro_AI_Ads.pdf"

def styles():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle(name='MainTitle', fontSize=14, textColor=BLUE, alignment=TA_CENTER, spaceAfter=6, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Sub', fontSize=9, textColor=NEON, alignment=TA_CENTER, spaceAfter=10))
    s.add(ParagraphStyle(name='Section', fontSize=10, textColor=BLUE, spaceBefore=8, spaceAfter=4, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='SubSection', fontSize=9, textColor=CYAN, spaceBefore=5, spaceAfter=2, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Body', fontSize=7.5, textColor=WHITE, alignment=TA_JUSTIFY, spaceAfter=3, leading=9))
    s.add(ParagraphStyle(name='Prompt', fontSize=6, textColor=GRAY, fontName='Courier', leading=7, leftIndent=2, rightIndent=2, spaceAfter=4, backColor=DARK_GRAY))
    s.add(ParagraphStyle(name='Footer', fontSize=6, textColor=HexColor("#888888"), alignment=TA_CENTER))
    return s

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(DARK)
    canvas.rect(0, A4[1]-22, A4[0], 22, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.setFont('Helvetica-Bold', 6)
    canvas.drawString(8, A4[1]-15, "ADVANCED PROMPT ENGINEERING | Professional AI Ad Platforms")
    canvas.setFillColor(DARK)
    canvas.rect(0, 0, A4[0], 16, fill=1, stroke=0)
    canvas.setFillColor(NEON)
    canvas.setFont('Helvetica', 5)
    canvas.drawCentredString(A4[0]/2, 4, f"Generated {datetime.now().strftime('%Y-%m-%d')} | Pollo.ai • Omneky • Seedance 2.0 Level")
    canvas.restoreState()

def build():
    doc = SimpleDocTemplate(OUTPUT, pagesize=A4, rightMargin=10, leftMargin=10, topMargin=32, bottomMargin=20)
    st = styles()
    story = []

    # COVER
    story.append(Spacer(1, 20))
    story.append(Paragraph("ADVANCED PROMPT ENGINEERING", st['MainTitle']))
    story.append(Paragraph("Professional AI Advertising Platforms Level", st['Sub']))
    story.append(Paragraph("How Pollo.ai, Omneky, Seedance 2.0 and similar tools create high-end ads", st['Body']))
    story.append(Spacer(1, 8))

    # SECTION 1
    story.append(Paragraph("1. HOW PROFESSIONAL AI AD PLATFORMS WORK (THE REAL LOGIC)", st['Section']))
    story.append(Paragraph("""
    Professional platforms like <b>Pollo.ai, Omneky, Seedance 2.0, Creatify, Veed + AI, etc.</b> do not use simple prompts. They use a <b>multi-layer prompt architecture</b> with these components:
    """, st['Body']))
    story.append(Paragraph("• <b>Style Layer:</b> Cinematic / UGC / 3D Product / Motion Graphics / Photorealistic", st['Body']))
    story.append(Paragraph("• <b>Subject Layer:</b> Product + Model + Environment + Interaction", st['Body']))
    story.append(Paragraph("• <b>Motion Layer:</b> Camera movement + Object movement + Timing", st['Body']))
    story.append(Paragraph("• <b>Text Layer:</b> Typography, timing, animation, position, color", st['Body']))
    story.append(Paragraph("• <b>Lighting & Mood Layer:</b> Color grade, atmosphere, emotional tone", st['Body']))
    story.append(Paragraph("• <b>Technical Layer:</b> Resolution, aspect ratio, frame rate, quality boosters", st['Body']))
    story.append(Paragraph("• <b>Negative Layer:</b> What to avoid (blurry, deformed, text errors, etc.)", st['Body']))
    story.append(Spacer(1, 6))

    # SECTION 2
    story.append(Paragraph("2. PERFECT TEXT PLACEMENT IN VIDEO & IMAGES", st['Section']))
    story.append(Paragraph("<b>Pro Prompt Structure for Text:</b>", st['SubSection']))
    story.append(Paragraph("""
    "Clean elegant gold sans-serif text 'NEW COLLECTION' appears at 2.3 seconds, centered, subtle pop-in animation with soft glow, stays for 2.8 seconds, then fades out elegantly. Font size 42, letter-spacing 1.5, modern luxury feel, perfectly readable, no distortion, sharp edges."
    """, st['Prompt']))
    story.append(Paragraph("<b>Key Techniques Used by Pro Tools:</b>", st['SubSection']))
    story.append(Paragraph("• Specify exact timing (e.g. 'appears at 2.3s, stays 2.8s')", st['Body']))
    story.append(Paragraph("• Specify animation type (pop-in, fade, slide, typewriter, glitch, etc.)", st['Body']))
    story.append(Paragraph("• Specify font characteristics (sans-serif, serif, modern, luxury, bold, light)", st['Body']))
    story.append(Paragraph("• Add 'perfectly readable, no distortion, sharp edges, high contrast'", st['Body']))
    story.append(Paragraph("• Use 'subtle glow' or 'soft shadow' for premium feel", st['Body']))
    story.append(Spacer(1, 6))

    # SECTION 3
    story.append(Paragraph("3. INFOGRAPHICS & DATA VISUALIZATION PROMPTS", st['Section']))
    story.append(Paragraph("<b>Pro Prompt Example:</b>", st['SubSection']))
    story.append(Paragraph("""
    "Clean modern infographic animation, dark background with golden accents. Title '347% MORE CONVERSIONS' appears at top in bold gold. Below, three animated stats appear one by one: '2.4s → 0.8s load time', '89% higher session value', '4.2x return on ad spend'. Each stat has subtle icon + smooth number counter animation. Professional data visualization style, minimalist luxury, perfectly readable, 8K."
    """, st['Prompt']))
    story.append(Spacer(1, 6))

    # SECTION 4
    story.append(Paragraph("4. PRODUCT DECONSTRUCTION & CONSTRUCTION (FABRICS / MATERIALS)", st['Section']))
    story.append(Paragraph("<b>Pro Prompt Example (Deconstruction):</b>", st['SubSection']))
    story.append(Paragraph("""
    "6-second cinematic macro video of premium cotton fabric being deconstructed in extreme slow motion. Camera starts wide on finished black t-shirt, then slowly zooms into the fabric. Individual threads separate and float in the air with realistic physics. Fibers break apart showing the weave structure. Golden light highlights texture. Ultra-detailed textile macro, scientific yet beautiful, 8K, photorealistic."
    """, st['Prompt']))
    story.append(Paragraph("<b>Pro Prompt Example (Construction):</b>", st['SubSection']))
    story.append(Paragraph("""
    "6-second cinematic macro video showing premium fabric being constructed from raw threads. Individual cotton fibers weave together in perfect slow motion to form the final textile. Camera starts on individual threads floating, then they intertwine with realistic tension and texture. Final fabric appears smooth and luxurious. Golden light, extreme detail, scientific beauty, 8K."
    """, st['Prompt']))
    story.append(Spacer(1, 6))

    # SECTION 5
    story.append(Paragraph("5. VIRTUAL TRY-ON IN REAL VIDEO (PRODUCT ON MODEL)", st['Section']))
    story.append(Paragraph("<b>Advanced Prompt Structure for Realistic Virtual Try-On:</b>", st['SubSection']))
    story.append(Paragraph("""
    "6-second vertical video, realistic UGC style. 28-year-old woman walking naturally in modern street. She wears the exact black linen shirt from the product. Fabric moves realistically with her body, natural folds and wrinkles appear where they should. Shirt fits perfectly on her body shape, sleeves roll naturally, collar sits correctly. Perfect product-to-model adhesion, no floating fabric, no distortion, photorealistic material behavior, natural movement, 8K."
    """, st['Prompt']))
    story.append(Paragraph("<b>Key Techniques for Perfect Adhesion:</b>", st['SubSection']))
    story.append(Paragraph("• 'Fabric moves realistically with body, natural folds and wrinkles'", st['Body']))
    story.append(Paragraph("• 'Perfect product-to-model adhesion, no floating fabric, no distortion'", st['Body']))
    story.append(Paragraph("• 'Sleeves roll naturally, collar sits correctly, hem falls naturally'", st['Body']))
    story.append(Paragraph("• 'Photorealistic material behavior and physics'", st['Body']))
    story.append(Paragraph("• 'Exact product match: color, texture, buttons, stitching details'", st['Body']))
    story.append(Spacer(1, 6))

    # SECTION 6
    story.append(Paragraph("6. MULTI-LAYER PROMPT ARCHITECTURE (PRO LEVEL)", st['Section']))
    story.append(Paragraph("<b>Full Professional Prompt Example (6 seconds):</b>", st['SubSection']))
    story.append(Paragraph("""
    "6-second vertical video in premium cinematic UGC style, natural golden hour lighting, slight handheld movement. Confident 29-year-old woman (modern professional, natural beauty, short hair with subtle highlights) walking through bright modern apartment. She wears the exact beige linen shirt from product reference. Fabric moves with realistic physics and natural folds. At 1.8s elegant gold text 'NEW SEASON ESSENTIAL' pops in center with soft glow, stays 2.4s, then fades elegantly. She looks at camera with warm expert smile and says with perfect lip sync: 'This is the shirt I wear on repeat.' Background has subtle golden particles. Ultra-detailed fabric texture, natural skin, premium lighting, 8K, photorealistic, high-end advertisement quality."
    """, st['Prompt']))
    story.append(Spacer(1, 6))

    # SECTION 7
    story.append(Paragraph("7. NEGATIVE PROMPTING (CRITICAL FOR PRO RESULTS)", st['Section']))
    story.append(Paragraph("<b>Always add at the end:</b>", st['SubSection']))
    story.append(Paragraph("""
    "Negative: blurry, deformed, extra limbs, bad anatomy, floating fabric, text errors, distorted text, low quality, cartoon, illustration, overexposed, underexposed, watermark, logo errors, bad lighting, unnatural skin, plastic skin, bad proportions, jittery movement, floating objects"
    """, st['Prompt']))
    story.append(Spacer(1, 8))

    story.append(Paragraph("SHOPYCRAFTER – Ingeniería de E-commerce con IA | www.shopycrafter.com", st['Footer']))
    story.append(Paragraph("This is the advanced prompt system used by professional AI advertising platforms in 2026.", st['Footer']))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"✅ PDF generado: {OUTPUT}")

if __name__ == "__main__":
    build()