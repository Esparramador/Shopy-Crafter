#!/usr/bin/env python3
"""
ShopyCrafter Video Campaign Production Kit - Professional PDF Generator
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak, 
    Table, TableStyle, KeepTogether, ListFlowable, ListItem
)
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
import os
from datetime import datetime

# Colors - ShopyCrafter Brand
DARK_BG = HexColor("#0A0A0A")
GOLD = HexColor("#FFD700")
NEON_GREEN = HexColor("#00FF9F")
CYAN = HexColor("#00F0FF")
WHITE = HexColor("#FFFFFF")
DARK_GRAY = HexColor("#1A1A1A")

OUTPUT_PATH = "/home/workdir/artifacts/ShopyCrafter_Video_Campaign_Production_Kit.pdf"

# Image paths
IMG_DIR = "/home/workdir/artifacts/imagine_images/"
RENDERED_DIR = "/home/workdir/artifacts/rendered/"

def create_styles():
    styles = getSampleStyleSheet()
    
    # Custom styles
    styles.add(ParagraphStyle(
        name='MainTitle',
        parent=styles['Title'],
        fontSize=28,
        textColor=GOLD,
        alignment=TA_CENTER,
        spaceAfter=20,
        fontName='Helvetica-Bold'
    ))
    
    styles.add(ParagraphStyle(
        name='SubTitle',
        parent=styles['Normal'],
        fontSize=14,
        textColor=NEON_GREEN,
        alignment=TA_CENTER,
        spaceAfter=30,
        fontName='Helvetica'
    ))
    
    styles.add(ParagraphStyle(
        name='SectionHeader',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=GOLD,
        spaceBefore=20,
        spaceAfter=12,
        fontName='Helvetica-Bold',
        borderColor=GOLD,
        borderWidth=1,
        borderPadding=5
    ))
    
    styles.add(ParagraphStyle(
        name='VideoTitle',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=CYAN,
        spaceBefore=15,
        spaceAfter=8,
        fontName='Helvetica-Bold'
    ))
    
    styles.add(ParagraphStyle(
        name='CustomBody',
        parent=styles['Normal'],
        fontSize=10,
        textColor=WHITE,
        alignment=TA_JUSTIFY,
        spaceAfter=8,
        leading=14
    ))
    
    styles.add(ParagraphStyle(
        name='PromptText',
        parent=styles['Normal'],
        fontSize=8,
        textColor=HexColor("#CCCCCC"),
        fontName='Courier',
        leading=10,
        leftIndent=10,
        rightIndent=10,
        spaceAfter=10,
        backColor=DARK_GRAY
    ))
    
    styles.add(ParagraphStyle(
        name='Highlight',
        parent=styles['Normal'],
        fontSize=11,
        textColor=GOLD,
        fontName='Helvetica-Bold',
        spaceAfter=6
    ))
    
    styles.add(ParagraphStyle(
        name='Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=HexColor("#888888"),
        alignment=TA_CENTER
    ))
    
    return styles

def add_header_footer(canvas, doc):
    canvas.saveState()
    
    # Header bar
    canvas.setFillColor(DARK_BG)
    canvas.rect(0, A4[1] - 40, A4[0], 40, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.setFont('Helvetica-Bold', 10)
    canvas.drawString(30, A4[1] - 25, "SHOPYCRAFTER | Video Campaign Production Kit 2026")
    
    # Footer
    canvas.setFillColor(DARK_BG)
    canvas.rect(0, 0, A4[0], 30, fill=1, stroke=0)
    canvas.setFillColor(NEON_GREEN)
    canvas.setFont('Helvetica', 8)
    canvas.drawCentredString(A4[0]/2, 12, f"Confidential | Generated {datetime.now().strftime('%Y-%m-%d')} | Ingenieria de E-commerce con IA")
    
    canvas.restoreState()

def build_pdf():
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        rightMargin=25,
        leftMargin=25,
        topMargin=60,
        bottomMargin=45
    )
    
    styles = create_styles()
    story = []
    
    # ========== COVER PAGE ==========
    story.append(Spacer(1, 80))
    story.append(Paragraph("SHOPYCRAFTER", styles['MainTitle']))
    story.append(Paragraph("VIDEO CAMPAIGN PRODUCTION KIT", styles['SubTitle']))
    story.append(Spacer(1, 20))
    story.append(Paragraph("Concepto 4: Si nosotros gestionáramos [tu tienda]", styles['Highlight']))
    story.append(Spacer(1, 30))
    
    # Cover image
    cover_img_path = os.path.join(IMG_DIR, "Kdz0B.jpg")
    if os.path.exists(cover_img_path):
        img = Image(cover_img_path, width=450, height=300)
        story.append(img)
    
    story.append(Spacer(1, 30))
    story.append(Paragraph("6 Videos 9:16 + Master Concatenated Cut + Full Production Assets", styles['CustomBody']))
    story.append(Paragraph("Ready for Kling AI • Runway Gen-3 • Luma Dream Machine • Pika Labs", styles['CustomBody']))
    story.append(PageBreak())
    
    # ========== EXECUTIVE SUMMARY ==========
    story.append(Paragraph("1. EXECUTIVE SUMMARY & STRATEGY", styles['SectionHeader']))
    story.append(Paragraph("""
    <b>Campaign Objective:</b> Position ShopyCrafter as the premium AI-powered "e-commerce engineering" partner for Shopify stores. 
    Target: Mid-to-high volume Shopify merchants who want 24/7 autonomous optimization without hiring a full team.
    """, styles['CustomBody']))
    
    story.append(Paragraph("""
    <b>Core Message:</b> "Si ShopyCrafter gestionara tu tienda... tus resultados serían otros."
    The 6-video series builds from mystery → deep analysis → construction → explosive results → dramatic transformation → clear CTA.
    """, styles['CustomBody']))
    
    story.append(Paragraph("""
    <b>Intelligent Concatenation Strategy:</b> The 6 short videos (total ~2:10) are designed to flow as ONE epic brand film. 
    Golden light transitions, continuous music build, and narrative progression create a seamless 2-minute master cut 
    perfect for website hero, LinkedIn, and high-value lead magnets.
    """, styles['CustomBody']))
    story.append(Spacer(1, 15))
    
    # ========== CHARACTER REFERENCE ==========
    story.append(Paragraph("2. CONSISTENT CHARACTER REFERENCE (CRITICAL FOR AI VIDEO)", styles['SectionHeader']))
    story.append(Paragraph("""
    <b>Name:</b> Crafter (Holographic AI Entity - Female presenting for warmth + authority)
    """, styles['CustomBody']))
    story.append(Paragraph("""
    <b>Visual Description (copy-paste into every video prompt):</b><br/>
    Sleek holographic AI woman, 30 years old, sharp cyberpunk tailored black suit with glowing cyan and neon-green circuit lines, 
    short asymmetrical hair with vibrant neon-green highlights, confident professional expression, subtle holographic shimmer and edge glow, 
    cinematic lighting, ultra-detailed face, premium corporate tech aesthetic.
    """, styles['CustomBody']))
    story.append(Paragraph("""
    <b>Usage Tip:</b> Generate ONE reference image of Crafter first (using the description above + cyberpunk command center background). 
    Then use "Image Reference" / "Character Lock" / "IP-Adapter" in Kling/Runway/Luma for 100% consistency across all 6 videos.
    """, styles['CustomBody']))
    story.append(PageBreak())
    
    # ========== THE 6 VIDEOS ==========
    story.append(Paragraph("3. THE 6 VIDEO PROMPTS (9:16 OPTIMIZED - PRODUCTION READY)", styles['SectionHeader']))
    story.append(Paragraph("Copy-paste directly into Kling AI, Runway Gen-3, Luma Dream Machine or Pika Labs. All prompts are vertically optimized (9:16), include exact timing, voice-over, camera moves, and music cues.", styles['CustomBody']))
    story.append(Spacer(1, 10))
    
    # VIDEO 1
    story.append(Paragraph("VIDEO 1 – COMMAND CENTER (22s) | \"El cerebro que gestiona tu tienda\"", styles['VideoTitle']))
    story.append(Paragraph("""
    <b>Voice-over Script:</b><br/>
    [0-4s] “Imagina que tu tienda Shopify tuviera un equipo completo de ingenieros de e-commerce trabajando 24 horas al día, 7 días a la semana…”<br/>
    [4-9s] “…con IA que analiza, prueba y optimiza cada detalle sin parar.”<br/>
    [15-18s] Crafter (soft, powerful): “Esto es ShopyCrafter.”
    """, styles['CustomBody']))
    story.append(Paragraph("""
    <b>Full Prompt (copy-paste):</b><br/>
    Vertical 9:16 cinematic 8K photorealistic, dark cyberpunk corporate aesthetic, golden neon and glowing green accents. 
    Futuristic command center. Massive holographic screen in center showing premium Shopify store wireframe being optimized by glowing digital tools and floating data streams. 
    Slow smooth push-in from top to central hologram (0-7s). At 7s holographic AI entity "Crafter" (sleek woman cyberpunk black suit with cyan-green neon lines, short neon-green highlighted hair, confident professional expression, holographic shimmer) materializes on right side. 
    Golden conversion metrics and green optimization lines appear (9-15s). Crafter raises hand and entire dashboard lights up in gold (15-18s). 
    Large gold headline centered top readable on mobile: "Si ShopyCrafter gestionara tu tienda". 
    ShopyCrafter logo + tagline "Ingeniería de E-commerce con IA" bottom safe zone (18-22s). 
    Music: Dark cinematic synthwave hybrid 135 BPM pulsing sub-bass building tension with golden brass swells.
    """, styles['PromptText']))
    story.append(Spacer(1, 8))
    
    # VIDEO 2
    story.append(Paragraph("VIDEO 2 – LUPA DE PRECISIÓN (20s) | \"Análisis profundo, resultados inmediatos\"", styles['VideoTitle']))
    story.append(Paragraph("""
    <b>Voice-over Script:</b><br/>
    [0-5s] “Cada píxel. Cada palabra. Cada botón.”<br/>
    [5-11s] “ShopyCrafter no solo ve tu tienda… la disecciona, la entiende y la mejora en tiempo real.”
    """, styles['CustomBody']))
    story.append(Paragraph("""
    <b>Full Prompt:</b><br/>
    Vertical 9:16, sleek dark modern SaaS style, glowing green code. Huge glowing digital magnifying glass centered moving slowly downward over beautiful Shopify product page layout. 
    Reveals highly optimized glowing green code, heatmaps, A/B test results and real-time conversion metrics (0-11s). 
    At 6s Crafter appears reflected inside the lens, confident smile. Conversion number jumps 2.4% → 8.7% in golden particles (11-16s). 
    Large gold headline top: "Análisis profundo. Resultados reales.". Logo + tagline bottom (16-20s). 
    Music: Focused analytical version of theme with rising golden hits.
    """, styles['PromptText']))
    story.append(PageBreak())
    
    # VIDEO 3
    story.append(Paragraph("VIDEO 3 – ROBOTIC BLUEPRINT (24s) | \"Construimos tu tienda perfecta\"", styles['VideoTitle']))
    story.append(Paragraph("""
    <b>Voice-over Script:</b><br/>
    [0-6s] “No contratamos gente. Construimos inteligencia.”<br/>
    [6-12s] “ShopyCrafter ensambla, prueba y perfecciona tu tienda como si tuvieras un equipo de 20 especialistas trabajando sin parar.”
    """, styles['CustomBody']))
    story.append(Paragraph("""
    <b>Full Prompt:</b><br/>
    Vertical 9:16 premium 3D cinematic render, dark moody studio. Floating digital blueprint of complete Shopify store centered. 
    Multiple high-tech robotic arms with glowing cyan joints precisely assembling and optimizing components in real-time: moving sections, rewriting code, A/B testing variants (0-13s). 
    Slow gentle orbit around blueprint. At 9s Crafter appears above directing arms with subtle hand gestures. 
    Golden light bursts from finished optimized sections (13-20s). Large gold headline: "Construimos tu tienda perfecta". 
    Logo bottom (20-24s). Music: Robotic percussion + triumphant golden swells.
    """, styles['PromptText']))
    story.append(Spacer(1, 8))
    
    # VIDEO 4
    story.append(Paragraph("VIDEO 4 – DASHBOARD DORADO (18s) | \"Los números que importan\"", styles['VideoTitle']))
    story.append(Paragraph("""
    <b>Voice-over Script:</b><br/>
    [0-4s] “+347% de conversión en 90 días.”<br/>
    [4-9s] “+89% de ingresos por sesión.”<br/>
    [9-13s] “Esto es lo que pasa cuando la IA gestiona tu e-commerce.”
    """, styles['CustomBody']))
    story.append(Paragraph("""
    <b>Full Prompt:</b><br/>
    Vertical 9:16 corporate tech aesthetic. Sleek floating dashboard centered with golden neon conversion rate graphs skyrocketing with beautiful rising lines and particle effects. 
    Blurred high-end fashion retail background. Slow push-in on main golden line chart (0-10s). Crafter appears left side at 7s, arms crossed, satisfied expression. 
    Big golden text: "+347% conversión". Logo + "Pide tu diagnóstico gratis" (14-18s). 
    Music: Triumphant version with big golden brass hits.
    """, styles['PromptText']))
    story.append(PageBreak())
    
    # VIDEO 5
    story.append(Paragraph("VIDEO 5 – SPLIT-SCREEN (25s) | \"Antes. Después. ShopyCrafter.\"", styles['VideoTitle']))
    story.append(Paragraph("""
    <b>Voice-over Script:</b><br/>
    [0-7s] “Izquierda: tu tienda hoy.”<br/>
    [7-13s] “Derecha: tu tienda con ShopyCrafter.”<br/>
    [13-18s] “La diferencia no es magia. Es ingeniería con IA.”
    """, styles['CustomBody']))
    story.append(Paragraph("""
    <b>Full Prompt:</b><br/>
    Vertical 9:16 high-contrast dramatic split-screen 3D concept. Top half: glitching, slow, grey, laggy Shopify storefront with low red metrics and frustrated loading. 
    Bottom half: sleek glowing golden perfectly optimized Shopify storefront with smooth animations and rising green metrics. 
    Vertical golden light beam splits screen at 8s and transforms top into bottom as Crafter walks upward from grey to gold (8-14s). 
    Final full golden screen (14-20s). Large gold headline across center: "Antes. Después. ShopyCrafter.". 
    Logo + CTA (20-25s). Music: Tension on top → explosive golden resolution on bottom.
    """, styles['PromptText']))
    story.append(Spacer(1, 8))
    
    # VIDEO 6
    story.append(Paragraph("VIDEO 6 – HERO CTA (20s) | \"Gestionamos tu e-commerce. Tú solo vendes.\"", styles['VideoTitle']))
    story.append(Paragraph("""
    <b>Voice-over Script:</b><br/>
    [0-6s] “ShopyCrafter no es otra herramienta.”<br/>
    [6-11s] “Es el equipo de e-commerce que siempre quisiste… pero con IA que nunca duerme.”<br/>
    [11-16s] “Gestionamos tu Shopify. Tú solo vendes.”
    """, styles['CustomBody']))
    story.append(Paragraph("""
    <b>Full Prompt:</b><br/>
    Vertical 9:16 epic closing. Crafter centered in futuristic command center. All previous 5 scenes orbit around her as glowing holographic planets (0-10s). 
    Slow 360° orbit. Golden particles and data streams flow. Final 4 seconds: Full screen gold CTA "Solicita tu diagnóstico gratuito de 48h" + logo + shopycrafter.com. 
    Music: Full triumphant resolution with powerful final hit.
    """, styles['PromptText']))
    story.append(PageBreak())
    
    # ========== INTELLIGENT CONCATENATION ==========
    story.append(Paragraph("4. INTELLIGENT MASTER CUT – 2:10 EPIC BRAND FILM", styles['SectionHeader']))
    story.append(Paragraph("""
    <b>Why concatenate?</b> The 6 shorts are engineered to work as ONE cohesive 2-minute-10-second brand film. 
    This master cut is perfect for: Website hero video, LinkedIn long-form, YouTube pre-roll, high-value email attachments, and sales presentations.
    """, styles['CustomBody']))
    
    story.append(Paragraph("<b>RECOMMENDED EDITING FLOW (CapCut / Premiere / DaVinci Resolve):</b>", styles['Highlight']))
    
    concat_data = [
        ["Time", "Source Video", "Action", "Transition", "Music Note"],
        ["0:00-0:22", "Video 1", "Full", "None (start)", "Dark tension build"],
        ["0:22-0:42", "Video 2", "Full", "Golden light wipe (2s)", "Analytical layer in"],
        ["0:42-1:06", "Video 3", "Full", "Robotic arm sweep (1.5s)", "Percussion rise"],
        ["1:06-1:24", "Video 4", "Full", "Graph particle burst (2s)", "Triumphant swell"],
        ["1:24-1:49", "Video 5", "Full (keep dramatic split)", "Golden beam extend (3s)", "Peak tension → release"],
        ["1:49-2:10", "Video 6", "Full + extended CTA", "Crafter orbit fade (2s)", "Full resolution hit"],
    ]
    
    table = Table(concat_data, colWidths=[1.2*cm, 2.5*cm, 3.5*cm, 4*cm, 4*cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), GOLD),
        ('TEXTCOLOR', (0, 0), (-1, 0), DARK_BG),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BACKGROUND', (0, 1), (-1, -1), DARK_GRAY),
        ('TEXTCOLOR', (0, 1), (-1, -1), WHITE),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, GOLD),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [DARK_GRAY, HexColor("#121212")]),
    ]))
    story.append(table)
    story.append(Spacer(1, 15))
    
    story.append(Paragraph("""
    <b>Pro Editing Tips for Intelligent Flow:</b><br/>
    • Keep music as ONE continuous track (export full 2:10 music bed first).<br/>
    • Use golden light / particle bursts as natural transitions between videos.<br/>
    • Extend Video 6 CTA by 4-5 seconds with slow zoom on logo + website URL fade-in.<br/>
    • Color grade all clips with same LUT (dark teal shadows + golden highlights) for perfect cohesion.<br/>
    • Add subtle film grain + 2.35:1 letterbox on master cut for premium cinematic feel.
    """, styles['CustomBody']))
    story.append(PageBreak())
    
    # ========== VISUAL GALLERY ==========
    story.append(Paragraph("5. BRANDED VISUAL ASSETS (READY FOR ADS & THUMBNAILS)", styles['SectionHeader']))
    story.append(Paragraph("These 5 static images are pre-branded with logo, headlines and tagline. Use for: LinkedIn/Meta ads, Google Display, email headers, presentation slides, and video thumbnails.", styles['CustomBody']))
    story.append(Spacer(1, 10))
    
    # Add the 5 images in a grid-like layout
    images_info = [
        ("Kdz0B.jpg", "Command Center – Hero Visual"),
        ("ic1fU.jpg", "Lupa – Analysis Visual"),
        ("OD24o.jpg", "Robotic Blueprint – Construction Visual"),
        ("HL1Mn.jpg", "Dashboard – Results Visual"),
        ("2mF2e.jpg", "Split-Screen – Transformation Visual"),
    ]
    
    for img_name, caption in images_info:
        img_path = os.path.join(IMG_DIR, img_name)
        if os.path.exists(img_path):
            story.append(Paragraph(f"<b>{caption}</b>", styles['Highlight']))
            img = Image(img_path, width=400, height=266)
            story.append(img)
            story.append(Spacer(1, 15))
    
    story.append(PageBreak())
    
    # ========== TECHNICAL SPECS ==========
    story.append(Paragraph("6. TECHNICAL SPECS & DELIVERABLES CHECKLIST", styles['SectionHeader']))
    
    specs = """
    <b>Video Specifications:</b><br/>
    • Primary: 1080×1920 (9:16) – 30fps – H.264 – 8-12 Mbps<br/>
    • Secondary: 1920×1080 (16:9) – 30fps – H.264 – 15-20 Mbps<br/>
    • Master Cut: 1920×1080 with 2.35:1 letterbox, 24fps cinematic<br/>
    • Audio: 48kHz 24-bit, -14 LUFS integrated, -1 dBTP max<br/><br/>
    
    <b>Recommended AI Video Tools (ranked by quality):</b><br/>
    1. Kling AI 1.6 (best character consistency + motion)<br/>
    2. Runway Gen-3 Alpha (best prompt adherence + cinematic)<br/>
    3. Luma Dream Machine (best 3D/robotic elements)<br/>
    4. Pika Labs 2.1 (fastest iteration)<br/><br/>
    
    <b>Final Deliverables (agency handoff):</b><br/>
    □ 6× 9:16 vertical videos (MP4)<br/>
    □ 6× 16:9 horizontal videos (MP4)<br/>
    □ 1× 2:10 Master Brand Film (MP4 + MOV ProRes)<br/>
    □ 6× 1080×1920 thumbnails (PNG)<br/>
    □ 6× 1200×628 social thumbnails (PNG)<br/>
    □ This PDF kit + editable .srt subtitles<br/>
    □ Full music track (WAV + stems)
    """
    story.append(Paragraph(specs, styles['CustomBody']))
    story.append(Spacer(1, 20))
    
    story.append(Paragraph("7. NEXT STEPS", styles['SectionHeader']))
    story.append(Paragraph("""
    1. Generate reference image of "Crafter" character today.<br/>
    2. Run all 6 prompts in your preferred AI video tool (parallel generation recommended).<br/>
    3. Edit master cut following the table above (2-3 hours in CapCut/Premiere).<br/>
    4. Export + upload to landing page + ad accounts.<br/>
    5. A/B test Video 5 (Split-Screen) vs Video 6 (CTA) as standalone ads.
    """, styles['CustomBody']))
    
    story.append(Spacer(1, 30))
    story.append(Paragraph("SHOPYCRAFTER – Ingeniería de E-commerce con IA", styles['SubTitle']))
    story.append(Paragraph("www.shopycrafter.com | 24/7 IA que trabaja por ti", styles['Footer']))
    
    # Build PDF
    doc.build(story, onFirstPage=add_header_footer, onLaterPages=add_header_footer)
    print(f"✅ PDF generated successfully: {OUTPUT_PATH}")

if __name__ == "__main__":
    build_pdf()