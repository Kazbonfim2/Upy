import { ensureSchema } from "./db";
import { runDue } from "./lib/run-check";

await ensureSchema();

let busy = false;

async function tick() {
  if (busy) return;
  busy = true;
  try {
    await runDue();
  } catch (err) {
    console.error("worker:", err);
  } finally {
    busy = false;
  }
}

await tick();
setInterval(tick, 1000);
console.log("worker ok");
