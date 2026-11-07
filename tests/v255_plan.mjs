// v255 — after ViMax's storyboard and camera tree (our own code): the agents' plan says who is in each shot and which camera
// position it's filmed from; each shot's first picture gets only those people's pictures, and a shot back on an earlier camera
// position is drawn from that shot's picture. Run: node tests/v255_plan.mjs
import { parsePlan255, keyPlan255, offlinePlan132 } from "../lib/long132.js";
const fails = [], chk = (n, ok, info) => { if (!ok) fails.push(n + (info === undefined ? "" : " · " + JSON.stringify(info).slice(0, 900))); };
// the plan's answer, as a text AI might write it (names with # or @, other case, an unknown name, a string shot, cams like "cam b")
const r = { shots: [{ shot: "Wide: Layla and Omar at the market", who: ["#layla", "Omar"], cam: "A" }, { shot: "Close-up on Layla", who: ["Layla", "Nobody"], cam: "b" },
  "Omar looks back", { shot: "Back to the wide view, both laugh", who: ["@OMAR", "layla"], cam: "cam a" }, { shot: "Close on Layla again", who: ["Layla"], cam: "B" }] };
const p = parsePlan255(r, 5, ["Layla", "Omar"]);
chk("the plan's shots, people (known names only, the customer's spelling) and camera positions are read", JSON.stringify(p.shots) === JSON.stringify(["Wide: Layla and Omar at the market", "Close-up on Layla", "Omar looks back", "Back to the wide view, both laugh", "Close on Layla again"])
  && JSON.stringify(p.who) === JSON.stringify([["Layla", "Omar"], ["Layla"], null, ["Omar", "Layla"], ["Layla"]]) && JSON.stringify(p.cams) === JSON.stringify(["A", "B", null, "A", "B"]), p);
const refs = [{ slot: "vRef1", tag: "Layla", url: "/m/layla.png" }, { slot: "vRef2", tag: "Omar", url: "/m/omar.png" }, { slot: "vRef3", tag: "market", url: "/m/market.png" }];
const k = keyPlan255(5, { who: p.who, cams: p.cams }, refs);
chk("a shot back on an earlier camera position is drawn from that shot (B → shot 2); the others from the first shot", JSON.stringify(k.map((x) => x.parent)) === JSON.stringify([-1, 0, 0, 0, 1]), k);
chk("each shot gets only the pictures of the people in it; a shot the plan didn't say gets all (up to 3)", JSON.stringify(k[1].refs) === JSON.stringify(["/m/layla.png"]) && JSON.stringify(k[3].refs) === JSON.stringify(["/m/layla.png", "/m/omar.png"]) && k[2].refs.length === 3, k);
const k2 = keyPlan255(3, {}, refs);
chk("an older plan (no people, no cameras) works as before: every shot from the first, all pictures", JSON.stringify(k2.map((x) => x.parent)) === JSON.stringify([-1, 0, 0]) && k2.every((x) => x.refs.length === 3), k2);
chk("a plain list of shots (older answers) still reads", JSON.stringify(parsePlan255({ shots: ["one", "two"] }, 2).shots) === JSON.stringify(["one", "two"]) && offlinePlan132("a kite", 3).shots.length === 3);
if (fails.length) { console.log("v255 plan FAIL\n - " + fails.join("\n - ")); process.exit(1); } console.log("v255 plan OK");
