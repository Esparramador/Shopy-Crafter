#!/usr/bin/env python3
"""
Universal AI Advertising Playbook - Real Campaign Examples
5 Detailed Case Studies Using the Universal System
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

OUTPUT = "/home/workdir/artifacts/Universal_Playbook_Examples.pdf"

def styles():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle(name='MainTitle', fontSize=16, textColor=BLUE, alignment=TA_CENTER, spaceAfter=8, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Sub', fontSize=10, textColor=NEON, alignment=TA_CENTER, spaceAfter=12))
    s.add(ParagraphStyle(name='Section', fontSize=11, textColor=BLUE, spaceBefore=10, spaceAfter=5, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Example', fontSize=10, textColor=CYAN, spaceBefore=6, spaceAfter=3, fontName='Helvetica-Bold'))
    s.add(ParagraphStyle(name='Body', fontSize=8, textColor=WHITE, alignment=TA_JUSTIFY, spaceAfter=4, leading=10))
    s.add(ParagraphStyle(name='Prompt', fontSize=6, textColor=GRAY, fontName='Courier', leading=7.5, leftIndent=3, rightIndent=3, spaceAfter=5, backColor=DARK_GRAY))
    s.add(ParagraphStyle(name='Footer', fontSize=6, textColor=HexColor("#888888"), alignment=TA_CENTER))
    return s

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(DARK)
    canvas.rect(0, A4[1]-24, A4[0], 24, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.setFont('Helvetica-Bold', 7)
    canvas.drawString(10, A4[1]-16, "UNIVERSAL AI ADVERTISING PLAYBOOK | Real Campaign Examples")
    canvas.setFillColor(DARK)
    canvas.rect(0, 0, A4[0], 18, fill=1, stroke=0)
    canvas.setFillColor(NEON)
    canvas.setFont('Helvetica', 6)
    canvas.drawCentredString(A4[0]/2, 5, f"Generated {datetime.now().strftime('%Y-%m-%d')} | 5 Real-World Style Examples")
    canvas.restoreState()

def build():
    doc = SimpleDocTemplate(OUTPUT, pagesize=A4, rightMargin=12, leftMargin=12, topMargin=35, bottomMargin=22)
    st = styles()
    story = []

    # COVER
    story.append(Spacer(1, 30))
    story.append(Paragraph("UNIVERSAL AI ADVERTISING PLAYBOOK", st['MainTitle']))
    story.append(Paragraph("5 REAL-WORLD CAMPAIGN EXAMPLES", st['Sub']))
    story.append(Paragraph("How to Apply the System to Any Brand, Product & Objective", st['Body']))
    story.append(Spacer(1, 15))

    # EXAMPLE 1 - FASHION
    story.append(Paragraph("EXAMPLE 1: FASHION / DTC CLOTHING BRAND", st['Section']))
    story.append(Paragraph("<b>Brand:</b> \"Lumina\" – Sustainable streetwear brand (hypothetical)", st['Body']))
    story.append(Paragraph("<b>Campaign Objective:</b> Product Launch + Conversion (new collection)", st['Body']))
    story.append(Paragraph("<b>UGC Style Chosen:</b> Lifestyle + \"Get Ready With Me\" + Try-on", st['Body']))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>6-Second Prompt Example (Clip 1):</b>", st['Body']))
    story.append(Paragraph("6-second vertical video in realistic UGC vlog style, natural morning lighting, slight handheld camera feel. Confident 26-year-old woman (Lumina founder vibe, modern street style, natural makeup, short hair) speaking directly to camera with perfect lip sync: \"This new collection is made from 100% recycled materials... but it feels like luxury.\" Warm authentic lighting, city apartment background. High quality, natural skin texture.", st['Prompt']))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>Why it works:</b> Combines sustainability story + emotional benefit + visual proof in 6 seconds. Perfect for Instagram Reels and TikTok.", st['Body']))
    story.append(Spacer(1, 8))

    # EXAMPLE 2 - SAAS
    story.append(Paragraph("EXAMPLE 2: SAAS / PRODUCTIVITY TOOL", st['Section']))
    story.append(Paragraph("<b>Brand:</b> \"Flowly\" – AI productivity app for freelancers", st['Body']))
    story.append(Paragraph("<b>Campaign Objective:</b> Conversion + Testimonial style", st['Body']))
    story.append(Paragraph("<b>UGC Style Chosen:</b> Founder talking head + Screen recording hybrid", st['Body']))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>6-Second Prompt Example (Clip 2):</b>", st['Body']))
    story.append(Paragraph("6-second vertical video in realistic UGC style, clean modern desk setup, natural window lighting. 32-year-old male founder speaking directly to camera with perfect lip sync and calm expert tone: \"I used to lose 2 hours every day switching between tools. Now Flowly does it for me.\" Slight natural camera movement, professional but approachable. High quality.", st['Prompt']))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>Why it works:</b> Problem → Solution in 6 seconds + founder authenticity = high trust for SaaS.", st['Body']))
    story.append(Spacer(1, 8))

    # EXAMPLE 3 - ECOMMERCE PHYSICAL
    story.append(Paragraph("EXAMPLE 3: E-COMMERCE PHYSICAL PRODUCT (SUPPLEMENTS)", st['Section']))
    story.append(Paragraph("<b>Brand:</b> \"VitaCore\" – Premium daily supplements for busy professionals", st['Body']))
    story.append(Paragraph("<b>Campaign Objective:</b> Awareness + Conversion (new flavor launch)", st['Body']))
    story.append(Paragraph("<b>UGC Style Chosen:</b> Unboxing + Daily routine + Real use", st['Body']))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>6-Second Prompt Example (Clip 3):</b>", st['Body']))
    story.append(Paragraph("6-second vertical video in realistic UGC style, bright kitchen lighting, slight handheld feel. 29-year-old woman (busy professional look) speaking directly to camera with perfect lip sync and energetic but natural tone: \"This new mango flavor actually makes me look forward to taking my vitamins every morning.\" Real product visible, authentic morning routine vibe. High quality, natural lighting.", st['Prompt']))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>Why it works:</b> Turns a boring product into an emotional daily habit + taste proof.", st['Body']))
    story.append(Spacer(1, 8))

    # EXAMPLE 4 - COACHING
    story.append(Paragraph("EXAMPLE 4: ONLINE COACHING / PERSONAL BRAND", st['Section']))
    story.append(Paragraph("<b>Brand:</b> \"Elena Ruiz\" – Business coach for female entrepreneurs", st['Body']))
    story.append(Paragraph("<b>Campaign Objective:</b> Lead generation + Authority building", st['Body']))
    story.append(Paragraph("<b>UGC Style Chosen:</b> Talking head + Story + Value", st['Body']))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>6-Second Prompt Example (Clip 4):</b>", st['Body']))
    story.append(Paragraph("6-second vertical video in realistic UGC style, bright home office, natural daylight. Elena (38, warm confident presence, professional casual) speaking directly to camera with perfect lip sync and inspiring tone: \"Most women I work with don't need more strategy... they need to stop overthinking and start executing.\" Natural head movement, authentic expert energy. High quality.", st['Prompt']))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>Why it works:</b> Strong insight + emotional trigger in 6 seconds. Perfect for warm audiences and retargeting.", st['Body']))
    story.append(Spacer(1, 8))

    # EXAMPLE 5 - B2B
    story.append(Paragraph("EXAMPLE 5: B2B / ENTERPRISE SOFTWARE", st['Section']))
    story.append(Paragraph("<b>Brand:</b> \"Nexus\" – AI project management platform for mid-size companies", st['Body']))
    story.append(Paragraph("<b>Campaign Objective:</b> Retargeting + Case study style", st['Body']))
    story.append(Paragraph("<b>UGC Style Chosen:</b> Professional talking head + Data + Customer story (more polished UGC)", st['Body']))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>6-Second Prompt Example (Clip 5):</b>", st['Body']))
    story.append(Paragraph("6-second vertical video in realistic but professional UGC style, modern office background, clean lighting. 42-year-old male operations director speaking directly to camera with perfect lip sync and credible tone: \"We reduced project delays by 47% in the first 90 days with Nexus.\" Calm, authoritative, data-driven delivery. High quality, trustworthy B2B feel.", st['Prompt']))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>Why it works:</b> Specific result + credible presenter = high conversion for B2B retargeting.", st['Body']))
    story.append(Spacer(1, 10))

    story.append(Paragraph("SHOPYCRAFTER – Ingeniería de E-commerce con IA | www.shopycrafter.com", st['Footer']))
    story.append(Paragraph("This document shows how the Universal Playbook adapts to any industry and objective.", st['Footer']))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"✅ PDF generado: {OUTPUT}")

if __name__ == "__main__":
    build()