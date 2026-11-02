// A render worker on its own (needs REDIS_URL and DATABASE_URL): takes renders from the queue, RENDER_CONCURRENCY at a time.
import { CFG } from "./config";
import { parts } from "./boot";

if (!CFG.redisUrl || !CFG.databaseUrl) { console.error("The worker needs REDIS_URL and DATABASE_URL (without them the API renders by itself)."); process.exit(1); }
const { queue } = await parts(true);
console.log(`nooi render worker: ${CFG.concurrency} at a time`);
const bye = async () => { await queue.close(); process.exit(0); };
process.on("SIGTERM", bye); process.on("SIGINT", bye);
