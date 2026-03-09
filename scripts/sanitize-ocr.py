#!/usr/bin/env python3
"""
Sanitize OCR text from Byrd's "Little America" (1930).

Fixes systematic Cyrillic→Latin character substitutions from Archive.org OCR,
deletes unrecoverable corruption zones, and adds a clean source header.
"""

import re
import sys
from pathlib import Path

SOURCE_FILE = Path(__file__).parent.parent / "sources" / "byrd-little-america.txt"

# Cyrillic → Latin homoglyph map (visually identical characters)
CYRILLIC_TO_LATIN = {
    "\u0421": "C",   # С → C
    "\u0441": "c",   # с → c
    "\u0422": "T",   # Т → T
    "\u0442": "t",   # т → t  (not always a clean map, but safe in English)
    "\u041E": "O",   # О → O
    "\u043E": "o",   # о → o
    "\u0420": "P",   # Р → P
    "\u0440": "p",   # р → p
    "\u041D": "H",   # Н → H
    "\u043D": "n",   # н → n  (Cyrillic en)
    "\u0410": "A",   # А → A
    "\u0430": "a",   # а → a
    "\u0415": "E",   # Е → E
    "\u0435": "e",   # е → e
    "\u0412": "B",   # В → B
    "\u0432": "v",   # в → v  (Cyrillic ve, lowercase maps to v)
    "\u041C": "M",   # М → M
    "\u043C": "m",   # м → m
    "\u041A": "K",   # К → K
    "\u043A": "k",   # к → k
    "\u0406": "I",   # І → I  (Ukrainian/Belarusian I)
    "\u0456": "i",   # і → i
    "\u0423": "Y",   # У → Y  (contextual — in English OCR this is usually Y)
    "\u0443": "y",   # у → y
    "\u0425": "X",   # Х → X
    "\u0445": "x",   # х → x
    # Additional Cyrillic characters that appear in garbled text
    "\u041F": "P",   # П → P  (not visually identical but appears in OCR noise)
    "\u043F": "p",   # п → p
    "\u0411": "B",   # Б → B  (approximate)
    "\u0431": "b",   # б → b
    "\u0417": "3",   # З → 3  (often garbled as digit)
    "\u0437": "3",   # з → 3
    "\u0419": "Y",   # Й → Y  (approximate)
    "\u0439": "y",   # й → y
    "\u041B": "L",   # Л → L  (approximate)
    "\u043B": "l",   # л → l
    "\u0414": "D",   # Д → D  (approximate)
    "\u0434": "d",   # д → d
    "\u0413": "G",   # Г → G  (approximate)
    "\u0433": "g",   # г → g
    "\u0416": "X",   # Ж → X  (approximate, rare)
    "\u0436": "x",   # ж → x
    "\u0418": "U",   # И → U  (approximate)
    "\u0438": "u",   # и → u
    "\u0427": "Ch",  # Ч → Ch (approximate)
    "\u0447": "ch",  # ч → ch
    "\u0428": "Sh",  # Ш → Sh
    "\u0448": "sh",  # ш → sh
    "\u0429": "Shch",# Щ → Shch
    "\u0449": "shch",# щ → shch
    "\u042B": "Y",   # Ы → Y
    "\u044B": "y",   # ы → y
    "\u042D": "E",   # Э → E
    "\u044D": "e",   # э → e
    "\u042E": "Yu",  # Ю → Yu
    "\u044E": "yu",  # ю → yu
    "\u042F": "Ya",  # Я → Ya
    "\u044F": "ya",  # я → ya
    "\u0424": "F",   # Ф → F
    "\u0444": "f",   # ф → f
    "\u0426": "C",   # Ц → C
    "\u0446": "c",   # ц → c
    "\u0451": "e",   # ё → e
    "\u0401": "E",   # Ё → E
    "\u0452": "d",   # ђ → d (Serbian)
    "\u0454": "e",   # є → e (Ukrainian)
    "\u0457": "i",   # ї → i (Ukrainian)
    "\u04AF": "y",   # ү → y (various Turkic)
    "\u04E9": "o",   # ө → o
    "\u0491": "g",   # ґ → g (Ukrainian)
    "\u0490": "G",   # Ґ → G
    "\u044A": "",    # ъ → (hard sign, no equivalent)
    "\u042A": "",    # Ъ → (hard sign)
    "\u044C": "",    # ь → (soft sign, no equivalent)
    "\u042C": "",    # Ь → (soft sign)
    # Extended Cyrillic found in second pass
    "\u0405": "S",   # Ѕ → S (Macedonian)
    "\u0455": "s",   # ѕ → s
    "\u040E": "U",   # Ў → U (Belarusian short U)
    "\u045E": "u",   # ў → u
    "\u0404": "E",   # Є → E (Ukrainian Ye)
    "\u04D9": "a",   # ә → a (Schwa, Kazakh/Tatar)
    "\u04D8": "A",   # Ә → A
    "\u04BB": "h",   # һ → h (Bashkir/Tatar)
    "\u04BA": "H",   # Һ → H
    "\u0407": "I",   # Ї → I (Ukrainian Yi)
    "\u0408": "J",   # Ј → J (Serbian/Macedonian)
    "\u0458": "j",   # ј → j
    "\u04AE": "Y",   # Ү → Y (uppercase of ү)
    "\u0409": "L",   # Љ → L (Serbian Lje)
    "\u0459": "l",   # љ → l
    "\u040A": "N",   # Њ → N (Serbian Nje)
    "\u045A": "n",   # њ → n
    "\u040B": "D",   # Ћ → D (Serbian Che)
    "\u045B": "d",   # ћ → d
    "\u040C": "K",   # Ќ → K (Macedonian)
    "\u045C": "k",   # ќ → k
    "\u040F": "Dz",  # Џ → Dz (Serbian)
    "\u045F": "dz",  # џ → dz
    "\u04A3": "n",   # ң → n (Kazakh Eng)
    "\u0493": "g",   # ғ → g (Kazakh Ghe)
}

# Build translation table for str.translate (only works for single-char mappings)
# Multi-char mappings need manual replacement
SINGLE_CHAR_MAP = {ord(k): v for k, v in CYRILLIC_TO_LATIN.items() if len(v) <= 1}
MULTI_CHAR_MAP = {k: v for k, v in CYRILLIC_TO_LATIN.items() if len(v) > 1}

CLEAN_HEADER = """\
================================================================================
LITTLE AMERICA
Aerial Exploration in the Antarctic / The Flight to the South Pole
by Richard Evelyn Byrd, Rear Admiral, U.S.N., Ret.
G. P. Putnam's Sons, New York, 1930

Source: Archive.org (https://archive.org/details/littleamerica0000rich)
OCR digitized 2023, Kahle/Austin Foundation
Cleaned for The Ceremony project, March 2026
================================================================================
"""

# Lines to delete: 1-based inclusive ranges
DELETE_RANGES = [
    (1, 95),       # Garbled front cover / library stamps
    (18179, 18201), # Complete OCR failure (photo captions)
]


def replace_cyrillic(text: str) -> tuple[str, int]:
    """Replace all Cyrillic characters with Latin equivalents. Returns (new_text, count)."""
    count = 0

    # First, handle multi-char replacements
    for cyrillic, latin in MULTI_CHAR_MAP.items():
        n = text.count(cyrillic)
        if n > 0:
            text = text.replace(cyrillic, latin)
            count += n

    # Then single-char via translate (fast)
    old_len_check = sum(1 for ch in text if ord(ch) in SINGLE_CHAR_MAP)
    count += old_len_check
    text = text.translate(SINGLE_CHAR_MAP)

    return text, count


def count_remaining_cyrillic(text: str) -> list[tuple[int, str, str]]:
    """Find any remaining Cyrillic characters (U+0400-U+04FF). Returns [(line_no, char, context)]."""
    results = []
    for i, line in enumerate(text.split("\n"), 1):
        for ch in line:
            if "\u0400" <= ch <= "\u04FF":
                # Get surrounding context
                idx = line.index(ch)
                start = max(0, idx - 10)
                end = min(len(line), idx + 10)
                results.append((i, ch, repr(line[start:end])))
    return results


def main():
    print(f"Reading {SOURCE_FILE}...")
    text = SOURCE_FILE.read_text(encoding="utf-8")
    lines = text.split("\n")
    original_line_count = len(lines)
    print(f"  Original: {original_line_count:,} lines, {len(text):,} characters")

    # Step 1: Delete corruption zones (process in reverse to preserve line numbers)
    deleted_count = 0
    for start, end in sorted(DELETE_RANGES, reverse=True):
        # Convert to 0-based indexing
        del lines[start - 1 : end]
        deleted_count += end - start + 1
        print(f"  Deleted lines {start}-{end} ({end - start + 1} lines)")

    # Step 2: Add clean header at the top
    header_lines = CLEAN_HEADER.split("\n")
    lines = header_lines + lines
    print(f"  Added {len(header_lines)}-line header")

    # Step 3: Rejoin and apply Cyrillic→Latin replacement
    text = "\n".join(lines)
    text, char_count = replace_cyrillic(text)
    print(f"  Replaced {char_count:,} Cyrillic characters")

    # Step 4: Clean up excessive blank lines (3+ consecutive → 2)
    text = re.sub(r"\n{4,}", "\n\n\n", text)

    # Final stats
    final_lines = text.split("\n")
    print(f"\n  Final: {len(final_lines):,} lines, {len(text):,} characters")
    print(f"  Lines removed: {original_line_count - len(final_lines) + len(header_lines):,}")

    # Check for remaining Cyrillic
    remaining = count_remaining_cyrillic(text)
    if remaining:
        print(f"\n  WARNING: {len(remaining)} Cyrillic characters remain:")
        for line_no, ch, ctx in remaining[:20]:
            print(f"    Line {line_no}: U+{ord(ch):04X} ({ch}) in {ctx}")
    else:
        print("\n  No remaining Cyrillic characters found.")

    # Write output
    SOURCE_FILE.write_text(text, encoding="utf-8")
    print(f"\n  Written to {SOURCE_FILE}")


if __name__ == "__main__":
    main()
