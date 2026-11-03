import AsyncStorage from "@react-native-async-storage/async-storage";

export type ChatMessageRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  imageUri?: string;
  imageName?: string;
  imageUris?: string[];
  imageNames?: string[];
};

export type ChatMessageImage = { uri: string; name: string };

export function getChatMessageImages(message: Pick<ChatMessage, "imageUri" | "imageName" | "imageUris" | "imageNames">): ChatMessageImage[] {
  if (message.imageUris?.length) {
    return message.imageUris.slice(0, 4).map((uri, index) => ({
      uri,
      name: message.imageNames?.[index]?.trim() || `Görsel ${index + 1}`,
    }));
  }
  return message.imageUri
    ? [{ uri: message.imageUri, name: message.imageName?.trim() || "Seçilen görsel" }]
    : [];
}

export type ChatConversation = {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
};

export type ChatHistorySnapshot = {
  version: 1;
  activeConversationId: string | null;
  conversations: ChatConversation[];
};

const STORAGE_KEY = "@echoai/chat-history-v1";
let writeQueue: Promise<void> = Promise.resolve();

export function createEmptyChatHistory(): ChatHistorySnapshot {
  return { version: 1, activeConversationId: null, conversations: [] };
}

export function createConversationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createMessageId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createConversationTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === "user");
  const title = firstUserMessage?.content.replace(/\s+/g, " ").trim();
  if (!title && firstUserMessage && getChatMessageImages(firstUserMessage).length > 0) return "Görsel analizi";
  if (!title) return "Yeni sohbet";
  return title.length > 42 ? `${title.slice(0, 39).trimEnd()}…` : title;
}

export function upsertChatConversation(
  conversations: ChatConversation[],
  id: string,
  messages: ChatMessage[],
): ChatConversation[] {
  const previous = conversations.find((conversation) => conversation.id === id);
  const updated: ChatConversation = {
    id,
    title: previous?.title ?? createConversationTitle(messages),
    updatedAt: Date.now(),
    messages,
  };
  return [updated, ...conversations.filter((conversation) => conversation.id !== id)]
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseMessage(value: unknown): ChatMessage | null {
  const record = asRecord(value);
  if (
    !record ||
    typeof record.id !== "string" ||
    (record.role !== "user" && record.role !== "assistant") ||
    typeof record.content !== "string"
  ) {
    return null;
  }

  const imageUris = Array.isArray(record.imageUris)
    ? record.imageUris.filter((uri): uri is string => typeof uri === "string").slice(0, 4)
    : [];
  const imageNames = Array.isArray(record.imageNames)
    ? record.imageNames.filter((name): name is string => typeof name === "string").slice(0, 4)
    : [];

  return {
    id: record.id,
    role: record.role,
    content: record.content,
    ...(typeof record.imageUri === "string" ? { imageUri: record.imageUri } : {}),
    ...(typeof record.imageName === "string" ? { imageName: record.imageName } : {}),
    ...(imageUris.length > 0 ? { imageUris } : {}),
    ...(imageNames.length > 0 ? { imageNames } : {}),
  };
}

function parseConversation(value: unknown): ChatConversation | null {
  const record = asRecord(value);
  if (
    !record ||
    typeof record.id !== "string" ||
    !Array.isArray(record.messages)
  ) {
    return null;
  }

  const messages = record.messages
    .map(parseMessage)
    .filter((message): message is ChatMessage => message !== null);
  if (messages.length === 0) return null;

  return {
    id: record.id,
    title: typeof record.title === "string" ? record.title : createConversationTitle(messages),
    updatedAt:
      typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt)
        ? record.updatedAt
        : Date.now(),
    messages,
  };
}

export async function loadChatHistory(): Promise<ChatHistorySnapshot> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return createEmptyChatHistory();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    throw new Error("Sohbet geçmişi okunamadı.");
  }

  const record = asRecord(parsed);
  if (!record || record.version !== 1 || !Array.isArray(record.conversations)) {
    return createEmptyChatHistory();
  }

  const conversations = record.conversations
    .map(parseConversation)
    .filter((conversation): conversation is ChatConversation => conversation !== null)
    .sort((left, right) => right.updatedAt - left.updatedAt);
  const requestedActiveId =
    typeof record.activeConversationId === "string" ? record.activeConversationId : null;

  return {
    version: 1,
    activeConversationId:
      requestedActiveId && conversations.some((conversation) => conversation.id === requestedActiveId)
        ? requestedActiveId
        : null,
    conversations,
  };
}

export function saveChatHistory(snapshot: ChatHistorySnapshot): Promise<void> {
  const serialized = JSON.stringify(snapshot);
  const nextWrite = writeQueue
    .catch(() => undefined)
    .then(() => AsyncStorage.setItem(STORAGE_KEY, serialized));
  writeQueue = nextWrite.catch(() => undefined);
  return nextWrite;
}
