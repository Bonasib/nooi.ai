# nooi — from 1 customer to millions (v124)

What happens when many customers create at the same moment, what v124 changed, how far the site goes as it is, and what each
next step needs. English first, then Arabic.

## Why customers saw "High demand right now"

The AI engine takes only so many **new** tasks from one account in a window. Kie's published limit is **20 new generation
requests every 10 seconds per account**. More than that are answered `429` and **dropped, not queued**. Kie's support can raise
the limit after reviewing the account's volume. Kie sets no strict limit on tasks already running.

Before v124 the server sent everything at once. A busy moment got `429`s, tried 3 times in about 4 seconds, then tried other
models on the same account (busy too) and failed the job: "High demand right now".

## What v124 does (in this repository, tested)

| Part | What it does |
| --- | --- |
| Send line (`lib/line124.js`) | New tasks leave at the pace the engine takes them (90 % of its limit, with room for network delay). A `429` puts the task back at the **front** of the line, then the line pauses (0.5 s, growing only while the engine keeps saying it) and slows a little. It speeds up again by itself. |
| Fair line | The next task is the oldest one of the customer served longest ago. One customer's 50 pictures don't hold up everyone else. |
| Place in line | The job's card says "12 ahead of you · starts in about 10 s". Nothing to do: it starts by itself. |
| Too long a wait | After 20 min (`LINE_MAX_MIN`) the job fails with everything given back, and says why in the reader's language. |
| No model hopping on "too many" | The next model is on the same account, so switching models only used up the limit faster. |
| Engine checks | The server checks running jobs often at first, less as they take longer (2 s · 5 s · 10 s; with a call-back 6 · 15 · 30 s). It makes at most 10 checks a second per engine. A "too many" on a check is not the job's fault. |
| Jobs being made, kept apart | The server's loops look only at jobs still being made, not at every job of every customer every second. |
| One request per page | An open page asks about all its jobs in one request (`/v1/jobs/live`), and only every 15 s while its tab is hidden. |
| The page, compressed | 2.6 MB → **636 KB** brotli / 900 KB gzip, made once and kept in memory, with an ETag. A returning visitor downloads nothing (304). |
| Messages in the reader's language | "High demand…" on an Arabic page that opened in English is now Arabic. |
| Admin → Speed | Shows the line (waiting, sent, "too many" in the last hour, given back) and in words why tasks waited. The engine limit can be raised there after the engine's support raises it. |

Test: 60 jobs sent at once to an engine that takes 6 a second, plus a burst of "too many" from another app on the same key.
All 60 finished, none failed; none was refused for being over the limit (`tests/v124.mjs`).

## How far it goes as it is (one server, one Node process, the data file)

- **Engine:** at Kie's default limit, about 16 new tasks every 10 s after the safety margin. That is about 5,900 an hour and
  140,000 a day. Above that, customers wait their turn: minutes, not failures. Each job's own making time (the engine's queue
  and render) is extra.
- **This server:** one Node process and one data file (`data/db.json`), written whole on each save. That is fine for thousands
  of visitors at once and tens of thousands of accounts. The Admin speed card warns when saving takes over 250 ms. That is the
  sign the data file is getting too big.

## What each next step needs (each needs the owner's approval: it changes hosting and costs)

1. **Now, no code:** ask Kie's support for a higher limit, then set it in Admin → Speed → Engine limit. Put a CDN (e.g.
   Cloudflare) in front of the site and `/media`.
2. **Tens of thousands of customers a day:**
   - Media files in object storage (S3 / R2) behind the CDN.
   - PostgreSQL instead of the data file.
   - The send line in Redis, so several Node processes or servers share one line.
   - Video work (ffmpeg) in its own worker processes.
3. **Millions:**
   - A managed database with read copies.
   - A job queue (Redis/BullMQ or SQS) with workers that grow with the load.
   - Several engine accounts or providers under contract with higher limits, each with its own line.
   - Plan priority in the line (Studio first) if wanted.
4. **12,000,000 customers:** if each makes one job a day, that is about 139 new tasks a second, about 70 times Kie's default
   limit. Only engine contracts (higher limits, several providers) give that. The line spreads whatever the engines take
   fairly; it can't create engine capacity.

---

## بالعربية

**لماذا ظهرت "ضغط عالٍ حالياً":** يقبل محرّك الذكاء عدداً محدوداً من المهام **الجديدة** من الحساب الواحد في كل فترة. الحدّ المنشور
لـKie هو **20 طلباً جديداً كل 10 ثوانٍ**، وما زاد يُرفض برمز 429 ويُسقط ولا يُوضع في طابور. يمكن لدعمهم رفع الحد بعد مراجعة حجم
الاستخدام. قبل v124 كان الخادم يرسل كل شيء دفعة واحدة، فيحاول 3 مرات خلال 4 ثوانٍ تقريباً ثم يفشل.

**ما يفعله v124:**
- **طابور إرسال:** تخرج المهام بالوتيرة التي يقبلها المحرّك. إن قال المحرّك "كثير" تعود المهمة إلى **مقدمة** الطابور.
- **طابور عادل بين العملاء:** خمسون صورة لعميل واحد لا تؤخّر الآخرين.
- **مكان المهمة في الطابور:** تظهر على بطاقتها ("أمامك 12 · يبدأ خلال نحو 10 ث").
- **الانتظار الطويل:** بعد 20 دقيقة يُعاد الرصيد مع السبب.
- **حمل الخادم:** فحوص أقل للمهام الجارية؛ طلب واحد لكل صفحة لكل مهامها، وأقل حين تكون الصفحة في الخلفية.
- **الصفحة مضغوطة:** 2.6 ميجابايت ← 636 كيلوبايت، والزائر العائد لا ينزّل شيئاً.
- **الرسائل بلغة القارئ.**
- **الإدارة ← السرعة:** حالة الطابور، وحقل لرفع حد المحرّك.

**إلى أين يصل كما هو:**
- **المحرّك:** نحو 140 ألف مهمة جديدة في اليوم بالحد الافتراضي لـKie. ما زاد ينتظر دوره ولا يفشل.
- **هذا الخادم:** آلاف الزوار في الوقت نفسه وعشرات آلاف الحسابات، بملف بيانات واحد وعملية Node واحدة.

**الخطوات التالية (كلها بموافقة المالك لأنها تغيّر الاستضافة والتكلفة):**
1. **الآن بلا برمجة:** اطلب من دعم Kie حداً أعلى ثم اكتبه في الإدارة ← السرعة، وضع CDN أمام الموقع.
2. **عشرات الآلاف يومياً:**
   - تخزين الملفات في S3/R2.
   - PostgreSQL بدل ملف البيانات.
   - الطابور في Redis لعدة خوادم.
   - عمليات منفصلة لمعالجة الفيديو.
3. **الملايين:**
   - قاعدة بيانات مُدارة.
   - طابور مهام بعمّال يتوسّعون مع الضغط.
   - عدة حسابات أو مزوّدين بعقود وحدود أعلى.
4. **12 مليون عميل:** نحو 139 مهمة جديدة في الثانية، أي قرابة 70 ضعف حد Kie الافتراضي. لا يتحقق ذلك إلا بعقود مع المحركات. الطابور
   يوزّع ما تقبله المحركات بعدل، لكنه لا يصنع سعة جديدة.

Sources: [Kie API — Getting started (rate limits)](https://docs.kie.ai/) · [kie.ai — Getting started](https://kie.ai/getting-started)
