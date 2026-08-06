import { HttpAgent } from "@ag-ui/client";
import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";

const AGENT_API_URL = process.env.AGENT_API_URL ?? "http://127.0.0.1:8787/default";

const runtime = new CopilotRuntime({
  agents: {
    default: new HttpAgent({ url: AGENT_API_URL }),
  },
});

export async function POST(req: Request) {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    endpoint: "/api/copilotkit",
  });
  return handleRequest(req);
}
