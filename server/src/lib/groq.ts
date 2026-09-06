import prettier from "prettier";
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
          { role: "user", content: JSON.stringify(facts) },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return;
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const card = parseGroqCard(body.choices?.[0]?.message?.content || "");
    if (!card) return;

    await db.insert(cards).values({ monitorId, ...card, resolved: false, source: "ai" });
  } catch (err) {
    console.error("groq card falhou:", err);
  }
}

export async function generateTraverseCode(
  responseBody: string,
  language: "javascript" | "typescript" = "javascript",
): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error("GROQ_API_KEY não configurada no servidor.");
  }

  const isTs = language === "typescript";
  const langName = isTs ? "TypeScript" : "JavaScript";

  const systemPrompt = `Você é um desenvolvedor sênior especialista em JavaScript e TypeScript.
Gere um exemplo prático de código em ${langName} Vanilla mostrando como consumir via fetch e integrar a resposta fornecida.

Regras obrigatórias:
1. Use apenas ${langName} Vanilla moderno (fetch nativo, async/await).
2. Não utilize frameworks ou bibliotecas como React, Vue, Angular, Axios, jQuery, etc.
3. Baseie-se fielmente na estrutura real dos campos, objetos e arrays da resposta fornecida.
4. ${isTs ? "Defina interfaces/tipos TypeScript correspondentes à estrutura real dos dados e utilize anotações de tipo." : "Utilize código JavaScript moderno e limpo."}
5. O exemplo deve conter: a chamada fetch da API, o parse com .json() e a integração/manipulação dos dados reais (ex: forEach, map, laços ou acesso a propriedades).
6. Retorne estritamente apenas o código executável. Não inclua texto introdutório, explicações ou notas antes ou depois.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL?.trim() || "llama-3.1-8b-instant",
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Corpo da resposta recebida:\n\n${responseBody.slice(0, 15000)}` },
      ],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Erro na API do Groq (${res.status}): ${errorText || res.statusText}`);
  }

  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  let rawCode = body.choices?.[0]?.message?.content?.trim() || "";

  if (!rawCode) {
    throw new Error("Groq não retornou resposta.");
  }

  // Remove cercas markdown ```ts ... ``` caso o modelo as inclua
  const fenceMatch = rawCode.match(/^```(?:ts|typescript|js|javascript)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    rawCode = fenceMatch[1].trim();
  }

  // Formata com Prettier
  try {
    const formatted = await prettier.format(rawCode, {
      parser: isTs ? "typescript" : "babel",
      semi: true,
      singleQuote: false,
      tabWidth: 2,
    });
    return formatted.trim();
  } catch (fmtErr) {
    console.warn("Prettier format fallback:", fmtErr);
    return rawCode;
  }
}
