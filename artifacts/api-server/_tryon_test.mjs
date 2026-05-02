import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = fs.readFileSync('/tmp/tryontest/model.png');
const watch = fs.readFileSync('/tmp/tryontest/watch.png');
const prompt = `Photorealistic virtual try-on / product placement.

Image 1 = MODEL (the person).
Image 2 = PRODUCT (watches — luxury silver wristwatch).

Task: The model wears the watch from image 2 on their LEFT wrist. The watch strap is fastened naturally and the dial faces the camera. The wrist is slightly raised in a casual, elegant pose so the watch is the focal point.

ABSOLUTE RULES:
- Preserve the MODEL's identity, face, skin tone, hair and body proportions from image 1 EXACTLY.
- Preserve the PRODUCT's exact shape, materials (silver case, brown leather strap), colors, components (case, dial, hands, bezel, strap) from image 2.
- Anatomically correct: 5 fingers per hand, natural proportions, realistic skin and shadows.
- The product is placed/worn on wrist — never fused into the body, never floating, never deformed.
- Realistic contact shadows where the product touches the model.
- Studio portrait composition, soft professional lighting, clean neutral background.
- Output: ultra-high resolution, sharp focus, commercial fashion/lifestyle photography quality, professional color grading.
- No text, no logos overlays, no watermarks added.`;

const t0 = Date.now();
const result = await ai.models.generateContent({
  model: 'gemini-2.5-flash-image',
  contents: [
    { text: prompt },
    { inlineData: { mimeType: 'image/png', data: model.toString('base64') } },
    { inlineData: { mimeType: 'image/png', data: watch.toString('base64') } },
  ],
  config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '2:3' } },
});
const parts = result?.candidates?.[0]?.content?.parts ?? [];
let saved = false;
for (const part of parts) {
  const inline = part.inlineData || part.inline_data;
  if (inline?.data) {
    const buf = Buffer.from(inline.data, 'base64');
    fs.writeFileSync('/tmp/tryontest/watch_tryon.png', buf);
    console.log('SAVED tryon ' + buf.length + ' bytes in ' + (Date.now()-t0) + 'ms');
    saved = true;
    break;
  }
}
if (!saved) console.log('NO_IMAGE. parts=' + JSON.stringify(parts).slice(0,400));
