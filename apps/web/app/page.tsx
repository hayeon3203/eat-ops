"use client";

import { useState } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { Layout } from "@/components/Layout";

type Provider = "local" | "foundry";

export default function Home() {
  const [provider, setProvider] = useState<Provider>("local");

  return (
    <main style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <label style={{ padding: "8px 14px", fontSize: "0.875rem" }}>
        모델:{" "}
        <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
          <option value="local">로컬 (EXAONE, GB10 vLLM)</option>
          <option value="foundry">Foundry (GPT-5-mini)</option>
        </select>
      </label>
      {/* key=provider remounts the whole subtree on switch, so each
          provider gets its own thread instead of replaying history against
          a different model mid-conversation. */}
      <CopilotKit key={provider} runtimeUrl={`/api/copilotkit/${provider}`}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <Layout />
        </div>
      </CopilotKit>
    </main>
  );
}
