// v119: how long the editor's exports take to convert on this server (the last 30) — the speed card uses it to say whether a
// bigger server would make exports faster (converting uses every processor core; a recording already in the right shape is
// only re-packed, which takes about a second whatever the server)
export const XSTATS = { n: 0, last: [] };
export function noteExport(o) { XSTATS.n++; XSTATS.last.push({ at: Date.now(), ...o }); if (XSTATS.last.length > 30) XSTATS.last.shift(); }
