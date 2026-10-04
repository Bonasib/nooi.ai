// First-line content filter (same rules as the studio). Add a moderation model for production.
export function moderate(t) {
  t = String(t || "").toLowerCase();
  const minor = /(child|kid|minor|underage|teen|schoolgirl|schoolboy|loli|طفل|طفلة|أطفال|قاصر|قاصرة|مراهق|مراهقة)/.test(t);
  const sexual = /(nude|naked|nsfw|porn|sex|sexual|erotic|lingerie|topless|عاري|عارية|عراة|إباحي|اباحي|جنسي|جنس)/.test(t);
  if (minor && sexual) return "minors"; if (sexual) return "sexual";
  if (/(deepfake|undress|remove (her|his) clothes|تعرية|ديب فيك)/.test(t)) return "likeness";
  return null;
}
