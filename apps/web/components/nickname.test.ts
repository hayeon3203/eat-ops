import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateNickname, getIdentity } from "./nickname";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  let n = 0;
  vi.stubGlobal("crypto", { randomUUID: () => `uuid-${n++}` });
});

describe("generateNickname", () => {
  it("formats as '<수식어> <명사>'", () => {
    expect(generateNickname(() => 0)).toBe("배고픈 미식가");
  });

  it("reaches the last entry of both lists", () => {
    expect(generateNickname(() => 0.999)).toBe("야무지게 먹는 첫손님");
  });
});

describe("getIdentity", () => {
  it("returns the same identity on repeat calls", () => {
    const first = getIdentity();
    const second = getIdentity();
    expect(second).toEqual(first);
    expect(first.nickname.split(" ").length).toBeGreaterThanOrEqual(2);
  });

  it("mints a fresh identity when the stored entry is corrupted", () => {
    localStorage.setItem("daol.identity", "not json");
    expect(getIdentity().id).toBe("uuid-0");
  });

  it("mints a fresh identity when the stored entry is missing a field", () => {
    localStorage.setItem("daol.identity", JSON.stringify({ nickname: "배고픈 미식가" }));
    expect(getIdentity().id).toBe("uuid-0");
  });

  // 폰에서 LAN 주소(http://172.16.x.x:3000)로 열면 보안 컨텍스트가 아니라
  // crypto.randomUUID가 아예 없다. 예전에는 여기서 TypeError가 나서, 장소를 하나
  // 고르는 것만으로 앱이 에러 화면으로 넘어갔다.
  it("mints an identity without crypto.randomUUID (insecure origin)", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (a: Uint8Array) => a.fill(0xab),
    });
    expect(getIdentity().id).toBe("ab".repeat(16));
  });
});
