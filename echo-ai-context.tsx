import { createContext, useContext } from "react";
import type { ConversationHandle } from "react-native-litert-lm";

export type EchoAIStatus =
  | "checking"
  | "not-installed"
  | "requesting-permission"
  | "downloading"
  | "loading"
  | "ready"
  | "failed"
  | "unsupported";

export type EchoAIContextValue = {
  status: EchoAIStatus;
  progress: number;
  message: string | null;
  startInstall: () => Promise<void>;
  createConversation: (systemPrompt: string) => ConversationHandle | null;
};

export const EchoAIContext = createContext<EchoAIContextValue | null>(null);

export function useEchoAI(): EchoAIContextValue {
  const value = useContext(EchoAIContext);
  if (!value) throw new Error("useEchoAI must be used within EchoAIProvider");
  return value;
}
