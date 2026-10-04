# nooi.ai on Hostinger — start here
# تشغيل nooi.ai على Hostinger — ابدأ من هنا

Everything is in this folder: the platform (`public/`), the server, the database file and the install scripts.
كل شيء في هذا المجلد: المنصة (`public/`)، والخادم، وملف قاعدة البيانات، وسكربتات التثبيت.

---

## 1. Choose the right plan · اختر الباقة المناسبة
- **Use a Hostinger VPS** (KVM 2 or higher is a good start), operating system **Ubuntu 24.04**.
- **استخدم VPS من Hostinger** (باقة KVM 2 أو أعلى بداية جيدة)، بنظام **Ubuntu 24.04**.
- Shared "Web hosting" is not suitable: the platform needs Node.js 20, ffmpeg and a background worker that runs all the time.
- الاستضافة المشتركة غير مناسبة: المنصة تحتاج Node.js 20 وffmpeg وعملية خلفية تعمل باستمرار.

## 2. Point the domain · اربط النطاق
In hPanel → **Domains → nooi.ai → DNS / Nameservers** add (and delete any older A records for the same names):
في hPanel ← **النطاقات ← nooi.ai ← DNS** أضف (واحذف أي سجلات A قديمة بنفس الأسماء):

| Type | Name | Points to |
|---|---|---|
| A | @ | your VPS IP · عنوان IP للـ VPS |
| A | www | your VPS IP · عنوان IP للـ VPS |

DNS can take from a few minutes up to a few hours. · قد يستغرق التفعيل من دقائق إلى ساعات.

## 3. Upload and install · ارفع وثبّت
From your computer (replace `IP` with your VPS address):
من جهازك (استبدل `IP` بعنوان الـ VPS):
```bash
scp nooi-hostinger.zip root@IP:/root/
ssh root@IP
unzip nooi-hostinger.zip && cd nooi-server
sudo bash deploy/install.sh nooi.ai contact@nooi.ai
```
The script installs Node.js 20, ffmpeg, Nginx, free HTTPS (Let's Encrypt), the firewall, automatic restarts, health checks every 5 minutes and **daily backups**. It also creates the database and a secret key.
السكربت يثبّت Node.js 20 وffmpeg وNginx وشهادة HTTPS مجانية والجدار الناري وإعادة التشغيل التلقائي وفحص الصحة كل 5 دقائق و**النسخ الاحتياطي اليومي**، وينشئ قاعدة البيانات والمفتاح السري.

## 4. Sign in as the owner · ادخل كمالك
Open **https://nooi.ai**, sign in with **contact@nooi.ai** (the email you gave the installer = owner/admin), then open **Admin dashboard**:
افتح **https://nooi.ai** وسجّل الدخول بـ **contact@nooi.ai** (البريد الذي أعطيته للسكربت = المالك)، ثم افتح **لوحة الإدارة**:
- **AI providers** → add your keys → press **Test all**. · أضف مفاتيحك ثم اضغط «اختبار الكل».
- **Models** → set each flagship model's API id and mark it verified; upload official logos. · اضبط معرّف كل نموذج رائد وارفع الشعارات الرسمية.
- **Payments** → add keys, enable methods. Webhook addresses: `https://nooi.ai/v1/billing/webhook/stripe` (also `/paypal`, `/moyasar`, `/tap`, `/airwallex`). · أضف مفاتيح الدفع، وعناوين الـ Webhook كما في الأعلى.

## 5. Email with your Hostinger mailbox · البريد عبر صندوق Hostinger
Create **contact@nooi.ai** in hPanel → Emails, then on the server:
أنشئ **contact@nooi.ai** في hPanel ← البريد، ثم على الخادم:
```bash
nano /opt/nooi/.env        # set: EMAIL_PROVIDER=smtp  and  SMTP_PASS=your-mailbox-password
systemctl restart nooi
```
(SMTP server `smtp.hostinger.com`, port `465` are already filled in.) · (خادم SMTP والمنفذ معبّآن مسبقاً.)

## 6. The database · قاعدة البيانات
- Live database: **`/opt/nooi/data/db.json`** (one JSON file; the server saves it automatically). · قاعدة البيانات: ملف JSON واحد يحفظه الخادم تلقائياً.
- The empty starting file is `deploy/db.seed.json`; the installer copies it only if no database exists, so it **never overwrites real data**. · الملف الأولي يُنسخ فقط إن لم توجد قاعدة بيانات، فلا يمحو بيانات حقيقية.
- Backups: every night to `/var/backups/nooi` (14 days kept). Restore: `sudo bash deploy/restore.sh`. · نسخ احتياطي ليلي (يُحفظ 14 يوماً)، والاستعادة بالأمر أعلاه.
- Uploaded/generated media: `/opt/nooi/media`. · الوسائط: في هذا المجلد.

## 7. Updating later · التحديث لاحقاً
Upload the new zip, unzip, then: · ارفع الحزمة الجديدة وفك ضغطها ثم:
```bash
sudo bash deploy/update.sh
```
It keeps your database, media and `.env`, and rolls back automatically if the new version fails.
يحافظ على قاعدة البيانات والوسائط والإعدادات، ويتراجع تلقائياً إن فشلت النسخة الجديدة.

## 8. Before launch · قبل الإطلاق
- [ ] Firebase project for sign-in (Google / Apple / email link / phone) → `.env` · مشروع Firebase لتسجيل الدخول
- [ ] AI provider keys tested (Admin → AI providers → Test all) · اختبار مفاتيح مزودي الذكاء
- [ ] Payment sandbox test, then live keys · تجربة الدفع التجريبي ثم المفاتيح الحقيقية
- [ ] Official model logos uploaded · رفع الشعارات الرسمية للنماذج
- [ ] Business details (CR, VAT) in Legal & payments · بيانات المنشأة (السجل والضريبة)
- [ ] Lawyer review of Terms & Privacy · مراجعة قانونية للشروط والخصوصية

Full technical guide: `deploy/README.md`. · الدليل التقني الكامل: `deploy/README.md`.
