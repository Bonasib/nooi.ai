# nooi.ai — Server

الخادم الذي يشغّل الاستوديو فعلياً: يربط واجهاتك البرمجية (APIs)، ويدير عمليات التوليد، ويحلل المواقع، ويجدول النشر على السوشال ميديا، ويدير تسجيل الدخول.
The server that makes the studio real: it bridges your APIs, runs generation jobs, analyzes websites, schedules social posts, and handles sign-in.

## التشغيل · Run

```bash
npm install
cp .env.example .env      # ثم أضف مفاتيحك · then add your keys
npm start                 # http://localhost:8080
```

المتطلبات · Requirements: Node.js 18.17+، و ffmpeg (لربط الفصول من آخر إطار · to chain chapters from the last frame)، ونطاق https عام (PUBLIC_BASE_URL) لأن منصات السوشال تسحب الملفات منه · and a public https domain, because social platforms pull media from it.

## أين تضع كل مفتاح · Where each key goes

| الأداة · Tool | المتغيرات · Variables | الملف الذي يُعدَّل عند الربط · File to map |
|---|---|---|
| توليد الفيديو WAN 3.0 · Video | `WAN_API_URL` `WAN_API_KEY` `WAN_MODEL` | `providers/index.js → wanBody` |
| الصور · Images | `IMAGE_API_URL` `IMAGE_API_KEY` | `providers/index.js` |
| الأصوات · Voice | `TTS_API_URL` `TTS_API_KEY` | `providers/index.js` |
| مزامنة الشفاه · Lip sync | `LIPSYNC_API_URL` `LIPSYNC_API_KEY` | `providers/index.js` |
| الموسيقى · Music & SFX | `MUSIC_API_URL` `MUSIC_API_KEY` | `providers/index.js` |
| إزالة الخلفية · AI matting | `MATTING_API_URL` `MATTING_API_KEY` | `providers/index.js` |
| التقاط الحركة · Motion capture | `MOCAP_API_URL` `MOCAP_API_KEY` | `providers/index.js` |
| التحسين · Upscale/60fps/restore | `ENHANCE_API_URL` `ENHANCE_API_KEY` | `providers/index.js` |
| التعديل بالوصف · Prompt edit | `EDIT_API_URL` `EDIT_API_KEY` | `providers/index.js` |
| التفريغ النصي · Transcription | `STT_API_URL` `STT_API_KEY` | `providers/index.js → transcribe` (يُعيد segments بتوقيت · returns timed segments) |
| الدبلجة · Dubbing (35 لغة) | `DUB_API_URL` `DUB_API_KEY` | `providers/index.js → dub` |
| ترجمة السطور · Subtitle translation | `ANTHROPIC_API_KEY` | جاهز · ready |
| القصة والنصوص والترجمة وتحليل الموقع · Text AI | `LLM_BASE_URL` `LLM_API_KEY` `LLM_MODEL` | جاهز لـ Claude أو Qwen · ready for Claude or Qwen |
| تسجيل الدخول · Sign-in | `FIREBASE_*` | جاهز · ready |
| النشر · Social | `META_*` `TIKTOK_*` `GOOGLE_*` `X_*` `LINKEDIN_*` | جاهز لإنستغرام وفيسبوك وتيك توك ويوتيوب · ready for IG/FB/TikTok/YouTube |

كل مزوّد يستخدم محوّلاً عاماً (`providers/generic.js`) يتوقع النمط الشائع: إرسال طلب ← رقم مهمة ← متابعة الحالة حتى يظهر رابط الناتج. عندما ترسل لي وثائق كل API، أعدّل دالة `buildBody` الخاصة به فقط.
Each provider uses a generic adapter expecting the common pattern: submit → job id → poll until an output URL. When you send each API's docs, only its `buildBody` mapping changes.

## تسجيل الدخول · Sign-in (Firebase)
فعّل في Firebase Console: Google، Apple، Email link، Phone. أضف نطاقك إلى Authorized domains. رسائل SMS تُرسل عبر Firebase Phone Auth.
Enable Google, Apple, Email link and Phone providers; add your domain to Authorized domains. SMS is sent by Firebase Phone Auth.

## النشر على المنصات · Social publishing
- **Instagram / Facebook:** تطبيق Meta بصلاحيات `instagram_content_publish` و `pages_manage_posts` وحساب إنستغرام تجاري مرتبط بصفحة فيسبوك · Meta app + IG Business account linked to a Page.
- **TikTok:** Content Posting API. خيار `PULL_FROM_URL` يتطلب توثيق نطاق الملفات في بوابة مطوري تيك توك. المنشورات تكون خاصة (`SELF_ONLY`) حتى تجتاز تطبيقك مراجعة تيك توك · Requires a verified media domain; posts stay private until your app passes TikTok's audit.
- **YouTube:** YouTube Data API v3. الرفع خاص افتراضياً (`YOUTUBE_PRIVACY`) · Uploads are private by default.
- **X / LinkedIn / Snapchat:** الربط (OAuth) جاهز؛ رفع الوسائط سيُكمَل عند تزويدي بصلاحيات تطبيقك · OAuth is ready; media upload will be finished once you share your app access.

عنوان إعادة التوجيه لكل منصة · Redirect URI per platform: `https://YOUR_DOMAIN/v1/oauth/<meta|tiktok|youtube|x|linkedin>/callback`

## ملاحظات · Notes
- البيانات تُحفظ في `data/db.json` — انقلها إلى قاعدة بيانات عند التوسع · Data lives in `data/db.json`; move to a database when you scale.
- بدون `FIREBASE_PROJECT_ID` يعمل الخادم بمستخدم محلي واحد — لا تنشره للعامة هكذا · Without Firebase it runs as one local user — don't expose it publicly.
- واجهات المنصات تتغير؛ راجع أحدث الوثائق قبل الإطلاق · Platform APIs change; check current docs before launch.

## اللغات · Languages
- الواجهة: العربية والإنجليزية مدمجتان؛ الفرنسية واليابانية والصينية والهندية والإسبانية والكورية والروسية والفلبينية والملايوية والصومالية والأمهرية والتركية تُترجم تلقائياً عبر `/v1/llm/json` وتُحفظ في المتصفح · Interface: AR/EN built in, 12 more auto-translated via `/v1/llm/json` and cached.
- الترجمة والدبلجة: 36 لغة مع لهجات (19 لهجة عربية، 10 إنجليزية، وغيرها). اسم اللهجة يصل للمزوّد في `meta.dialect` و`meta.dialectName` · Subtitles & dubbing: 36 languages with dialects; passed to providers as `meta.dialect` / `meta.dialectName`.

## تجربة Qwen · Qwen trial
ضع في `.env` · Put in `.env`:
```
LLM_BASE_URL=https://token-plan.maas.qwencloudapi.com/apps/anthropic
LLM_API_KEY=<مفتاحك · your key>
LLM_MODEL=<اسم النموذج من لوحة Qwen · model name from your Qwen console>
```
ثم شغّل الخادم وافتح «الربط والواجهات» ← «اختبر الاتصال». أو من الطرفية · Then start the server and press "Test connection", or from a terminal:
```bash
curl "$LLM_BASE_URL/v1/messages" -H "x-api-key: $LLM_API_KEY" -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"'"$LLM_MODEL"'","max_tokens":20,"messages":[{"role":"user","content":"Reply with exactly: OK"}]}'
```
للرجوع إلى Claude لاحقاً: احذف `LLM_BASE_URL` وضع مفتاح Claude في `LLM_API_KEY` · To switch back to Claude, clear `LLM_BASE_URL` and use a Claude key.


## جديد · New
- **المدفوعات · Payments:** `lib/billing.js` — سجل رصيد، تسعير موحّد، استرداد تلقائي للمهام الفاشلة، الدفع عبر Moyasar أو Tap أو Stripe. See `docs/PAYMENTS_ROADMAP.md`.
- **السياسات · Policies:** `docs/policies/*.en.md` و `*.ar.md` (الشروط، الخصوصية، الاسترداد، الاستخدام المقبول، حقوق النشر، ملفات الارتباط).
- **MCP:** `POST /mcp` + رموز API. See `integrations/README.md` (Claude · ChatGPT · Qwen · Blender · Unity).
- **الرسم الحي · Live Sketch:** `POST /v1/realtime/sketch` → `REALTIME_API_URL`.
- **اختيار النموذج الذكي · Smart routing:** `LLM_MODEL_FAST` / `LLM_MODEL` / `LLM_MODEL_STRONG` حسب صعوبة المهمة.

- **المخططات الأرضية · Floor plans:** `POST /v1/llm/json` يقبل `images` (حتى صورتين) لقراءة الغرف والأبعاد والرموز من المخطط — يحتاج نموذجاً يدعم الصور (Claude أو Qwen-VL).

## لوحة الإدارة · Admin dashboard
- ضع بريدك في `ADMIN_EMAILS` لتكون المالك، و`SECRET_KEY` لتشفير المفاتيح. Put your email in `ADMIN_EMAILS` (owner) and set `SECRET_KEY`.
- الأدوار: مالك، مشرف عام، دعم، مالية، مشرف محتوى، مشاهد — والصلاحيات قابلة للتعديل. Roles & permissions are editable.
- المزودون: Seedance، Kling، Qwen (DashScope + نصوص)، WAN، Claude، الصوت، SAM 3D، الرسم الفوري، البريد — تُحفظ المفاتيح مشفّرة.
- الدفع: Stripe، PayPal (بالدولار)، Airwallex، ميسّر، تاب — تفعيل وإيقاف من اللوحة. Webhooks: `/v1/billing/webhook/<provider>`.
- الدعم: `/v1/support/tickets` للعملاء، ورسائل البريد من contact@nooi.ai.
> تحقق من نقاط الاتصال ومعرّفات النماذج لكل مزوّد في وضع الاختبار قبل الإطلاق. Verify each provider's endpoints and model ids in sandbox before launch.

## مزايا كرت الشاشة · GPU features
متوقفة حالياً (SAM 3D، الجسم ثلاثي الأبعاد، Render Streaming). لإعادتها لاحقاً: `GPU_FEATURES=true` في `.env` و`GPU_FEATURES=true` في الواجهة، مع خدمة GPU متصلة.
Currently off. To bring them back later set `GPU_FEATURES=true` (server `.env` and the studio flag) with a GPU service connected.
