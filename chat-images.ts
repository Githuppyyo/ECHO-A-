export type ChatImageSelection = {
  uri: string;
  name: string;
};

export async function pickChatImage(): Promise<ChatImageSelection | null> {
  return null;
}

export async function resolveChatImagePath(_uri: string): Promise<string | null> {
  return null;
}
