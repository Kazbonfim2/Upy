import { Hono } from "hono";
import { generateTraverseCode } from "../lib/groq";
import { parseTraverseInput } from "../lib/validate";

export const aiRoutes = new Hono();

aiRoutes.post("/traverse", async (c) => {
  const body = (await c.req.json()) as Record<string, unknown>;
  const { responseBody, language } = parseTraverseInput(body);

  const code = await generateTraverseCode(responseBody, language);
  return c.json({ code });
});
