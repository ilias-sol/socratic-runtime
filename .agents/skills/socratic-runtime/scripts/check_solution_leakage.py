#!/usr/bin/env python3
"""Exit nonzero when candidate student-visible text resembles a solution leak."""

from __future__ import annotations

import re
import sys

PATTERNS = [
    r"```", r"\bdef\s+\w+", r"\bclass\s+\w+", r"\breturn\s+[^?\n]+",
    r"\bwhile\s+[^?\n]+:", r"\bfor\s+\w+\s+in\b",
    r"(?:^|\n)\s*[A-Za-z_]\w*\s*=\s*[^?\n]+",
    r"hidden test|private test|secret case|expected output is",
]

def is_safe(text: str) -> bool:
    return bool(text.strip()) and len(text) <= 180 and text.rstrip().endswith("?") and not any(
        re.search(pattern, text, re.IGNORECASE) for pattern in PATTERNS
    )

if __name__ == "__main__":
    candidate = sys.stdin.read()
    print("safe" if is_safe(candidate) else "blocked")
    raise SystemExit(0 if is_safe(candidate) else 1)
