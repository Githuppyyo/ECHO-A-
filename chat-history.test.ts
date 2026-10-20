import { beforeEach, describe, expect, it, vi } from "vitest";

const localStorage = vi.hoisted(() => new Map<string, string>());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => localStorage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      localStorage.set(key, value);
    },
  },
}));

import {
  createConversationTitle,
  loadChatHistory,
  saveChatHistory,
  upsertChatConversation,
  type ChatMessage,
} from "./chat-history";

beforeEach(() => {
  localStorage.clear();
});

describe("local chat history", () => {
  it("stores the active conversation and restores its messages and image reference", async () => {
    const messages: ChatMessage[] = [
      {
        id: "user-1",
        role: "user",
        content: "Bu görselde ne var?",
        imageUri: "file:///app/documents/chat-images/image.jpg",
        imageName: "image.jpg",
      },
      { id: "assistant-1", role: "assistant", content: "Bir masa görüyorum." },
    ];
    await saveChatHistory({
      version: 1,
      activeConversationId: "conversation-1",
      conversations: [
        {
          id: "conversation-1",
          title: "Bu görselde ne var?",
          updatedAt: 123,
          messages,
        },
      ],
    });

    const restored = await loadChatHistory();
    expect(restored.activeConversationId).toBe("conversation-1");
    expect(restored.conversations[0]?.messages).toEqual(messages);
  });

  it("creates a readable title and preserves other conversations when upserting", () => {
    const firstMessage: ChatMessage = {
      id: "user-1",
      role: "user",
      content: "  Bana kısa bir plan yaz  ",
    };
    const other = {
      id: "old",
      title: "Önceki sohbet",
      updatedAt: 10,
      messages: [firstMessage],
    };

    const updated = upsertChatConversation([other], "new", [firstMessage]);
    expect(createConversationTitle([firstMessage])).toBe("Bana kısa bir plan yaz");
    expect(updated.map((conversation) => conversation.id)).toEqual(["new", "old"]);
  });
});
