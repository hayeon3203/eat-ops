import type { ReactNode } from "react";
import "@copilotkit/react-ui/styles.css";
import "./globals.css";

export const metadata = {
  title: "Foundry Hybrid Agent",
};

// <CopilotKit> lives in page.tsx, not here: its runtimeUrl needs to switch
// between the local/foundry routes based on client state, and layout.tsx
// (a server component) can't hold that state.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
