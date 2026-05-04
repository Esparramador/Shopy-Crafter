#!/usr/bin/env python3
"""
AMARO LUXURY CARS - CAMPAÑA COMPLETA 2026
Los 6 Vídeos + Estrategia 30 días + Prompts Adicionales + Identidad Visual
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

OUTPUT = "/home/workdir/artifacts/AmaroLuxuryCars_Campana_Completa_2026.pdf"

def styles():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle(name='MainTitle', fontSize=11, textColor=BLUE, alignment=TA_CENTER, spaceAfter=3, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Sub', fontSize=7.5, textColor=NEON, alignment=TA_CENTER, spaceAfter=5))
    s.add(ParagraphStyle(name='Section', fontSize=8.5, textColor=BLUE, spaceBefore=5, spaceAfter=2, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='SubSection', fontSize=7, textColor=CYAN, spaceBefore=2, spaceAfter=1, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Body', fontSize=6, textColor=WHITE, alignment=TA_JUSTIFY, spaceAfter=1, leading=7.5))
    s.add(ParagraphStyle(name='Prompt', fontSize=4.5, textColor=GRAY, fontName='Courier', leading=5.5, leftIndent=1, rightIndent=1, spaceAfter=2, backColor=DARK_GRAY))
    s.add(ParagraphStyle(name='Footer', fontSize=4.5, textColor=HexColor("#888888"), alignment=TA_CENTER))
    return s

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(DARK)
    canvas.rect(0, A4[1]-16, A4[0], 16, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.setFont('Helvetica-Bold', 4.5)
    canvas.drawString(4, A4[1]-11, "AMARO LUXURY CARS | Campaña Completa 2026 - Los 6 Vídeos + Estrategia 30 días")
    canvas.setFillColor(DARK)
    canvas.rect(0, 0, A4[0], 10, fill=1, stroke=0)
    canvas.setFillColor(NEON)
    canvas.setFont('Helvetica', 4)
    canvas.drawCentredString(A4[0]/2, 2, f"Generated {datetime.now().strftime('%Y-%m-%d')} | Listo para ejecutar")
    canvas.restoreState()

def build():
    doc = SimpleDocTemplate(OUTPUT, pagesize=A4, rightMargin=6, leftMargin=6, topMargin=22, bottomMargin=12)
    st = styles()
    story = []

    # COVER
    story.append(Spacer(1, 6))
    story.append(Paragraph("AMARO LUXURY CARS - CAMPAÑA COMPLETA 2026", st['MainTitle']))
    story.append(Paragraph("Los 6 Vídeos + Estrategia 30 días + Prompts Adicionales + Identidad Visual", st['Sub']))
    story.append(Spacer(1, 4))

    # SECCIÓN A: LOS 6 VÍDEOS
    story.append(Paragraph("A. LOS 6 VÍDEOS COMPLETOS DE LA CAMPAÑA", st['Section']))

    story.append(Paragraph("VÍDEO 1 - EL DESEO (12 seg) - Lamborghini Urus", st['SubSection']))
    story.append(Paragraph("""
12-second vertical video, premium cinematic style, golden hour. Black Lamborghini Urus parked in front of a luxury building in Barcelona. Camera slowly orbits the car (0-6s). At 6s doors open. Man in suit approaches and looks at the car with desire. Camera pushes into the Urus logo. He speaks with perfect lip sync: "Este es el coche que siempre soñé... y hoy lo puedo conducir sin comprarlo."

TEXT: "LAMBORGHINI URUS" at 3s | "HOY LO CONDUCES TÚ" at 8s | "RESERVA AHORA →" at 10s
    """, st['Prompt']))
    story.append(Spacer(1, 2))

    story.append(Paragraph("VÍDEO 2 - LA EXPERIENCIA (14 seg) - Interior + Conducción", st['SubSection']))
    story.append(Paragraph("""
14-second vertical video. Man gets into a black BMW M4 Competition. Camera shows interior (leather, digital dashboard, ambient lighting) in slow motion (0-5s). Then car driving on coastal road at sunset with tracking shot (5-11s). Final shot: man parking and smiling. Speaks: "Este es el sonido del motor. Esta es la sensación de libertad. Sin mantenimiento. Sin límites."

TEXT: "BMW M4 COMPETITION" at 4s | "SIN LÍMITES" at 9s | "RESERVA AHORA →" at 12s
    """, st['Prompt']))
    story.append(Spacer(1, 2))

    story.append(Paragraph("VÍDEO 3 - LA LIBERTAD (10 seg) - Sin compromiso", st['SubSection']))
    story.append(Paragraph("""
10-second vertical video. Man driving a green Lamborghini Urus on highway. Camera shows him smiling, wind in hair, pure joy. Voice-over (or lip sync): "Sin entrada. Sin mantenimiento. Sin límite de kilómetros. Solo tú, el coche y la carretera."

TEXT: "0€ MANTENIMIENTO" at 2s | "KM ILIMITADOS" at 5s | "RESERVA AHORA →" at 8s
    """, st['Prompt']))
    story.append(Spacer(1, 2))

    story.append(Paragraph("VÍDEO 4 - TESTIMONIOS REALES (12 seg)", st['SubSection']))
    story.append(Paragraph("""
12-second vertical video. 3 quick testimonials (different clients):
- Client 1 (man 35): "Alquilé el Urus para mi boda. Fue mágico."
- Client 2 (woman 42): "Llevé el M4 a una reunión de negocios. Impresioné a todos."
- Client 3 (couple): "El mejor regalo de aniversario que nos hemos hecho."

TEXT: "CLIENTES REALES" | "EXPERIENCIAS REALES" | "RESERVA AHORA →"
    """, st['Prompt']))
    story.append(Spacer(1, 2))

    story.append(Paragraph("VÍDEO 5 - DECONSTRUCCIÓN (16 seg) - Cómo funciona", st['SubSection']))
    story.append(Paragraph("""
16-second vertical video. Starts with full fleet (Urus, M4, Ferrari, Lotus). Camera zooms into each car showing details. Timelapse showing how easy it is to rent: choose car → select dates → pay → drive. Voice-over: "Elige tu coche. Elige tus fechas. Paga. Y conduce. Así de fácil."

TEXT: "ELIGE → RESERVA → CONDUCE" at 8s | "ASÍ DE FÁCIL" at 12s
    """, st['Prompt']))
    story.append(Spacer(1, 2))

    story.append(Paragraph("VÍDEO 6 - CTA FINAL (8 seg)", st['SubSection']))
    story.append(Paragraph("""
8-second vertical video. Man standing next to a Ferrari or Urus. Looks at camera with confident smile: "Este fin de semana conduce el coche que siempre quisiste. Reserva ahora y vive la experiencia."

TEXT: "TU COCHE. TU MOMENTO." at 2s | "RESERVA AHORA → WHATSAPP" at 5s
    """, st['Prompt']))
    story.append(PageBreak())

    # SECCIÓN B: ESTRATEGIA 30 DÍAS
    story.append(Paragraph("B. ESTRATEGIA DE CONTENIDO 30 DÍAS PARA INSTAGRAM", st['Section']))
    story.append(Paragraph("""
<b>SEMANA 1 - AWARENESS (Días 1-7)</b>
- Lunes: Foto del logo + claim "Vive el coche que sueñas"
- Martes: Reel - "Los 5 coches más deseados de Amaro" (15 seg)
- Miércoles: Foto de interior de Urus + texto "Este es tu futuro asiento"
- Jueves: Reel - Time-lapse de un coche llegando limpio
- Viernes: Foto de cliente + testimonio corto
- Sábado: Stories con poll "Ferrari o Lamborghini?"
- Domingo: Foto de flota completa + "Elige tu fin de semana"

<b>SEMANA 2 - CONSIDERATION (Días 8-14)</b>
- Lunes: Reel - "Cómo alquilar un superdeportivo en 3 minutos"
- Martes: Foto de M4 CS Touring + specs
- Miércoles: Reel - Conducción real (carretera de noche)
- Jueves: Foto de interior + "Esto es lo que sientes al sentarte"
- Viernes: Testimonio en vídeo (15 seg)
- Sábado: Stories - "Pregúntame lo que quieras sobre alquilar"
- Domingo: Foto de oferta especial de la semana

<b>SEMANA 3 - CONVERSION (Días 15-21)</b>
- Lunes: Reel - "Los 3 errores que cometen los que alquilan por primera vez"
- Martes: Foto de Urus + precio "Desde 299€/día"
- Miércoles: Reel - "Por qué el Urus es el SUV más deseado del mundo"
- Jueves: Foto de cliente feliz + "Este fin de semana podría ser el tuyo"
- Viernes: Oferta flash "20% off en reservas de mayo"
- Sábado: Stories con countdown de la oferta
- Domingo: Foto de flota + "Elige tu coche. Reserva hoy."

<b>SEMANA 4 - RETENTION + UGC (Días 22-30)</b>
- Lunes: Reel - "Los 5 momentos más épicos de nuestros clientes"
- Martes: Foto de Lotus + "El coche más subestimado de nuestra flota"
- Miércoles: Reel - "Un día en la vida de un cliente de Amaro"
- Jueves: Foto de interior de Ferrari + "Esto no se compra. Se vive."
- Viernes: Testimonio en vídeo largo (30 seg)
- Sábado: Stories - "Danos tu opinión y gana un día gratis"
- Domingo: Foto de todos los coches + "Gracias por soñar con nosotros"
    """, st['Body']))
    story.append(Spacer(1, 4))

    # SECCIÓN C: PROMPTS ADICIONALES
    story.append(Paragraph("C. PROMPTS ADICIONALES (LISTOS PARA USAR)", st['Section']))
    story.append(Paragraph("""
<b>PROMPT - TESTIMONIO REAL (15 seg)</b>
15-second vertical video. Real client (or actor) standing next to a Urus: "Alquilé el Lamborghini Urus para mi boda. Fue el mejor día de mi vida. Todo el mundo se quedó mirando. Amaro me lo puso facilísimo. Reservaré otra vez sin duda."

<b>PROMPT - INTERIOR 360º (10 seg)</b>
10-second vertical video. 360º slow rotation inside a Ferrari or Urus. Voice-over: "Este es el interior que solo unos pocos pueden disfrutar... hasta hoy."

<b>PROMPT - COMPARATIVA ANTES/DESPUÉS (12 seg)</b>
12-second vertical video. Split screen: Left = "Antes: soñando con el coche". Right = "Después: conduciendo el Urus". Text: "Deja de soñar. Empieza a conducir."
    """, st['Prompt']))
    story.append(Spacer(1, 4))

    # SECCIÓN D: IDENTIDAD VISUAL
    story.append(Paragraph("D. RECOMENDACIONES DE IDENTIDAD VISUAL", st['Section']))
    story.append(Paragraph("""
<b>Logo actual:</b> Muy bueno (alas doradas + escudo negro). Mantenerlo.

<b>Paleta de colores recomendada:</b>
- Negro profundo (#0A0A0A)
- Dorado metálico (#D4AF37)
- Plata / Blanco roto (#F5F5F5)
- Rojo acento para Ferrari (#C41E3A)

<b>Tipografía recomendada:</b>
- Títulos: Montserrat Bold o Neue Haas Grotesk
- Cuerpo: Inter o Satoshi

<b>Estilo fotográfico:</b>
- Siempre coches limpios y brillantes
- Iluminación dorada o azulada (nunca luz plana)
- Fondos minimalistas o paisajes de ciudad
- Puertas abiertas o capó abierto cuando sea posible
- Modelos diversos (hombres y mujeres 30-50 años)

<b>Hashtags recomendados:</b>
#AmaroLuxuryCars #AlquilerCochesLujo #Barcelona #Madrid #LamborghiniUrus #Ferrari #BMWM4 #ExperienciaUnica #SinCompromiso
    """, st['Body']))
    story.append(Spacer(1, 5))

    story.append(Paragraph("AMARO LUXURY CAR RENTALS | Barcelona & Madrid | Reservas por WhatsApp", st['Footer']))
    story.append(Paragraph("Campaña completa lista para ejecutar. Contacto: @amaroluxurycars", st['Footer']))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"✅ PDF generado: {OUTPUT}")

if __name__ == "__main__":
    build()