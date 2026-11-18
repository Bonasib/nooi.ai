// The API process. With Redis set, renders can run in separate worker processes (RENDER_WORKER=0 here, `pnpm worker` there).
import { CFG } from "./config";
import { parts } from "./boot";
import { buildApp } from "./server";
import { startCleanup } from "./cleanup";

const { store, queue } = await parts(process.env.RENDER_WORKER !== "0");
const app = await buildApp({ store, queue, logger: true });
startCleanup(store);
await app.listen({ port: CFG.port, host: CFG.host });
const bye = async () => { await app.close(); await queue.close(); process.exit(0); };
process.on("SIGTERM", bye); process.on("SIGINT", bye);
