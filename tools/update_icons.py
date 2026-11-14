#!/usr/bin/env python3
"""Fetch the official WCA event icons and write shared/puzzle-icons.js.

The icons come from https://github.com/cubing/icons (MIT licence), the set the
WCA website uses. They are copied exactly as published; nothing is redrawn.
The one exception is listed in ADJUST below: the FTO icon keeps every triangle
as drawn, but its four faces are moved closer together.

Run this after adding a puzzle to PUZZLES in shared/puzzles.js:

    python tools/update_icons.py

It reads the puzzle ids from shared/puzzles.js and looks each one up among the
official events first, then the unofficial ones. A puzzle with no icon of its
own can borrow one: give it  icon: "333"  in PUZZLES.
"""
import json
import math
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

SOURCE = "https://raw.githubusercontent.com/cubing/icons/main"
FOLDERS = ["src/svg/event", "src/svg/unofficial"]
ROOT = Path(__file__).resolve().parent.parent
PUZZLES_FILE = ROOT / "shared" / "puzzles.js"
OUT_FILE = ROOT / "shared" / "puzzle-icons.js"


def fetch(path):
    try:
        with urllib.request.urlopen(f"{SOURCE}/{path}", timeout=20) as res:
            return res.read().decode("utf-8")
    except urllib.error.HTTPError:
        return None


def wanted_ids():
    """Every puzzle id in PUZZLES, plus any icon a puzzle borrows."""
    text = PUZZLES_FILE.read_text(encoding="utf-8")
    block = text[text.index("export const PUZZLES"):]
    block = block[:block.index("};")]
    ids = re.findall(r'^\s*"([\w-]+)":\s*\{', block, flags=re.M)
    ids += re.findall(r'icon:\s*"([\w-]+)"', block)
    return list(dict.fromkeys(ids))


def parse(svg):
    """Split an icon file into its viewBox and the shapes inside it."""
    box = re.search(r'viewBox="([^"]+)"', svg)
    body = re.search(r"<svg[^>]*>(.*)</svg>", svg, flags=re.S)
    if not box or not body:
        raise ValueError("not an SVG icon")
    return {"box": box.group(1), "body": body.group(1).strip()}


def polygons(body):
    """The straight-edged shapes of a one-path icon, as lists of (x, y)."""
    data = re.search(r'\sd="([^"]+)"', body).group(1)
    tokens = re.findall(r"[MmLlHhVvZz]|-?\d*\.?\d+", data)
    shapes, shape, cmd = [], None, ""
    x = y = start_x = start_y = 0.0
    i = 0

    def number():
        nonlocal i
        i += 1
        return float(tokens[i - 1])

    while i < len(tokens):
        if tokens[i].isalpha():
            cmd = tokens[i]
            i += 1
            if cmd in "Zz":
                shapes.append(shape)
                x, y = start_x, start_y
            continue
        if cmd in "Mm":
            a, b = number(), number()
            x, y = (x + a, y + b) if cmd == "m" else (a, b)
            start_x, start_y, shape = x, y, [(x, y)]
            cmd = "l" if cmd == "m" else "L"       # further pairs are lines
            continue
        if cmd in "Ll":
            a, b = number(), number()
            x, y = (x + a, y + b) if cmd == "l" else (a, b)
        elif cmd in "Hh":
            a = number()
            x = x + a if cmd == "h" else a
        elif cmd in "Vv":
            a = number()
            y = y + a if cmd == "v" else a
        else:
            raise ValueError(f"path command {cmd!r} is not handled")
        shape.append((x, y))
    return shapes


def close_faces(icon, gap):
    """FTO: the icon shows four triangular faces around an X-shaped gap. Slide
    each face towards the centre until that gap is `gap` units wide. The
    triangles themselves, and the gaps between them, are untouched."""
    x0, y0, width, height = (float(n) for n in icon["box"].split())
    cx, cy = x0 + width / 2, y0 + height / 2
    faces = {"left": (1, 0), "right": (-1, 0), "top": (0, 1), "bottom": (0, -1)}   # which way is inwards

    def face_of(shape):
        mx = sum(px for px, _ in shape) / len(shape) - cx
        my = sum(py for _, py in shape) / len(shape) - cy
        if abs(mx) > abs(my):
            return "left" if mx < 0 else "right"
        return "top" if my < 0 else "bottom"

    shapes = polygons(icon["body"])
    # How far each face is from the diagonals now, measured along its inward direction.
    reach = {name: min(abs((px - cx) * dx + (py - cy) * dy) - abs((px - cx) * dy + (py - cy) * dx)
                       for shape in shapes if face_of(shape) == name for px, py in shape)
             for name, (dx, dy) in faces.items()}
    out = []
    for shape in shapes:
        name = face_of(shape)
        dx, dy = faces[name]
        slide = reach[name] - gap / math.sqrt(2)       # half the gap, along the inward direction
        out.append("M" + "L".join(f"{px + dx * slide:.2f} {py + dy * slide:.2f}" for px, py in shape) + "z")
    return {"box": icon["box"], "body": f'<path d="{"".join(out)}"/>'}


# Icons that are changed after fetching, and how. Keep this list short: the
# point of the set is that it matches what cubers know from the WCA site.
ADJUST = {
    # The gap between faces is 56 units as published, four times the gap
    # between the triangles (about 14). 20 keeps the faces readable.
    "fto": lambda icon: close_faces(icon, gap=20),
}


def main():
    licence = fetch("LICENSE")
    if not licence:
        sys.exit("Could not reach the icon repository. Check the internet connection.")

    icons, missing = {}, []
    for puzzle in wanted_ids():
        svg = next(filter(None, (fetch(f"{folder}/{puzzle}.svg") for folder in FOLDERS)), None)
        if svg:
            icons[puzzle] = parse(svg)
            if puzzle in ADJUST:
                icons[puzzle] = ADJUST[puzzle](icons[puzzle])
            print("ok     ", puzzle, "(adjusted)" if puzzle in ADJUST else "")
        else:
            missing.append(puzzle)
            print("MISSING", puzzle)

    header = [
        "// Official WCA event icons. GENERATED by tools/update_icons.py; do not edit by hand.",
        "// Copied from https://github.com/cubing/icons (changes, if any, are listed under",
        "// ADJUST in the tool), under this licence:",
        "//",
        *[f"//   {line}".rstrip() for line in licence.strip().splitlines()],
        "",
        "// id -> { box: the icon's viewBox, body: its shapes }. The shapes carry no",
        "// colour of their own, so they take whatever colour the page gives them.",
        "export const ICONS = {",
    ]
    rows = [f"  {json.dumps(key)}: {json.dumps(icon)}," for key, icon in icons.items()]
    OUT_FILE.write_text("\n".join(header + rows + ["};", ""]), encoding="utf-8", newline="\n")
    print(f"\nWrote {len(icons)} icons to {OUT_FILE.relative_to(ROOT)}")
    if missing:
        print("No icon exists for:", ", ".join(missing))
        print('Give each of those  icon: "<another id>"  in PUZZLES, or it will show the 3x3 icon.')


if __name__ == "__main__":
    main()
