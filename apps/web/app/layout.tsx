import type { ReactNode } from "react";
import "@copilotkit/react-ui/styles.css";
import "./globals.css";

export const metadata = {
  title: "Daol Fusion",
  description: "AI와 함께 찾고 기록하는 나만의 맛집 지도",
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
