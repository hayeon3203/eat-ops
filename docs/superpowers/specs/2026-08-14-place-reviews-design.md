# 장소별 다중 사용자 별점·댓글 (리뷰)

**날짜**: 2026-08-14
**상태**: 승인됨

## 목표

여러 이용자가 같은 장소에 각자 별점과 댓글을 남긴다. 추천 카드에서 평균 별점과 리뷰 목록을 보고, 그 자리에서 리뷰를 쓴다.

## 이용자 식별

로그인 없음. 브라우저마다 랜덤 닉네임 1개를 발급해 localStorage에 고정한다 (무신사 방식).

- 형식: `<수식어> <명사>` — `곱빼기 시키는 감별사`, `별점 짠 해장러`
- 30 × 30 = 900 조합. 10명 규모에서 겹칠 확률 ~5%
- 겹쳐도 리뷰는 안 섞인다 — 진짜 키는 같이 발급하는 `author_id` (`crypto.randomUUID()`), 닉네임은 표시 전용
- 중복 방지 로직 없음 (900조합이면 실용상 무의미, 서버 라운드트립만 늘어남)

**보안 한계 (의도된 것)**: `author_id`는 브라우저가 보내는 값이라 위조 가능하다. 로그인이 없으므로 리뷰 소유권을 강제할 수단이 없고, 삭제 시 `author_id` 대조는 UI 편의 수준의 방어다. 사내 ~10명이 공유 Basic Auth로 접근하는 환경을 전제한다. 진짜 강제가 필요해지면 계정 테이블 + 세션 도입이 선행되어야 한다.

## 데이터

새 테이블을 만들지 않는다. `visits`가 이미 `kakao_place_id`, `rating`, `note`, `visited_at`을 갖고 있어 그대로 리뷰 레코드다. 작성자 컬럼 2개만 추가한다.

```sql
ALTER TABLE visits ADD COLUMN author TEXT;      -- 표시용 닉네임
ALTER TABLE visits ADD COLUMN author_id TEXT;   -- localStorage UUID
```

`db.py`의 기존 `try/except sqlite3.OperationalError` 마이그레이션 패턴을 따른다 (`recommendations.price`와 동일).

기존 행은 두 컬럼이 NULL이다. 화면에는 `익명`으로 표시한다. 챗 `record_visit` 툴이 남기는 행도 NULL로 들어가며 같은 취급을 받는다.

**리뷰 = 방문 기록**으로 통합한다. 별점이 두 군데 사는 상황(별도 `reviews` 테이블)을 피하는 대신, 안 가본 가게에는 리뷰를 못 남긴다는 제약을 받아들인다.

**장소 마스터 테이블은 만들지 않는다.** `recommendations`와 `visits`가 각자 장소 정보를 복사해 갖는 현 구조를 유지하고, 둘은 `kakao_place_id`로 조인한다.

## API (`apps/agent-api/main.py`)

| 메서드 | 경로 | 내용 |
| --- | --- | --- |
| GET | `/api/visits?place_id=&author_id=` | 기존 엔드포인트에 선택 필터 2개 추가. 무인자 호출은 기존 동작 유지 |
| POST | `/api/visits` | 신규 |
| DELETE | `/api/visits/{id}?author_id=` | `author_id`가 일치할 때만 삭제 |
| GET | `/api/recommendations` | **변경** — `rating_avg`, `review_count` 추가 |

### POST `/api/visits`

```json
{
  "kakao_place_id": "...", "place_name": "...", "address": "...",
  "lat": 0, "lng": 0,
  "rating": 4, "note": "...", "author": "곱빼기 시키는 감별사", "author_id": "uuid"
}
```

장소 정보는 추천 카드가 이미 갖고 있으므로 클라이언트가 그대로 보낸다. `add_recommendation_endpoint`와 달리 **Kakao 조회를 하지 않는다** — 불필요한 왕복이고 일일 쿼터를 깎는다.

`rating`은 1~5 정수. 범위를 벗어나면 400.

### GET `/api/recommendations` 집계

`db.list_recommendations()`가 `LEFT JOIN visits ON kakao_place_id`로 `AVG(rating)`, `COUNT(rating)`을 같이 반환한다. 리뷰 없는 장소는 `rating_avg = null`, `review_count = 0`.

카드마다 별도 요청을 보내지 않기 위한 선택 — 목록 로드 1번이면 요약 줄이 다 채워진다. 리뷰 본문은 카드를 펼칠 때만 `GET /api/visits?place_id=`로 가져온다.

## 프런트엔드 (`apps/web/`)

### `components/nickname.ts` (신규)

- 수식어 30 + 명사 30 배열
- `getIdentity(): { id: string; nickname: string }` — localStorage 키 `daol.identity`를 읽고, 없으면 생성 후 저장

### `components/ReviewSection.tsx` (신규, ~90줄)

추천 카드 아래 접힘 상태로 붙는다.

- 접힘: `★ 4.3 · 리뷰 3` (리뷰 0개면 `리뷰 남기기`)
- 펼침: 리뷰 목록(닉네임 / 별점 / 댓글 / 날짜, 내 리뷰엔 삭제 버튼) + 작성 폼(별점 1~5 버튼 + 댓글 input + 등록)
- 펼칠 때 `GET /api/visits?place_id=` 최초 1회 fetch
- 등록 시 `getIdentity()` 값을 실어 POST, 성공하면 목록에 낙관적 추가

### 수정

- `components/types.ts` — `Visit`에 `author`/`author_id`, `Recommendation`에 `rating_avg`/`review_count`
- `components/RecommendationList.tsx` — 각 카드 아래 `<ReviewSection>` 마운트
- `components/VisitList.tsx` — `?author_id=`로 내 리뷰만 조회. 검색 input은 내 리뷰 텍스트 필터로 유지, `카카오에서 더 찾기` 버튼은 제거 (내 리뷰 목록에서 외부 검색은 의미 없음)
- `app/globals.css` — `.review-*` 클래스

`RestaurantCard.tsx`는 손대지 않는다.

## 검증

- `tests/unit/test_reviews.py` — 같은 `kakao_place_id`에 서로 다른 `author_id` 2건 저장 후: 평균 별점 계산, `place_id` 필터, `author_id` 필터, 남의 `author_id`로 DELETE 시 미삭제, `rating` 범위 밖 400
- `apps/web/components/nickname.test.ts` — `getIdentity()`를 두 번 호출해도 같은 값 반환, 형식이 `<수식어> <명사>`. `paydayPick.test.ts`와 같은 vitest 패턴

## 범위 밖

리뷰 수정(삭제 후 재작성으로 대체), 사진 첨부(Plans.md:439 별건), 정렬·페이지네이션, 신고·차단, 닉네임 재발급 버튼.

## 단어 목록

**수식어 30**
```
배고픈, 야식 시키는, 줄 서는, 예약하는, 리필하는,
완주한, 남기는, 포장하는, 숟가락 든, 사진 먼저 찍는,
매운 거 잘 먹는, 뜨거운 거 못 먹는, 혼밥하는, 늦게 온, 단골 된,
별점 짠, 별점 후한, 배부른, 소화 중인, 물부터 찾는,
메뉴 고민하는, 첫 술 뜨는, 후식까지 먹는, 곱빼기 시키는, 재방문한,
새벽에 먹는, 골고루 먹는, 천천히 먹는, 급하게 먹는, 더치페이하는
```

**명사 30**
```
미식가, 대식가, 식신, 단골, 탐험가,
방랑자, 사냥꾼, 수집가, 평론가, 심사위원,
순례자, 연구원, 감별사, 애호가, 탐식가,
개척자, 기록자, 안내자, 웨이팅족, 혼밥러,
회식러, 야식러, 해장러, 디저트러, 사장님,
셰프, 주방장, 배달기사, 단골손님, 첫손님
```
