import { Ionicons } from "@expo/vector-icons";
import { AnimatedPressable } from "@/components/animated-pressable";
import { EchoText as Text, EchoTextInput as TextInput } from "@/components/echo-text";
import { useEchoAI } from "@/components/echo-ai-context";
import { useColors } from "@/hooks/use-colors";
import { concealInternalModelName } from "@/lib/brand-policy";
import { parseOfflineArtScene, sceneToSvg, type OfflineArtScene } from "@/lib/offline-image-art";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { SvgXml } from "react-native-svg";

const IMAGE_SYSTEM_PROMPT = `ECHO AI çevrimdışı vektör illüstrasyon tasarımcısısın. Yalnızca şu JSON biçiminde yanıt ver, Markdown/HTML/SVG/kod çiti/açıklama ekleme: {"viewBox":"0 0 512 512","primitives":[...]}. primitives en çok 32 öğe içersin. Her öğe yalnızca şu tiplerden biri olsun: rect, circle, ellipse, line, text, path. Kullanılabilecek alanlar tipin doğal geometrisiyle birlikte yalnızca fill, stroke, strokeWidth, rx, ry ve fontSize alanlarıdır. Renkler yalnızca #RGB, #RRGGBB veya #RRGGBBAA biçiminde olsun. x/y ve diğer geometri sayıları 0..512 aralığında kalsın. Görsel kompozisyonu sade, dengeli ve poster/vektör illüstrasyon estetiğinde tut. Harici URL, SVG/HTML etiketi, CSS, script veya başka JSON anahtarı üretme.`;

export function OfflineImageGenerator() {
  const colors = useColors();
  const { status, createConversation } = useEchoAI();
  const [prompt, setPrompt] = useState("");
  const [scene, setScene] = useState<OfflineArtScene | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const generate = async () => {
    const request = prompt.trim();
    if (!request || status !== "ready" || generating) return;

    const conversation = createConversation(IMAGE_SYSTEM_PROMPT);
    if (!conversation) {
      setNotice("ECHO AI hazır değil. Yerel modeli açtıktan sonra tekrar dene.");
      return;
    }

    setGenerating(true);
    setNotice(null);
    setScene(null);
    try {
      const raw = await conversation.execute([
        { type: "text", text: `İllüstrasyon tarifi: ${request}` },
      ]);
      const safeOutput = concealInternalModelName(raw.trim());
      const parsed = parseOfflineArtScene(safeOutput);
      if (!parsed || parsed.primitives.length === 0) {
        throw new Error("invalid-scene");
      }
      setScene(parsed);
      setNotice("Çevrimdışı vektör illüstrasyon hazır.");
    } catch {
      setNotice("İllüstrasyon güvenli çizim biçiminde üretilemedi. Daha kısa bir tarif deneyebilirsin.");
    } finally {
      await Promise.resolve().then(() => conversation.release()).catch(() => undefined);
      setGenerating(false);
    }
  };

  const saveOrShare = async () => {
    if (!scene || saving || Platform.OS !== "android") return;
    const documentDirectory = FileSystem.documentDirectory;
    if (!documentDirectory) {
      setNotice("Cihazda dosya alanı bulunamadı.");
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const directory = `${documentDirectory}generated-art/`;
      const info = await FileSystem.getInfoAsync(directory);
      if (!info.exists) await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      const uri = `${directory}echo-ai-illustration-${Date.now()}.svg`;
      await FileSystem.writeAsStringAsync(uri, sceneToSvg(scene), {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (!(await Sharing.isAvailableAsync())) throw new Error("sharing-unavailable");
      await Sharing.shareAsync(uri, {
        mimeType: "image/svg+xml",
        dialogTitle: "SVG illüstrasyonunu kaydet veya paylaş",
        UTI: "public.svg-image",
      });
      setNotice("SVG dosyası hazır. Android menüsünden kaydedebilir veya paylaşabilirsin.");
    } catch {
      setNotice("SVG dışa aktarılamadı. Yeniden deneyebilirsin.");
    } finally {
      setSaving(false);
    }
  };

  const canGenerate = status === "ready" && Boolean(prompt.trim()) && !generating;
  const svg = scene ? sceneToSvg(scene) : null;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 5 }}>
        <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>
          Çevrimdışı vektör illüstrasyon
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
          İnternet kullanmadan sade SVG çizimleri oluşturur; fotoğraf-gerçekçi görsel üretmez.
        </Text>
      </View>

      <TextInput
        accessibilityLabel="Oluşturulacak illüstrasyon tarifi"
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Örn. Gece göğünde turkuaz bir dağ posteri"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={500}
        textAlignVertical="top"
        editable={status === "ready" && !generating}
        style={{
          minHeight: 76,
          maxHeight: 140,
          color: colors.foreground,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 14,
          padding: 12,
          fontSize: 14,
          lineHeight: 20,
        }}
      />

      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel="Çevrimdışı illüstrasyon oluştur"
        disabled={!canGenerate}
        onPress={() => void generate()}
        style={({ pressed }) => ({
          minHeight: 46,
          borderRadius: 13,
          backgroundColor: colors.primary,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: !canGenerate ? 0.62 : pressed ? 0.82 : 1,
        })}
      >
        {generating ? <ActivityIndicator size="small" color={colors.background} /> : <Ionicons name="sparkles-outline" size={18} color={colors.background} />}
        <Text style={{ color: colors.background, fontSize: 14, fontWeight: "700" }}>
          {generating ? "Cihazda çiziliyor…" : "İllüstrasyon oluştur"}
        </Text>
      </AnimatedPressable>

      {scene && svg ? (
        <View style={{ gap: 10, borderRadius: 18, padding: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ overflow: "hidden", borderRadius: 13, backgroundColor: "#FFFFFF" }}>
            <SvgXml xml={svg} width="100%" height={260} />
          </View>
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="SVG illüstrasyonunu kaydet veya paylaş"
            disabled={saving || Platform.OS !== "android"}
            onPress={() => void saveOrShare()}
            style={({ pressed }) => ({
              minHeight: 44,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: saving ? 0.62 : pressed ? 0.82 : 1,
            })}
          >
            <Ionicons name="download-outline" size={18} color={colors.foreground} />
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>
              {saving ? "SVG hazırlanıyor…" : "SVG’yi kaydet / paylaş"}
            </Text>
          </AnimatedPressable>
        </View>
      ) : null}

      {notice ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
          {notice}
        </Text>
      ) : null}
    </View>
  );
}
