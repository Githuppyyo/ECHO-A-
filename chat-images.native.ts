import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";

import { fileUriToAbsolutePath } from "./chat-image-path";

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

export async function pickChatImage(): Promise<ChatImageSelection | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: false,
    allowsMultipleSelection: false,
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) throw new Error("Local document storage unavailable");

  const imageDirectory = `${documentDirectory}chat-images/`;
  const directoryInfo = await FileSystem.getInfoAsync(imageDirectory);
  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(imageDirectory, { intermediates: true });
  }

  const extension = imageExtension(asset.fileName, asset.uri, asset.mimeType);
  const destination = `${imageDirectory}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  await FileSystem.copyAsync({ from: asset.uri, to: destination });

  return {
    uri: destination,
    name: asset.fileName?.trim() || "Seçilen görsel",
  };
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
