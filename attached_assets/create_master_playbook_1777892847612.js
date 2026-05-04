const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
        Header, Footer, AlignmentType, HeadingLevel, PageBreak, 
        LevelFormat, BorderStyle, WidthType, ShadingType, PageNumber } = require('docx');
const fs = require('fs');

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: "1F4E79" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "2E75B6" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "5B9BD5" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [{
    properties: {
      page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } }
    },
    headers: {
      default: new Header({ children: [new Paragraph({
        children: [new TextRun({ text: "SHOPYCRAFTER – Master Campaign Playbook | Confidential", size: 18, color: "666666" })]
      })] })
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Page ", size: 18 }), new TextRun({ children: [PageNumber.CURRENT], size: 18 })]
      })] })
    },
    children: [

      // ========== TITLE PAGE ==========
      new Paragraph({ spacing: { before: 1200 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "SHOPYCRAFTER", size: 56, bold: true, color: "1F4E79" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: "MASTER CAMPAIGN PLAYBOOK", size: 36, bold: true, color: "2E75B6" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ text: "Complete Methodology, Prompt Engineering Framework & Production System", size: 24, color: "5B9BD5" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600 }, children: [new TextRun({ text: "How to Extract Brand DNA, Design Campaigns & Build Any Prompt", size: 22 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: "Video • Audio • Lip Sync • Images • Briefs • Analysis", size: 20, color: "666666" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 800 }, children: [new TextRun({ text: "Generated: May 2026 | Version 1.0", size: 18, color: "888888" })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ========== TABLE OF CONTENTS ==========
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("TABLE OF CONTENTS")] }),
      new Paragraph({ children: [new TextRun("1. Executive Summary & Purpose")] }),
      new Paragraph({ children: [new TextRun("2. Brand DNA Extraction Process")] }),
      new Paragraph({ children: [new TextRun("3. Campaign Strategy Framework")] }),
      new Paragraph({ children: [new TextRun("4. Creative Direction & Visual Language")] }),
      new Paragraph({ children: [new TextRun("5. Prompt Engineering Masterclass")] }),
      new Paragraph({ children: [new TextRun("   5.1 Video Prompts (Cinematic vs UGC + Lip Sync)")] }),
      new Paragraph({ children: [new TextRun("   5.2 Audio & Voice-over Prompts")] }),
      new Paragraph({ children: [new TextRun("   5.3 Image & Visual Prompts")] }),
      new Paragraph({ children: [new TextRun("   5.4 Brief & Analysis Prompts")] }),
      new Paragraph({ children: [new TextRun("6. Production Pipeline (6-Second Clips → Master Cut)")] }),
      new Paragraph({ children: [new TextRun("7. Tools, Resources & Capabilities Used")] }),
      new Paragraph({ children: [new TextRun("8. Templates & Replicable Frameworks")] }),
      new Paragraph({ children: [new TextRun("9. How to Apply to Any Brand")] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ========== 1. EXECUTIVE SUMMARY ==========
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. EXECUTIVE SUMMARY & PURPOSE")] }),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun("This document is the complete, replicable methodology used to create the ShopyCrafter advertising campaign from scratch. It covers every step: from brand DNA extraction to final video production, including all prompt engineering techniques, creative decisions, and production systems.")] }),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "Objective of this Playbook:", bold: true }), new TextRun(" Enable any marketer, creative director, or agency to replicate the exact same professional process for any brand, in any industry, using modern AI tools (Grok Imagine, Kling, Runway, Luma, etc.).")] }),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "What makes this methodology unique:", bold: true })] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Hyper-detailed prompt engineering for 6-second micro-clips")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("UGC + Lip Sync hybrid style (highest conversion potential)")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Intelligent concatenation system for master cuts")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Complete brand DNA extraction framework")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Ready-to-use templates for briefs, prompts, and analysis")] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ========== 2. BRAND DNA EXTRACTION ==========
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("2. BRAND DNA EXTRACTION PROCESS")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.1 Research Phase")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("Tools used:")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("browse_page on shopycrafter.com + Instagram @shopycrafter")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("web_search for \"ShopyCrafter Shopify IA\"")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("x_user_search for brand presence")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.2 DNA Extraction Framework (4 Pillars)")] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Pillar 1 – Core Offering: ", bold: true }), new TextRun("Gestión inteligente de tiendas Shopify con IA 24/7")] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Pillar 2 – Tone: ", bold: true }), new TextRun("Técnico + Premium + Español (autoridad sin frialdad)")] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Pillar 3 – Visual DNA: ", bold: true }), new TextRun("Dark cyberpunk + Dorado neón + Verde optimización")] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Pillar 4 – Emotional Benefit: ", bold: true }), new TextRun("\"Si nosotros gestionáramos tu tienda… tus resultados serían otros\"")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.3 Key Insight Discovered")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("ShopyCrafter is not just another tool — it is the \"AI co-pilot that never sleeps\". This insight became the central campaign message.")] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ========== 3. CAMPAIGN STRATEGY ==========
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3. CAMPAIGN STRATEGY FRAMEWORK")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.1 Concept Name")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "\"Si nosotros gestionáramos [tu tienda]\"", bold: true, italics: true })] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.2 Narrative Arc (6 Videos = 1 Film)")] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun("Video 1 → Mystery + Authority (Command Center)")] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun("Video 2 → Deep Analysis (Lupa)")] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun("Video 3 → Construction (Robotic Blueprint)")] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun("Video 4 → Explosive Results (Dashboard)")] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun("Video 5 → Dramatic Transformation (Split-Screen)")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("Video 6 → Powerful CTA (Hero)")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.3 Strategic Decision: UGC + Lip Sync")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("After initial cinematic prompts, we pivoted to UGC + perfect lip sync because it generates higher trust and conversion. This was a key learning documented in this playbook.")] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ========== 4. CREATIVE DIRECTION ==========
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("4. CREATIVE DIRECTION & VISUAL LANGUAGE")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.1 Two Styles Developed")] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Style A – Cinematic Cyberpunk Corporate: ", bold: true }), new TextRun("High-end, dark, golden neon, holographic Crafter (used in initial versions)")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "Style B – UGC Talking Head + Lip Sync: ", bold: true }), new TextRun("Real woman, direct to camera, natural lighting, authentic vlog feel (final recommended style)")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.2 Character System (Crafter)")] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Cinematic Version: ", bold: true }), new TextRun("Holographic AI entity (female, cyberpunk suit, neon-green hair)")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "UGC Version: ", bold: true }), new TextRun("Real 30-year-old Spanish woman, black blazer with neon green details, short hair with neon highlights, confident expert expression")] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ========== 5. PROMPT ENGINEERING MASTERCLASS ==========
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("5. PROMPT ENGINEERING MASTERCLASS")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5.1 Core Prompt Architecture (Universal Formula)")] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Formula: ", bold: true }), new TextRun("[Duration + Style] + [Subject + Action] + [Camera + Lighting] + [Voice + Lip Sync] + [Music + Ending] + [Quality Boosters]")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5.2 Video Prompt Templates")] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Cinematic 6-second Template:", bold: true })] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "\"6-second cinematic 8K vertical video, dark cyberpunk corporate aesthetic, golden neon + glowing green accents. [Specific action]. Voice-over (confident professional Spanish female voice): \\\"[Exact line]\\\". Music: [music description]. Ultra-detailed, film grain, premium quality.\"", italics: true })] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "UGC + Lip Sync 6-second Template:", bold: true })] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "\"6-second vertical video in realistic UGC vlog style, natural lighting, slight handheld camera feel, authentic talking-head aesthetic. Confident 30-year-old Spanish woman [description] speaking directly to camera with perfect lip sync — her mouth moves naturally and exactly in sync with the voice. She says: \\\"[Exact line]\\\". Warm authentic lighting. High quality.\"", italics: true })] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5.3 Audio / Voice-over Prompt Template")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "\"Professional Spanish female voice, 30-35 years old, warm but authoritative, modern tech tone, clear diction, natural rhythm, confident and inspiring delivery. Record in 48kHz 24-bit. Perfect lip sync required.\"", italics: true })] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5.4 Image Prompt Template")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "\"[Scene description], 8K photorealistic, [lighting], [mood], ShopyCrafter logo in elegant gold neon bottom right, large gold headline: \\\"[Text]\\\", tagline \\\"Ingeniería de E-commerce con IA\\\", premium advertisement style, high contrast, cinematic.\"", italics: true })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ========== 6. PRODUCTION PIPELINE ==========
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("6. PRODUCTION PIPELINE (6-Second Clips → Master Cut)")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6.1 Step-by-Step Process")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Generate reference image of Crafter (once)")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Generate all 22 micro-clips in parallel (use same reference image)")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Record voice-over with female voice (use brief)")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Edit in CapCut / Premiere: place clips + sync audio")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Add transitions (Golden Light Wipe / Particle Burst)")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Apply uniform color grading (golden highlights + natural skin)")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Export master cut 2:10 + individual videos")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6.2 Recommended Tools")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Video Generation: Grok Imagine, Kling AI 1.6, Runway Gen-3, Luma Dream Machine")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Editing: CapCut (free + fast) or Premiere Pro / DaVinci Resolve")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Voice: ElevenLabs (Spanish female voices) or professional studio")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Color: Same LUT on all clips (dark teal shadows + golden highlights)")] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ========== 7. TOOLS & RESOURCES ==========
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("7. TOOLS, RESOURCES & CAPABILITIES USED")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("7.1 AI Tools")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Image Generation: Grok Imagine (primary)")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Video Generation: Grok Imagine (6s clips), Kling AI, Runway Gen-3")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Document Creation: reportlab (PDF), docx-js (Word)")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Presentation: PptxGenJS")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("7.2 Research Tools")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("browse_page, web_search, x_user_search")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("7.3 Production Tools")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("CapCut / Premiere Pro / DaVinci Resolve")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("ElevenLabs (voice)")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("zip (file packaging)")] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ========== 8. TEMPLATES ==========
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("8. TEMPLATES & REPLICABLE FRAMEWORKS")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("8.1 Brand DNA Extraction Template")] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "1. Research Phase: ", bold: true }), new TextRun("Website + Social + Reviews + Competitors")] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "2. 4-Pillar Analysis: ", bold: true }), new TextRun("Offering / Tone / Visual DNA / Emotional Benefit")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "3. Key Insight: ", bold: true }), new TextRun("One powerful sentence that becomes the campaign core")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("8.2 Video Prompt Formula (Copy-Paste)")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "[Duration] + [Style] + [Subject + Action] + [Camera] + [Voice + Lip Sync] + [Music] + [Quality]", italics: true })] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("8.3 Campaign Checklist")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Brand DNA extracted and documented")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("6-video narrative arc defined")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Style chosen (UGC vs Cinematic)")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Character reference created")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("All prompts written and tested")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Voice-over brief prepared")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Concatenation plan documented")] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ========== 9. HOW TO APPLY ==========
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("9. HOW TO APPLY TO ANY BRAND (STEP-BY-STEP)")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "Extract Brand DNA: ", bold: true }), new TextRun("Use the 4-Pillar framework")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "Define Narrative Arc: ", bold: true }), new TextRun("6 videos = 1 emotional journey")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "Choose Style: ", bold: true }), new TextRun("UGC + Lip Sync (recommended) or Cinematic")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "Create Character Reference: ", bold: true }), new TextRun("One image used in all clips")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "Write 6-Second Prompts: ", bold: true }), new TextRun("Use the Universal Formula")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "Generate in Parallel: ", bold: true }), new TextRun("All clips at once")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "Record Voice-over: ", bold: true }), new TextRun("Use the brief template")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "Edit & Concatenate: ", bold: true }), new TextRun("Follow the pipeline")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "Export & Launch: ", bold: true }), new TextRun("Individual videos + Master cut")] }),
      new Paragraph({ spacing: { before: 300 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "— END OF PLAYBOOK —", size: 20, bold: true, color: "1F4E79" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100 }, children: [new TextRun({ text: "This document contains the complete professional system used to create the ShopyCrafter campaign.", size: 18, color: "666666" })] }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/home/workdir/artifacts/ShopyCrafter_Master_Playbook.docx", buffer);
  console.log("✅ Word document created: ShopyCrafter_Master_Playbook.docx");
});