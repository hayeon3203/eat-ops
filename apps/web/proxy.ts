import { NextRequest, NextResponse } from "next/server";

// Plans.md Milestone 6 — minimal LAN-deployment gate. Native HTTP Basic
// Auth: the browser prompts once for this origin and caches the credential
// for every later request, so no frontend code needs to carry the
// passcode. No-op when BASIC_AUTH_PASS is unset (local dev unaffected).
// Matching gate on the agent-api side lives in apps/agent-api/main.py's
// _BasicAuthMiddleware — the two are independent origins, so the browser
// prompts once per port.
const USER = process.env.BASIC_AUTH_USER ?? "daol";
const PASS = process.env.BASIC_AUTH_PASS;

export function proxy(request: NextRequest) {
  if (!PASS) return NextResponse.next();

  const auth = request.headers.get("authorization");
  if (auth) {
    const [, encoded] = auth.split(" ");
    const [user, pass] = atob(encoded ?? "").split(":");
    // 사용자명은 대소문자·앞뒤 공백을 무시한다. 휴대폰 키보드가 사용자명 칸을
    // 건드려서(자동 대문자화, 앞뒤 공백) 비밀번호가 맞는데도 401이 반복되는 일이
    // 있었다. 사용자명은 비밀이 아니라 느슨하게 봐도 되지만, 비밀번호는 아래처럼
    // 정확히 일치해야 한다. 자동완성이 글자를 덧붙이는 경우(daol -> daolts)까지는
    // 여기서 못 막는다 — 네이티브 Basic Auth 대화상자는 입력 힌트를 줄 수 없다.
    if (user?.trim().toLowerCase() === USER.toLowerCase() && pass === PASS) return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="daol-fusion"' },
  });
}

export const config = {
  // 파비콘은 브라우저가 인증 헤더 없이 가져가므로 게이트에서 빼야 한다. 앱은
  // favicon.ico가 아니라 app/icon.png를 쓰는데 여기 빠져 있어서 계속 401이었다.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png).*)"],
};
