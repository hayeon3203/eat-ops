"use client";

import { CopilotChat } from "@copilotkit/react-ui";

export default function Home() {
  return (
    <main style={{ height: "100vh" }}>
      <CopilotChat labels={{ title: "Foundry Hybrid Agent", initial: "Hi! Ask me anything." }} />
    </main>
  );
}
