# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# Fills the generated parts of README.md from scripts/catalog.json (made by export_catalog.mjs):
# the section counts and, per catalog section, an H3 heading and a collapsed <details> block with
# its poster and its table, between the CATALOG markers.
# Usage: python scripts/build_readme.py   (run from the repository root)
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
README = ROOT / "README.md"
CATALOG = ROOT / "scripts" / "catalog.json"
# (category id, section name, one-line blurb), in page order. The index gives the section number.
SECTIONS = [
    ("reel", "The reel, scene by scene", "The nine scenes and cuts of the first reel."),
    ("type", "Text in motion", "Kinetic type, reveals, scrambles and letters that melt, fill or fly."),
    ("mg", "2D motion graphics", "Shape layers, paths, morphs, parallax and other 2D animation."),
    ("ui", "App and web UI motion", "Buttons, loaders, toggles, cards and transitions for apps and sites."),
    ("sim", "Simulation and generative art", "Flow fields, flocks, cloth, sand, slime mold and generative art."),
    ("gpu", "GPU shaders", "Fragment shaders: fluids, fractals, ray marching, noise and post effects."),
    ("audio", "Sound and motion", "Motion that makes or follows sound: synths, visualizers, beat sync."),
    ("libs", "Animation libraries", "The same ideas with Three.js, GSAP, PixiJS, p5.js, D3, Matter.js and more."),
    ("engine", "3D engines (Blender, Unreal)", "Blender and Unreal shots: physics, cloth, liquid, fire, Lumen, Niagara."),
    ("tools", "Code-to-video tools", "Remotion, HyperFrames, Motion Canvas, Manim, Taichi and other code-to-video tools."),
    ("edit", "Editing and post-production", "Work on footage: speed ramps, grades, datamosh, tracking, stabilization."),
    ("scratch", "Built from scratch", "Renderers, solvers and synths written with no engine or library."),
]


def cell(text: str) -> str:
    # Makes catalog text safe for one Markdown table cell. CSS at-rules such as @property go in
    # backticks, because GitHub turns a bare @word into a link to that user or organization.
    text = text.replace("|", "/").replace("\n", " ").strip()
    return re.sub(r"(?<![\w`])(@[A-Za-z][\w-]*)", r"`\1`", text)


def main() -> int:
    cards = json.loads(CATALOG.read_text(encoding="utf-8"))
    out = []
    live = sum(1 for c in cards if c["kind"] == "live")
    clips = len(cards) - live
    sliders = sum(1 for c in cards if c["sliders"])
    out.append(f"**{len(cards)} techniques**: {live} run live in the page ({sliders} with sliders), {clips} are rendered clips.\n")
    for idx, (cat, name, blurb) in enumerate(SECTIONS):
        rows = [c for c in cards if c["cat"] == cat]
        if not rows:
            continue
        n_live = sum(1 for c in rows if c["kind"] == "live")
        n_clip = len(rows) - n_live
        # The H3 stays outside <details>, so its anchor (for example #text-in-motion-36) keeps working.
        out.append(f"\n### {name} ({len(rows)})\n")
        out.append("<details>")
        # The tag leaves out zero counts, and its words are joined by &nbsp; so a narrow screen
        # moves the whole tag to the next line instead of breaking it in the middle.
        tag = [f"SECTION {idx + 1:02d} OF {len(SECTIONS):02d}"]
        if n_live:
            tag.append(f"{n_live} LIVE")
        if n_clip:
            tag.append(f"{n_clip} CLIPS")
        tag_html = " / ".join(tag).replace(" ", "&nbsp;")
        out.append(f"<summary><b>Show all {len(rows)} techniques with prompts</b> "
                   f"<sub>{tag_html}</sub>"
                   f"<br>{blurb}</summary>\n")
        poster = ROOT / "media" / "readme" / f"poster-{cat}.jpg"
        if poster.exists():
            alt = f"{name}: a contact sheet of the section's cards"
            out.append(f'<p><img src="media/readme/poster-{cat}.jpg" width="100%" alt="{alt}"></p>\n')
        out.append("| Technique | Made with | Runs on | Prompt to copy |")
        out.append("|---|---|---|---|")
        for c in rows:
            kind = " (clip)" if c["kind"] == "clip" else ""
            out.append(f"| [{cell(c['title'])}](index.html#{c['id']}){kind} | {cell(c['tool'])} | {c['runs']} | {cell(c['prompt'])} |")
        out.append("\n</details>")
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
