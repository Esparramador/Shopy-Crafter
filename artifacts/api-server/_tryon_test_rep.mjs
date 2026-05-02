import Replicate from 'replicate';
import fs from 'fs';

const r = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
const model = fs.readFileSync('/tmp/tryontest/model.png');
const watch = fs.readFileSync('/tmp/tryontest/watch.png');
const modelDataUri = `data:image/png;base64,${model.toString('base64')}`;
const watchDataUri = `data:image/png;base64,${watch.toString('base64')}`;

const prompt = `Photorealistic virtual try-on. Image 1 = MODEL person. Image 2 = PRODUCT (luxury silver wristwatch with brown leather strap).
Task: The model wears the watch from image 2 on their LEFT wrist. The watch strap is fastened naturally and the dial faces the camera. The wrist is slightly raised in a casual elegant pose so the watch is the focal point.
ABSOLUTE RULES:
- Preserve MODEL identity, face, skin, hair, body proportions from image 1 EXACTLY.
- Preserve PRODUCT exact shape, materials (silver case, brown leather), colors and components from image 2.
- Anatomically correct: 5 fingers per hand. Realistic shadows where watch touches wrist.
- Studio portrait, soft lighting, clean neutral background.
- Output: ultra-high resolution, sharp focus, commercial photography quality.
- No text, no logos overlays, no watermarks added.`;

const t0 = Date.now();
const out = await r.run('google/nano-banana', {
  input: {
    prompt,
    image_input: [modelDataUri, watchDataUri],
    output_format: 'png',
  },
});
const raw = Array.isArray(out) ? out[0] : out;
const url = typeof raw === 'string' ? raw : (raw.url ? (typeof raw.url === 'function' ? raw.url().href : raw.url) : String(raw));
console.log('URL=' + url.slice(0,100));
const buf = await (await fetch(url)).arrayBuffer();
fs.writeFileSync('/tmp/tryontest/watch_tryon_rep.png', Buffer.from(buf));
console.log('SAVED ' + Buffer.from(buf).byteLength + ' bytes in ' + (Date.now()-t0) + 'ms');
