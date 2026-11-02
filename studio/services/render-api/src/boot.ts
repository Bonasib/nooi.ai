// Picks the parts from the environment: PostgreSQL or memory, BullMQ on Redis or an in-process queue.
import { CFG } from "./config";
import { MemoryStore, prismaStore, type Store } from "./store";
import { memoryQueue, bullQueue, type RenderQueue } from "./queue";

export async function parts(withWorker: boolean): Promise<{ store: Store; queue: RenderQueue }> {
  const store = CFG.databaseUrl ? await prismaStore() : new MemoryStore();
  const queue = CFG.redisUrl ? await bullQueue(store, withWorker) : memoryQueue(store);
  return { store, queue };
}
