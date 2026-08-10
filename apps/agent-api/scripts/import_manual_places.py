"""One-off import: 41 hand-typed 역삼동 places -> recommendations table.

ponytail: throwaway script, not a persistent agent tool. Run once:
    .venv/bin/python scripts/import_manual_places.py

Goes through the already-running agent-api's own HTTP endpoints
(GET /api/search for a dry-run look at the Kakao match, POST
/api/recommendations to actually insert) instead of importing kakao.py/db.py
directly — the running server already has KAKAO_REST_API_KEY loaded
in-process; this script never needs to see that secret itself.

Requires apps/agent-api's server already running on AGENT_API_BASE (see
main.py's __main__ block / README "실행법").
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

AGENT_API_BASE = "http://127.0.0.1:8787"

# (place_name, occasion, cuisine, note=original kakao category tag)
PLACES: list[tuple[str, str, str, str]] = [
    # 회식장소
    ("깐부치킨", "회식장소", "기타", "치킨"),
    ("미역향 삼겹장", "회식장소", "한식", "미역국, 삼겹살"),
    ("돝고기506", "회식장소", "한식", "삼겹살"),
    # 점심장소
    ("김밥천국 역삼역점", "점심장소", "한식", "분식"),
    ("성덕 역삼점", "점심장소", "중식", "딤섬, 중식만두"),
    ("샐러디&샌드위치 역삼점", "점심장소", "양식", "다이어트, 샐러드"),
    ("틈새라면 역삼점", "점심장소", "한식", "분식"),
    ("백암왕순대 역삼2호점", "점심장소", "한식", "순대, 순댓국"),
    ("크라이치즈버거 강남점", "점심장소", "양식", "햄버거"),
    ("왁버거 강남", "점심장소", "양식", "햄버거"),
    ("진심왕돈까스 역삼점", "점심장소", "한식", "한식"),
    ("호앙비엣 역삼2호점", "점심장소", "베트남식", "베트남음식"),
    ("김밥천국 역삼지식센터점", "점심장소", "한식", "분식"),
    ("웍시 강남역삼점", "점심장소", "중식", "중식당"),
    ("정남옥 역삼점", "점심장소", "한식", "순대, 순댓국"),
    ("히노야카레", "점심장소", "일식", "카레"),
    ("갓포돈 1호점", "점심장소", "일식", "돈가스"),
    ("연탄마을", "점심장소", "한식", "돼지고기구이"),
    ("김부장", "점심장소", "한식", "한식"),
    ("강남고기집 한판도 역삼본점", "점심장소", "한식", "육류, 고기요리"),
    ("차셰프고기덮밥", "점심장소", "한식", "육류, 고기요리"),
    ("청담소반", "점심장소", "한식", "한식"),
    ("김남완초밥집", "점심장소", "일식", "초밥, 롤"),
    ("수미정", "점심장소", "한식", "한식"),
    ("우쿠야 강남역삼점", "점심장소", "일식", "돈가스"),
    ("비진도 해물뚝배기 역삼점", "점심장소", "한식", "해물, 생선요리"),
    ("봉된장 본점", "점심장소", "한식", "찌개, 전골"),
    ("고등어식당", "점심장소", "한식", "한식"),
    ("멘노아지 강남본점", "점심장소", "일식", "일본식라면"),
    ("제주은희네해장국 강남역점", "점심장소", "한식", "해장국"),
    ("현풍닭칼국수 강남역삼점", "점심장소", "한식", "칼국수, 만두"),
    ("백소정 역삼역점", "점심장소", "일식", "일식당"),
    ("그냥찌개집 역삼점", "점심장소", "한식", "찌개, 전골"),
    ("짬뽕지존 역삼점", "점심장소", "중식", "중식당"),
    # 수고한 나에게
    ("나이스샤워 역삼점", "수고한 나에게", "일식", "일식당"),
    ("을밀대 역삼점", "수고한 나에게", "한식", "냉면"),
    ("브루클린더버거조인트 역삼점", "수고한 나에게", "양식", "햄버거"),
    ("우동명가 기리야마본진", "수고한 나에게", "일식", "우동, 소바"),
    ("애호락 강남직영점", "수고한 나에게", "한식", "한식"),
    ("송화", "수고한 나에게", "한식", "한식"),
    ("카츠쇼신 강남점", "수고한 나에게", "일식", "돈가스"),
]


def http_json(method: str, path: str, body: dict | None = None) -> tuple[int, object]:
    url = f"{AGENT_API_BASE}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}


def main() -> None:
    status, existing = http_json("GET", "/api/recommendations")
    if status != 200:
        print(f"FATAL: GET /api/recommendations -> {status}")
        return
    existing_names = {r["place_name"] for r in existing}

    ok, skipped, failed = [], [], []
    for place_name, occasion, cuisine, note in PLACES:
        query = f"{place_name} 역삼동"
        status, results = http_json("GET", f"/api/search?q={urllib.parse.quote(query)}")
        if status != 200 or not results:
            # "역삼동" 접미사가 일부 이름에서 오히려 매칭을 방해함 — 원본 이름으로 재시도.
            query = place_name
            status, results = http_json("GET", f"/api/search?q={urllib.parse.quote(query)}")
        if status != 200 or not results:
            failed.append((place_name, f"검색결과없음 (status={status})"))
            continue
        top = results[0]
        if "강남구" not in top.get("address", ""):
            failed.append((place_name, f"주소불일치: {top.get('address')}"))
            continue
        if top["place_name"] in existing_names:
            skipped.append((place_name, top["place_name"]))
            continue

        status, result = http_json(
            "POST",
            "/api/recommendations",
            {"place_name": query, "occasion": occasion, "cuisine": cuisine, "note": note},
        )
        if status not in (200, 201):
            failed.append((place_name, f"등록실패 status={status} body={result}"))
            continue
        ok.append((place_name, result.get("place_name"), result.get("address")))
        existing_names.add(result.get("place_name"))

    print(f"\n=== 등록 성공 {len(ok)} / 스킵(기존) {len(skipped)} / 실패 {len(failed)} (총 {len(PLACES)}) ===")
    for src, name, addr in ok:
        print(f"  OK   {src} -> {name} ({addr})")
    for src, matched in skipped:
        print(f"  SKIP {src} -> 이미 존재: {matched}")
    for src, reason in failed:
        print(f"  FAIL {src} -> {reason}")


if __name__ == "__main__":
    main()
