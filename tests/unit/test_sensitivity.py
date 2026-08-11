"""Unit self-check for sensitivity.py. Run manually:

    apps/agent-api/.venv/bin/python tests/unit/test_sensitivity.py
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "apps" / "agent-api"))

import sensitivity  # noqa: E402


def demo() -> None:
    cases = [
        (None, "public"),
        ("점심 뭐 먹지", "public"),
        ("내 주민번호는 900101-1234567이야", "confidential"),
        ("카드번호 4111 1111 1111 1111 결제해줘", "confidential"),
        ("api_key: sk-abcdefghijklmnopqrstuvwx", "confidential"),
        ("sk-abcdefghijklmnopqrstuvwx 이 키로 호출해줘", "confidential"),
        ("AKIAABCDEFGHIJKLMNOP 이거 유출됐어", "confidential"),
    ]
    for text, expected in cases:
        actual = sensitivity.detect(text)
        assert actual == expected, f"detect({text!r}) = {actual!r}, expected {expected!r}"
    print(f"[decision_table] ok ({len(cases)} cases)")


if __name__ == "__main__":
    demo()
