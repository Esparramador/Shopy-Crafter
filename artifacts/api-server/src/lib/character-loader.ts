/**
 * Character loader — carga un personaje desde DB y devuelve su imagen ref +
 * descripción canónica para inyectar identity-lock en cualquier generación.
 */
import { db, charactersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getVaultContent } from "./vault.js";

export interface LoadedCharacter {
  id: number;
  name: string;
  gender: string | null;
  ageRange: string | null;
  identityDescription: string;
  styleNotes: string | null;
  voiceId: string | null;
  voiceGender: string | null;
  voiceLanguage: string | null;
  refImage: Buffer;
  refMime: string;
}

export async function loadCharacter(
  projectId: number,
  characterId: number,
): Promise<LoadedCharacter | null> {
  const [row] = await db
    .select()
    .from(charactersTable)
    .where(and(eq(charactersTable.id, characterId), eq(charactersTable.projectId, projectId)));
  if (!row || !row.refVaultFileId) return null;
  const file = await getVaultContent(row.refVaultFileId, projectId);
  if (!file?.content) return null;
  return {
    id: row.id,
    name: row.name,
    gender: row.gender,
    ageRange: row.ageRange,
    identityDescription: row.identityDescription,
    styleNotes: row.styleNotes,
    voiceId: row.voiceId,
    voiceGender: row.voiceGender,
    voiceLanguage: row.voiceLanguage,
    refImage: Buffer.from(file.content, "base64"),
    refMime: row.refMimeType || file.mimeType || "image/png",
  };
}

/**
 * Devuelve un bloque textual de identity-lock listo para concatenar a cualquier
 * prompt de generación de imagen/vídeo. Es muy explícito para que los modelos
 * preserven facciones, complexión y rasgos consistentes en cada escena.
 */
export function buildIdentityLockPrompt(c: LoadedCharacter): string {
  const parts: string[] = [];
  parts.push(
    `IDENTITY LOCK — preserve EXACTLY the same person across every frame and shot.`,
  );
  parts.push(`Character name: "${c.name}".`);
  if (c.gender) parts.push(`Gender: ${c.gender}.`);
  if (c.ageRange) parts.push(`Age range: ${c.ageRange}.`);
  parts.push(`Canonical identity: ${c.identityDescription}`);
  if (c.styleNotes) parts.push(`Style notes: ${c.styleNotes}`);
  parts.push(
    `IMPORTANT: face, eyes, skin tone, hair color & cut, body proportions and distinctive features MUST remain identical to the reference image. Do not invent a different person, do not change ethnicity, age, hair color or facial features. Use the reference image as the SOLE source of truth for the character's appearance.`,
  );
  return parts.join(" ");
}
