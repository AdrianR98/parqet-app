import re
import csv
import sys
from pathlib import Path
from collections import defaultdict

try:
    import fitz  # PyMuPDF
except ImportError:
    print("PyMuPDF fehlt. Bitte ausführen: python -m pip install pymupdf")
    sys.exit(1)

if len(sys.argv) < 3:
    print("Usage: python scripts/extract-trading-universe-pdf.py <input.pdf> <output.csv>")
    sys.exit(1)

input_path = Path(sys.argv[1])
output_path = Path(sys.argv[2])

isin_pattern = re.compile(r"^[A-Z]{2}[A-Z0-9]{9}[0-9]$")


def isin_checksum_valid(isin: str) -> bool:
    isin = isin.strip().upper()
    if not isin_pattern.fullmatch(isin):
        return False

    expanded = ""
    for ch in isin:
        if ch.isdigit():
            expanded += ch
        elif "A" <= ch <= "Z":
            expanded += str(ord(ch) - ord("A") + 10)
        else:
            return False

    total = 0
    for index, digit_char in enumerate(expanded[::-1]):
        digit = int(digit_char)
        if index % 2 == 1:
            digit *= 2
        total += digit // 10 + digit % 10

    return total % 10 == 0


def clean_text(value: str) -> str:
    return " ".join(value.strip().split())


def is_meaningful_name(value: str) -> bool:
    value = clean_text(value)
    if len(value) < 2:
        return False
    if not re.search(r"[A-Za-zÄÖÜäöü]", value):
        return False
    if value.upper() in {"TRADE", "REPUBLIC", "TRADING", "UNIVERSE", "ISIN", "NAME"}:
        return False
    return True


def row_key(y: float, tolerance: float = 3.0) -> int:
    return round(y / tolerance)


doc = fitz.open(input_path)
rows = []

for page_index, page in enumerate(doc, start=1):
    words = page.get_text("words")
    # word tuple: x0, y0, x1, y1, text, block_no, line_no, word_no

    grouped = defaultdict(list)
    for word in words:
        x0, y0, x1, y1, text, *_ = word
        text = clean_text(text)
        if not text:
            continue
        grouped[row_key(y0)].append((x0, y0, x1, y1, text))

    for _, row_words in sorted(grouped.items()):
        row_words.sort(key=lambda item: item[0])

        isin_items = []
        for item in row_words:
            text = item[4].upper()
            if isin_pattern.fullmatch(text) and isin_checksum_valid(text):
                isin_items.append(item)

        if not isin_items:
            continue

        for isin_item in isin_items:
            isin_x0, _, isin_x1, _, isin = isin_item

            # Namen stehen in dieser PDF rechts neben der ISIN.
            name_parts = []
            for item in row_words:
                x0, _, _, _, text = item
                if x0 <= isin_x1 + 20:
                    continue
                name_parts.append(text)

            name = clean_text(" ".join(name_parts))

            if is_meaningful_name(name):
                rows.append({
                    "isin": isin.upper(),
                    "name": name,
                    "page": page_index,
                })

# Deduplicate: pro ISIN längsten Namen behalten.
by_isin = {}
for row in rows:
    isin = row["isin"]
    name = row["name"]
    if isin not in by_isin or len(name) > len(by_isin[isin]["name"]):
        by_isin[isin] = row

output_path.parent.mkdir(parents=True, exist_ok=True)

with output_path.open("w", newline="", encoding="utf-8-sig") as f:
    writer = csv.writer(f, delimiter=";")
    writer.writerow(["ISIN", "Name", "Page"])
    for isin in sorted(by_isin):
        row = by_isin[isin]
        writer.writerow([row["isin"], row["name"], row["page"]])

print(f"Exportiert: {len(by_isin)} eindeutige gültige ISINs nach {output_path}")

if len(by_isin) == 0:
    print("Keine Zeilen extrahiert. Prüfe, ob die PDF Text enthält oder nur gescannte Bilder.")
else:
    print("Beispiele:")
    for isin, row in list(sorted(by_isin.items()))[:10]:
        print(f"- {isin}; {row['name']}; Seite {row['page']}")