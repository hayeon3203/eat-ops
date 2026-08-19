import { HttpAgent } from "@ag-ui/client";
import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";

const AGENT_API_BASE = process.env.AGENT_API_URL ?? "http://127.0.0.1:8787";

// Plans.md M6 — agent-api's _BasicAuthMiddleware gates every request once
// BASIC_AUTH_PASS is set there; this server-to-server call needs to carry
// the same credential (the browser only authenticates against this Next.js
// origin via middleware.ts, never directly against agent-api's port).
const AGENT_API_AUTH_HEADER = process.env.BASIC_AUTH_PASS
  ? {
      Authorization: `Basic ${Buffer.from(`${process.env.BASIC_AUTH_USER ?? "daol"}:${process.env.BASIC_AUTH_PASS}`).toString("base64")}`,
    }
  : undefined;

// One runtime endpoint per provider (`/api/copilotkit/local`,
// `/api/copilotkit/foundry`, `/api/copilotkit/auto`) mirroring agent-api's
// own `/local`, `/foundry`, and `/auto` (ModelRouter) AG-UI paths, so the
// web UI can switch providers by changing `runtimeUrl` instead of
// restarting agent-api with a different env var.
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider !== "local" && provider !== "foundry" && provider !== "auto") {
    return new Response("Unknown provider", { status: 404 });
  }

  const runtime = new CopilotRuntime({
    agents: {
      default: new HttpAgent({ url: `${AGENT_API_BASE}/${provider}`, headers: AGENT_API_AUTH_HEADER }),
    },
  });
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    endpoint: `/api/copilotkit/${provider}`,
  });
  return handleRequest(req);
}
