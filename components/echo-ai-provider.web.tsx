import type { ReactNode } from "react";
import { EchoAIContext, type EchoAIContextValue } from "./echo-ai-context";

const unsupportedValue: EchoAIContextValue = {
  status: "unsupported",
  progress: 0,
  message: null,
  startInstall: async () => undefined,
  createConversation: () => null,
};

export function EchoAIProvider({ children }: { children: ReactNode }) {
  return <EchoAIContext.Provider value={unsupportedValue}>{children}</EchoAIContext.Provider>;
}
