# Security — nooi.ai

What was reviewed, what was found, what v195 fixed, and what the owner should do on the server. Written after the v195 whole-site
review (every suite step + a read of server.js, lib/, providers/, deploy/, public/index.html, package-lock.json).

## 1. What was checked and found

| Area | Finding | State |
|---|---|---|
| Sign-in | Firebase ID tokens are verified on the server (`verifyIdToken`); API tokens are random 24-byte `nooi_…` strings stored only as SHA-256 hashes, with read-only and daily-cap rules; an account deleted moments ago is refused even with a still-valid token. | fine |
| Admin | Every `/v1/admin/*` route sits behind `requireUser` **and** `requireAdmin(permission)` or `isStaff`; roles owner / admin / support / finance / moderator / viewer; an audit log of admin actions. | fine |
| No-sign-in mode | Without `FIREBASE_PROJECT_ID` the server runs as one local owner (tests and development). The server prints a warning. It must never face the internet. In this mode only, an `X-Dev-User` header names another local account (v196 — so tests can exercise shared projects and roles); with sign-in on, the header is ignored. | advice §3.1 |
| Uploads | 1 GB limit, random file names — but the **extension was kept as given**, so an uploaded `.html`/`.svg` was served from `/media` on the site's own address: a stored-XSS door for any signed-in user. | **fixed v195** |
| Serving `/media` | `express.static` (no path traversal). Four older media-name resolvers accepted any `[A-Za-z0-9._-]+` (could match `..`); the download route uses `path.basename`. | tightened v195 |
| Server reading addresses (SSRF) | **Website analysis** (`/v1/analyze-site`) fetched any address a customer typed, redirects followed — including `localhost` and the cloud metadata address `169.254.169.254`. **Reference pictures** for the NVIDIA and 3D engines were fetched the same way. The picture engines (`providers/images2.js`), agents (`AGENTS_ALLOW_HOSTS`) and localization already had guards. | **fixed v195** |
| Browser headers | None were sent: no `nosniff`, no frame protection, no referrer policy, `X-Powered-By: Express` on. | **fixed v195** |
| CORS | `origin: PUBLIC_BASE_URL || true` — with `PUBLIC_BASE_URL` set (production) only the site's own origin is allowed; no cookies are used, so the fallback only matters in development. | advice §3.1 |
| Rate limits | Sign-in codes: 6 digits, one-time, 5 tries; `tooMany` / `rateOk` on the heavy routes; MCP daily caps. | fine, advice §3.2 |
| Payments | Webhook signatures for Stripe / Airwallex / PayPal / Moyasar on the raw body (v191), Moyasar IP list, keys only in Admin → Payments. | fine |
| Subprocesses | ffmpeg & co. run with `spawn(bin, [args])` — no shell; the one `sh -c` only probes constant binary names. | fine |
| Page (XSS) | Every interpolation of customer text that was sampled goes through `esc()`; no cookies; sign-in state lives in Firebase's own storage. | fine |
| Deploy | `update.sh` unzips into a private temp folder, rsyncs with `data/`, `media/`, `.env` excluded, keeps a previous copy and rolls back on failure. | fine |
| Dependencies | `npm audit` before v195: 4 high (body-parser, node-forge, nodemailer SMTP-injection, undici) + 8 moderate. After: **0 high**; the 8 moderate are all inside the `firebase-admin` 12 chain (`google-gax`, `gaxios`, `@google-cloud/*`). | fixed / advice §3.6 |
| Secrets | Provider names and keys never reach the browser (`engOut` renames the engine); keys are entered in Admin and kept in `data/`. | fine |

## 2. Fixed in v195

- **`lib/safeurl.js`** — one guard for every address the server reads on a customer's word: `publicUrl` (https only — http allowed for website analysis — no credentials in the URL, every DNS answer must be public: 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, 100.64/10, 0/8, multicast, IPv6 ULA/link-local and mapped forms refused), `fetchPublic` (redirects followed by hand, each hop checked, 5 at most), `readPublic`/`toDataUrl` (size cap 64 MB; the site's own `/media/...` read from disk). In the no-sign-in mode the loopback address is allowed so the tests' stand-in engines keep working — that mode never faces the internet.
- Applied to `lib/site.js` (website analysis: also HTML only, 3 MB cap), `providers/nvidia.js` and `providers/gen3d.js` (reference pictures).
- **Headers on every answer**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Content-Security-Policy: frame-ancestors 'self'; base-uri 'self'; object-src 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(self), geolocation=()`, `Strict-Transport-Security: max-age=15552000` when the visit came over HTTPS; `X-Powered-By` removed. The page's own script is inline, so a script policy is not set yet (see §3.9).
- **Uploads** keep their extension only when it is a media/data kind the site works with (pictures, video, sound, 3D, captions, fonts, LUTs, PDF, ZIP…); anything else is stored as `.bin`. One file per request.
- **`/media`** answers document-like files (html, xml, svg, scripts, styles) with `Content-Security-Policy: default-src 'none'; sandbox`, and html/scripts/styles as `text/plain` — a file can never become a page on the site's address. Pictures, video, sound and models are untouched.
- Media-name resolvers in `lib/edit145.js`, `lib/edit148.js`, `lib/slowmo163.js`, `lib/studio153.js` now accept `[A-Za-z0-9][A-Za-z0-9._-]{0,200}` only.
- Dependencies: `npm audit fix` (body-parser, node-forge, qs, undici), `nodemailer` 6 → 10.3, `node-cron` 3 → 4.6.

## 3. Advice for the owner (in order of importance)

1. **Production environment** (`/opt/nooi/.env`, mode 600, owned by root): `FIREBASE_PROJECT_ID` **and** `FIREBASE_SERVICE_ACCOUNT` set (never run the no-sign-in mode on the internet), `PUBLIC_BASE_URL=https://nooi.ai` (also what CORS allows), `SECRET_KEY` of 40+ random characters. `bash /opt/nooi/deploy/doctor.sh` checks these.
2. **Nginx**: port 80 only redirects to 443; TLS 1.2+; pass `X-Forwarded-Proto` (`proxy_set_header X-Forwarded-Proto $scheme;`) so the server sends HSTS; `client_max_body_size 1g` only for `location /v1/uploads` and `10m` elsewhere; `limit_req_zone` on `/v1/` (for example 20 r/s, burst 40 per IP) and a stricter one on `/v1/auth` and `/v1/analyze-site`; `server_tokens off`.
3. **Firewall and SSH**: `ufw` allowing 22, 80, 443 only; SSH by key, `PasswordAuthentication no`, `PermitRootLogin prohibit-password`; `fail2ban` on sshd and the Nginx limit-req log.
4. **Keys and accounts**: engine, payment and email keys are entered in Admin and never pasted into chats, tickets or commit messages — any key that ever was, rotate it now (NVIDIA, Kie, MiniMax, Moyasar, Stripe, SMTP). Two-factor sign-in on GitHub, Hostinger, Firebase/Google Cloud and every provider account.
5. **Backups**: `data/` (accounts, credits, settings, audit) nightly to another machine or bucket (the v186 backup script packs it; media separately, weekly), and **test a restore** once a quarter. Keep a copy of the C2PA signing certificate.
6. **Updates**: `npm audit` monthly; Node on the current LTS (20 or 22); `firebase-admin` 12 → 14 to clear the remaining 8 moderate advisories (it drops Node 18 — check `node -v` on the VPS first, then run suite steps 54 and 112); `apt update && apt upgrade` on the VPS monthly, `unattended-upgrades` for security patches.
7. **Firebase Authentication**: authorized domains limited to `nooi.ai`; email-enumeration protection on; if sign-up abuse appears, App Check / reCAPTCHA Enterprise.
8. **Watching**: `doctor.sh` weekly; Admin → audit log for admin actions; Nginx access log for bursts of 401/403/429 and 5xx; disk alerts (v188 `space.sh`).
9. **Next hardening in code** (not urgent): a strict `Content-Security-Policy` for scripts needs the page's inline script moved to a file with a nonce or hash — worth doing when the page is next split; signed, short-lived download links instead of `?token=` in a URL (a token in a URL lands in logs and browser history); the v182 team-only gate for any staging copy of the site.
10. **Processes**: a staging copy gets its own Firebase project and `PUBLIC_BASE_URL`; never copy `data/` with live keys onto a laptop; the one local owner in the no-sign-in mode is for tests only.

## 4. Reporting a problem

Write to contact@nooi.ai with the address, the steps and the time. Nothing from a customer is published: the site's own data, keys and logs stay on the server.

---

## ملخّص بالعربية

**ما فُحص:** تسجيل الدخول (رموز Firebase تُتحقّق على الخادم، رموز الاتصال مخزّنة كبصمات SHA-256)، صلاحيات الإدارة (كل مسار `/v1/admin` خلف `requireAdmin`)، الرفع والوسائط، قراءة الخادم للعناوين (SSRF)، ترويسات المتصفّح، CORS، حدود الطلبات، المدفوعات (تواقيع الإشعارات)، العمليات الفرعية (بلا shell)، الصفحة (كل نصوص العملاء عبر `esc()`)، النشر، والتبعيات (`npm audit`).

**ما أُصلح في v195:**
- حارس واحد لكل عنوان يقرأه الخادم بناءً على كلمة العميل (`lib/safeurl.js`): عناوين الإنترنت العامة فقط، كل عنوان DNS يُفحص، كل قفزة تحويل تُفحص، لا عناوين داخلية ولا عنوان بيانات السحابة؛ طُبِّق على تحليل المواقع وصور المرجع لمحرّكات NVIDIA والمحرّكات ثلاثية الأبعاد.
- ترويسات أمان على كل ردّ (منع تخمين النوع، منع التأطير من مواقع أخرى، سياسة الإحالة، الصلاحيات، HSTS عبر HTTPS) وإزالة `X-Powered-By`.
- الرفع يحتفظ بالامتداد فقط لأنواع الوسائط والبيانات المعروفة، وغير ذلك يُخزَّن `.bin`؛ ملفات `/media` الشبيهة بالصفحات تُجاب كنص عادي داخل sandbox — لا يمكن لملف مرفوع أن يصبح صفحة على عنوان الموقع.
- تشديد أنماط أسماء الوسائط في أربعة ملفات؛ تحديث التبعيات: صفر ثغرات عالية (كانت 4).

**نصائح للمالك بالترتيب:** (1) بيئة الإنتاج: `FIREBASE_PROJECT_ID` و`FIREBASE_SERVICE_ACCOUNT` و`PUBLIC_BASE_URL=https://nooi.ai` و`SECRET_KEY` طويل؛ لا يعمل وضع «بلا تسجيل دخول» على الإنترنت أبدًا. (2) Nginx: HTTPS فقط، تمرير `X-Forwarded-Proto`، حدّ حجم الجسم 1g لمسار الرفع فقط، `limit_req` على `/v1/`. (3) جدار ناري 22/80/443 فقط، SSH بالمفاتيح، fail2ban. (4) المفاتيح تُدخل من لوحة الإدارة فقط؛ أي مفتاح لُصق يومًا في محادثة يُبدَّل الآن؛ تحقّق بخطوتين على كل الحسابات. (5) نسخ احتياطي ليلي لمجلد `data/` خارج الخادم واختبار الاستعادة. (6) `npm audit` شهريًا، Node LTS، ترقية `firebase-admin` إلى 14. (7) Firebase: النطاقات المصرّح بها `nooi.ai` فقط. (8) مراقبة `doctor.sh` وسجل التدقيق. (9) لاحقًا في الكود: سياسة CSP كاملة للسكربت، وروابط تنزيل موقّعة قصيرة العمر بدل `?token=`.
