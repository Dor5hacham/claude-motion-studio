# Fills the generated parts of README.md from scripts/catalog.json (made by export_catalog.mjs):
# the section counts and one table per catalog section, between the CATALOG markers.
# Usage: python scripts/build_readme.py   (run from the repository root)
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
README = ROOT / "README.md"
CATALOG = ROOT / "scripts" / "catalog.json"
SECTIONS = [
    ("reel", "The reel, scene by scene"), ("type", "Text in motion"), ("mg", "2D motion graphics"), ("ui", "App and web UI motion"),
    ("sim", "Simulation and generative art"), ("gpu", "GPU shaders"), ("audio", "Sound and motion"),
    ("libs", "Animation libraries"), ("engine", "3D engines (Blender, Unreal)"), ("tools", "Code-to-video tools"),
    ("edit", "Editing and post-production"),
]


def cell(text: str) -> str:
    return text.replace("|", "/").replace("\n", " ").strip()


def main() -> int:
    cards = json.loads(CATALOG.read_text(encoding="utf-8"))
    out = []
    live = sum(1 for c in cards if c["kind"] == "live")
    clips = len(cards) - live
    sliders = sum(1 for c in cards if c["sliders"])
    out.append(f"**{len(cards)} techniques**: {live} run live in the page ({sliders} with sliders), {clips} are rendered clips.\n")
    for cat, name in SECTIONS:
        rows = [c for c in cards if c["cat"] == cat]
        if not rows:
            continue
        out.append(f"\n### {name} ({len(rows)})\n")
        poster = ROOT / "media" / "readme" / f"poster-{cat}.jpg"
        if poster.exists():
            out.append(f"![{name}](media/readme/poster-{cat}.jpg)\n")
        out.append("| Technique | Made with | Runs on | Prompt to copy |")
        out.append("|---|---|---|---|")
        for c in rows:
            kind = " (clip)" if c["kind"] == "clip" else ""
            out.append(f"| [{cell(c['title'])}](index.html#{c['id']}){kind} | {cell(c['tool'])} | {c['runs']} | {cell(c['prompt'])} |")
    block = "\n".join(out)
    text = README.read_text(encoding="utf-8")
    new, n = re.subn(r"(<!-- CATALOG:START -->\n).*?(<!-- CATALOG:END -->)", lambda m: m.group(1) + block + "\n" + m.group(2), text, flags=re.S)
    if n != 1:
        print("README.md is missing the CATALOG markers")
        return 1
    README.write_text(new, encoding="utf-8", newline="\n")
    print(f"README catalog updated: {len(cards)} cards")
    return 0


if __name__ == "__main__":
    sys.exit(main())
