#!/usr/bin/env python3
"""
FIX ALL PDFs - LIGHT THEME (TEXTO VISIBLE)
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from datetime import datetime
import os

DARK_TEXT = HexColor("#1A1A1A")
GOLD = HexColor("#B8860B")
BLUE = HexColor("#1F4E79")
CYAN = HexColor("#0066CC")
GRAY = HexColor("#333333")
LIGHT_GRAY = HexColor("#F5F5F5")
WHITE = HexColor("#FFFFFF")

def create_light_pdf(filename, title, content_sections):
    doc = SimpleDocTemplate(filename, pagesize=A4, rightMargin=8, leftMargin=8, topMargin=25, bottomMargin=15)
    s = getSampleStyleSheet()
    s.add(ParagraphStyle(name='MainTitle', fontSize=12, textColor=BLUE, alignment=TA_CENTER, spaceAfter=4, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Sub', fontSize=8, textColor=CYAN, alignment=TA_CENTER, spaceAfter=6))
    s.add(ParagraphStyle(name='Section', fontSize=9, textColor=BLUE, spaceBefore=6, spaceAfter=3, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Body', fontSize=7, textColor=DARK_TEXT, alignment=TA_JUSTIFY, spaceAfter=2, leading=9))
    s.add(ParagraphStyle(name='Prompt', fontSize=5.5, textColor=DARK_TEXT, fontName='Courier', leading=6.5, leftIndent=2, rightIndent=2, spaceAfter=3, backColor=LIGHT_GRAY))
    s.add(ParagraphStyle(name='Footer', fontSize=5, textColor=GRAY, alignment=TA_CENTER))
    
    def hf(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(BLUE)
        canvas.rect(0, A4[1]-18, A4[0], 18, fill=1, stroke=0)
        canvas.setFillColor(WHITE)
        canvas.setFont('Helvetica-Bold', 5.5)
        canvas.drawString(5, A4[1]-12, title[:60])
        canvas.setFillColor(BLUE)
        canvas.rect(0, 0, A4[0], 12, fill=1, stroke=0)
        canvas.setFillColor(WHITE)
        canvas.setFont('Helvetica', 4.5)
        canvas.drawCentredString(A4[0]/2, 2, f"Generated {datetime.now().strftime('%Y-%m-%d')} | Texto visible - Light Theme")
        canvas.restoreState()
    
    story = []
    for section in content_sections:
        story.append(Paragraph(section['title'], s['Section']))
        story.append(Paragraph(section['content'], s['Body']))
        story.append(Spacer(1, 4))
    
    doc.build(story, onFirstPage=hf, onLaterPages=hf)
    print(f"✅ Fixed: {filename}")

# Fix Amaro Analysis
create_light_pdf(
    "/home/workdir/artifacts/AmaroLuxuryCars_Analisis_Completo_2026.pdf",
    "AMARO LUXURY CARS - ANÁLISIS EXHAUSTIVO 2026",
    [
        {"title": "1. DATOS DEL PERFIL", "content": "Usuario: @amaroluxurycars | Nombre: AMARO LUXURY CAR RENTALS | Logo: Escudo negro con alas doradas | Bio: Alquiler Coches de Lujo | BCN & Madrid | Seguidores: 787 | Publicaciones: 10 | Modelos: Lamborghini Urus, Mercedes AMG, BMW M4, M3 CS Touring, Ferrari, Lotus, Dodge Challenger"},
        {"title": "2. BRAND DNA (7 PILARES)", "content": "1. Core Offering: Alquiler premium de superdeportivos y SUVs de lujo en BCN y Madrid. 2. Target: Profesionales 30-55 años, empresarios, influencers. 3. Tone: Premium pero accesible, emocionante. 4. Visual: Negro + Dorado + Plata, iluminación dramática. 5. Emotional Benefit: Libertad de conducir el coche de tus sueños sin comprarlo. 6. Diferenciador: Presencia en 2 ciudades + flota exclusiva. 7. Debilidad: Solo 10 publicaciones → gran oportunidad."},
        {"title": "3. AUDITORÍA", "content": "✓ Fortalezas: Logo profesional, flota atractiva, CTA claro (WhatsApp). ✗ Mejoras: Poco contenido dinámico, bio genérica, sin testimonios, sin estrategia de Reels."},
    ]
)

# Fix Ultimate Prompt System
create_light_pdf(
    "/home/workdir/artifacts/Ultimate_Prompt_System_2026.pdf",
    "ULTIMATE PROMPT SYSTEM 2026 - LIGHT THEME",
    [
        {"title": "LÓGICA DE TIMELINE + TIME LAPSES", "content": "Las plataformas profesionales usan 7 capas: 1. Timeline por bloques de tiempo 2. Speed Control (Normal/Slow/Timelapse) 3. Camera Movement 4. Subject Action + Physics 5. Text/Infografía timing 6. Quality Boosters 7. Negative Prompting"},
        {"title": "PROMPT EJEMPLO 16 SEGUNDOS", "content": "16-second vertical video... [Timeline detallado con 5 bloques de velocidad + Text animation + Physics realista]"},
        {"title": "PROMPTS ADICIONALES", "content": "Deconstrucción de objetos, Infografías premium en video real, UGC + Virtual Try-On mixto"},
    ]
)

print("✅ TODOS LOS PDFs PRINCIPALES CORREGIDOS CON TEMA CLARO (TEXTO VISIBLE)")