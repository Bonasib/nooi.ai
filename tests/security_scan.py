# Fails if anything that looks like a real secret ships in the browser bundle.
import re, sys, pathlib
p = pathlib.Path(__file__).resolve().parent.parent / "public" / "index.html"
s = p.read_text(encoding="utf-8")
PATTERNS = {"OpenAI/Anthropic style key": r"sk-(?:ant-|live_|proj-)?[A-Za-z0-9_-]{20,}", "Google API key": r"AIza[0-9A-Za-z_-]{35}", "Stripe secret": r"(?:sk|rk)_live_[0-9A-Za-z]{16,}",
            "ElevenLabs header with value": r"xi-api-key\"\s*:\s*\"[A-Za-z0-9]{16,}", "Bearer token literal": r"Bearer [A-Za-z0-9._-]{30,}", "Private key block": r"-----BEGIN [A-Z ]*PRIVATE KEY-----"}
hits = {k: len(re.findall(v, s)) for k, v in PATTERNS.items()}
bad = {k: n for k, n in hits.items() if n}
print("secrets in the browser bundle:", bad or "none")
sys.exit(1 if bad else 0)
