"""
Run this to rebuild the Firefox ZIP after any code change:
  python build-firefox.py
"""
import json, os, sys, zipfile
from pathlib import Path

SRC  = Path(__file__).parent          # btab-switcher/
OUT  = SRC.parent / "btab-switcher-firefox.zip"
LOCAL= SRC.parent / "btab-switcher-firefox-local"

EXCLUDE = {"manifest.json", "manifest-firefox.json", "build-firefox.py", 
           "package.json", "package-lock.json", "playwright.config.ts", 
           "postcss.config.cjs", "tailwind.config.ts", "tsconfig.json", 
           "vite.config.ts", "vitest.config.ts", "tracker.json", 
           "generate-icons.cjs", "fetch-assets.py"}
EXCLUDE_DIRS = {"node_modules", "dist", "src", "tests", "test-results", "playwright-report", ".git", "manifests"}

# ── Read & validate Firefox manifest ─────────────────────────────────────────
manifest_path = SRC / "manifest-firefox.json"
with open(manifest_path, encoding="utf-8-sig") as f:
    manifest = json.load(f)

print(f"  version       : {manifest['version']}")
print(f"  browser_action: {'browser_action' in manifest}")
print(f"  gecko id      : {manifest.get('browser_specific_settings',{}).get('gecko',{}).get('id','?')}")

# ── Build ZIP ─────────────────────────────────────────────────────────────────
try:
    OUT.unlink(missing_ok=True)
except PermissionError:
    print(f"  Warning: Could not delete old ZIP (in use), creating new one...")
    OUT = SRC.parent / "btab-switcher-firefox-new.zip"
with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    # Write manifest-firefox.json as manifest.json (no BOM)
    zf.writestr(
        zipfile.ZipInfo("manifest.json"),
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    )
    # Write all other files
    for f in sorted(SRC.rglob("*")):
        # Skip excluded dirs
        if any(part in EXCLUDE_DIRS for part in f.relative_to(SRC).parts):
            continue
        if f.is_file() and f.name not in EXCLUDE:
            arcname = f.relative_to(SRC).as_posix()
            zf.write(f, arcname)
            print(f"  + {arcname}")

size = OUT.stat().st_size // 1024
print(f"\nZIP: {OUT}  ({size} KB)")

# ── Also update the local test folder ─────────────────────────────────────────
LOCAL.mkdir(exist_ok=True)
(LOCAL / "manifest.json").write_text(
    json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
)
for f in sorted(SRC.rglob("*")):
    # Skip excluded dirs
    if any(part in EXCLUDE_DIRS for part in f.relative_to(SRC).parts):
        continue
    if f.is_file() and f.name not in EXCLUDE:
        dest = LOCAL / f.relative_to(SRC)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(f.read_bytes())

print(f"Local test folder updated: {LOCAL}")
print("\nDone. Reload the extension in about:debugging.")
