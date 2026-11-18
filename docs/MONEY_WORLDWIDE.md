# Money worldwide: a decision note (nothing built yet)

## Where nooi is today
- Prices are shown in **SAR or USD** only.
- **Every invoice includes Saudi VAT (15%)**, wherever the buyer lives (`lib/invoices.js`).
- Payment providers you can switch on in Admin: Stripe, PayPal, Airwallex, Moyasar and Tap.
- A credit floor (`CREDIT_FLOOR_USD`) keeps every sale above what the AI engines cost.

## What has to change for customers worldwide
1. **Tax.** Many places tax digital services where the *buyer* lives: the EU, the UK, Norway, Switzerland, Australia, India, many US states and others. A German consumer should pay German VAT, not Saudi VAT. Someone has to register, collect and file in each of those places.
2. **Currency.** People buy more readily in their own currency, and paying in a foreign one adds card exchange fees.
3. **Price level.** A US price is heavy in Egypt, India or Indonesia.
4. **How people pay.** Cards are not the main way to pay everywhere. Examples: mada and STC Pay (Saudi Arabia), iDEAL and SEPA (Europe), Pix (Brazil), UPI (India), Alipay and WeChat Pay (China).

## The main decision: who is the seller abroad?
| | A. A merchant of record sells for you | B. You stay the seller, with a tax engine | C. Both (recommended now) |
|---|---|---|---|
| What it is | Paddle, Stripe Managed Payments or Lemon Squeezy is the legal seller. It collects and files VAT and sales tax everywhere, handles refunds and chargebacks, and sends the receipts. | You keep Stripe, Airwallex and the others. Stripe Tax (or similar) works out the tax, but you register and file in each place (one EU registration, "non-Union OSS", covers EU consumers). | Saudi and Gulf customers pay nooi directly (Moyasar or Tap: mada, STC Pay, Apple Pay, 15% VAT invoice as today). Everyone else pays through a merchant of record. |
| Cost (reported) | Paddle: 5% + $0.50 all-in. Stripe Managed Payments: about 3.5% on top of Stripe's normal fees. Lemon Squeezy: 5% + $0.50 plus international extras. Exchange-rate margins come on top. | Stripe Tax: 0.5% of volume where you're registered, or $90–$1,500 a month with registrations and filings included. Plus an accountant and the registrations themselves. | MoR fee on international sales only. |
| Good | One integration, no foreign registrations, works from the first sale | Cheapest per sale once volume is high; your own invoices and payouts | Keeps the home market's local methods and invoices; no foreign tax work until it pays off |
| Watch | They must approve the business. **Ask each one whether AI video, voice cloning and face swaps are allowed.** Their receipt replaces your invoice. | Admin work and legal risk in every country; needs a tax adviser | Two checkouts to keep in step |

**Recommendation: C now, B later.** Move to B when the merchant-of-record premium over B (roughly 2–3% of international sales) costs more than registrations, filings and an accountant. That point is around **$100k a month** of international sales if those fixed costs come to about $2,500 a month. Check this with your accountant.

## Prices and currencies
- **Fixed price lists per currency**, not live exchange rates, rounded to nice numbers (for example 9.99 EUR, 39 AED, 799 INR). Review them every quarter.
- Start with about 10 currencies: USD, EUR, GBP, SAR, AED, EGP, INR, IDR, TRY, BRL. Airwallex and the merchants of record accept 100+.
- **Purchasing-power tiers**, three for a start:
  - Tier A, full price: US, EU, UK, Gulf.
  - Tier B, about 60–70%: for example Türkiye, Brazil, Mexico, Malaysia.
  - Tier C, about 35–50%: for example Egypt, India, Indonesia, Pakistan, Vietnam, Bangladesh.
  - The tier follows the **card's or billing country**, not the IP address, so a VPN doesn't change the price.
  - The engines cost the same in every country, so a lower tier cuts nooi's margin, never below the credit floor. Plans can drop more than credit top-ups.
- Show prices the local way: tax included in the EU, UK and Gulf; tax added at checkout in the US.

## Payment methods by region
Moyasar and Tap cover the Gulf: mada, STC Pay and Apple Pay. Airwallex lists 30+ local methods (iDEAL, Bancontact, Alipay, WeChat Pay, GrabPay and others) and collects in 130+ currencies. Each merchant of record has its own list, so compare them for the countries you care about before choosing.

## The owner's decisions
1. Keep Saudi and Gulf sales local (C)? Which merchant of record for the rest? Ask Paddle and Stripe about AI face swaps first.
2. Approve the currency price list and the three tiers (countries and percentages).
3. An accountant for ZATCA now, and for foreign registrations later.

## When it's decided (about 3–5 days of work)
- Price tables per currency and tier.
- The country and tier at checkout.
- The merchant-of-record checkout and webhook that adds credits, like the providers today.
- Invoices: the existing VAT invoice for local sales, the merchant of record's receipt for the rest.
- Tax-inclusive or tax-added prices on the page, by country.
- Tests with mocked providers.

Sources (fees and rules change, so confirm each on the provider's own page before signing):
[Paddle fees — Dodo Payments](https://dodopayments.com/blogs/paddle-fees-explained) ·
[Paddle vs Lemon Squeezy — Rework](https://resources.rework.com/tools/billing-revenue/paddle-vs-lemon-squeezy) ·
[Stripe Managed Payments fees — Dodo Payments](https://dodopayments.com/blogs/stripe-managed-payments-fees-explained) ·
[Merchant of record in 2026](https://alexcloudstar.com/blog/merchant-of-record-indie-saas-2026/) ·
[Stripe Tax pricing — Stripe support](https://support.stripe.com/questions/understanding-stripe-tax-pricing) ·
[Stripe Tax pay-as-you-go — Stripe support](https://support.stripe.com/questions/understanding-stripe-tax-pay-as-you-go-pricing) ·
[EU VAT registration — Stripe guide](https://stripe.com/en-cy/guides/tax-registration-process-europe) ·
[EU VAT on digital services — Avalara](https://www.avalara.com/vatlive/en/eu-vat-rules/eu-vat-digital-services-moss.html) ·
[Airwallex payment methods](https://www.airwallex.com/docs/payments/payment-methods) ·
[Airwallex supported currencies](https://www.airwallex.com/docs/payments__supported-currencies) ·
[Airwallex WooCommerce plugin](https://wordpress.org/plugins/airwallex-online-payments-gateway/)
