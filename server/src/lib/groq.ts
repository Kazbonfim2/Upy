import { db } from "../db";
import { cards } from "../db/schema";
import { parseGroqCard } from "./validate";

export async function maybeOpenAiCard(
  monitorId: number,
  facts: { url: string; method: string; statusCode: number | null; latencyMs: number; error: string | null },
) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL?.trim() || "llama-3.1-8b-instant",
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              'Responda só JSON: {"name": string máx 100, "status": string máx 100 (ex: Crítico, Timeout, Erro 5xx), "description": string máx 300 com causa provável e ação}.',
          },
          {
            role: "user",
            content: JSON.stringify(facts),
          },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });
    const reqId = res.headers.get("x-request-id") ?? "-";
    if (!res.ok) throw new Error(`groq HTTP ${res.status} [reqId: ${reqId}]`);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return;
    const card = parseGroqCard(content);
    if (!card) return;
    const [inserted] = await db
      .insert(cards)
      .values({ monitorId, ...card, resolved: false, source: "ai" })
      .returning();
    console.log(`[groq] card #${inserted?.id} criada monitor=${monitorId} reqId=${reqId}`);
  } catch (err) {
    console.error("groq card falhou:", err);
  }
}
