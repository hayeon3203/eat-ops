/**
 * Anonymous per-browser identity for place reviews.
 *
 * There is no login (the deployment sits behind one shared Basic Auth
 * passcode), so each browser gets a random Musinsa-style nickname on first
 * use and keeps it in localStorage. `id` is the real key — 30x30 = 900
 * nicknames means two browsers can collide, and only the id keeps their
 * reviews apart.
 */

const STORAGE_KEY = "daol.identity";

const MODIFIERS = [
  "배고픈", "야식 시키는", "줄 서는", "예약하는", "리필하는",
  "완주한", "남기는", "포장하는", "숟가락 든", "사진 먼저 찍는",
  "매운 거 잘 먹는", "뜨거운 거 못 먹는", "혼밥하는", "늦게 온", "단골 된",
  "별점 짠", "별점 후한", "배부른", "소화 중인", "물부터 찾는",
  "메뉴 고민하는", "첫 술 뜨는", "후식까지 먹는", "곱빼기 시키는", "재방문한",
  "새벽에 먹는", "골고루 먹는", "천천히 먹는", "급하게 먹는", "야무지게 먹는",
];

const NOUNS = [
  "미식가", "대식가", "식신", "단골", "탐험가",
  "방랑자", "사냥꾼", "수집가", "평론가", "심사위원",
  "순례자", "연구원", "감별사", "애호가", "큐레이터",
  "개척자", "기록자", "안내자", "웨이팅족", "혼밥러",
  "회식러", "야식러", "해장러", "디저트러", "전도사",
  "셰프", "주방장", "길잡이", "단골손님", "첫손님",
];

export interface Identity {
  id: string;
  nickname: string;
}

function pick<T>(list: T[], random: () => number): T {
  return list[Math.floor(random() * list.length)];
}

export function generateNickname(random: () => number = Math.random): string {
  return `${pick(MODIFIERS, random)} ${pick(NOUNS, random)}`;
}

/** crypto.randomUUID는 보안 컨텍스트(HTTPS 또는 localhost)에서만 존재한다. 폰에서
 *  LAN 주소(http://172.16.x.x:3000)로 열면 undefined라 호출하는 순간 TypeError가 났고,
 *  ReviewSection이 렌더 중에 getIdentity()를 부르기 때문에 장소를 하나 고르는 것만으로
 *  앱 전체가 에러 화면("This page couldn't load")으로 넘어갔다. getRandomValues는
 *  http에서도 있으므로 없을 때만 그걸로 만든다. id는 사람이 볼 일 없는 불투명한 키라
 *  UUID 형식을 지킬 이유는 없다. */
function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Reads the stored identity, minting and persisting one on first call. */
export function getIdentity(): Identity {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<Identity>;
      if (parsed.id && parsed.nickname) return parsed as Identity;
    } catch {
      // Corrupted entry — fall through and mint a fresh one.
    }
  }
  const identity: Identity = { id: randomId(), nickname: generateNickname() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  return identity;
}
