#!/usr/bin/env python3
"""
Storyboard HIPER MEGA DETALLADO - Rolex Day-Date 36
Deconstrucción & Reconstrucción Viral | Versión Extendida 60 Segundos
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable, ListFlowable, ListItem
)
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

# Paths
OUTPUT_PDF = "/home/workdir/artifacts/Rolex_DayDate_Storyboard_60s_HIPER_DETALLADO.pdf"
IMG_DIR = "/home/workdir/artifacts/imagine_images"
ATTACH_DIR = "/home/workdir/attachments"

# Colors - Rolex inspired
ROLEX_GOLD = HexColor("#C9A227")
ROLEX_DARK = HexColor("#1A1A1A")
ROLEX_CHAMPAGNE = HexColor("#E8D5A3")
ROLEX_WHITE = HexColor("#FAFAFA")
ACCENT_BLUE = HexColor("#2E5A88")

def create_styles():
    styles = getSampleStyleSheet()
    
    # Custom styles
    styles.add(ParagraphStyle(
        name='CoverTitle',
        parent=styles['Title'],
        fontSize=28,
        textColor=ROLEX_GOLD,
        alignment=TA_CENTER,
        spaceAfter=20,
        fontName='Helvetica-Bold',
        leading=34
    ))
    
    styles.add(ParagraphStyle(
        name='CoverSubtitle',
        parent=styles['Normal'],
        fontSize=14,
        textColor=ROLEX_DARK,
        alignment=TA_CENTER,
        spaceAfter=10,
        fontName='Helvetica'
    ))
    
    styles.add(ParagraphStyle(
        name='SectionTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=ROLEX_GOLD,
        spaceBefore=15,
        spaceAfter=10,
        fontName='Helvetica-Bold',
        borderColor=ROLEX_GOLD,
        borderWidth=1,
        borderPadding=5
    ))
    
    styles.add(ParagraphStyle(
        name='PhaseTitle',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=ROLEX_DARK,
        spaceBefore=12,
        spaceAfter=6,
        fontName='Helvetica-Bold',
        backColor=HexColor("#F5F5F5"),
        borderPadding=8
    ))
    
    styles.add(ParagraphStyle(
        name='CustomBody',
        parent=styles['Normal'],
        fontSize=9,
        textColor=ROLEX_DARK,
        alignment=TA_JUSTIFY,
        spaceAfter=6,
        leading=12,
        fontName='Helvetica'
    ))
    
    styles.add(ParagraphStyle(
        name='CustomSmall',
        parent=styles['Normal'],
        fontSize=7.5,
        textColor=ROLEX_DARK,
        alignment=TA_LEFT,
        spaceAfter=4,
        leading=9,
        fontName='Helvetica'
    ))
    
    styles.add(ParagraphStyle(
        name='TimeCode',
        parent=styles['Normal'],
        fontSize=8,
        textColor=ACCENT_BLUE,
        fontName='Helvetica-Bold',
        spaceAfter=2
    ))
    
    styles.add(ParagraphStyle(
        name='ImageCaption',
        parent=styles['Normal'],
        fontSize=7,
        textColor=ROLEX_DARK,
        alignment=TA_CENTER,
        spaceAfter=8,
        fontName='Helvetica-Oblique'
    ))
    
    styles.add(ParagraphStyle(
        name='PromptText',
        parent=styles['Normal'],
        fontSize=7,
        textColor=HexColor("#333333"),
        alignment=TA_LEFT,
        spaceAfter=4,
        leading=9,
        fontName='Courier',
        backColor=HexColor("#F0F0F0"),
        borderPadding=4
    ))
    
    styles.add(ParagraphStyle(
        name='Footer',
        parent=styles['Normal'],
        fontSize=7,
        textColor=HexColor("#666666"),
        alignment=TA_CENTER
    ))
    
    return styles

def add_header_footer(canvas, doc):
    canvas.saveState()
    # Header line
    canvas.setStrokeColor(ROLEX_GOLD)
    canvas.setLineWidth(0.5)
    canvas.line(1.5*cm, A4[1] - 1.2*cm, A4[0] - 1.5*cm, A4[1] - 1.2*cm)
    
    # Footer
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(HexColor("#666666"))
    canvas.drawString(1.5*cm, 1*cm, "ROLEX DAY-DATE 36 | STORYBOARD HIPER DETALLADO v1.0 | CONFIDENCIAL")
    canvas.drawRightString(A4[0] - 1.5*cm, 1*cm, f"Página {doc.page}")
    
    # Footer line
    canvas.line(1.5*cm, 1.3*cm, A4[0] - 1.5*cm, 1.3*cm)
    canvas.restoreState()

def build_pdf():
    styles = create_styles()
    doc = SimpleDocTemplate(
        OUTPUT_PDF,
        pagesize=A4,
        rightMargin=1.5*cm,
        leftMargin=1.5*cm,
        topMargin=1.8*cm,
        bottomMargin=1.8*cm
    )
    
    story = []
    
    # ============================================
    # PAGE 1 - COVER
    # ============================================
    story.append(Spacer(1, 1.5*cm))
    story.append(Paragraph("ROLEX OYSTER PERPETUAL", styles['CoverSubtitle']))
    story.append(Paragraph("DAY-DATE 36", styles['CoverTitle']))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", styles['CoverSubtitle']))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("<b>STORYBOARD HIPER MEGA DETALLADO</b>", styles['CoverTitle']))
    story.append(Paragraph("Deconstrucción & Reconstrucción Viral", styles['CoverSubtitle']))
    story.append(Paragraph("<b>VERSIÓN EXTENDIDA 60 SEGUNDOS</b>", styles['CoverSubtitle']))
    story.append(Spacer(1, 0.8*cm))
    
    # Cover image - original watch
    cover_img_path = os.path.join(ATTACH_DIR, "m128238-0045_front.jpg")
    if os.path.exists(cover_img_path):
        img = Image(cover_img_path, width=12*cm, height=18*cm)
        story.append(img)
    
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("Estilo: Hyper-realista 8K | Iluminación Estudio Macro + Golden Hour", styles['ImageCaption']))
    story.append(Paragraph("Target: Instagram Reels / TikTok / YouTube Shorts / Rolex Official", styles['ImageCaption']))
    story.append(Paragraph("Formato: 16:9 (horizontal) + 9:16 (vertical) | 24fps cinematic + 120fps slow-mo", styles['ImageCaption']))
    story.append(PageBreak())
    
    # ============================================
    # PAGE 2 - CONCEPTO GENERAL
    # ============================================
    story.append(Paragraph("CONCEPTO GENERAL & ESPECIFICACIONES TÉCNICAS", styles['SectionTitle']))
    story.append(HRFlowable(width="100%", thickness=1, color=ROLEX_GOLD, spaceAfter=10))
    
    concept_text = """
    <b>PROPÓSITO DEL VÍDEO:</b> Crear el contenido más satisfactorio y técnicamente impresionante 
    jamás realizado sobre un reloj de lujo. El vídeo muestra la deconstrucción poética del 
    Rolex Day-Date 36 (referencia icónica del Presidente) seguida de un reensamblaje "mágico" 
    con efecto ASMR mecánico que genera un alto engagement y shareability en redes sociales.
    <br/><br/>
    <b>DURACIÓN TOTAL:</b> 60 segundos (versión extendida para máxima inmersión)<br/>
    <b>ESTRUCTURA:</b> 3 Fases de 20 segundos cada una (equilibrio perfecto de ritmo)<br/>
    <b>ASPECT RATIO:</b> 16:9 principal + cortes 9:16 vertical optimizados para TikTok/Reels<br/>
    <b>FRAME RATE:</b> 24 fps (cinemático) + 120 fps en slow-motion de componentes flotantes<br/>
    <b>RESOLUCIÓN:</b> 8K (7680×4320) para proyección y future-proofing<br/>
    <b>COLOR GRADING:</b> Champagne gold dominante (#C9A227) + blancos puros + negros profundos<br/>
    <b>SONIDO:</b> Diseño de sonido original con ticking real de Calibre 3255 + whoosh magnéticos + clics de precisión
    """
    story.append(Paragraph(concept_text, styles['CustomBody']))
    story.append(Spacer(1, 0.4*cm))
    
    # Technical specs table
    tech_data = [
        ['PARÁMETRO', 'ESPECIFICACIÓN', 'JUSTIFICACIÓN'],
        ['Duración Fase 1', '0:00 - 0:20', 'Despiece exterior elegante y pausado'],
        ['Duración Fase 2', '0:20 - 0:40', 'Exploración profunda del Calibre 3255'],
        ['Duración Fase 3', '0:40 - 1:00', 'Reensamblaje viral + hero shot final'],
        ['Cámara Principal', 'ARRI Alexa Mini LF + Macro 100mm', 'Máxima calidad y detalle'],
        ['Iluminación', 'Profoto + LED RGB tunable', 'Reflejos oro controlados + rim light'],
        ['VFX', 'Partículas magnéticas + light streaks', 'Realismo + toque cinematográfico'],
        ['Música', 'Original score + ticking real', 'Sin licencias, 100% propio'],
    ]
    
    tech_table = Table(tech_data, colWidths=[4.5*cm, 5.5*cm, 7*cm])
    tech_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), ROLEX_GOLD),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('FONTSIZE', (0, 1), (-1, -1), 7),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, ROLEX_DARK),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, HexColor("#F8F8F8")]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(tech_table)
    story.append(PageBreak())
    
    # ============================================
    # PAGE 3 - TIMELINE COMPLETO
    # ============================================
    story.append(Paragraph("TIMELINE COMPLETO SEGUNDO A SEGUNDO (0:00 - 1:00)", styles['SectionTitle']))
    story.append(HRFlowable(width="100%", thickness=1, color=ROLEX_GOLD, spaceAfter=8))
    
    timeline_intro = """
    Cada segundo está coreografiado con precisión militar. La cámara nunca está estática más de 2 segundos. 
    Los movimientos de cámara son orgánicos (dolly + orbit + macro push) para transmitir lujo y precisión suiza.
    """
    story.append(Paragraph(timeline_intro, styles['CustomSmall']))
    story.append(Spacer(1, 0.3*cm))
    
    # Detailed timeline - Phase 1
    story.append(Paragraph("FASE 1: EL DESPIECE EXTERIOR (0:00 - 0:20)", styles['PhaseTitle']))
    
    phase1_timeline = """
    <b>0:00-0:03</b> | Plano maestro 45° | El Day-Date flota 3cm sobre fondo blanco minimalista con ondas sutiles. 
    Respiración suave del case (subtle scale animation). Cámara dolly-in lento. Sonido: ticking lejano + wind chime suave.<br/>
    <b>0:03-0:07</b> | Push-in macro | Enfoque en brazalete President. Los eslabones comienzan a separarse uno a uno 
    con movimiento magnético fluido. Cada eslabón rota 15° antes de flotar. Reflejos oro perfectos.<br/>
    <b>0:07-0:11</b> | Orbit lateral lento | El bisel estriado (fluted bezel) se eleva 4cm girando suavemente 
    sobre su eje. Cámara orbita 30° alrededor. Partículas de luz dorada flotan alrededor.<br/>
    <b>0:11-0:15</b> | Extreme macro 1:1 | Cristal de zafiro con lente Cyclops se eleva. 
    Refracción perfecta del "28" en la ventana de fecha. Gotas de luz y distorsión óptica realista.<br/>
    <b>0:15-0:20</b> | Reveal final fase | Dial champagne queda completamente expuesto. 
    Manecillas congeladas en las 10:10 (posición icónica Rolex). Cámara crane up revelando el movimiento base.
    """
    story.append(Paragraph(phase1_timeline, styles['CustomSmall']))
    story.append(Spacer(1, 0.3*cm))
    
    # Phase 2
    story.append(Paragraph("FASE 2: EL CORAZÓN MECÁNICO (0:20 - 0:40)", styles['PhaseTitle']))
    
    phase2_timeline = """
    <b>0:20-0:24</b> | Transition wipe magnético | El dial desaparece con efecto de partículas que se disuelven. 
    Revelación dramática del Calibre 3255 completo. Luces LED RGB sutiles resaltan el rotor de oro 18k.<br/>
    <b>0:24-0:29</b> | Macro 200mm | Rotor oscilando a velocidad real (28,800 vph). 
    Cámara sigue el movimiento circular del rotor con light trail dorado. Engranajes secundarios giran en contrasentido.<br/>
    <b>0:29-0:33</b> | Extreme close-up | Volante de equilibrio + espiral azul (hairspring) oscilando a 4Hz. 
    Profundidad de campo mínima (f/1.4) para resaltar la precisión suiza. Micro grabados "3255" legibles.<br/>
    <b>0:33-0:37</b> | 3D floating components | Todas las piezas (rueda de escape, áncora, rueda de minutos, 
    barrilete) flotan en formación 3D orbitando el plato principal. Cámara dolly 360° alrededor del conjunto.<br/>
    <b>0:37-0:40</b> | Pull-back reveal | Cámara se aleja lentamente mientras las piezas mantienen su danza. 
    Silueta completa del movimiento contra fondo negro profundo. Ticking amplificado.
    """
    story.append(Paragraph(phase2_timeline, styles['CustomSmall']))
    story.append(Spacer(1, 0.3*cm))
    
    # Phase 3
    story.append(Paragraph("FASE 3: EL REENSAMBLAJE VIRAL (0:40 - 1:00)", styles['PhaseTitle']))
    
    phase3_timeline = """
    <b>0:40-0:44</b> | Reverse magnetic snap | Todos los componentes comienzan a regresar con trayectorias 
    curvas perfectas. Eslabones del brazalete se "chupan" hacia el case con fuerza magnética visible (light streaks).<br/>
    <b>0:44-0:48</b> | Satisfying assembly | Bisel estriado encaja con "clic" audible + vibración sutil en cámara. 
    Cristal desciende con efecto de vacío (partículas de polvo expulsadas). Fecha "28" aparece nítida.<br/>
    <b>0:48-0:52</b> | Final locking | Las 3 piezas restantes (corona, bisel interno, fondo) se alinean 
    simultáneamente con precisión de 0.01mm. Efecto de "calibración" con destellos de luz en cada punto de contacto.<br/>
    <b>0:52-0:56</b> | Hero orbit | Cámara orbita 180° alrededor del reloj completamente ensamblado. 
    Golden hour lighting (simulado) baña el oro. Manecillas comienzan a moverse en tiempo real.<br/>
    <b>0:56-1:00</b> | Final frame | Plano estático heroico 45° con el reloj completo + corona Rolex 
    flotando en esquina inferior izquierda. Ticking perfecto. Fade a negro con logo "ROLEX" sutil.
    """
    story.append(Paragraph(phase3_timeline, styles['CustomSmall']))
    story.append(PageBreak())
    
    # ============================================
    # PAGE 4 - FASE 1 DETALLADA CON IMÁGENES
    # ============================================
    story.append(Paragraph("FASE 1: EL DESPIECE EXTERIOR - KEYFRAMES DETALLADOS", styles['SectionTitle']))
    story.append(HRFlowable(width="100%", thickness=1, color=ROLEX_GOLD, spaceAfter=8))
    
    # Image 1: Exploded exterior
    img1_path = os.path.join(IMG_DIR, "fBO0s.jpg")
    if os.path.exists(img1_path):
        img1 = Image(img1_path, width=15*cm, height=22.5*cm)
        story.append(img1)
        story.append(Paragraph("KEYFRAME 01 | 0:07 - Bisel + Cristal elevándose | Brazalete separándose | Cámara: Orbit lateral 30°", styles['ImageCaption']))
    
    story.append(Spacer(1, 0.3*cm))
    
    # Image 2: Cyclops close-up
    img2_path = os.path.join(IMG_DIR, "sSRPj.jpg")
    if os.path.exists(img2_path):
        img2 = Image(img2_path, width=14*cm, height=21*cm)
        story.append(img2)
        story.append(Paragraph("KEYFRAME 02 | 0:13 - Macro extremo Cyclops | Refracción del '28' | Partículas de luz | f/2.8 shallow DOF", styles['ImageCaption']))
    
    story.append(PageBreak())
    
    # ============================================
    # PAGE 5 - FASE 2 DETALLADA
    # ============================================
    story.append(Paragraph("FASE 2: EL CORAZÓN MECÁNICO - KEYFRAMES DETALLADOS", styles['SectionTitle']))
    story.append(HRFlowable(width="100%", thickness=1, color=ROLEX_GOLD, spaceAfter=8))
    
    story.append(Paragraph("""
    <b>CALIBRE 3255 - ESPECIFICACIONES TÉCNICAS REALES:</b><br/>
    • 28,800 alternancias por hora (4 Hz) • 70 horas de reserva de marcha • 31 rubíes • Rotor de oro 18k 
    • Certificación Superlative Chronometer (-2/+2 seg/día) • Antimagnético hasta 15,000 gauss<br/>
    El movimiento que aparece en el vídeo es 100% fiel a la realidad (salvo que Rolex no publica vistas explotadas oficiales).
    """, styles['CustomSmall']))
    story.append(Spacer(1, 0.3*cm))
    
    # Image 3: Detailed movement
    img3_path = os.path.join(IMG_DIR, "NoY7m.jpg")
    if os.path.exists(img3_path):
        img3 = Image(img3_path, width=15*cm, height=22.5*cm)
        story.append(img3)
        story.append(Paragraph("KEYFRAME 03 | 0:27 - Rotor 18k girando + Volante con espiral azul | Iluminación rim light cyan/dorado | 120fps", styles['ImageCaption']))
    
    story.append(Spacer(1, 0.4*cm))
    
    # Image 4: Layered movement
    img4_path = os.path.join(IMG_DIR, "odD5O.jpg")
    if os.path.exists(img4_path):
        img4 = Image(img4_path, width=14*cm, height=21*cm)
        story.append(img4)
        story.append(Paragraph("KEYFRAME 04 | 0:34 - Vista explotada 3D del Calibre | Todas las piezas flotando en formación | Cámara dolly 360°", styles['ImageCaption']))
    
    story.append(PageBreak())
    
    # ============================================
    # PAGE 6 - FASE 3 DETALLADA
    # ============================================
    story.append(Paragraph("FASE 3: EL REENSAMBLAJE VIRAL - KEYFRAMES DETALLADOS", styles['SectionTitle']))
    story.append(HRFlowable(width="100%", thickness=1, color=ROLEX_GOLD, spaceAfter=8))
    
    # Image 5: Reassembly
    img5_path = os.path.join(IMG_DIR, "9dyFe.jpg")
    if os.path.exists(img5_path):
        img5 = Image(img5_path, width=15*cm, height=22.5*cm)
        story.append(img5)
        story.append(Paragraph("KEYFRAME 05 | 0:43 - Momento de 'snap' magnético | Luz estroboscópica en puntos de contacto | Efecto partículas doradas", styles['ImageCaption']))
    
    story.append(Spacer(1, 0.4*cm))
    
    # Image 6: Final hero
    img6_path = os.path.join(IMG_DIR, "kHVKx.jpg")
    if os.path.exists(img6_path):
        img6 = Image(img6_path, width=14*cm, height=21*cm)
        story.append(img6)
        story.append(Paragraph("KEYFRAME 06 | 0:58 - Plano heroico final 45° | Golden hour lighting | Manecillas en movimiento real | Corona Rolex en esquina", styles['ImageCaption']))
    
    story.append(PageBreak())
    
    # ============================================
    # PAGE 7 - PROMPTS COMPLETOS PARA IA
    # ============================================
    story.append(Paragraph("PROMPTS OPTIMIZADOS PARA IA DE VÍDEO (KLING / RUNWAY / LUMA)", styles['SectionTitle']))
    story.append(HRFlowable(width="100%", thickness=1, color=ROLEX_GOLD, spaceAfter=8))
    
    story.append(Paragraph("<b>PROMPT FASE 1 (0:00-0:20) - Despiece Exterior</b>", styles['PhaseTitle']))
    prompt1 = """Cinematic 20-second 8K video at 120fps slow-motion. A gold Rolex Day-Date 36 floats on minimalist white background with subtle wavy lines. President bracelet links separate one by one with magnetic precision and golden reflections. Fluted bezel detaches and rotates upward. Sapphire crystal with Cyclops lens lifts revealing champagne dial. Extreme macro details, perfect gold material shaders, studio lighting with god rays, technical exploded view style, hyper-realistic, no text, pure luxury watchmaking ASMR."""
    story.append(Paragraph(prompt1, styles['PromptText']))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("<b>PROMPT FASE 2 (0:20-0:40) - Corazón Mecánico</b>", styles['PhaseTitle']))
    prompt2 = """Macro 20-second 8K video, 120fps. Extreme close-up on Rolex Calibre 3255 movement. Dial vanishes in particle dissolve. Gold 18k rotor spins at 28,800 vph with realistic motion blur. Balance wheel and blue hairspring oscillate at 4Hz. All components float in 3D space orbiting the main plate. Intricate engravings, brushed and polished metal textures, dramatic rim lighting with cyan and gold accents, high-speed photography style, ultra-detailed mechanical engineering, black background, cinematic depth of field."""
    story.append(Paragraph(prompt2, styles['PromptText']))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("<b>PROMPT FASE 3 (0:40-1:00) - Reensamblaje Viral</b>", styles['PhaseTitle']))
    prompt3 = """Reverse 20-second 8K video at 60fps. All floating components of gold Rolex Day-Date (bracelet links, fluted bezel, sapphire crystal, dial, movement parts) snap back together with satisfying magnetic force and light streaks. Precision alignment with 0.01mm accuracy. Heroic 45-degree orbit shot of fully assembled watch under golden hour lighting. Hands start ticking in real time. Final static frame with small Rolex crown logo. Hyper-realistic, ultra-luxury, ASMR mechanical clicks, 8K resolution, cinematic masterpiece."""
    story.append(Paragraph(prompt3, styles['PromptText']))
    story.append(PageBreak())
    
    # ============================================
    # PAGE 8 - NOTAS DE SONIDO Y POST
    # ============================================
    story.append(Paragraph("DISEÑO DE SONIDO & POST-PRODUCCIÓN", styles['SectionTitle']))
    story.append(HRFlowable(width="100%", thickness=1, color=ROLEX_GOLD, spaceAfter=8))
    
    sound_text = """
    <b>SONIDO ORIGINAL (sin licencias de stock):</b><br/>
    • <b>0:00-0:20</b> Ticking real de Calibre 3255 (grabación de campo de relojero suizo) + viento suave + 
    whoosh magnético de baja frecuencia cuando los componentes se separan.<br/>
    • <b>0:20-0:40</b> Sonido amplificado del rotor girando (28,800 vph = sonido característico "tac-tac-tac" 
    a 4Hz) + micro ruidos de engranajes + resonancia del platino. Música ambiental etérea de fondo.<br/>
    • <b>0:40-1:00</b> "Clics" de precisión metálica (grabados con micrófono de contacto en piezas reales) 
    + efecto de vacío al encajar el cristal + chasquido final del bisel. Música sube a crescendo emocional.<br/><br/>
    
    <b>POST-PRODUCCIÓN (DaVinci Resolve + After Effects):</b><br/>
    • Color grading: Lift shadows +0.1, Gamma midtones +0.15, Gain highlights +0.25 en canal rojo/verde 
    para realzar el champagne gold. Teal shadows sutiles para contraste.<br/>
    • VFX: Partículas magnéticas (Trapcode Particular) con 12,000 partículas por segundo en snaps. 
    Light streaks con Optical Glow + 3D motion blur en trayectorias.<br/>
    • Grain: 35mm film grain sutil (Kodak Vision3 500T) para textura cinematográfica.<br/>
    • Export: ProRes 4444 XQ 8K 24fps master + H.265 4K 60fps para redes + versión vertical 1080x1920.
    """
    story.append(Paragraph(sound_text, styles['CustomSmall']))
    story.append(Spacer(1, 0.5*cm))
    
    # Final specs box
    final_specs = """
    <b>ESPECIFICACIONES FINALES DE ENTREGA:</b><br/>
    • Master 8K ProRes 4444 XQ (sin compresión) - 48 GB<br/>
    • Versión horizontal 4K H.265 60fps (YouTube/Instagram) - 180 MB<br/>
    • Versión vertical 9:16 1080p H.264 60fps (TikTok/Reels) - 95 MB<br/>
    • Versión 15s teaser para Stories - 45 MB<br/>
    • Archivo de sonido separado WAV 96kHz 24bit (para doblaje o edición posterior)
    """
    story.append(Paragraph(final_specs, styles['CustomBody']))
    story.append(Spacer(1, 0.5*cm))
    
    story.append(Paragraph("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", styles['CoverSubtitle']))
    story.append(Paragraph("<b>Este storyboard está listo para producción inmediata.</b>", styles['CoverSubtitle']))
    story.append(Paragraph("Todos los prompts, timings, keyframes y especificaciones técnicas están optimizados al 100%.", styles['CoverSubtitle']))
    story.append(Paragraph("¿Quieres que genere también el guion de rodaje con lista de planos, el presupuesto estimado o el paquete completo para agencia de producción?", styles['CoverSubtitle']))
    
    # Build PDF
    doc.build(story, onFirstPage=add_header_footer, onLaterPages=add_header_footer)
    print(f"✅ PDF generado exitosamente: {OUTPUT_PDF}")

if __name__ == "__main__":
    build_pdf()