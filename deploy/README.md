# Deploy nooi.ai on your Hostinger VPS · تشغيل nooi.ai على خادم Hostinger

## 1 · VPS operating system · نظام التشغيل
hPanel → VPS → **OS & Panel → Operating System** → choose **Ubuntu 24.04** (plain, no control panel).
من hPanel ← VPS ← نظام التشغيل ← اختر **Ubuntu 24.04** (بدون لوحة تحكم).

## 2 · Point the domain to the VPS · ربط النطاق بالخادم
hPanel → Domains → your domain → **DNS / Nameservers → DNS records**:
| Type | Name | Points to | TTL |
|---|---|---|---|
| A | @ | *your VPS IP* | 300 |
| A | www | *your VPS IP* | 300 |
Delete any other A/AAAA records for @ and www. The VPS IP is on hPanel → VPS → Overview.
احذف أي سجلات A أو AAAA أخرى لـ @ و www. عنوان IP تجده في صفحة الـ VPS.

## 3 · Upload the package · رفع الحزمة
From your computer (Terminal / PowerShell):
```bash
scp nooi-server.zip root@YOUR_VPS_IP:/root/
```
Or open **hPanel → VPS → Browser terminal** and upload with any method you prefer.

## 4 · Install (one command) · التثبيت بأمر واحد
```bash
ssh root@YOUR_VPS_IP
apt-get update && apt-get install -y unzip
unzip -o nooi-server.zip && cd nooi-server/deploy
bash install.sh nooi.ai contact@nooi.ai
```
What it does automatically · ماذا يفعل تلقائياً:
Node.js 20 · ffmpeg · Nginx · free HTTPS (Let's Encrypt, auto-renew) · firewall + fail2ban · auto-start & auto-restart service · daily backups (14 days) · health check every 5 min · automatic security updates · swap on small plans.

## 5 · Add your keys (on the server — never in chat) · أضف مفاتيحك على الخادم فقط
```bash
nano /opt/nooi/.env        # then:
systemctl restart nooi
```
Most provider & payment keys can also be added from **Admin dashboard → AI providers / Payments** (stored encrypted).
يمكن إضافة أغلب المفاتيح من لوحة الإدارة وتُحفظ مشفّرة.

## Everyday commands · أوامر يومية
| Task | Command |
|---|---|
| Live logs · السجلات | `journalctl -u nooi -f` |
| Restart · إعادة تشغيل | `systemctl restart nooi` |
| Update to a new package · تحديث | `nooi-update /root/nooi-server.zip` (auto-rollback on failure) |
| Backup now · نسخة احتياطية | `nooi-backup` |
| Restore · استرجاع | `bash /opt/nooi/deploy/restore.sh /var/backups/nooi/<file>.tgz` |

## Hostinger firewall · جدار الحماية في Hostinger
If hPanel → VPS → **Firewall** is enabled, allow ports **22, 80, 443**.
