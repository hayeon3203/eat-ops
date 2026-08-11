"""Deterministic sensitivity rules (Plans.md §6/§7 민감도 판정).

# ponytail: rules only, no local-classifier fallback for the `unknown` tier
# Plans.md describes — every input resolves to public or confidential.
# Add a classifier call when regex rules produce real false negatives.
"""

from __future__ import annotations

import re

from typing import Literal

Sensitivity = Literal["public", "confidential"]

_PATTERNS = [
    re.compile(r"\d{6}-?[1-4]\d{6}"),  # 주민등록번호
    re.compile(r"(?:\d[ -]?){13,16}"),  # 카드번호 (13~16자리, 구분자 허용)
    re.compile(r"sk-[A-Za-z0-9]{20,}"),  # OpenAI-style API key
    re.compile(r"AKIA[0-9A-Z]{16}"),  # AWS access key
    re.compile(r"(?i)(?:api[_-]?key|password|secret)\s*[:=]\s*\S+"),
]


def detect(text: str | None) -> Sensitivity:
    if not text:
        return "public"
    return "confidential" if any(p.search(text) for p in _PATTERNS) else "public"
