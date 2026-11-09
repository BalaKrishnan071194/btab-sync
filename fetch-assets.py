"""
Downloads and bundles all local assets for bTab Sync.
Run: python fetch-assets.py

Assets fetched:
  - Lucide icons (ISC license)
  - Inter font weights 400/500/600/700 (SIL OFL 1.1)
"""
import urllib.request, os, json
from pathlib import Path

SRC = Path(__file__).parent
ASSETS = SRC / "assets"
FONTS  = ASSETS / "fonts"
ASSETS.mkdir(exist_ok=True)
FONTS.mkdir(exist_ok=True)

def dl(url, dest):
    print(f"  Downloading {dest.name} ...", end=" ", flush=True)
    urllib.request.urlretrieve(url, dest)
    print(f"{dest.stat().st_size // 1024} KB")

# ── Lucide icons (ISC license) ────────────────────────────────────────────────
dl(
    "https://unpkg.com/lucide@latest/dist/umd/lucide.min.js",
    ASSETS / "lucide.min.js"
)

# ── Inter font — latin subset, woff2 (SIL OFL 1.1) ───────────────────────────
BASE = "https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files"
for weight in [300, 400, 500, 600, 700]:
    dl(f"{BASE}/inter-latin-{weight}-normal.woff2", FONTS / f"inter-{weight}.woff2")

# ── Generate fonts.css ────────────────────────────────────────────────────────
faces = ""
for weight in [300, 400, 500, 600, 700]:
    faces += f"""@font-face {{
  font-family: "Inter";
  font-style: normal;
  font-weight: {weight};
  font-display: swap;
  src: url("assets/fonts/inter-{weight}.woff2") format("woff2");
}}
"""

css_path = SRC / "fonts.css"
css_path.write_text(faces, encoding="utf-8")
print(f"  Generated fonts.css ({css_path.stat().st_size} bytes)")

# ── Summary ───────────────────────────────────────────────────────────────────
total = sum(f.stat().st_size for f in [*FONTS.glob("*.woff2"), ASSETS/"lucide.min.js"])
print(f"\n  Total asset bundle: {total // 1024} KB")
print("  No network required at runtime.\n")

print("Next steps:")
print("  1. Add assets/ and fonts.css to manifest web_accessible_resources")
print("  2. In popup.html: <script src='assets/lucide.min.js'></script>")
print("  3. In popup.js: lucide.createIcons() after each render")
print("  4. In overlay.css: replace @import with link to fonts.css")
