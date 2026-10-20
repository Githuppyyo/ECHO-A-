import { describe, expect, it } from "vitest";

import { getChatActivityLabel, getChatThinkingOptions, inferChatActivity } from "./chat-activity";

describe("chat activity", () => {
  it("görsel eklenince görüntü analiz durumunu önceliklendirir", () => {
    expect(inferChatActivity("Bu görselde ne var?", true)).toBe("image");
    expect(getChatActivityLabel("image")).toBe("Görüntüyü analiz ediyor…");
  });

  it("Türkçe çekimli kod taleplerini saptar", () => {
    expect(inferChatActivity("Bu fonksiyona uygun kodu yaz", false)).toBe("code");
    expect(getChatActivityLabel("code")).toBe("Kodu hazırlıyor…");
  });

  it("PDF ve genel yanıt durumlarını ayırır", () => {
    expect(inferChatActivity("Bunu PDF olarak düzenle", false)).toBe("pdf");
    expect(getChatActivityLabel("pdf")).toBe("PDF içeriğini hazırlıyor…");
    expect(inferChatActivity("Bana kısaca açıkla", false)).toBe("thinking");
    expect(getChatActivityLabel("thinking")).toBe("ECHO AI düşünüyor…");
  });

  it("basit sohbetlerde gizli düşünmeyi kapatıp karmaşık görevleri sınırlar", () => {
    expect(getChatThinkingOptions("Selam", false)).toEqual({ enabled: false });
    expect(getChatThinkingOptions("Bu fonksiyonun kodunu yaz", false)).toEqual({
      enabled: true,
      tokenBudget: 128,
    });
    expect(getChatThinkingOptions("Bu görseli analiz et", true)).toEqual({
      enabled: true,
      tokenBudget: 64,
    });
  });
});
