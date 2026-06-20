import { Router } from "express";
import { logger } from "../lib/logger.js";

const router = Router();

function getGeminiKey(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY no configurado");
  return k;
}

router.post("/game-ai/chat", async (req, res) => {
  try {
    const { npcName, npcType, npcDialogue, playerKarma, playerMoney, completedMissions, playerAction } = req.body;
    if (!npcName) { res.status(400).json({ error: "npcName requerido" }); return; }

    const apiKey = getGeminiKey();
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const karmaLabel = playerKarma > 50 ? "CEO ejemplar" : playerKarma > 0 ? "ejecutivo ambicioso" : playerKarma > -50 ? "CEO polémico" : "villano corporativo";
    const systemContext = `Eres ${npcName} en el videojuego CEO Empire, un GTA-style open world donde el jugador es un CEO construyendo su imperio de negocios.
Tu personalidad: ${npcType === "hostile" || npcType === "boss" ? "eres un rival empresarial agresivo y amenazante" : npcType === "friendly" ? "eres un aliado del CEO protagonista" : "eres un ciudadano de la ciudad"}.
Tu diálogo predefinido: "${npcDialogue || "Hola, CEO"}".
El jugador tiene karma de ${playerKarma} (${karmaLabel}), dinero: $${playerMoney?.toLocaleString() || "desconocido"}.
Misiones completadas: ${completedMissions?.length || 0}.
Acción del jugador: ${playerAction || "hablar contigo"}.
Responde en español, en 1-2 frases cortas y en personaje. Sé dramático y entretenido.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: systemContext }] }],
    });

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || npcDialogue || "...";
    res.json({ text });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "game-ai/chat fallback to default dialogue");
    res.json({ text: req.body.npcDialogue || "Sin palabras..." });
  }
});

router.post("/game-ai/analyze", async (req, res) => {
  try {
    const { karma, money, kills, businessesBought, completedMissions, dayTime } = req.body;
    const apiKey = getGeminiKey();
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const timeLabel = dayTime < 6 ? "madrugada" : dayTime < 12 ? "mañana" : dayTime < 18 ? "tarde" : "noche";
    const prompt = `Eres el narrador de CEO Empire, un videojuego GTA-style. Analiza la situación del CEO jugador en 2 frases dramáticas y en español:
- Karma: ${karma}/100
- Dinero: $${money?.toLocaleString()}
- Eliminaciones: ${kills}
- Negocios comprados: ${businessesBought}
- Misiones completadas: ${completedMissions}
- Hora del día: ${timeLabel}
Sé épico, cinematográfico y motivador (o amenazante según el karma). Máximo 2 frases.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "El CEO avanza imparable...";
    res.json({ text });
  } catch (err: any) {
    res.json({ text: "El CEO avanza imparable hacia la cima del Imperio..." });
  }
});

export default router;
