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
        children: [new TextRun({ text: "UNIVERSAL AI ADVERTISING PLAYBOOK | Version 2.0 | Confidential", size: 18, color: "666666" })]
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
      new Paragraph({ spacing: { before: 1000 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "UNIVERSAL AI", size: 48, bold: true, color: "1F4E79" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ADVERTISING PLAYBOOK", size: 44, bold: true, color: "2E75B6" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 300 }, children: [new TextRun({ text: "Complete System to Generate High-Converting Ads", size: 26, color: "5B9BD5" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: "for ANY Brand • ANY Product • ANY Campaign Type • ANY UGC Style", size: 22 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ text: "Video • Audio • Lip Sync • Images • Briefs • Strategy", size: 20, color: "666666" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600 }, children: [new TextRun({ text: "Version 2.0 | May 2026", size: 18, color: "888888" })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ========== 1. PURPOSE ==========
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. PURPOSE OF THIS PLAYBOOK")] }),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun("This is the complete, professional system used to create high-converting advertising campaigns using modern AI tools. It is designed to be 100% universal — it works for any company, any product, any service, any campaign objective, and any UGC style.")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "What you will be able to do after reading this document:", bold: true })] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Extract Brand DNA from any company in under 30 minutes")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Design complete 6-video campaigns for any objective")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Write professional prompts for video, audio, lip sync, and images")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Choose the best UGC style for each product/category")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Produce ads using 6-second micro-clips + intelligent concatenation")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Adapt the system to Awareness, Conversion, Retargeting, Product Launch, etc.")] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ========== 2. UNIVERSAL BRAND DNA FRAMEWORK ==========
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("2. UNIVERSAL BRAND DNA EXTRACTION FRAMEWORK")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.1 The 5-Pillar Method (Works for Any Brand)")] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Pillar 1 – Core Offering: ", bold: true }), new TextRun("What do they sell and what problem do they solve?")] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Pillar 2 – Target Audience: ", bold: true }), new TextRun("Who is the ideal customer and what do they really want?")] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Pillar 3 – Tone of Voice: ", bold: true }), new TextRun("How should the brand sound? (Premium, Friendly, Expert, Bold, etc.)")] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Pillar 4 – Visual Identity: ", bold: true }), new TextRun("Colors, style, and feeling that represent the brand")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "Pillar 5 – Emotional Benefit: ", bold: true }), new TextRun("The deep feeling the customer gets after buying")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.2 Quick Research Method (15-30 minutes)")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Read homepage + About page")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Check Instagram/TikTok/LinkedIn for last 20 posts")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Read 10 recent customer reviews")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Identify 3 competitors and note what they do differently")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Write the 5-Pillar summary")] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ========== 3. CAMPAIGN TYPES ==========
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3. CAMPAIGN TYPES & HOW TO ADAPT")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.1 The 6 Most Common Campaign Objectives")] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "1. Awareness / Brand Building", bold: true })] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun("Focus: Emotional storytelling, founder story, mission, behind the scenes")] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "2. Conversion / Direct Response", bold: true })] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun("Focus: Problem → Solution → Proof → Offer → CTA")] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "3. Product Launch", bold: true })] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun("Focus: Teaser → Reveal → Benefits → Social Proof → Limited offer")] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "4. Retargeting / Warm Audience", bold: true })] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun("Focus: Testimonial, Case study, \"You might have missed this\", Scarcity")] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "5. Testimonial / Social Proof", bold: true })] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun("Focus: Real customer stories, before/after, results")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "6. Educational / Value-Driven", bold: true })] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("Focus: Teach something valuable → Position as expert → Soft CTA")] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ========== 4. UGC STYLES ==========
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("4. UGC STYLES FOR DIFFERENT INDUSTRIES")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.1 Recommended UGC Archetypes by Category")] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Fashion / Beauty: ", bold: true }), new TextRun("Lifestyle + Try-on + Before/After + \"Get ready with me\"")] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "SaaS / Software: ", bold: true }), new TextRun("Screen recording + Founder talking head + Customer testimonial")] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "E-commerce / Physical Products: ", bold: true }), new TextRun("Unboxing + Real use + Problem → Solution")] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Services (Coaching, Consulting, Agencies): ", bold: true }), new TextRun("Talking head + Case study + \"Day in the life\"")] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Health & Wellness: ", bold: true }), new TextRun("Transformation story + Expert explanation + Daily routine")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "B2B / Enterprise: ", bold: true }), new TextRun("Professional talking head + Data + Customer story (more polished)")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.2 Lip Sync Best Practices (Universal)")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Always add: \"perfect lip sync, mouth moves naturally and exactly with the voice\"")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Use real human presenters (not AI avatars) for highest trust")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Record voice first, then generate video with exact script")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Keep sentences short (max 12-15 words per breath)")] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ========== 5. UNIVERSAL PROMPT SYSTEM ==========
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("5. UNIVERSAL PROMPT SYSTEM")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5.1 Master Prompt Formula (Works for Any Video)")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "[Duration] + [Style] + [Presenter Description] + [Action + Emotion] + [Exact Script Line] + [Camera Movement] + [Lighting & Background] + [Quality Boosters] + [Lip Sync Instruction]", italics: true })] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5.2 6-Second Prompt Templates by Campaign Type")] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Conversion / Direct Response:", bold: true })] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "\"6-second vertical video in realistic UGC style, natural lighting. [Presenter] speaking directly to camera with perfect lip sync: \\\"[Problem] → [Solution] → [Result]\\\". Warm, trustworthy, expert tone. High quality.\"", italics: true })] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Awareness / Emotional:", bold: true })] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "\"6-second vertical video in cinematic but authentic style. [Presenter] looking at camera with emotional expression and perfect lip sync: \\\"[Emotional story or mission line]\\\". Soft lighting, genuine feeling. High quality.\"", italics: true })] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Product Launch / Excitement:", bold: true })] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "\"6-second vertical video in energetic UGC style. [Presenter] speaking with excitement and perfect lip sync: \\\"[Big news or launch line]\\\". Bright lighting, confident energy. High quality.\"", italics: true })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ========== 6. PRODUCTION SYSTEM ==========
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("6. UNIVERSAL PRODUCTION SYSTEM")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6.1 The 6-Second Micro-Clip Method (Best Practice 2026)")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("Modern AI video tools (Grok Imagine, Kling, Runway, Luma) perform best with 5-8 second clips. This system uses 6-second micro-clips that are later concatenated into full ads. This method gives much higher quality and control than generating long videos.")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6.2 Recommended Workflow for Any Campaign")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Extract Brand DNA (15-30 min)")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Define campaign objective and UGC style")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Create presenter reference image (once per brand)")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Write 3-6 second prompts using the Universal Formula")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Generate all clips in parallel")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Record voice-over with lip sync in mind")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Edit + add transitions + color grade")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Export individual ads + master cut")] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ========== 7. TOOLS ==========
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("7. RECOMMENDED TOOLS (2026)")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("7.1 Video Generation")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Grok Imagine – Best for realistic UGC + lip sync")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Kling AI 1.6 – Best character consistency")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Runway Gen-3 – Best cinematic quality")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Luma Dream Machine – Best for complex scenes")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("7.2 Voice & Audio")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("ElevenLabs – Best AI voices (Spanish female/male)")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Professional studio – For highest quality")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("7.3 Editing & Post-Production")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("CapCut – Fastest for UGC style")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("DaVinci Resolve – Best color grading (free)")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Premiere Pro – Industry standard")] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ========== 8. FINAL FRAMEWORK ==========
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("8. FINAL UNIVERSAL FRAMEWORK (One-Page Summary)")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "Step 1: ", bold: true }), new TextRun("Extract Brand DNA (5 Pillars)")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "Step 2: ", bold: true }), new TextRun("Choose Campaign Objective + UGC Style")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "Step 3: ", bold: true }), new TextRun("Create Presenter Reference Image")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "Step 4: ", bold: true }), new TextRun("Write 6-second prompts using Universal Formula")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "Step 5: ", bold: true }), new TextRun("Generate all clips + record voice-over")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "Step 6: ", bold: true }), new TextRun("Edit, transition, color grade, export")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Step 7: ", bold: true }), new TextRun("Launch + measure + iterate")] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 300 }, children: [new TextRun({ text: "— END OF UNIVERSAL AI ADVERTISING PLAYBOOK —", size: 20, bold: true, color: "1F4E79" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100 }, children: [new TextRun({ text: "This system works for any brand, any product, any campaign, and any UGC style.", size: 18, color: "666666" })] }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/home/workdir/artifacts/Universal_AI_Advertising_Playbook_v2.docx", buffer);
  console.log("✅ Universal Playbook created: Universal_AI_Advertising_Playbook_v2.docx");
});