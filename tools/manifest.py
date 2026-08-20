#!/usr/bin/env python3
"""Regenerise data/manifest.js iz sadrzaja data/lessons/."""

from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
LESSONS = REPO / "data" / "lessons"
OUT = REPO / "data" / "manifest.js"


def main() -> None:
    files = sorted(p.name for p in LESSONS.glob("*.js"))
    body = ",\n".join(f'  "lessons/{name}"' for name in files)
    OUT.write_text(
        "/* Generisano skriptom tools/manifest.py — ne menjaj rucno. */\n"
        "window.LESSON_FILES = [\n" + body + "\n];\n",
        encoding="utf-8",
    )
    print(f"manifest.js: {len(files)} lekcija")


if __name__ == "__main__":
    main()
