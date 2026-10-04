import cron from "node-cron";
import { allUsers, save } from "./store.js";
import { publishPost } from "../social/publish.js";
export async function runPost(u, post) {
  post.status = "publishing"; save();
  const { results, errors } = await publishPost(post, u.accounts);
  post.results = results; post.error = errors.join(" · ");
  post.status = errors.length && !Object.keys(results).length ? "failed" : "published";
  post.publishedAt = Date.now(); save();
}
cron.schedule("* * * * *", async () => {
  const now = Date.now();
  for (const [, u] of allUsers()) for (const post of Object.values(u.posts))
    if (post.status === "scheduled" && post.at && Date.parse(post.at) <= now) runPost(u, post).catch((e) => { post.status = "failed"; post.error = e.message; save(); });
});
