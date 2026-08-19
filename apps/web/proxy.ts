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
    if (user === USER && pass === PASS) return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="daol-fusion"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
