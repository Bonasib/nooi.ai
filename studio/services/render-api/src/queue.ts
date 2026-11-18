// The render queue: BullMQ on Redis (the VPS: renders survive a restart, a separate worker process can take them), or an in-process
// queue for development and tests. Priority: the top plan first. Concurrency: RENDER_CONCURRENCY renders at once on the CPU.
import { CFG } from "./config";
import type { Store } from "./store";
import { runRender, type RenderJobData } from "./render";

export interface RenderQueue { add(d: RenderJobData, priority: number): Promise<void>; remove(id: string): Promise<void>; counts(): Promise<Record<string, number>>; close(): Promise<void> }

export function memoryQueue(store: Store): RenderQueue {
  const wait: { d: RenderJobData; pr: number; at: number }[] = []; let busy = 0;
  const pump = () => {
    while (busy < CFG.concurrency && wait.length) {
      wait.sort((a, b) => a.pr - b.pr || a.at - b.at); const j = wait.shift()!; busy++;
      runRender(store, j.d).finally(() => { busy--; pump(); });
    }
  };
  return {
    async add(d, pr) { wait.push({ d, pr, at: Date.now() }); setImmediate(pump); },
    async remove(id) { const i = wait.findIndex((x) => x.d.id === id); if (i >= 0) wait.splice(i, 1); },
    async counts() { return { waiting: wait.length, active: busy }; },
    async close() { wait.length = 0; },
  };
}
export async function bullQueue(store: Store, withWorker: boolean): Promise<RenderQueue> {
  const { Queue, Worker } = await import("bullmq"); const { default: IORedis } = await import("ioredis");
  const conn = new IORedis(CFG.redisUrl, { maxRetriesPerRequest: null });
  const q = new Queue("nooi-render", { connection: conn });
  const w = withWorker ? new Worker("nooi-render", async (job) => runRender(store, job.data as RenderJobData), { connection: conn.duplicate(), concurrency: CFG.concurrency }) : null;
  return {
    async add(d, pr) { await q.add("render", d, { jobId: d.id, priority: pr, removeOnComplete: 1000, removeOnFail: 1000 }); },
    async remove(id) { const j = await q.getJob(id); if (j) await j.remove().catch(() => undefined); },
    async counts() { return q.getJobCounts("waiting", "active", "completed", "failed", "delayed", "prioritized"); },
    async close() { await w?.close(); await q.close(); conn.disconnect(); },
  };
}
