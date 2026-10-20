import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedPressable } from "@/components/animated-pressable";
import type { ConversationHandle } from "react-native-litert-lm";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { ChatActivityStatus } from "@/components/chat-activity-status";
import { useEchoAI } from "@/components/echo-ai-context";
import { EchoBrand } from "@/components/echo-brand";
import { ModelInstallCard } from "@/components/model-install-card";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { concealInternalModelName } from "@/lib/brand-policy";

const DRAFT_STORAGE_KEY = "@echoai/canvas-draft-v1";
type CanvasMode = "text" | "code";
type CanvasDraft = { title: string; content: string; mode: CanvasMode };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createPdfHtml(title: string, content: string, mode: CanvasMode): string {
  const safeTitle = escapeHtml(title.trim() || "ECHO AI taslağı");
  const safeContent = escapeHtml(content.replace(/\r\n/g, "\n"));
  const body = mode === "code"
    ? `<pre class="code">${safeContent}</pre>`
    : `<div class="text">${safeContent.replace(/\n/g, "<br />")}</div>`;

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body { color: #111; font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.65; }
  h1 { font-size: 21pt; line-height: 1.2; margin: 0 0 8mm; letter-spacing: -.02em; }
  .meta { color: #666; font-size: 9pt; margin-bottom: 8mm; }
  .text { white-space: pre-wrap; overflow-wrap: anywhere; }
  .code { white-space: pre-wrap; overflow-wrap: anywhere; font-family: 'Courier New', monospace; font-size: 9pt; line-height: 1.5; }
</style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <div class="meta">ECHO AI · ${new Date().toLocaleDateString("tr-TR")}</div>
  ${body}
</body>
</html>`;
}

export default function CanvasScreen() {
  const colors = useColors();
  const { status, createConversation } = useEchoAI();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<CanvasMode>("text");
  const [prompt, setPrompt] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(DRAFT_STORAGE_KEY)
      .then((stored) => {
        if (!active || !stored) return;
        const parsed = JSON.parse(stored) as Partial<CanvasDraft>;
        if (typeof parsed.title === "string") setTitle(parsed.title);
        if (typeof parsed.content === "string") setContent(parsed.content);
        if (parsed.mode === "text" || parsed.mode === "code") setMode(parsed.mode);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      const value: CanvasDraft = { title, content, mode };
      void AsyncStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(value)).catch(() => undefined);
    }, 350);
    return () => clearTimeout(timer);
  }, [content, hydrated, mode, title]);

  const generateDraft = async () => {
    const request = prompt.trim();
    if (!request || status !== "ready" || generating) return;

    const systemPrompt = mode === "code"
      ? "Kanvas için çalışıyorsun. İstekten doğru dilde, çalışır ve temiz bir kod taslağı üret. Kod modunda yalnızca kodu döndür; Markdown kod çiti, model/sağlayıcı adı veya gereksiz açıklama ekleme."
      : "Kanvas için çalışıyorsun. İsteğe uygun, düzenlenebilir ve iyi yapılandırılmış bir Türkçe metin oluştur. Başlık ve paragraflar kullan; istenmeyen yorum ekleme.";
    const conversation: ConversationHandle | null = createConversation(systemPrompt);
    if (!conversation) {
      setNotice("ECHO AI henüz hazır değil.");
      return;
    }

    setGenerating(true);
    setNotice(null);
    try {
      const current = content.trim()
        ? `\n\nMevcut taslak (istenirse düzenle):\n${content.slice(0, 9000)}`
        : "";
      const requestText = `İçerik türü: ${mode === "code" ? "Kod" : "Metin"}\nİstek: ${request}${current}`;
      const result = await conversation.execute([{ type: "text", text: requestText }]);
      let output = concealInternalModelName(result.trim());
      if (mode === "code") {
        output = output.replace(/^```(?:[\w.+-]+)?\s*\n([\s\S]*?)\n```$/, "$1").trim();
      }
      if (!output) throw new Error("empty-result");
      setContent(output);
      if (!title.trim()) setTitle(mode === "code" ? "Kod taslağı" : "Yeni taslak");
      setNotice("Taslak kanvasa eklendi; düzenleyebilirsin.");
      setPrompt("");
    } catch {
      setNotice("Taslak oluşturulamadı. Yeniden deneyebilirsin.");
    } finally {
      await Promise.resolve()
        .then(() => conversation.release())
        .catch(() => undefined);
      setGenerating(false);
    }
  };

  const exportPdf = async () => {
    if (!content.trim() || exporting) return;
    if (Platform.OS !== "android") {
      setNotice("PDF dışa aktarımı Android uygulamasında kullanılabilir.");
      return;
    }

    setExporting(true);
    setNotice(null);
    try {
      const file = await Print.printToFileAsync({
        html: createPdfHtml(title, content, mode),
        base64: false,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) throw new Error("sharing-unavailable");
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/pdf",
        dialogTitle: "PDF'yi paylaş veya kaydet",
        UTI: "com.adobe.pdf",
      });
      setNotice("PDF hazırlandı. Kaydetmek veya paylaşmak için Android menüsünü kullan.");
    } catch {
      setNotice("PDF oluşturulamadı. Tekrar deneyebilirsin.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScreenContainer safeAreaClassName="bg-background">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
        <EchoBrand subtitle="Yaz, üret, dışa aktar" />

        <View style={{ gap: 5 }}>
          <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: "800" }}>Kanvas</Text>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
            Metinini veya kodunu hazırla. İstersen taslağı PDF olarak paylaş.
          </Text>
        </View>

        {status !== "ready" ? <ModelInstallCard /> : null}

        <View style={{ gap: 10 }}>
          <TextInput
            accessibilityLabel="Belge başlığı"
            value={title}
            onChangeText={setTitle}
            placeholder="Belge başlığı"
            placeholderTextColor={colors.muted}
            maxLength={100}
            style={{
              color: colors.foreground,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 16,
              fontWeight: "700",
            }}
          />

          <View
            accessibilityRole="tablist"
            style={{ flexDirection: "row", padding: 4, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          >
            {(["text", "code"] as const).map((option) => {
              const selected = mode === option;
              return (
                <AnimatedPressable
                  key={option}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setMode(option)}
                  style={{
                    flex: 1,
                    minHeight: 40,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: selected ? colors.primary : colors.background,
                    borderWidth: 1,
                    borderColor: selected ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ color: selected ? colors.background : colors.muted, fontWeight: "700", fontSize: 13 }}>
                    {option === "text" ? "Metin" : "Kod"}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>

          <TextInput
            accessibilityLabel={mode === "code" ? "Kod taslağı" : "Metin taslağı"}
            value={content}
            onChangeText={setContent}
            placeholder={mode === "code" ? "Kodunu buraya yaz..." : "Taslağını buraya yaz..."}
            placeholderTextColor={colors.muted}
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={mode !== "code"}
            spellCheck={mode !== "code"}
            style={{
              minHeight: 230,
              color: colors.foreground,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 16,
              padding: 14,
              fontSize: mode === "code" ? 13 : 15,
              lineHeight: mode === "code" ? 20 : 23,
              fontFamily: mode === "code" ? "monospace" : undefined,
            }}
          />
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            Taslak cihazında otomatik saklanır.
          </Text>
        </View>

        <View style={{ gap: 9, borderRadius: 18, padding: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>ECHO AI&apos;ye hazırla</Text>
          <TextInput
            accessibilityLabel="ECHO AI için taslak isteği"
            value={prompt}
            onChangeText={setPrompt}
            placeholder={mode === "code" ? "Örn. Basit bir yapılacaklar listesi kodu yaz" : "Örn. Bu fikir için kısa bir tanıtım metni yaz"}
            placeholderTextColor={colors.muted}
            multiline
            maxLength={2500}
            style={{
              minHeight: 54,
              maxHeight: 110,
              color: colors.foreground,
              fontSize: 14,
              lineHeight: 20,
              paddingVertical: 7,
            }}
          />
          {generating ? <ChatActivityStatus activity={mode === "code" ? "code" : "text"} /> : null}
          <AnimatedPressable
            accessibilityRole="button"
            onPress={() => void generateDraft()}
            disabled={status !== "ready" || generating || !prompt.trim()}
            style={({ pressed }) => ({
              minHeight: 46,
              borderRadius: 13,
              backgroundColor: colors.primary,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: status !== "ready" || generating || !prompt.trim() ? 0.62 : pressed ? 0.82 : 1,
            })}
          >
            {!generating ? <Ionicons name="sparkles-outline" size={17} color={colors.background} /> : null}
            <Text style={{ color: colors.background, fontSize: 14, fontWeight: "700" }}>
              {generating ? "Üretim sürüyor..." : "Taslak oluştur"}
            </Text>
          </AnimatedPressable>
        </View>

        {exporting ? <ChatActivityStatus activity="pdf" label="PDF oluşturuluyor…" /> : null}
        <AnimatedPressable
          accessibilityRole="button"
          onPress={() => void exportPdf()}
          disabled={!content.trim() || exporting || Platform.OS !== "android"}
          style={({ pressed }) => ({
            minHeight: 50,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: !content.trim() || exporting || Platform.OS !== "android" ? 0.62 : pressed ? 0.82 : 1,
          })}
        >
          {!exporting ? <Ionicons name="document-text-outline" size={19} color={colors.foreground} /> : null}
          <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>
            {exporting ? "İşlem sürüyor..." : "PDF oluştur"}
          </Text>
        </AnimatedPressable>

        {notice ? <Text accessibilityLiveRegion="polite" style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{notice}</Text> : null}
        {Platform.OS === "web" ? (
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            Yerel AI ve PDF dışa aktarımı Android uygulamasında kullanılabilir.
          </Text>
        ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
