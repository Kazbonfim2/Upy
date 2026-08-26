import { ensureSchema } from "./db";
import { purgeOldChecks, runDue } from "./lib/run-check";

process.on("unhandledRejection", (reason) => console.error("worker unhandled rejection:", reason));
process.on("uncaughtException", (err) => console.error("worker uncaught exception:", err));

while (true) {
  try {
    await ensureSchema();
    break;
  } catch (err) {
    console.error("worker aguardando banco:", err);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

let tickCount = 0;

async function tick() {
  try {
    await runDue();
    tickCount++;
    if (tickCount % 3600 === 0) {
      purgeOldChecks().catch((err) => console.error("worker purge erro:", err));
    }
  } catch (err) {
    console.error("worker tick:", err);
  }
}

await tick();
setInterval(tick, 1000);
console.log("worker ok");

