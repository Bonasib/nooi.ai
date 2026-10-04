# nooi.ai — Payments roadmap · خارطة طريق المدفوعات

| # | Phase · المرحلة | Status · الحالة | What · ماذا |
|---|---|---|---|
| 0 | Business & compliance · النشاط والامتثال | ✅ App | Policies (Terms, Privacy, Refunds, AUP, Copyright, Cookies) in 14 languages · business details · 18+ gate · consent at checkout · content filter (app + server). Your side: CR, VAT, bank account (IBAN), domain email. |
| 1 | Credit packs checkout · الدفع لحزم الرصيد | ✅ Server | `lib/billing.js`: hosted checkout (Moyasar invoices · Tap charges · Stripe Checkout), return + webhook, **re-verify with provider before crediting**, idempotent, amount/currency match check. |
| 2 | Subscriptions · الاشتراكات | ⏭ Next | Saved-card tokens, monthly/yearly renewals, proration, 7-day grace, renewal reminders, cancel in Account. |
| 3 | Credits in every tool · الرصيد في كل الأدوات | ✅ Server | One price table (`priceOf`) for video, images, dubbing, 3D, sketch; text AI by tier (fast 0 · balanced 1 · strongest 2); **automatic refund on failed jobs**; ledger per user; `GET /v1/billing`. |
| 4 | Tax & invoices · الضريبة والفواتير | ⏭ Next | ZATCA Fatoora e-invoices (QR, 15% VAT), credit notes for refunds, PDF invoices in Account. |
| 5 | Teams & enterprise · الفرق والشركات | Later | Seats, shared credit pools, invoicing / bank transfer / POs. |
| 6 | API & MCP billing · فوترة API وMCP | ✅ Server | Personal tokens (`/v1/tokens`), every MCP/API call charged to credits, per-plan rate limits (next). |
| 7 | Marketplace payouts · مدفوعات السوق | Later | Sell templates, 3D assets, voices; revenue share; creator KYC & payouts. |
| 8 | Risk & chargebacks · المخاطر والاعتراضات | ⏭ Next | 3-D Secure, velocity limits, disposable-email blocking, refunds dashboard, dispute evidence export. |
| 9 | Currencies & methods · العملات والوسائل | Later | SAR · AED · USD · EUR; mada, Apple Pay, STC Pay; Tabby/Tamara for yearly plans. |

## Go-live checklist · قبل الإطلاق
1. Sandbox keys → test purchase, failed card, refund, webhook replay (must not double-credit).
2. Set `PAYMENT_PROVIDER` + secret key, `PUBLIC_BASE_URL` (HTTPS), statement descriptor **NOOI.AI**.
3. Fill Business details in the app so every policy and the footer show your legal name, CR, VAT, address, email and phone.
4. Point the provider's webhook to `https://YOUR_DOMAIN/v1/billing/webhook/<provider>`.
5. Keep the content filter on and add a moderation model — AI platforms are reviewed as higher risk.

> Provider APIs change — confirm each endpoint against the provider's current documentation in sandbox before going live.
