"use client";

import { useState } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { Layout } from "@/components/Layout";
import type { Provider } from "@/components/types";

export default function Home() {
  const [provider, setProvider] = useState<Provider>("auto");

  return (
    <main className="app-shell">
      {/* key=provider remounts the whole subtree on switch, so each
          provider gets its own thread instead of replaying history against
          a different model mid-conversation. */}
      <CopilotKit key={provider} runtimeUrl={`/api/copilotkit/${provider}`}>
        <Layout provider={provider} onProviderChange={setProvider} />
      </CopilotKit>
    </main>
  );
}
