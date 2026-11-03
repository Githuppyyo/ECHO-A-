import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";

import { fileUriToAbsolutePath } from "./chat-image-path";

export const MAX_CHAT_IMAGES_PER_MESSAGE = 4;

export type ChatImageSelection = {
  uri: string;
  name: string;
};

function imageExtension(
  fileName: string | null | undefined,
  uri: string,
  mimeType: string | null | undefined,
): string {
  const fromName = fileName?.split(".").pop()?.toLowerCase();
  const fromUri = uri.split(/[?#]/, 1)[0]?.split(".").pop()?.toLowerCase();
  const fromMime = mimeType?.split("/").pop()?.toLowerCase().replace("jpeg", "jpg");
  const candidate = fromName || fromUri || fromMime || "jpg";
  return /^[a-z0-9]{1,8}$/.test(candidate) ? candidate : "jpg";
}

export async function pickChatImages(
  requestedLimit = MAX_CHAT_IMAGES_PER_MESSAGE,
): Promise<ChatImageSelection[]> {
  const selectionLimit = Math.max(
    1,
    Math.min(MAX_CHAT_IMAGES_PER_MESSAGE, Math.floor(requestedLimit)),
  );
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit,
    quality: 1,
  });

  if (result.canceled || result.assets.length === 0) return [];
  const assets = result.assets.slice(0, selectionLimit);
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) throw new Error("Local document storage unavailable");

  const imageDirectory = `${documentDirectory}chat-images/`;
  const directoryInfo = await FileSystem.getInfoAsync(imageDirectory);
  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(imageDirectory, { intermediates: true });
  }

  const copied: ChatImageSelection[] = [];
  try {
    for (const [index, asset] of assets.entries()) {
      const extension = imageExtension(asset.fileName, asset.uri, asset.mimeType);
      const suffix = Math.random().toString(36).slice(2, 8);
      const destination = `${imageDirectory}${Date.now()}-${index}-${suffix}.${extension}`;
      await FileSystem.copyAsync({ from: asset.uri, to: destination });
      copied.push({
        uri: destination,
        name: asset.fileName?.trim() || `Görsel ${index + 1}`,
      });
    }
    return copied;
  } catch (error) {
    await Promise.all(
      copied.map((image) => FileSystem.deleteAsync(image.uri, { idempotent: true }).catch(() => undefined)),
    );
    throw error;
  }
}

export async function resolveChatImagePath(uri: string): Promise<string | null> {
  const absolutePath = fileUriToAbsolutePath(uri);
  if (!absolutePath) return null;

  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists ? absolutePath : null;
  } catch {
    return null;
  }
}
