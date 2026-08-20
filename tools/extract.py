#!/usr/bin/env python3
"""Izvlaci tekst iz materijala sa casova spanskog u staging/ fajlove.

Skenira izvorni folder (Google Drive), prepoznaje nove i izmenjene fajlove
preko sha256 hesa, i za svaki pise .txt u staging/. Fajlove koje ne moze da
procita (PDF bez tekstualnog sloja, PPTX slike) markira kao "needs-review"
da bi ih Claude procitao direktno u nedeljnoj sesiji.

Upotreba:
    python3 tools/extract.py            # samo novi/izmenjeni fajlovi
    python3 tools/extract.py --all      # ponovo obradi sve
    python3 tools/extract.py --status   # samo prikazi sta je novo, bez pisanja
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import unicodedata
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree

REPO = Path(__file__).resolve().parent.parent
CONFIG_PATH = REPO / "tools" / "config.json"
STATE_PATH = REPO / "tools" / "state.json"
STAGING = REPO / "staging"

SUPPORTED = {".odt", ".pdf", ".pptx", ".docx", ".txt", ".md"}
# .gdoc su Google Drive stubovi (samo JSON sa linkom), nemaju sadrzaj lokalno
IGNORED = {".gdoc", ".gsheet", ".gslides", ".gdraw"}


# --------------------------------------------------------------------------
# ekstrakcija po formatu
# --------------------------------------------------------------------------

def _strip_ns(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def extract_odt(path: Path) -> str:
    """ODT je zip arhiva; svaki pasus i naslov postaje jedan red."""
    with zipfile.ZipFile(path) as z:
        root = ElementTree.fromstring(z.read("content.xml"))

    BLOCKS = {"p", "h"}
    lines: list[str] = []

    def render(node) -> str:
        tag = _strip_ns(node.tag)
        if tag == "tab":
            return "\t"
        if tag in ("line-break", "br"):
            return "\n"
        if tag == "s":
            count = next((v for k, v in node.attrib.items() if k.endswith("}c")), "1")
            return " " * int(count)

        parts = [node.text or ""]
        for child in node:
            if _strip_ns(child.tag) in BLOCKS:
                # ugnjezdeni pasus (celija tabele, stavka liste) ide u svoj red
                lines.append(render(child).strip())
            else:
                parts.append(render(child))
            parts.append(child.tail or "")
        return "".join(parts)

    render(root)
    return "\n".join(lines)


def extract_docx(path: Path) -> str:
    with zipfile.ZipFile(path) as z:
        root = ElementTree.fromstring(z.read("word/document.xml"))
    lines = []
    for para in root.iter():
        if _strip_ns(para.tag) != "p":
            continue
        runs = [n.text or "" for n in para.iter() if _strip_ns(n.tag) == "t"]
        lines.append("".join(runs).strip())
    return "\n".join(lines)


def extract_pptx(path: Path) -> str:
    """Tekst iz slajdova, redom, sa oznakom broja slajda."""
    out: list[str] = []
    with zipfile.ZipFile(path) as z:
        slides = sorted(
            (n for n in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)),
            key=lambda n: int(re.search(r"(\d+)", n).group(1)),
        )
        for name in slides:
            num = int(re.search(r"(\d+)", name).group(1))
            root = ElementTree.fromstring(z.read(name))
            lines: list[str] = []
            for para in root.iter():
                if _strip_ns(para.tag) != "p":
                    continue
                runs = [n.text or "" for n in para.iter() if _strip_ns(n.tag) == "t"]
                text = "".join(runs).strip()
                if text:
                    lines.append(text)
            out.append(f"--- Slajd {num} ---\n" + "\n".join(lines))
    return "\n\n".join(out)


def extract_pdf(path: Path) -> str:
    """Redom: pdftotext iz poppler-a, pa PyMuPDF, pa pdfminer. Prazno ako nema nijednog."""
    if shutil.which("pdftotext"):
        result = subprocess.run(
            ["pdftotext", "-layout", str(path), "-"],
            capture_output=True, text=True, check=False,
        )
        if result.returncode == 0 and result.stdout.strip():
            # pdftotext razdvaja strane form feed znakom
            pages = result.stdout.split("\f")
            return "\n\n".join(
                f"--- Strana {i + 1} ---\n{page.strip()}"
                for i, page in enumerate(pages)
                if page.strip()
            )

    try:
        import fitz  # PyMuPDF
    except ImportError:
        pass
    else:
        with fitz.open(path) as doc:
            return "\n\n".join(
                f"--- Strana {i + 1} ---\n{page.get_text()}"
                for i, page in enumerate(doc)
            )

    try:
        from pdfminer.high_level import extract_text
    except ImportError:
        return ""
    return extract_text(str(path))


def extract_plain(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


EXTRACTORS = {
    ".odt": extract_odt,
    ".docx": extract_docx,
    ".pptx": extract_pptx,
    ".pdf": extract_pdf,
    ".txt": extract_plain,
    ".md": extract_plain,
}


# --------------------------------------------------------------------------
# pomocne
# --------------------------------------------------------------------------

def slugify(name: str) -> str:
    norm = unicodedata.normalize("NFKD", name)
    ascii_only = "".join(c for c in norm if not unicodedata.combining(c))
    ascii_only = ascii_only.replace("ñ", "n").replace("Ñ", "N")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_only).strip("-").lower()
    return slug or "fajl"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def guess_date(name: str) -> str | None:
    """Iz naziva tipa '29.07 notas' ili 'notas 5.08' izvlaci dan i mesec."""
    m = re.search(r"\b(\d{1,2})[.\-/](\d{1,2})\b", name)
    if not m:
        return None
    day, month = int(m.group(1)), int(m.group(2))
    if not (1 <= day <= 31 and 1 <= month <= 12):
        return None
    return f"{month:02d}-{day:02d}"


def staging_name(path: Path, source: Path, digest: str, used: dict[str, str]) -> str:
    """Ime staging fajla, jedinstveno i kad se dva izvora zovu isto."""
    rel = str(path.relative_to(source))
    base = f"{slugify(path.stem)}.{path.suffix.lstrip('.').lower()}"
    name = f"{base}.txt"
    if used.get(name, rel) != rel:
        name = f"{base}-{digest[:6]}.txt"
    used[name] = rel
    return name


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def load_config() -> dict:
    config = load_json(CONFIG_PATH, {})
    if "source_dir" not in config:
        sys.exit(
            f"Nedostaje {CONFIG_PATH.relative_to(REPO)} sa poljem 'source_dir'.\n"
            "Kopiraj tools/config.example.json u tools/config.json i podesi putanju."
        )
    return config


# --------------------------------------------------------------------------
# glavni tok
# --------------------------------------------------------------------------

def collect(source: Path) -> list[Path]:
    files = []
    for path in sorted(source.rglob("*")):
        if not path.is_file() or path.name.startswith((".", "~$")):
            continue
        if path.suffix.lower() in SUPPORTED:
            files.append(path)
    return files


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--all", action="store_true", help="ponovo obradi i vec obradjene fajlove")
    parser.add_argument("--status", action="store_true", help="samo prikazi promene, ne pisi nista")
    args = parser.parse_args()

    config = load_config()
    source = Path(config["source_dir"]).expanduser()
    if not source.is_dir():
        sys.exit(f"Izvorni folder ne postoji: {source}")

    state = load_json(STATE_PATH, {"files": {}})
    known: dict = state.setdefault("files", {})
    STAGING.mkdir(exist_ok=True)

    files = collect(source)
    new, changed, unchanged, review = [], [], [], []
    used_names: dict[str, str] = {
        info["staging"]: rel for rel, info in known.items() if info.get("staging")
    }

    for path in files:
        rel = str(path.relative_to(source))
        digest = sha256(path)
        prior = known.get(rel)

        if prior and prior.get("sha256") == digest and not args.all:
            unchanged.append(rel)
            continue

        status = "changed" if prior else "new"
        (changed if prior else new).append(rel)

        if args.status:
            continue

        ext = path.suffix.lower()
        try:
            text = (EXTRACTORS[ext](path) or "").strip()
        except Exception as exc:  # neispravan ili zasticen fajl ne sme da srusi ceo run
            text = ""
            print(f"  ! greska pri citanju {rel}: {exc}", file=sys.stderr)

        # malo teksta na puno bajtova = skeniran PDF ili slajdovi od slika
        needs_review = len(text) < 200
        if needs_review:
            review.append(rel)

        out_path = STAGING / staging_name(path, source, digest, used_names)
        header = [
            f"# izvor: {rel}",
            f"# format: {ext.lstrip('.')}",
            f"# sha256: {digest}",
            f"# izvuceno: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        ]
        date_hint = guess_date(path.stem)
        if date_hint:
            header.append(f"# datum-iz-naziva: {date_hint}")
        if needs_review:
            header.append("# PAZNJA: malo ili nimalo teksta - procitaj original direktno")
            header.append(f"# putanja: {path}")
        out_path.write_text("\n".join(header) + "\n\n" + text + "\n", encoding="utf-8")

        known[rel] = {
            "sha256": digest,
            "staging": out_path.name,
            "status": status,
            "needs_review": needs_review,
            "chars": len(text),
            "extracted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }

    if not args.status:
        state["last_run"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        STATE_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Izvor: {source}")
    print(f"Ukupno fajlova: {len(files)}  |  novi: {len(new)}  izmenjeni: {len(changed)}  nepromenjeni: {len(unchanged)}")
    for rel in new:
        print(f"  + {rel}")
    for rel in changed:
        print(f"  ~ {rel}")
    if review:
        print("\nZahtevaju rucno citanje (nema tekstualnog sloja):")
        for rel in review:
            print(f"  ? {rel}")
    if not args.status and (new or changed):
        print(f"\nTekst je u {STAGING.relative_to(REPO)}/ — pokreni sesiju sa Claude-om da napravi pitanja.")
    elif not new and not changed:
        print("\nNema novih materijala.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
