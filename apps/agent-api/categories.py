"""Fixed category axes for user-submitted recommendations (사용자 추천 등록 + 카테고리).

Three independent axes, not hierarchical — a recommendation may pick zero
or one value per axis, combined with AND when filtering.
"""

from __future__ import annotations

OCCASIONS = ("점심장소", "회식장소", "수고한 나에게")
FOOD_TYPES = ("밥", "면", "빵")
CUISINES = ("한식", "양식", "일식", "중식", "베트남식", "기타")

LUNCH_PRICE_THRESHOLD_WON = 13_000


def validate_category(value: str | None, allowed: tuple[str, ...], axis_name: str) -> None:
    if value is not None and value not in allowed:
        raise ValueError(f"{axis_name} must be one of {allowed} or omitted, got {value!r}")


def infer_occasion_from_price(price: int | None) -> str | None:
    """Auto-suggest occasion by menu price — only distinguishes the two
    occasions that actually have a price-based rule. 회식장소 has no price
    rule (group dining varies too much), so price never implies it.

    # ponytail: single fixed threshold, no per-cuisine/per-region tuning —
    # add if 13,000 stops being a useful cutoff.
    """
    if price is None:
        return None
    return "점심장소" if price < LUNCH_PRICE_THRESHOLD_WON else "수고한 나에게"
