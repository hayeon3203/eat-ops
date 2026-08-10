"""Fixed category axes for user-submitted recommendations (사용자 추천 등록 + 카테고리).

Three independent axes, not hierarchical — a recommendation may pick zero
or one value per axis, combined with AND when filtering.
"""

from __future__ import annotations

OCCASIONS = ("점심장소", "회식장소", "수고한 나에게")
FOOD_TYPES = ("밥", "면", "빵")
CUISINES = ("한식", "양식", "일식", "중식", "베트남식", "기타")


def validate_category(value: str | None, allowed: tuple[str, ...], axis_name: str) -> None:
    if value is not None and value not in allowed:
        raise ValueError(f"{axis_name} must be one of {allowed} or omitted, got {value!r}")
