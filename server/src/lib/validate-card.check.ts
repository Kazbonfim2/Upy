import { parseCard } from "./validate";

const ok = parseCard({ name: "Latência", status: "200", description: "ok" });
if (ok.name !== "Latência" || ok.status !== "200") throw new Error("parseCard create fail");

try {
  parseCard({ name: "x".repeat(101), status: "200" });
  throw new Error("should reject long name");
} catch (e) {
  if (!(e instanceof Error) || !e.message.includes("100")) throw e;
}

const partial = parseCard({ status: "201", resolved: true }, true);
if (partial.status !== "201" || partial.resolved !== true || partial.name !== undefined) {
  throw new Error("partial fail");
}

console.log("validate-card.check ok");
