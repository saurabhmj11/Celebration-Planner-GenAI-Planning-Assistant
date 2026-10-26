/**
 * GenAI engine adapter.
 *
 * A thin seam between the API route and the z-ai-web-dev-sdk. Keeping the SDK
 * import isolated in this module:
 *   1. Makes the route trivially unit-testable (mock this module, not the SDK).
 *   2. Lets us swap providers (GLM -> Gemini -> OpenAI) in ONE file.
 *   3. Documents exactly where server-only credentials are handled.
 */

export interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

export interface EngineCompletion {
  /** Raw text content returned by the model. */
  content?: string;
  /** Model identifier used for the response (for UI attribution). */
  model?: string;
}

/** Sent as the message list for a single completion request. */
export type RunEngine = (messages: ChatMessage[]) => Promise<EngineCompletion>;

/**
 * Default engine backed by z-ai-web-dev-sdk (server-side only).
 * Instantiation is deliberately per-call so serverless workers stay stateless.
 */
export const runChatCompletion: RunEngine = async (messages) => {
  const { default: ZAI } = await import("z-ai-web-dev-sdk");
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages,
    thinking: { type: "disabled" },
  });
  return {
    content: completion?.choices?.[0]?.message?.content,
    model: typeof completion?.model === "string" ? completion.model : "GLM",
  };
};
