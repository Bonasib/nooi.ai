// OAuth "Connect account" for each platform. Tokens are stored server-side per user.
import crypto from "crypto";
const V = () => process.env.META_GRAPH_VERSION || "v21.0";
const redirect = (p) => (process.env.OAUTH_REDIRECT_BASE || process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "") + "/v1/oauth/" + p + "/callback";
const b64url = (b) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const form = (o) => new URLSearchParams(o).toString();

export const OAUTH = {
  instagram: { configured: () => !!process.env.META_APP_ID, alias: "meta" },
  facebook: { configured: () => !!process.env.META_APP_ID, alias: "meta" },
  meta: {
    configured: () => !!process.env.META_APP_ID,
    authUrl: (state) => `https://www.facebook.com/${V()}/dialog/oauth?` + form({ client_id: process.env.META_APP_ID, redirect_uri: redirect("meta"), state, scope: "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,business_management" }),
    async exchange(code) {
      const t = await (await fetch(`https://graph.facebook.com/${V()}/oauth/access_token?` + form({ client_id: process.env.META_APP_ID, client_secret: process.env.META_APP_SECRET, redirect_uri: redirect("meta"), code }))).json();
      if (!t.access_token) throw new Error("Meta: " + JSON.stringify(t.error || t));
      const pages = await (await fetch(`https://graph.facebook.com/${V()}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${t.access_token}`)).json();
      const page = (pages.data || [])[0];
      if (!page) throw new Error("No Facebook Page found on this account");
      const acc = { facebook: { pageId: page.id, name: page.name, token: page.access_token } };
      if (page.instagram_business_account) acc.instagram = { igUserId: page.instagram_business_account.id, token: page.access_token, name: page.name };
      return acc;
    }
  },
  tiktok: {
    configured: () => !!process.env.TIKTOK_CLIENT_KEY,
    authUrl: (state) => "https://www.tiktok.com/v2/auth/authorize/?" + form({ client_key: process.env.TIKTOK_CLIENT_KEY, response_type: "code", scope: "user.info.basic,video.publish,video.upload", redirect_uri: redirect("tiktok"), state }),
    async exchange(code) {
      const t = await (await fetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form({ client_key: process.env.TIKTOK_CLIENT_KEY, client_secret: process.env.TIKTOK_CLIENT_SECRET, code, grant_type: "authorization_code", redirect_uri: redirect("tiktok") }) })).json();
      if (!t.access_token) throw new Error("TikTok: " + JSON.stringify(t));
      return { tiktok: { token: t.access_token, refresh: t.refresh_token, expires: Date.now() + (t.expires_in || 0) * 1000, openId: t.open_id } };
    }
  },
  youtube: {
    configured: () => !!process.env.GOOGLE_CLIENT_ID,
    authUrl: (state) => "https://accounts.google.com/o/oauth2/v2/auth?" + form({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirect("youtube"), response_type: "code", scope: "https://www.googleapis.com/auth/youtube.upload", access_type: "offline", prompt: "consent", state }),
    async exchange(code) {
      const t = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: redirect("youtube"), grant_type: "authorization_code" }) })).json();
      if (!t.access_token) throw new Error("Google: " + JSON.stringify(t));
      return { youtube: { token: t.access_token, refresh: t.refresh_token, expires: Date.now() + (t.expires_in || 0) * 1000 } };
    }
  },
  x: {
    configured: () => !!process.env.X_CLIENT_ID, pkce: true,
    authUrl: (state, challenge) => "https://twitter.com/i/oauth2/authorize?" + form({ response_type: "code", client_id: process.env.X_CLIENT_ID, redirect_uri: redirect("x"), scope: "tweet.read tweet.write users.read media.write offline.access", state, code_challenge: challenge, code_challenge_method: "S256" }),
    async exchange(code, verifier) {
      const basic = Buffer.from(process.env.X_CLIENT_ID + ":" + (process.env.X_CLIENT_SECRET || "")).toString("base64");
      const t = await (await fetch("https://api.x.com/2/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + basic }, body: form({ code, grant_type: "authorization_code", redirect_uri: redirect("x"), code_verifier: verifier, client_id: process.env.X_CLIENT_ID }) })).json();
      if (!t.access_token) throw new Error("X: " + JSON.stringify(t));
      return { x: { token: t.access_token, refresh: t.refresh_token, expires: Date.now() + (t.expires_in || 0) * 1000 } };
    }
  },
  linkedin: {
    configured: () => !!process.env.LINKEDIN_CLIENT_ID,
    authUrl: (state) => "https://www.linkedin.com/oauth/v2/authorization?" + form({ response_type: "code", client_id: process.env.LINKEDIN_CLIENT_ID, redirect_uri: redirect("linkedin"), state, scope: "openid profile w_member_social" }),
    async exchange(code) {
      const t = await (await fetch("https://www.linkedin.com/oauth/v2/accessToken", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form({ grant_type: "authorization_code", code, redirect_uri: redirect("linkedin"), client_id: process.env.LINKEDIN_CLIENT_ID, client_secret: process.env.LINKEDIN_CLIENT_SECRET }) })).json();
      if (!t.access_token) throw new Error("LinkedIn: " + JSON.stringify(t));
      return { linkedin: { token: t.access_token, expires: Date.now() + (t.expires_in || 0) * 1000 } };
    }
  }
};
export function pkcePair() { const verifier = b64url(crypto.randomBytes(32)); return { verifier, challenge: b64url(crypto.createHash("sha256").update(verifier).digest()) }; }

export async function freshToken(platform, acc) {
  if (!acc || !acc.refresh || !acc.expires || acc.expires - Date.now() > 60e3) return acc && acc.token;
  if (platform === "youtube") {
    const t = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: acc.refresh, grant_type: "refresh_token" }) })).json();
    if (t.access_token) { acc.token = t.access_token; acc.expires = Date.now() + t.expires_in * 1000; }
  } else if (platform === "tiktok") {
    const t = await (await fetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form({ client_key: process.env.TIKTOK_CLIENT_KEY, client_secret: process.env.TIKTOK_CLIENT_SECRET, grant_type: "refresh_token", refresh_token: acc.refresh }) })).json();
    if (t.access_token) { acc.token = t.access_token; acc.refresh = t.refresh_token || acc.refresh; acc.expires = Date.now() + t.expires_in * 1000; }
  }
  return acc.token;
}
