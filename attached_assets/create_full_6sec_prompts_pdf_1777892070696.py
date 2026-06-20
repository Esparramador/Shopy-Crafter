#!/usr/bin/env python3
"""
ShopyCrafter - Complete 6-Second Micro-Clips Kit for Grok Imagine
All 22 clips + Concatenation Table + Female Voice + Full Assets
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Preformatted
from reportlab.pdfgen import canvas
from datetime import datetime

DARK = HexColor("#0A0A0A")
GOLD = HexColor("#FFD700")
NEON = HexColor("#00FF9F")
CYAN = HexColor("#00F0FF")
WHITE = HexColor("#FFFFFF")
GRAY = HexColor("#CCCCCC")
DARK_GRAY = HexColor("#1A1A1A")

OUTPUT = "/home/workdir/artifacts/ShopyCrafter_6sec_MicroClips_GrokImagine_Kit.pdf"

def styles():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle(name='TitleMain', fontSize=20, textColor=GOLD, alignment=TA_CENTER, spaceAfter=8, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Sub', fontSize=11, textColor=NEON, alignment=TA_CENTER, spaceAfter=15))
    s.add(ParagraphStyle(name='Section', fontSize=13, textColor=GOLD, spaceBefore=12, spaceAfter=6, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='ClipTitle', fontSize=10, textColor=CYAN, spaceBefore=8, spaceAfter=3, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Body', fontSize=8, textColor=WHITE, alignment=TA_JUSTIFY, spaceAfter=4, leading=10))
    s.add(ParagraphStyle(name='Prompt', fontSize=6.5, textColor=GRAY, fontName='Courier', leading=8, leftIndent=3, rightIndent=3, spaceAfter=6, backColor=DARK_GRAY))
    s.add(ParagraphStyle(name='Footer', fontSize=7, textColor=HexColor("#888888"), alignment=TA_CENTER))
    s.add(ParagraphStyle(name='Highlight', fontSize=9, textColor=GOLD, fontName='Helvetica-Bold', spaceAfter=4))
    return s

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(DARK)
    canvas.rect(0, A4[1]-30, A4[0], 30, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.setFont('Helvetica-Bold', 8)
    canvas.drawString(15, A4[1]-20, "SHOPYCRAFTER | 6-Second Micro-Clips Kit for Grok Imagine")
    canvas.setFillColor(DARK)
    canvas.rect(0, 0, A4[0], 22, fill=1, stroke=0)
    canvas.setFillColor(NEON)
    canvas.setFont('Helvetica', 7)
    canvas.drawCentredString(A4[0]/2, 7, f"Generated {datetime.now().strftime('%Y-%m-%d')} | Female Voice | www.shopycrafter.com")
    canvas.restoreState()

def build():
    doc = SimpleDocTemplate(OUTPUT, pagesize=A4, rightMargin=15, leftMargin=15, topMargin=45, bottomMargin=30)
    st = styles()
    story = []

    # COVER
    story.append(Spacer(1, 50))
    story.append(Paragraph("SHOPYCRAFTER", st['TitleMain']))
    story.append(Paragraph("6-SECOND MICRO-CLIPS KIT", st['Sub']))
    story.append(Paragraph("Optimized for Grok Imagine (max 6s per generation)", st['Body']))
    story.append(Paragraph("22 Hyper-Detailed Clips • Female Voice • Full Concatenation Plan", st['Body']))
    story.append(Spacer(1, 15))
    story.append(Paragraph("Ingeniería de E-commerce con IA", st['Highlight']))
    story.append(PageBreak())

    # INSTRUCTIONS
    story.append(Paragraph("INSTRUCCIONES IMPORTANTES PARA GROK IMAGINE", st['Section']))
    story.append(Paragraph("""
    <b>1. Character Lock (Obligatorio):</b> Antes de generar cualquier clip, crea una imagen de referencia de "Crafter" usando esta descripción exacta:<br/>
    "Sleek holographic AI woman, 30 years old, cyberpunk black tailored suit with glowing cyan and neon-green circuit lines, short asymmetrical hair with vibrant neon-green highlights, confident professional expression, subtle holographic shimmer and edge glow, cinematic lighting, ultra-detailed face, premium corporate tech aesthetic."<br/><br/>
    <b>2. Voice:</b> Todos los prompts usan voz de mujer profesional española (cálida, segura, autoritaria, tono moderno tech).<br/><br/>
    <b>3. Estilo base (añade al inicio de cada prompt si Grok Imagine lo permite):</b><br/>
    "6-second cinematic 8K vertical video, dark cyberpunk corporate aesthetic, golden neon + glowing green accents, film grain, ultra-detailed, photorealistic, consistent character: Crafter..."
    """, st['Body']))
    story.append(Spacer(1, 8))

    # CONCATENATION TABLE
    story.append(Paragraph("TABLA DE CONCATENACIÓN (Master Cut 2:10)", st['Section']))
    concat_data = [
        ["Video", "Duración", "Clips", "Nombre de archivos recomendados"],
        ["Video 1 - Command Center", "22s", "4 clips", "V1_C1_0-6s + V1_C2_6-12s + V1_C3_12-18s + V1_C4_18-22s"],
        ["Video 2 - Lupa", "20s", "4 clips", "V2_C1_0-6s + V2_C2_6-12s + V2_C3_12-18s + V2_C4_18-20s"],
        ["Video 3 - Robotic Blueprint", "24s", "4 clips", "V3_C1_0-6s + V3_C2_6-12s + V3_C3_12-18s + V3_C4_18-24s"],
        ["Video 4 - Dashboard", "18s", "3 clips", "V4_C1_0-6s + V4_C2_6-12s + V4_C3_12-18s"],
        ["Video 5 - Split-Screen", "25s", "4 clips", "V5_C1_0-6s + V5_C2_6-12s + V5_C3_12-18s + V5_C4_18-25s"],
        ["Video 6 - Hero CTA", "20s", "3 clips", "V6_C1_0-6s + V6_C2_6-12s + V6_C3_12-18s + V6_C4_18-20s (opcional)"],
    ]
    t = Table(concat_data, colWidths=[3.5*cm, 1.8*cm, 1.5*cm, 9*cm])
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
    story.append(Spacer(1, 8))
    story.append(Paragraph("<b>Consejo de edición:</b> Usa transiciones de 'Golden Light Wipe' o 'Particle Burst' entre clips para flujo perfecto. Mantén la misma música de fondo continua.", st['Body']))
    story.append(PageBreak())

    # ALL CLIPS
    all_clips = [
        # VIDEO 1
        ("VIDEO 1 – COMMAND CENTER (22s)", [
            ("Clip 1.1 (0-6s)", "Wide establishing shot + first VO line",
             "6-second cinematic 8K vertical video, dark cyberpunk corporate aesthetic, golden neon + glowing green accents. Wide establishing shot of a massive futuristic command center with a huge holographic screen showing a premium Shopify wireframe. Slow smooth dolly-in from wide to medium shot. Subtle glowing data streams floating in the air. Dark cinematic lighting with golden rim lights. At 4.5s the first golden particles start appearing on the screen. Voice-over (confident professional Spanish female voice, warm but authoritative, modern tech tone): \"Imagina que tu tienda Shopify tuviera un equipo completo de ingenieros de e-commerce trabajando 24 horas al día, 7 días a la semana…\". Music: dark cinematic synthwave hybrid 135 BPM, pulsing sub-bass, building tension. Film grain, ultra-detailed, premium advertisement quality."),
            ("Clip 1.2 (6-12s)", "Crafter appears + dashboard activates",
             "6-second cinematic 8K vertical video. Same futuristic command center. At 0.5s the holographic AI entity \"Crafter\" (sleek woman in cyberpunk black suit with glowing cyan-green lines, short neon-green highlighted hair, confident expression, holographic shimmer) materializes on the right side with a soft energy burst. She slowly raises her right hand toward the holographic screen. The screen starts lighting up with green optimization lines and golden data. Slow camera push-in toward Crafter and the screen. Voice-over continues: \"…con IA que analiza, prueba y optimiza cada detalle sin parar.\" Golden light reflections on Crafter’s suit. Music: tension continues building with subtle rising pads."),
            ("Clip 1.3 (12-18s)", "Golden metrics explode",
             "6-second cinematic 8K vertical video. Close-up on the holographic dashboard. Golden conversion rate graphs and metrics suddenly explode and rise dramatically across the screen with beautiful particle effects and light streaks. Crafter is visible on the right edge, watching with a satisfied expression. Camera slowly orbits slightly to the right. Strong golden glow and lens flares. Voice-over: \"Esto es ShopyCrafter.\" Music: big golden brass swell at 14s. Ultra cinematic, high contrast, premium quality."),
            ("Clip 1.4 (18-22s)", "Logo + tagline",
             "6-second cinematic 8K vertical video. The holographic screen fades slightly. Large elegant gold text appears in the center: \"Si ShopyCrafter gestionara tu tienda\". ShopyCrafter logo (modern gold neon) + tagline \"Ingeniería de E-commerce con IA\" appears bottom right with subtle glow. Slow zoom out revealing the full command center. Soft golden particles floating. Music: resolves with a powerful final hit. Cinematic, premium advertisement ending."),
        ]),
        # VIDEO 2
        ("VIDEO 2 – LUPA DE PRECISIÓN (20s)", [
            ("Clip 2.1 (0-6s)", "Magnifying glass enters + first line",
             "6-second cinematic 8K vertical. Sleek dark modern SaaS style. Wide shot of a beautiful Shopify product page. A massive glowing digital magnifying glass enters from the left and slowly moves across the layout. As it passes, it reveals glowing green code, heatmaps and conversion metrics underneath with beautiful light effects. Voice-over (confident professional Spanish female voice): \"Cada píxel. Cada palabra. Cada botón.\" Music: focused analytical synthwave with rising tension. Ultra detailed, cinematic lighting."),
            ("Clip 2.2 (6-12s)", "Crafter reflected + conversion rising",
             "6-second cinematic 8K vertical. The magnifying glass continues moving right. Crafter appears reflected inside the lens with a confident smile (same character description). Conversion numbers start jumping: 2.4% → 5.8% with golden particles. Strong green and gold glow. Voice-over: \"ShopyCrafter no solo ve tu tienda… la disecciona, la entiende y la mejora en tiempo real.\" Camera follows the magnifying glass with a slight tracking movement."),
            ("Clip 2.3 (12-18s)", "Final conversion jump + explosion",
             "6-second cinematic 8K vertical. Close-up on the magnifying glass area. Final conversion jump 5.8% → 8.7% with big golden particle explosion. Crafter’s reflection winks subtly. Golden light bursts. Voice-over ends. Music: rising golden hit at 15s. Extremely detailed code and metrics visible. Premium cinematic quality."),
            ("Clip 2.4 (18-20s)", "Logo + tagline",
             "6-second cinematic 8K vertical. The magnifying glass fades out elegantly. Large gold headline appears: \"Análisis profundo. Resultados reales.\". ShopyCrafter logo + tagline bottom right. Slow fade to black with golden particles. Music: clean resolution."),
        ]),
        # VIDEO 3
        ("VIDEO 3 – ROBOTIC BLUEPRINT (24s)", [
            ("Clip 3.1 (0-6s)", "Robotic arms start assembling",
             "6-second cinematic 8K vertical video, dark cyberpunk corporate aesthetic, golden neon + glowing cyan accents. Wide cinematic shot of a dark moody high-tech studio. A large floating digital blueprint of a premium Shopify store hovers in the center. Multiple high-tech robotic arms with glowing cyan joints start moving and assembling website components with precision. Slow smooth camera orbit from left to right. Subtle sparks and light particles. Voice-over (confident professional Spanish female voice, warm but authoritative, modern tech tone): \"No contratamos gente. Construimos inteligencia.\" Music: dark cinematic synthwave hybrid 135 BPM with robotic percussion and subtle rising tension. Ultra-detailed, film grain, premium advertisement quality."),
            ("Clip 3.2 (6-12s)", "Crafter appears + directs arms",
             "6-second cinematic 8K vertical video. Same dark studio. The robotic arms continue working faster and more synchronized across the wide frame, moving sections, rewriting code lines in the air, and A/B testing variants. The holographic AI entity \"Crafter\" (sleek woman in cyberpunk black suit with glowing cyan-green neon lines, short neon-green highlighted hair, confident professional expression, holographic shimmer) appears floating above the blueprint at 1.5s and makes subtle hand gestures directing the arms. Camera slowly pushes in. Voice-over continues: \"ShopyCrafter ensambla, prueba y perfecciona tu tienda como si tuvieras un equipo de 20 especialistas trabajando sin parar.\" Golden light reflections on Crafter and the arms. Music builds with more energy."),
            ("Clip 3.3 (12-18s)", "Golden light bursts + finish",
             "6-second cinematic 8K vertical video. Focus on the blueprint as it becomes more complete and beautiful. Multiple golden light bursts and energy waves appear as sections finish optimizing. Crafter smiles confidently while continuing to direct the robotic arms. Camera does a slow 360° orbit around the now almost-finished glowing blueprint. Strong cinematic lighting with golden god rays. Voice-over: \"Construimos tu tienda perfecta.\" Music reaches a powerful swell with golden brass elements at 15s. Extremely detailed, high contrast, premium quality."),
            ("Clip 3.4 (18-24s)", "Finished blueprint + logo",
             "6-second cinematic 8K vertical video. The robotic arms slowly retract and disappear elegantly. The finished glowing golden Shopify store blueprint floats proudly in the center, rotating slowly. Crafter stands beside it with a satisfied expression, arms crossed. Large elegant gold text appears: \"Construimos tu tienda perfecta\". ShopyCrafter logo + tagline \"Ingeniería de E-commerce con IA\" appears bottom right with soft glow. Slow zoom out. Music resolves with a triumphant final hit. Cinematic, emotional, premium advertisement ending."),
        ]),
        # VIDEO 4
        ("VIDEO 4 – DASHBOARD DORADO (18s)", [
            ("Clip 4.1 (0-6s)", "Graphs start rising + first line",
             "6-second cinematic 8K vertical video, corporate tech aesthetic with golden neon. Sleek modern business dashboard floating in a blurred high-end fashion retail background. Golden conversion rate graphs start rising dramatically across the wide screen with beautiful light trails and particle effects. Slow camera push-in from wide to medium. Voice-over (confident professional Spanish female voice): \"+347% de conversión en 90 días.\" Music: uplifting cinematic synthwave with powerful golden swells. Ultra-detailed, high contrast, premium quality."),
            ("Clip 4.2 (6-12s)", "Crafter appears + more metrics",
             "6-second cinematic 8K vertical video. The golden graphs continue skyrocketing. Multiple smaller green optimization metrics pop up around the main chart with satisfying animations. The holographic Crafter appears on the left side of the dashboard at 1s, arms crossed, watching with a proud expression. Camera slowly orbits to the right. Strong golden glow and lens flares. Voice-over: \"+89% de ingresos por sesión.\" Music builds with big brass hits."),
            ("Clip 4.3 (12-18s)", "Peak explosion + logo",
             "6-second cinematic 8K vertical video. The dashboard reaches its peak with massive golden light explosion and particle burst. Crafter smiles confidently. Large bold gold text appears in the center: \"+347% conversión\". ShopyCrafter logo + \"Pide tu diagnóstico gratis\" appears bottom right. Slow elegant zoom out. Music: triumphant resolution with powerful final hit. Cinematic, emotional, premium advertisement quality."),
        ]),
        # VIDEO 5
        ("VIDEO 5 – SPLIT-SCREEN (25s)", [
            ("Clip 5.1 (0-6s)", "Split appears + first line",
             "6-second cinematic 8K vertical video, high contrast dramatic split-screen. Left side (50%): glitching, slow, grey, laggy Shopify storefront with low red metrics, pixelated images and frustrated loading animations. Right side (50%): sleek glowing golden perfectly optimized Shopify storefront with smooth animations and rising green metrics. Camera slowly pushes in. Voice-over (confident professional Spanish female voice): \"Izquierda: tu tienda hoy.\" Music: dark tense synth with glitch effects on the left side. Cinematic, high contrast."),
            ("Clip 5.2 (6-12s)", "Golden beam transforms + Crafter walks",
             "6-second cinematic 8K vertical video. The split-screen continues. At 2s a bright vertical golden light beam appears in the center and starts moving from left to right, transforming the grey laggy side into the golden optimized version as it passes. The holographic Crafter walks from the grey side into the golden side following the beam. Camera follows her movement. Voice-over: \"Derecha: tu tienda con ShopyCrafter.\" Music: tension builds dramatically."),
            ("Clip 5.3 (12-18s)", "Full transformation + text",
             "6-second cinematic 8K vertical video. The golden light beam finishes transforming the entire left side. Now both sides are glowing golden and perfect. Crafter stands in the center with a powerful expression. Big elegant gold text appears across the screen: \"Antes. Después. ShopyCrafter.\". Strong golden god rays and particles. Voice-over: \"La diferencia no es magia. Es ingeniería con IA.\" Music reaches peak intensity."),
            ("Clip 5.4 (18-25s)", "Logo + final resolution",
             "6-second cinematic 8K vertical video. The split-screen effect dissolves elegantly into one full golden optimized Shopify store. Crafter stands in front with a confident smile. ShopyCrafter logo + tagline appears bottom center with beautiful glow. Slow zoom out revealing the full cinematic scene. Music: powerful triumphant resolution with final hit. Premium cinematic ending, emotional and impactful."),
        ]),
        # VIDEO 6
        ("VIDEO 6 – HERO CTA (20s)", [
            ("Clip 6.1 (0-6s)", "Crafter centered + orbiting scenes",
             "6-second cinematic 8K vertical video, epic closing. Wide futuristic command center. The holographic Crafter stands in the center. All previous scenes (command center, magnifying glass, robotic arms, golden dashboard, split-screen) orbit around her as glowing holographic planets in a beautiful wide composition. Slow 360° camera orbit. Voice-over (confident professional Spanish female voice, warm and powerful): \"ShopyCrafter no es otra herramienta.\" Music: full cinematic synthwave hybrid with emotional pads and rising energy. Ultra cinematic, premium quality."),
            ("Clip 6.2 (6-12s)", "Direct to camera + second line",
             "6-second cinematic 8K vertical video. Crafter continues in the center as the holographic scenes orbit around her. Golden particles and data streams flow beautifully. She looks directly at camera with a confident and inspiring expression. Voice-over: \"Es el equipo de e-commerce que siempre quisiste… pero con IA que nunca duerme.\" Music builds to emotional peak. Cinematic lighting, high detail."),
            ("Clip 6.3 (12-18s)", "Final text + logo",
             "6-second cinematic 8K vertical video. The orbiting scenes slowly fade. Large powerful gold text appears: \"Gestionamos tu Shopify. Tú solo vendes.\" Crafter smiles warmly. ShopyCrafter logo + \"Solicita tu diagnóstico gratuito de 48h\" + website appears elegantly. Slow zoom out with golden light rays. Music: full triumphant resolution with powerful final hit. Emotional cinematic ending."),
            ("Clip 6.4 (18-20s) - Opcional", "Logo hold / end card",
             "6-second cinematic 8K vertical video. Clean elegant hold on the final frame with ShopyCrafter logo centered, golden particles gently floating, and tagline \"Ingeniería de E-commerce con IA\". Soft golden glow. Music: clean fade out. Perfect for logo end card."),
        ]),
    ]

    for video_title, clips in all_clips:
        story.append(Paragraph(video_title, st['Section']))
        for clip_title, desc, prompt in clips:
            story.append(Paragraph(f"<b>{clip_title}</b> — {desc}", st['ClipTitle']))
            story.append(Paragraph(prompt, st['Prompt']))
        story.append(Spacer(1, 6))

    story.append(PageBreak())

    # FINAL TIPS
    story.append(Paragraph("CONSEJOS FINALES PARA MÁXIMA CALIDAD", st['Section']))
    story.append(Paragraph("""
    <b>1. Orden de generación recomendado:</b><br/>
    Genera primero todos los clips de Video 1, luego Video 2, etc. Esto ayuda a mantener consistencia de estilo en Grok Imagine.<br/><br/>
    <b>2. Character Reference:</b> Usa siempre la misma imagen de Crafter como referencia en todos los clips (IP-Adapter / Character Lock / Image Reference).<br/><br/>
    <b>3. Música:</b> Exporta una pista de música continua de 2:10 primero, luego sincroniza los clips encima.<br/><br/>
    <b>4. Transiciones:</b> Usa "Golden Light Wipe", "Particle Burst" o "Energy Dissolve" entre clips para flujo cinematográfico.<br/><br/>
    <b>5. Color Grading:</b> Aplica el mismo LUT (dark teal shadows + golden highlights) a todos los clips después de generarlos.
    """, st['Body']))
    story.append(Spacer(1, 15))
    story.append(Paragraph("SHOPYCRAFTER – Ingeniería de E-commerce con IA", st['Sub']))
    story.append(Paragraph("Todo listo para generar. ¡Que los vídeos queden espectaculares!", st['Highlight']))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"✅ PDF generado: {OUTPUT}")

if __name__ == "__main__":
    build()