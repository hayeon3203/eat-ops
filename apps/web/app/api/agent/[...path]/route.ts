/**
 * Same-origin proxy for agent-api's REST endpoints (/api/visits,
 * /api/recommendations, /api/search, ...).
 *
 * The browser must never call agent-api's port directly. Twice now the
 * sidebar lists and every map marker silently went empty because of that:
 * first when `NEXT_PUBLIC_AGENT_API_URL` was unset and `127.0.0.1:8787`
 * resolved to the *viewer's* machine, then again when M6's Basic Auth gate
 * landed — a cross-origin fetch carries no credentials, so agent-api
 * answered 401 and the components' `.catch()` rendered an empty list with no
 * console error either time.
 *
 * Routing through this handler removes the whole class: the page always
 * fetches its own origin, one gate (proxy.ts) covers it, and the passcode is
 * attached here server-side — the same thing
 * app/api/copilotkit/[provider]/route.ts already does for the chat stream.
 */

const AGENT_API_BASE = process.env.AGENT_API_URL ?? "http://127.0.0.1:8787";

const AGENT_API_AUTH_HEADER: Record<string, string> = process.env.BASIC_AUTH_PASS
  ? {
      Authorization: `Basic ${Buffer.from(
        `${process.env.BASIC_AUTH_USER ?? "daol"}:${process.env.BASIC_AUTH_PASS}`
      ).toString("base64")}`,
    }
  : {};

async function forward(req: Request, params: Promise<{ path: string[] }>) {
  const { path } = await params;
  // Callers pass the agent-api path verbatim ("/api/agent" + "/api/visits"),
  // so `path` already starts with "api" — don't prefix it again.
  const target = `${AGENT_API_BASE}/${path.join("/")}${new URL(req.url).search}`;

  const headers: Record<string, string> = { ...AGENT_API_AUTH_HEADER };
  const contentType = req.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export const GET = (req: Request, { params }: Ctx) => forward(req, params);
export const POST = (req: Request, { params }: Ctx) => forward(req, params);
export const DELETE = (req: Request, { params }: Ctx) => forward(req, params);
