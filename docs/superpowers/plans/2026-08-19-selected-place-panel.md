# 선택한 장소 패널 확장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지도 마커를 클릭했을 때 왼쪽 사이드바에 뜨는 "선택한 장소" 패널에 카테고리 배지·전화번호·내 위치로부터의 거리·별점/리뷰를 붙인다.

**Architecture:** 패널은 지금 자리(왼쪽 사이드바) 그대로 두고 내용만 확장한다. 카카오 Local API에는 평점·리뷰가 없으므로 그 자리는 우리 DB의 리뷰(`ReviewSection` 재사용)가 채운다. 전화번호·카테고리는 카카오 응답에는 있지만 `visits`/`recommendations` 테이블에 없어서 컬럼을 추가하고 저장 경로 4곳에 흘려보낸다. 거리는 백엔드 없이 브라우저에서 계산한다.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / vitest (프론트), FastAPI / SQLite / aiohttp (백엔드)

## Global Constraints

- 백엔드 작업 디렉터리는 `/home/admin/foundry-hybrid-agent`. 파이썬은 `apps/agent-api/.venv/bin/python`으로 실행한다.
- 프론트 테스트 러너는 vitest. `cd apps/web && npx vitest run <path>`.
- **백엔드 테스트는 pytest가 아니다.** `tests/unit/*.py`는 `check_*()`가 bool을 반환하고 `demo()`가 전부 모아 assert하는 수동 자기점검 스크립트다. 새 파일도 이 패턴을 따른다.
- 브라우저는 절대 agent-api 포트를 직접 부르지 않는다. 프론트 fetch는 `/api/agent` 프록시를 통한다 (`ReviewSection.tsx:7-10` 주석 참고).
- 기존 DB 행은 백필하지 않는다. `phone`/`category`가 빈 값이면 UI에서 그 줄을 통째로 숨긴다.
- `apps/web/AGENTS.md`: 이 Next.js는 학습 데이터와 다를 수 있으니 새 Next 기능을 쓰기 전에 `apps/web/node_modules/next/dist/docs/`를 확인할 것. 이 계획은 새 Next 기능을 쓰지 않는다 (기존 클라이언트 컴포넌트 수정만).
- 스펙 원문: `docs/superpowers/specs/2026-08-19-selected-place-panel-design.md`

---

## File Structure

| 파일 | 책임 |
|---|---|
| `apps/agent-api/kakao.py` | 카카오 응답 document → `KakaoPlace` 매핑. `phone` 추가, 매핑을 `_to_place()`로 분리해 네트워크 없이 테스트 가능하게 함 |
| `apps/agent-api/db.py` | 스키마 마이그레이션 + insert. `phone`/`category` 컬럼과 인자 |
| `apps/agent-api/main.py` | `VisitIn` 모델 + 추천 등록 엔드포인트에서 insert로 전달 |
| `apps/agent-api/tools.py` | 챗 툴 `record_visit` / `add_recommendation`의 insert 호출 |
| `tests/unit/test_place_contact.py` (신규) | 위 백엔드 변경의 자기점검 |
| `apps/web/components/placeMeta.ts` (신규) | `haversineMeters`, `categoryBadge` — 순수 함수만 |
| `apps/web/components/placeMeta.test.ts` (신규) | 위 두 함수의 vitest |
| `apps/web/components/types.ts` | `SelectedPlace`에 좌표·전화 추가, `Visit`/`Recommendation`/`Place`에 `phone`/`category` |
| `apps/web/components/MapView.tsx` | 마커 클릭 payload에 좌표·전화·카테고리 실음 |
| `apps/web/components/ReviewSection.tsx` | prop 타입을 `Recommendation`에서 필요한 필드만 가진 좁은 타입으로 완화 |
| `apps/web/components/Sidebar.tsx` | 패널 렌더 |
| `apps/web/app/globals.css` | 패널 스크롤·메타줄·배지 스타일 |

---

### Task 1: 백엔드 — phone/category 수집·저장

카카오 응답에서 `phone`을 버리지 않고, `visits`/`recommendations`에 `phone`·`category` 컬럼을 추가해 저장 경로 4곳(HTTP 2 + 챗 툴 2)에서 채운다.

**Files:**
- Modify: `apps/agent-api/kakao.py:78-91`
- Modify: `apps/agent-api/db.py:65-72`, `:79-115`, `:146-181`
- Modify: `apps/agent-api/main.py:300-313`, `:390-402`
- Modify: `apps/agent-api/tools.py:196-205`, `:283-295`
- Test: `tests/unit/test_place_contact.py`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - `kakao._to_place(doc: dict) -> KakaoPlace` — `phone` 키를 포함한 7+1 필드 dict
  - `db.insert_visit(..., phone: str | None = None, category: str | None = None) -> dict`
  - `db.insert_recommendation(..., phone: str | None = None, category: str | None = None) -> dict`
  - `GET /api/visits`, `GET /api/recommendations` 응답 각 행에 `phone`, `category` 키 (Task 3의 TS 타입이 이걸 받는다)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/test_place_contact.py` 신규 작성:

```python
"""Unit self-check for phone/category plumbing (선택한 장소 패널).

Temp SQLite file via db.DB_PATH monkeypatch — no shared state with the real
data file. Run manually:

    apps/agent-api/.venv/bin/python tests/unit/test_place_contact.py
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "apps" / "agent-api"))

import db  # noqa: E402
import kakao  # noqa: E402


def check_kakao_maps_phone() -> bool:
    """Kakao's document keeps phone and the full category path."""
    doc = {
        "id": "26338954",
        "place_name": "역전우동0410 강남점",
        "road_address_name": "서울 강남구 테헤란로 123",
        "address_name": "서울 강남구 역삼동 1-1",
        "category_name": "음식점 > 일식 > 우동",
        "phone": "02-123-4567",
        "x": "127.0276",
        "y": "37.4979",
        "place_url": "http://place.map.kakao.com/26338954",
    }
    place = kakao._to_place(doc)
    ok = (
        place["phone"] == "02-123-4567"
        and place["category"] == "음식점 > 일식 > 우동"
        and place["address"] == "서울 강남구 테헤란로 123"
    )
    print(f"[kakao_maps_phone] {'ok' if ok else 'FAILED'} place={place!r}")
    return ok


def check_kakao_missing_phone() -> bool:
    """Places with no registered phone must map to empty string, not KeyError."""
    place = kakao._to_place({"id": "1", "place_name": "무전화식당", "x": "127.0", "y": "37.5"})
    ok = place["phone"] == "" and place["category"] == ""
    print(f"[kakao_missing_phone] {'ok' if ok else 'FAILED'} place={place!r}")
    return ok


def check_visit_roundtrip() -> bool:
    with tempfile.TemporaryDirectory() as tmpdir:
        db.DB_PATH = Path(tmpdir) / "test.db"
        db.init_db()
        row = db.insert_visit(
            kakao_place_id="26338954",
            place_name="역전우동0410 강남점",
            address="서울 강남구 테헤란로 123",
            lat=37.4979,
            lng=127.0276,
            rating=4,
            note="",
            phone="02-123-4567",
            category="음식점 > 일식 > 우동",
        )
        listed = db.list_visits(place_id="26338954")
        ok = (
            row["phone"] == "02-123-4567"
            and row["category"] == "음식점 > 일식 > 우동"
            and len(listed) == 1
            and listed[0]["phone"] == "02-123-4567"
        )
        print(f"[visit_roundtrip] {'ok' if ok else 'FAILED'} row={row!r}")
        return ok


def check_visit_defaults_null() -> bool:
    """Existing callers that don't pass phone/category still work — the old
    rows in the shipped DB stay NULL and the UI hides those lines."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db.DB_PATH = Path(tmpdir) / "test.db"
        db.init_db()
        row = db.insert_visit(
            kakao_place_id="1",
            place_name="옛날식당",
            address="서울",
            lat=37.5,
            lng=127.0,
            rating=3,
            note="",
        )
        ok = row["phone"] is None and row["category"] is None
        print(f"[visit_defaults_null] {'ok' if ok else 'FAILED'} row={row!r}")
        return ok


def check_recommendation_roundtrip() -> bool:
    with tempfile.TemporaryDirectory() as tmpdir:
        db.DB_PATH = Path(tmpdir) / "test.db"
        db.init_db()
        row = db.insert_recommendation(
            kakao_place_id="26338954",
            place_name="역전우동0410 강남점",
            address="서울 강남구 테헤란로 123",
            lat=37.4979,
            lng=127.0276,
            occasion="점심장소",
            food_type="면",
            cuisine="일식",
            note="",
            phone="02-123-4567",
            category="음식점 > 일식 > 우동",
        )
        listed = db.list_recommendations()
        ok = (
            row["phone"] == "02-123-4567"
            and len(listed) == 1
            and listed[0]["category"] == "음식점 > 일식 > 우동"
        )
        print(f"[recommendation_roundtrip] {'ok' if ok else 'FAILED'} row={row!r}")
        return ok


def demo() -> None:
    results = {
        "kakao_maps_phone": check_kakao_maps_phone(),
        "kakao_missing_phone": check_kakao_missing_phone(),
        "visit_roundtrip": check_visit_roundtrip(),
        "visit_defaults_null": check_visit_defaults_null(),
        "recommendation_roundtrip": check_recommendation_roundtrip(),
    }
    print("\n=== summary ===")
    for name, ok in results.items():
        print(f"{name}: {'PASS' if ok else 'FAIL'}")
    assert all(results.values()), "place contact self-check failed"


if __name__ == "__main__":
    demo()
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

Run: `apps/agent-api/.venv/bin/python tests/unit/test_place_contact.py`
Expected: FAIL — `AttributeError: module 'kakao' has no attribute '_to_place'`

- [ ] **Step 3: `kakao.py`의 document 매핑을 함수로 빼고 phone 추가**

`apps/agent-api/kakao.py`의 `search_places` 끝부분(78-91행)을 이렇게 바꾼다:

```python
def _to_place(doc: dict) -> KakaoPlace:
    """Map one Kakao document to our shape.

    Split out of search_places so the mapping is testable without a network
    round-trip against a daily-quota API.
    """
    return KakaoPlace(
        kakao_place_id=doc.get("id", ""),
        place_name=doc.get("place_name", ""),
        address=doc.get("road_address_name") or doc.get("address_name", ""),
        category=doc.get("category_name", ""),
        phone=doc.get("phone", ""),
        lat=float(doc.get("y", 0.0)),
        lng=float(doc.get("x", 0.0)),
        place_url=doc.get("place_url", ""),
    )
```

그리고 `search_places`의 마지막 루프를 한 줄로 바꾼다:

```python
    return [_to_place(doc) for doc in data.get("documents", [])]
```

(기존의 `places = []` / `for doc ... places.append(...)` / `return places` 블록을 통째로 대체)

- [ ] **Step 4: `db.py`에 컬럼과 인자 추가**

`db.py:65-72`의 ALTER 루프 튜플에 4줄을 추가한다:

```python
        for table, column, coltype in (
            ("recommendations", "price", "INTEGER"),
            # Review authorship. `author` is display-only; `author_id` (a
            # localStorage UUID) is the real key, so two browsers landing on
            # the same random nickname still keep their reviews apart.
            ("visits", "author", "TEXT"),
            ("visits", "author_id", "TEXT"),
            # Kakao fields the 선택한 장소 panel shows. Rows written before
            # this shipped stay NULL — no backfill, the panel hides the line.
            ("visits", "phone", "TEXT"),
            ("visits", "category", "TEXT"),
            ("recommendations", "phone", "TEXT"),
            ("recommendations", "category", "TEXT"),
        ):
```

`insert_visit`의 시그니처에 두 인자를 더한다 (`author_id` 다음, `-> dict[str, Any]` 앞):

```python
    author_id: str | None = None,
    phone: str | None = None,
    category: str | None = None,
```

INSERT 문과 값 튜플도 맞춘다:

```python
            """
            INSERT INTO visits
                (kakao_place_id, place_name, address, lat, lng, rating, note, author, author_id, phone, category, visited_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                kakao_place_id,
                place_name,
                address,
                lat,
                lng,
                rating,
                note,
                author,
                author_id,
                phone,
                category,
                datetime.now(timezone.utc).isoformat(),
            ),
```

`insert_recommendation`도 같은 방식으로 — 시그니처에 `price: int | None = None,` 다음 줄로:

```python
    phone: str | None = None,
    category: str | None = None,
```

INSERT 문과 값 튜플:

```python
            """
            INSERT INTO recommendations
                (kakao_place_id, place_name, address, lat, lng, occasion, food_type, cuisine, note, price, phone, category, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                kakao_place_id,
                place_name,
                address,
                lat,
                lng,
                occasion,
                food_type,
                cuisine,
                note,
                price,
                phone,
                category,
                datetime.now(timezone.utc).isoformat(),
            ),
```

`list_visits`와 `list_recommendations`는 손대지 않는다 — `SELECT *`라 새 컬럼이 자동으로 실린다.

- [ ] **Step 5: 테스트를 돌려 통과를 확인**

Run: `apps/agent-api/.venv/bin/python tests/unit/test_place_contact.py`
Expected: PASS — summary 5줄 모두 `PASS`

- [ ] **Step 6: 기존 백엔드 자기점검이 안 깨졌는지 확인**

Run:
```bash
apps/agent-api/.venv/bin/python tests/unit/test_db_recommendations.py
apps/agent-api/.venv/bin/python tests/unit/test_reviews.py
apps/agent-api/.venv/bin/python tests/unit/test_kakao_params.py
```
Expected: 셋 다 PASS (인자에 기본값을 줬으므로 기존 호출부는 그대로 동작해야 한다)

- [ ] **Step 7: 저장 경로 4곳에서 값을 흘려보냄**

`main.py:300-313` `VisitIn`에 두 필드 추가 (`author_id` 다음):

```python
    author_id: str | None = None
    phone: str | None = None
    category: str | None = None
```

`main.py:321` `add_visit_endpoint`의 `db.insert_visit(...)` 호출에 두 인자 추가 (`author_id=body.author_id,` 다음):

```python
        phone=body.phone,
        category=body.category,
```

`main.py:391` `add_recommendation_endpoint`의 `db.insert_recommendation(...)` 호출 — 여기는 서버가 직접 카카오를 조회하므로(`main.py:384`) 프론트 payload 변경 없이 조회 결과를 쓴다. `price=body.price,` 다음에 추가:

```python
        phone=place["phone"],
        category=place["category"],
```

`tools.py:197` `record_visit`의 `db.insert_visit(...)` — `note=note,` 다음:

```python
        phone=place["phone"],
        category=place["category"],
```

`tools.py:283` 근방 `add_recommendation`의 `db.insert_recommendation(...)` — `price=price,` 다음:

```python
        phone=place["phone"],
        category=place["category"],
```

- [ ] **Step 8: 엔드포인트 자기점검 재실행**

Run:
```bash
apps/agent-api/.venv/bin/python tests/unit/test_recommendations_endpoint.py
apps/agent-api/.venv/bin/python tests/unit/test_search_endpoint.py
```
Expected: 둘 다 PASS

- [ ] **Step 9: 커밋**

```bash
git add apps/agent-api/kakao.py apps/agent-api/db.py apps/agent-api/main.py apps/agent-api/tools.py tests/unit/test_place_contact.py
git commit -m "feat: 장소 전화번호·카테고리 수집 및 저장

카카오 Local 응답의 phone을 버리지 않고 visits/recommendations에
컬럼으로 저장한다. 선택한 장소 패널이 이 두 값을 쓴다. 기존 행은
백필하지 않으며 NULL로 남는다."
```

---

### Task 2: 프론트 순수 함수 — 거리 계산과 카테고리 배지

패널이 쓸 두 순수 함수를 먼저 만든다. UI와 분리해 두면 vitest로 바로 검증된다.

**Files:**
- Create: `apps/web/components/placeMeta.ts`
- Test: `apps/web/components/placeMeta.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `haversineMeters(a: {lat: number; lng: number}, b: {lat: number; lng: number}): number`
  - `formatDistance(meters: number): string` — 1000 미만은 `"340m"`, 이상은 `"8.8km"`
  - `categoryBadge(categoryName: string | undefined | null): string` — 빈 입력이면 `""`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/components/placeMeta.test.ts` 신규 작성:

```typescript
import { describe, expect, it } from "vitest";
import { categoryBadge, formatDistance, haversineMeters } from "./placeMeta";

const CITY_HALL = { lat: 37.5665, lng: 126.978 };
const GANGNAM_STN = { lat: 37.4979, lng: 127.0276 };

describe("haversineMeters", () => {
  it("서울시청 ↔ 강남역은 약 8.8km", () => {
    // 정확값 대신 범위 — 지구 반지름 상수나 공식 변형에 깨지지 않게.
    const d = haversineMeters(CITY_HALL, GANGNAM_STN);
    expect(d).toBeGreaterThan(8500);
    expect(d).toBeLessThan(9100);
  });

  it("같은 좌표는 0", () => {
    expect(haversineMeters(CITY_HALL, CITY_HALL)).toBe(0);
  });

  it("방향이 바뀌어도 같은 값", () => {
    expect(haversineMeters(CITY_HALL, GANGNAM_STN)).toBeCloseTo(
      haversineMeters(GANGNAM_STN, CITY_HALL),
      6
    );
  });
});

describe("formatDistance", () => {
  it("1km 미만은 미터, 정수로", () => {
    expect(formatDistance(340.7)).toBe("341m");
  });

  it("1km 이상은 소수 한 자리 km", () => {
    expect(formatDistance(8793)).toBe("8.8km");
  });
});

describe("categoryBadge", () => {
  it("첫 토막(대분류)을 떼고 › 로 잇는다", () => {
    expect(categoryBadge("음식점 > 한식 > 국밥")).toBe("한식 › 국밥");
  });

  it("카페 같은 다른 대분류도 똑같이 뗀다", () => {
    expect(categoryBadge("음식점 > 카페 > 커피전문점 > 스타벅스")).toBe(
      "카페 › 커피전문점 › 스타벅스"
    );
  });

  it("토막이 하나뿐이면 떼지 않는다", () => {
    expect(categoryBadge("음식점")).toBe("음식점");
  });

  it("빈 값·없는 값은 빈 문자열", () => {
    expect(categoryBadge("")).toBe("");
    expect(categoryBadge(undefined)).toBe("");
    expect(categoryBadge(null)).toBe("");
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

Run: `cd apps/web && npx vitest run components/placeMeta.test.ts`
Expected: FAIL — `Failed to resolve import "./placeMeta"`

- [ ] **Step 3: 최소 구현**

`apps/web/components/placeMeta.ts` 신규 작성:

```typescript
/** 선택한 장소 패널이 쓰는 순수 표시용 계산. UI와 분리해 vitest로 검증한다. */

interface Coords {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6371008.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** 두 좌표 사이의 대권 거리(미터).
 *
 * 카카오 검색 응답의 `distance` 필드를 쓰지 않는 이유: 그건 검색 요청에 실은
 * 좌표 기준이라, 사용자가 지도를 옮긴 뒤의 현재 위치와 다를 수 있다. */
export function haversineMeters(a: Coords, b: Coords): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/** "음식점 > 한식 > 국밥" → "한식 › 국밥".
 *
 * 첫 토막은 항상 대분류(음식점/카페 등)라 배지에서 자리만 차지한다. 토막이
 * 하나뿐일 때는 뗄 것이 없으므로 그대로 쓴다. */
export function categoryBadge(categoryName: string | undefined | null): string {
  if (!categoryName) return "";
  const parts = categoryName
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return parts.slice(1).join(" › ");
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인**

Run: `cd apps/web && npx vitest run components/placeMeta.test.ts`
Expected: PASS — 11 tests

- [ ] **Step 5: 커밋**

```bash
git add apps/web/components/placeMeta.ts apps/web/components/placeMeta.test.ts
git commit -m "feat: 거리 계산·카테고리 배지 순수 함수 추가"
```

---

### Task 3: 마커 클릭 payload에 좌표·전화·카테고리 싣기

마커는 이미 `lat`/`lng`를 갖고 있는데 `SelectedPlace`로 넘길 때 버린다. 이걸 살려야 Task 4의 리뷰와 거리가 동작한다.

**Files:**
- Modify: `apps/web/components/types.ts:1-16`, `:20-32`, `:50-65`
- Modify: `apps/web/components/MapView.tsx:8-23`, `:59-91`, `:130-137`, `:153-155`

**Interfaces:**
- Consumes: Task 1이 API 응답에 실은 `phone`, `category` 키
- Produces: `SelectedPlace`가 `{ place_name, address, category?, phone?, kakao_place_id, lat, lng }`. Task 4의 패널이 이 모양에 의존한다.

- [ ] **Step 1: 타입 확장**

`apps/web/components/types.ts`의 `SelectedPlace`를 바꾼다:

```typescript
export interface SelectedPlace {
  place_name: string;
  address: string;
  category?: string;
  /** Kakao의 등록 전화번호. 예전 DB 행에는 없어 패널이 줄을 숨긴다. */
  phone?: string;
  kakao_place_id: string;
  lat: number;
  lng: number;
}
```

`Place`에 `phone` 추가 (`place_url` 다음):

```typescript
  place_url: string;
  phone?: string;
```

`Visit`에 두 필드 추가 (`visited_at` 앞):

```typescript
  phone?: string | null;
  category?: string | null;
  visited_at: string;
```

`Recommendation`에도 같은 두 필드 추가 (`review_count` 다음):

```typescript
  review_count: number;
  phone?: string | null;
  category?: string | null;
```

- [ ] **Step 2: MapView의 마커 모델과 payload 확장**

`MapView.tsx:8-16`의 `MapMarker` 인터페이스에 `phone`을 더한다 (`kakaoId` 다음). `category?`는 이미 있으니 그대로 둔다:

```typescript
  kakaoId: string;
  phone?: string;
```

`MapView.tsx:18-23` `MapViewProps`의 `recordMarkers` / `recommendMarkers` 타입에도 두 필드를 더한다. 두 줄 모두 `kakao_place_id: string` 뒤에 `; phone?: string | null; category?: string | null` 를 넣어 이렇게 만든다:

```typescript
  recordMarkers: { lat: number; lng: number; place_name: string; address?: string; kakao_place_id: string; phone?: string | null; category?: string | null }[];
  recommendMarkers: { lat: number; lng: number; place_name: string; address?: string; kakao_place_id: string; phone?: string | null; category?: string | null }[];
```

`aiMarkers` memo(59-70행)에 `phone`을 더한다 (`kakaoId: p.kakao_place_id,` 다음):

```typescript
        kakaoId: p.kakao_place_id,
        phone: p.phone ?? undefined,
```

`tabMarkers` memo(73-91행)의 **두 갈래 모두**에 카테고리와 전화를 더한다 — 지금은 `category`를 아예 안 싣고 있다. `recommendMarkers.map` 쪽:

```typescript
        ? recommendMarkers.map((p) => ({
            lat: p.lat,
            lng: p.lng,
            label: p.place_name,
            address: p.address,
            category: p.category ?? undefined,
            kakaoId: p.kakao_place_id,
            phone: p.phone ?? undefined,
          }))
```

`recordMarkers.map` 쪽:

```typescript
        : recordMarkers.map((p) => ({
            lat: p.lat,
            lng: p.lng,
            label: p.place_name,
            address: p.address,
            category: p.category ?? undefined,
            kakaoId: p.kakao_place_id,
            phone: p.phone ?? undefined,
          })),
```

- [ ] **Step 3: 두 클릭 핸들러가 좌표를 넘기게 함**

`MapView.tsx:130-137`의 AI 마커 핸들러:

```typescript
      window.kakao.maps.event.addListener(marker, "click", () =>
        onMarkerSelect?.({
          place_name: place.label,
          address: place.address ?? "",
          category: place.category,
          phone: place.phone,
          kakao_place_id: place.kakaoId,
          lat: place.lat,
          lng: place.lng,
        })
      );
```

`MapView.tsx:153-155`의 탭 마커 핸들러 — 지금은 한 줄짜리인데 같은 모양으로 편다:

```typescript
      window.kakao.maps.event.addListener(marker, "click", () =>
        onMarkerSelect?.({
          place_name: place.label,
          address: place.address ?? "",
          category: place.category,
          phone: place.phone,
          kakao_place_id: place.kakaoId,
          lat: place.lat,
          lng: place.lng,
        })
      );
```

- [ ] **Step 4: 타입 검사로 배관을 검증**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 에러 없음. `SelectedPlace`에 `lat`/`lng`를 필수로 만들었으므로, 어딘가 빠뜨렸다면 여기서 잡힌다.

- [ ] **Step 5: 기존 프론트 테스트가 안 깨졌는지 확인**

Run: `cd apps/web && npx vitest run`
Expected: 전부 PASS

- [ ] **Step 6: 커밋**

```bash
git add apps/web/components/types.ts apps/web/components/MapView.tsx
git commit -m "feat: 마커 선택 시 좌표·전화·카테고리 함께 전달

지금까지 마커가 들고 있던 lat/lng를 SelectedPlace로 넘기지 않고
버렸다. 패널의 리뷰·거리 표시가 이 두 값을 필요로 한다."
```

---

### Task 4: 패널 렌더

패널에 배지·전화·거리·리뷰를 붙인다. `ReviewSection`을 재사용하기 위해 그 prop 타입을 `Recommendation` 전체에서 실제로 쓰는 필드만 가진 좁은 타입으로 완화한다.

**Files:**
- Modify: `apps/web/components/ReviewSection.tsx:5`, `:24-28`
- Modify: `apps/web/components/Sidebar.tsx:1-16`, `:122-140`
- Modify: `apps/web/app/globals.css:210`

**Interfaces:**
- Consumes: Task 2의 `haversineMeters`/`formatDistance`/`categoryBadge`, Task 3의 `SelectedPlace` 모양
- Produces: 없음 (마지막 태스크)

- [ ] **Step 1: `ReviewSection`의 prop 타입 완화**

`ReviewSection.tsx:5`의 import에서 `Recommendation`을 뺀다 (`Visit`만 남긴다):

```typescript
import type { Visit } from "./types";
```

`ReviewSection.tsx:24-26`의 prop 타입을 실제로 쓰는 7개 필드만 가진 타입으로 바꾼다:

```typescript
/** 리뷰를 붙일 수 있는 최소 장소 모양. Recommendation 전체를 요구하면 지도에서
 *  고른 장소(occasion/food_type 같은 축이 없다)를 넘길 수 없다. */
export interface ReviewablePlace {
  kakao_place_id: string;
  place_name: string;
  address: string;
  lat: number;
  lng: number;
  rating_avg: number | null;
  review_count: number;
}

interface ReviewSectionProps {
  place: ReviewablePlace;
  /** 지도에서 고른 장소는 패널이 이미 그 장소만 보여주므로 접어 둘 이유가 없다. */
  defaultOpen?: boolean;
}
```

`ReviewSection.tsx:28-29`의 컴포넌트 시그니처와 `open` 초기값:

```typescript
export function ReviewSection({ place, defaultOpen = false }: ReviewSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
```

`defaultOpen`으로 열린 채 시작할 때도 리뷰를 한 번은 가져와야 한다. `toggle` 함수 바로 위에 effect를 넣는다:

```typescript
  // defaultOpen으로 펼쳐진 채 마운트되면 toggle()이 불리지 않아 리뷰를 못 가져온다.
  // 장소가 바뀌면(패널에서 다른 마커 클릭) 이전 장소의 리뷰를 버리고 다시 가져온다.
  useEffect(() => {
    if (!defaultOpen) return;
    setReviews(null);
    setOpen(true);
    let cancelled = false;
    fetch(`${AGENT_API_BASE}/api/visits?place_id=${encodeURIComponent(place.kakao_place_id)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`failed: ${res.status}`);
        return res.json();
      })
      .then((rows) => !cancelled && setReviews(rows))
      .catch(() => {
        if (cancelled) return;
        setReviews([]);
        setError("리뷰를 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [defaultOpen, place.kakao_place_id]);
```

`useState`만 import하고 있으므로 3행을 고친다:

```typescript
import { useEffect, useState } from "react";
```

`RecommendationList.tsx:172`의 기존 호출부는 `Recommendation`을 그대로 넘기고 `defaultOpen`을 안 주므로 손댈 필요가 없다 — `Recommendation`은 `ReviewablePlace`의 모든 필드를 갖는다.

- [ ] **Step 2: 타입 검사로 기존 호출부가 통과하는지 확인**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 패널 렌더**

`Sidebar.tsx`의 import에 세 줄을 더한다:

```typescript
import { ReviewSection } from "./ReviewSection";
import { categoryBadge, formatDistance, haversineMeters } from "./placeMeta";
import { useGeolocation } from "./useGeolocation";
```

컴포넌트 본문 맨 위(`const [isModelMenuOpen, ...]` 위)에 현재 위치를 읽는다:

```typescript
  const myLocation = useGeolocation();
```

`selectedModel` 선언 아래에 표시값을 계산한다:

```typescript
  const badge = categoryBadge(selectedPlace?.category);
  const distance = selectedPlace
    ? formatDistance(haversineMeters(myLocation, { lat: selectedPlace.lat, lng: selectedPlace.lng }))
    : "";
```

`Sidebar.tsx:122-140`의 패널 블록을 통째로 이걸로 바꾼다:

```tsx
      {selectedPlace && (
        <div className="sidebar-selected-place">
          <div className="sidebar-selected-place-header">
            <span>선택한 장소</span>
            <button type="button" onClick={onClearSelectedPlace} aria-label="선택 해제">
              ✕
            </button>
          </div>
          <RestaurantCard name={selectedPlace.place_name} address={selectedPlace.address} />
          <div className="sidebar-selected-place-meta">
            {badge && <span className="sidebar-selected-place-badge">{badge}</span>}
            {selectedPlace.phone && (
              <a className="sidebar-selected-place-phone" href={`tel:${selectedPlace.phone}`}>
                📞 {selectedPlace.phone}
              </a>
            )}
            <span className="sidebar-selected-place-distance">{distance}</span>
          </div>
          <a
            className="sidebar-selected-place-link"
            href={`https://place.map.kakao.com/${selectedPlace.kakao_place_id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            카카오맵에서 보기 ↗
          </a>
          <ReviewSection
            key={selectedPlace.kakao_place_id}
            defaultOpen
            place={{
              kakao_place_id: selectedPlace.kakao_place_id,
              place_name: selectedPlace.place_name,
              address: selectedPlace.address,
              lat: selectedPlace.lat,
              lng: selectedPlace.lng,
              // 패널은 목록의 join 요약을 못 받는다. defaultOpen이라 마운트 직후
              // fetch한 값이 이 자리를 덮어쓴다 (ReviewSection.tsx의 count/avg).
              rating_avg: null,
              review_count: 0,
            }}
          />
        </div>
      )}
```

`RestaurantCard`에 `category`를 넘기던 것을 뺀 이유: 이제 배지가 그 자리를 대신하고, 원본 경로 문자열("음식점 > 한식 > 국밥")을 두 번 보여줄 이유가 없다.

- [ ] **Step 4: 스타일 추가**

`app/globals.css`의 `.sidebar-selected-place-header` 규칙(210행) **바로 앞**에 넣는다:

```css
/* 리뷰까지 들어가면 세로로 길어져서, 스크롤을 패널 안에 가두지 않으면
   아래의 탭과 목록이 화면 밖으로 밀려난다. */
.sidebar-selected-place {
  max-height: 45vh;
  overflow-y: auto;
  border-bottom: 1px solid var(--color-line);
}

.sidebar-selected-place-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 16px 8px;
  font-size: 0.78rem;
  color: var(--color-muted);
}

.sidebar-selected-place-badge {
  padding: 2px 8px;
  border-radius: 10px;
  background: #f5f8fa;
  color: var(--color-muted);
}

.sidebar-selected-place-phone {
  color: var(--color-primary);
  text-decoration: none;
}

.sidebar-selected-place-phone:hover {
  text-decoration: underline;
}
```

- [ ] **Step 5: 빌드와 테스트로 검증**

Run:
```bash
cd apps/web && npx tsc --noEmit && npx vitest run && npm run build
```
Expected: 타입 에러 없음, 테스트 전부 PASS, 빌드 성공

- [ ] **Step 6: 손으로 확인**

`apps/web`에서 `npm run dev`, agent-api도 띄운 상태로 브라우저에서:

1. 챗으로 장소를 검색해 AI 마커(파란 계열)를 띄우고 클릭 → 배지·전화·거리가 다 보인다
2. [추천] 탭의 마커를 클릭 → 이 계획 이전에 저장된 행이면 배지·전화 줄이 숨고 거리만 보인다
3. 패널에서 별점과 코멘트를 남기고 → 목록에 바로 뜬다. 새로고침 후에도 남아 있다
4. 새 장소를 추천 등록한 뒤 그 마커를 클릭 → 배지와 전화가 채워져 있다 (Task 1의 서버측 조회 경로)
5. 리뷰가 여러 개일 때 패널이 사이드바를 밀어내지 않고 자체 스크롤된다

- [ ] **Step 7: 커밋**

```bash
git add apps/web/components/Sidebar.tsx apps/web/components/ReviewSection.tsx apps/web/app/globals.css
git commit -m "feat: 선택한 장소 패널에 카테고리·전화·거리·리뷰 표시

카카오 Local API에는 평점/리뷰가 없어서 그 자리는 우리 DB의 리뷰가
채운다. ReviewSection의 prop을 Recommendation 전체에서 필요한 필드만
가진 ReviewablePlace로 완화해 지도에서 고른 장소에도 붙인다."
```

---

## 완료 조건

- [ ] `apps/agent-api/.venv/bin/python tests/unit/test_place_contact.py` PASS
- [ ] 기존 `tests/unit/` 자기점검 스크립트가 전부 PASS
- [ ] `cd apps/web && npx vitest run` PASS
- [ ] `cd apps/web && npx tsc --noEmit` 무에러, `npm run build` 성공
- [ ] Task 4 Step 6의 수동 확인 5가지 통과
