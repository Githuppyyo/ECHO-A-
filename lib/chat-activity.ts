export type ChatActivityKind = "thinking" | "code" | "pdf" | "image" | "text";

export function inferChatActivity(message: string, hasImage: boolean): ChatActivityKind {
  if (hasImage) return "image";

  const normalized = message.toLocaleLowerCase("tr-TR");
  if (/(^|\W)pdf(\W|$)/i.test(normalized)) return "pdf";
  if (/\b(kod\w*|program\w*|fonksiyon\w*|script|debug|hata ayıkla)\b/i.test(normalized)) {
    return "code";
  }
  return "thinking";
}

export function getChatThinkingOptions(message: string, hasImage: boolean) {
  const activity = inferChatActivity(message, hasImage);
  const normalized = message.trim().toLocaleLowerCase("tr-TR");
  const complexRequest =
    hasImage ||
    activity === "code" ||
    activity === "pdf" ||
    normalized.length > 180 ||
    /(karşılaştır|adım\s+adım|neden\b|nasıl\s+(yapılır|çalışır|çözülür)|analiz et|planla|hata ayıkla|debug|mimari|strateji)/i.test(
      normalized,
    );

  return complexRequest ? { enabled: true, tokenBudget: hasImage ? 64 : 128 } : { enabled: false };
}

export function getChatActivityLabel(activity: ChatActivityKind): string {
  switch (activity) {
    case "code":
      return "Kodu hazırlıyor…";
    case "pdf":
      return "PDF içeriğini hazırlıyor…";
    case "image":
      return "Görüntüyü analiz ediyor…";
    case "text":
      return "Metni hazırlıyor…";
    default:
      return "ECHO AI düşünüyor…";
  }
}
