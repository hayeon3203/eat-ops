import { HttpAgent } from "@ag-ui/client";
import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";

const AGENT_API_BASE = process.env.AGENT_API_URL ?? "http://127.0.0.1:8787";

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
      default: new HttpAgent({ url: `${AGENT_API_BASE}/${provider}` }),
    },
  });
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    endpoint: `/api/copilotkit/${provider}`,
  });
  return handleRequest(req);
}
