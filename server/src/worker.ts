import { ensureSchema } from "./db";
import { runDue } from "./lib/run-check";

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

async function tick() {
  try {
    await runDue();
  } catch (err) {
    console.error("worker tick:", err);
  }
}

await tick();
setInterval(tick, 1000);
console.log("worker ok");

