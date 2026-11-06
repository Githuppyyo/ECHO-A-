import { Ionicons } from "@expo/vector-icons";
import { AnimatedPressable } from "@/components/animated-pressable";
import { EchoBrand } from "@/components/echo-brand";
import { EchoText as Text, EchoTextInput as TextInput } from "@/components/echo-text";
import { ImageCanvasPreview } from "@/components/image-canvas-preview";
import { ImageModelCard } from "@/components/image-model-card";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { EchoAIImageGen, type ImageModelSnapshot } from "@/lib/imagegen";
import { useFocusEffect, useRouter, Stack } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  View,
} from "react-native";

const IMAGE_MODEL_LICENSES = require("../assets/licenses/image-model-licenses.json") as {
  id: string;
  title: string;
  source: string;
  text: string;
}[];

function errorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code?: unknown }).code ?? "");
  }
  return "";
}

function messageForError(error: unknown): string {
  switch (errorCode(error)) {
    case "E_IMAGE_STORAGE_LOW":
      return "Görsel modelini indirmek için yaklaşık 2,08 GB boş alan aç.";
    case "E_IMAGE_DEVICE_UNSUPPORTED":
      return "Bu cihazın belleği görsel üretimi için yetersiz.";
    case "E_IMAGE_RUNTIME_MISSING":
      return "ECHO AI görsel motoru bu cihazda başlatılamadı. APK'yı güncelle veya uyumlu bir Android cihazda dene.";
    case "E_IMAGE_MODEL_NOT_READY":
      return "Model tam olarak indirilip doğrulanmamış. İndirme durumunu kontrol et.";
    case "E_IMAGE_LICENSE_REQUIRED":
      return "Devam etmeden önce lisans koşullarını kabul etmelisin.";
    case "E_IMAGE_CANCELLED":
      return "Görsel üretimi durduruldu.";
    case "E_IMAGE_MEMORY":
      return "Bellek yetersiz. Diğer uygulamaları kapatıp daha kısa bir tarif dene.";
    case "E_IMAGE_GENERATION":
      return "PNG oluşturulamadı. Daha kısa veya farklı bir tarif dene.";
    default:
      return "İşlem tamamlanamadı. Yeniden deneyebilirsin.";
  }
}

export default function ImageStudioScreen() {
  const colors = useColors();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ImageModelSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [showLicense, setShowLicense] = useState(false);
  const [licenseBusy, setLicenseBusy] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [generationTotal, setGenerationTotal] = useState(4);
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const generatingRef = useRef(false);

  const refreshSnapshot = useCallback(async () => {
    if (!EchoAIImageGen) {
      setLoading(false);
      return;
    }
    try {
      const next = await EchoAIImageGen.getState();
      setSnapshot(next);
    } catch {
      setNotice("ECHO AI görsel durumu okunamadı. Uygulamayı yeniden açıp dene.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void refreshSnapshot(), 0);
    return () => clearTimeout(timer);
  }, [refreshSnapshot]);

  const snapshotPhase = snapshot?.phase;
  useEffect(() => {
    if (!snapshotPhase || !["pending", "running", "paused"].includes(snapshotPhase)) return;
    const timer = setInterval(() => void refreshSnapshot(), 1300);
    return () => clearInterval(timer);
  }, [refreshSnapshot, snapshotPhase]);

  useEffect(() => {
    const imageGenerator = EchoAIImageGen;
    if (!generating || !imageGenerator) return;
    const timer = setInterval(() => {
      try {
        const progress = imageGenerator.getGenerationProgress();
        setGenerationStep(progress.step);
        setGenerationTotal(Math.max(1, progress.total));
      } catch {
        // The generation promise provides the user-visible failure state.
      }
    }, 500);
    return () => clearInterval(timer);
  }, [generating]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (generatingRef.current) EchoAIImageGen?.cancelGeneration();
        void EchoAIImageGen?.releaseModelContext().catch(() => undefined);
      };
    }, []),
  );

  const startDownload = async () => {
    if (!EchoAIImageGen) return;
    setNotice(null);
    try {
      const next = await EchoAIImageGen.startModelDownload(wifiOnly);
      setSnapshot(next);
      setNotice("İndirme başladı. Android sistem indiricisi uygulama kapalıyken de sürdürür.");
    } catch (error) {
      setNotice(messageForError(error));
    }
  };

  const acceptLicenseAndDownload = async () => {
    if (!EchoAIImageGen || licenseBusy) return;
    setLicenseBusy(true);
    setNotice(null);
    try {
      await EchoAIImageGen.acceptModelLicense();
      setShowLicense(false);
      await startDownload();
      await refreshSnapshot();
    } catch (error) {
      setNotice(messageForError(error));
    } finally {
      setLicenseBusy(false);
    }
  };

  const cancelDownload = async () => {
    if (!EchoAIImageGen) return;
    try {
      setSnapshot(await EchoAIImageGen.cancelModelDownload());
      setNotice("Model indirmesi iptal edildi.");
    } catch {
      setNotice("İndirme iptal edilemedi. Android sistem bildirimini kontrol et.");
    }
  };

  const generate = async () => {
    const request = prompt.trim();
    if (!EchoAIImageGen || !snapshot?.canGenerate || !request || generating) return;
    setGenerating(true);
    generatingRef.current = true;
    setGenerationStep(0);
    setGenerationTotal(4);
    setNotice(null);
    try {
      const uri = await EchoAIImageGen.generatePng(request);
      setResultUri(uri);
      setNotice("PNG hazırlandı; cihazında oluşturuldu.");
    } catch (error) {
      setNotice(messageForError(error));
    } finally {
      generatingRef.current = false;
      setGenerating(false);
      await refreshSnapshot();
    }
  };

  const cancelGeneration = () => {
    if (!EchoAIImageGen) return;
    EchoAIImageGen.cancelGeneration();
    setNotice("Üretim durduruluyor…");
  };

  const shareResult = async () => {
    if (!resultUri || !(await Sharing.isAvailableAsync())) {
      setNotice("Android paylaşım menüsü bu cihazda kullanılamıyor.");
      return;
    }
    try {
      await Sharing.shareAsync(resultUri, {
        mimeType: "image/png",
        dialogTitle: "PNG'yi kaydet veya paylaş",
        UTI: "public.png",
      });
      setNotice("PNG için Android paylaşım menüsü açıldı.");
    } catch {
      setNotice("PNG paylaşım menüsü açılamadı.");
    }
  };

  if (Platform.OS !== "android" || !EchoAIImageGen) {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]} safeAreaClassName="bg-background">
        <ScrollView contentContainerStyle={{ padding: 18, gap: 18 }}>
          <EchoBrand subtitle="Çevrimdışı PNG üretimi" />
          <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "800" }}>Görsel Kanvası</Text>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21 }}>
            Bu özellik ECHO AI Android APK’sında kullanılabilir.
          </Text>
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} safeAreaClassName="bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 28, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <EchoBrand subtitle="Cihazında görsel üret" />
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="Kanvas’a dön"
            onPress={() => router.back()}
            style={({ pressed }) => ({
              width: 42,
              height: 42,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.76 : 1,
            })}
          >
            <Ionicons name="arrow-back" size={19} color={colors.foreground} />
          </AnimatedPressable>
        </View>

        <View style={{ gap: 5 }}>
          <Text style={{ color: colors.foreground, fontSize: 26, fontWeight: "800" }}>Görsel Kanvası</Text>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
            512 × 512 PNG oluştur. Ayrı modeli bir kez indir; sonrasında üretim internet olmadan cihazında çalışır.
          </Text>
        </View>

        <ImageModelCard
          snapshot={snapshot}
          loading={loading}
          wifiOnly={wifiOnly}
          onWifiOnlyChange={setWifiOnly}
          onDownload={() => void startDownload()}
          onCancel={() => void cancelDownload()}
          onReviewLicense={() => setShowLicense(true)}
        />

        {snapshot?.canGenerate ? (
          <View style={{ gap: 10, borderRadius: 18, padding: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>Görsel tarifi</Text>
            <TextInput
              accessibilityLabel="PNG görseli için tarif"
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Örn. Gün batımında deniz kıyısında yürüyen at"
              placeholderTextColor={colors.muted}
              multiline
              maxLength={500}
              textAlignVertical="top"
              editable={!generating}
              style={{
                minHeight: 92,
                maxHeight: 160,
                color: colors.foreground,
                backgroundColor: colors.background,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 14,
                padding: 12,
                fontSize: 14,
                lineHeight: 20,
              }}
            />
            <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 15 }}>
              İstek ve sonuç cihazından çıkmaz. Model çıktısının ayrıntısı cihaz gücüne ve tarife bağlıdır.
            </Text>
            <AnimatedPressable
              accessibilityRole="button"
              onPress={() => void generate()}
              disabled={!prompt.trim() || generating || !snapshot.canGenerate}
              style={({ pressed }) => ({
                minHeight: 48,
                borderRadius: 13,
                backgroundColor: colors.primary,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: !prompt.trim() || generating || !snapshot.canGenerate ? 0.58 : pressed ? 0.82 : 1,
              })}
            >
              {generating ? <ActivityIndicator size="small" color={colors.background} /> : <Ionicons name="sparkles-outline" size={18} color={colors.background} />}
              <Text style={{ color: colors.background, fontSize: 14, fontWeight: "700" }}>
                {generating ? "Cihazda oluşturuluyor…" : "PNG oluştur"}
              </Text>
            </AnimatedPressable>
          </View>
        ) : null}

        <ImageCanvasPreview
          uri={resultUri}
          generating={generating}
          progressStep={generationStep}
          progressTotal={generationTotal}
          onCancel={cancelGeneration}
          onShare={() => void shareResult()}
        />

        {notice ? (
          <Text accessibilityLiveRegion="polite" style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            {notice}
          </Text>
        ) : null}
      </ScrollView>

      <Modal
        visible={showLicense}
        animationType="slide"
        transparent
        onRequestClose={() => setShowLicense(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.58)" }}>
          <View style={{ maxHeight: "92%", borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: colors.background, padding: 18, gap: 12 }}>
            <Text style={{ color: colors.foreground, fontSize: 19, fontWeight: "800" }}>Model kullanım koşulları</Text>
            <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>
              Devam etmeden önce aşağıdaki açık kaynak lisanslarını oku. Üretim cihazında yapılır; model dosyası ayrı indirilir.
            </Text>
            <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ gap: 14 }}>
              {IMAGE_MODEL_LICENSES.map((license) => (
                <View key={license.id} style={{ gap: 6 }}>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>{license.title}</Text>
                  <Text selectable style={{ color: colors.muted, fontSize: 10, lineHeight: 15 }}>{license.text}</Text>
                  <Text selectable style={{ color: colors.muted, fontSize: 9, lineHeight: 13 }}>{license.source}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 9 }}>
              <AnimatedPressable
                accessibilityRole="button"
                onPress={() => setShowLicense(false)}
                disabled={licenseBusy}
                style={({ pressed }) => ({ flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", opacity: pressed || licenseBusy ? 0.7 : 1 })}
              >
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "700" }}>Şimdi değil</Text>
              </AnimatedPressable>
              <AnimatedPressable
                accessibilityRole="button"
                onPress={() => void acceptLicenseAndDownload()}
                disabled={licenseBusy}
                style={({ pressed }) => ({ flex: 1.4, minHeight: 44, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", opacity: licenseBusy ? 0.62 : pressed ? 0.82 : 1 })}
              >
                <Text style={{ color: colors.background, fontSize: 12, fontWeight: "700" }}>
                  {licenseBusy ? "İşlem sürüyor…" : "Kabul et ve indir"}
                </Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
