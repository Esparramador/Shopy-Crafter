export interface PublicChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Public chat request bodies are untrusted. Keep only the supported shape,
 * bound each message, and cap history before it reaches the model.
 */
export function sanitizePublicChatMessages(
  input: unknown,
  limit: number,
): PublicChatMessage[] | null {
  if (!Array.isArray(input)) return null;

  const messages = input
    .filter((item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null && !Array.isArray(item))
    .filter((item) =>
      (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string")
    .map((item) => ({
      role: item.role as PublicChatMessage["role"],
      content: (item.content as string).slice(0, 1200),
    }))
    .slice(-limit);

  return messages.some((message) => message.role === "user") ? messages : null;
}
