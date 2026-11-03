export const MAX_CHAT_IMAGES_PER_MESSAGE = 4;

export type ChatImageSelection = {
  uri: string;
  name: string;
};

export async function pickChatImages(_requestedLimit = MAX_CHAT_IMAGES_PER_MESSAGE): Promise<ChatImageSelection[]> {
  return [];
}

export async function resolveChatImagePath(_uri: string): Promise<string | null> {
  return null;
}
