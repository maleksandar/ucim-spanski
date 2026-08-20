#!/usr/bin/env python3
"""Regenerise data/manifest.js i oznaci verziju statickih fajlova.

Verzija je heš sadrzaja svih js/css/data fajlova. Upisuje se kao ?v=... u
index.html i kao ASSET_VERSION u manifest.js (odatle je store.js lepi na
lekcije koje ucitava dinamicki). Tako se posle deploy-a nikad ne pomesaju
stara i nova verzija fajlova iz browser kesa.
"""

import hashlib
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
LESSONS = REPO / "data" / "lessons"
MANIFEST = REPO / "data" / "manifest.js"
INDEX = REPO / "index.html"

# manifest.js je izuzet jer i sam sadrzi verziju — inace bi hes zavisio od sebe
VERSIONED = ["css/style.css", "js/*.js", "data/verbs.js", "data/lessons/*.js"]


def asset_files() -> list[Path]:
    found: list[Path] = []
    for pattern in VERSIONED:
        found.extend(sorted(REPO.glob(pattern)))
    return found


def compute_version(files: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in files:
        digest.update(str(path.relative_to(REPO)).encode("utf-8"))
        digest.update(path.read_bytes())
    return digest.hexdigest()[:8]


def write_manifest(names: list[str], version: str) -> None:
    body = ",\n".join(f'  "lessons/{name}"' for name in names)
    MANIFEST.write_text(
        "/* Generisano skriptom tools/manifest.py — ne menjaj rucno. */\n"
        f'window.ASSET_VERSION = "{version}";\n'
        "window.LESSON_FILES = [\n" + body + "\n];\n",
        encoding="utf-8",
    )


def stamp_index(version: str) -> int:
    html = INDEX.read_text(encoding="utf-8")
    pattern = re.compile(r'((?:href|src)=")((?:css|js|data)/[^"?]+)(\?v=[^"]*)?(")')
    stamped, count = pattern.subn(rf'\1\2?v={version}\4', html)
    if stamped != html:
        INDEX.write_text(stamped, encoding="utf-8")
    return count


def main() -> None:
    names = sorted(p.name for p in LESSONS.glob("*.js"))
    version = compute_version(asset_files())
    write_manifest(names, version)
    tagged = stamp_index(version)
    print(f"manifest.js: {len(names)} lekcija  |  verzija {version}  |  index.html: {tagged} fajla")


if __name__ == "__main__":
    main()
