Audit translations and text direction.
1. Run `python3 tests/i18n.py` — it lists English text visible in the Arabic UI. Ignore brand/model names, emails, native language names and user content; every other item is a bug: wrap it in `L(en, ar)` (never compute L() at load time — use a function).
2. Run `python3 tests/langviews.py` — ar/fa/ckb must be `rtl`, others `ltr`, and no page may overflow.
3. Fix, re-run, and summarise what changed (English + Arabic).
