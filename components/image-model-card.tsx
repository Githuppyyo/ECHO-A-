import { Ionicons } from "@expo/vector-icons";
import { AnimatedPressable } from "@/components/animated-pressable";
import { EchoText as Text } from "@/components/echo-text";
import { useColors } from "@/hooks/use-colors";
import type { ImageModelSnapshot } from "@/modules/echo-ai-imagegen/src";
import { Switch, View } from "react-native";

type ImageModelCardProps = {
  snapshot: ImageModelSnapshot | null;
  loading: boolean;
  wifiOnly: boolean;
  onWifiOnlyChange: (value: boolean) => void;
  onDownload: () => void;
  onCancel: () => void;
  onReviewLicense: () => void;
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2).replace(".", ",")} GB`;
  return `${(bytes / 1_000_000).toFixed(0)} MB`;
}

export function ImageModelCard({
  snapshot,
  loading,
  wifiOnly,
  onWifiOnlyChange,
  onDownload,
  onCancel,
  onReviewLicense,
}: ImageModelCardProps) {
  const colors = useColors();
  const phase = snapshot?.phase ?? "none";
  const isDownloading = phase === "pending" || phase === "running" || phase === "paused";
  const isReady = phase === "complete";
  const needsLicense = !snapshot?.licenseAccepted;
  const requiredFreeBytes = snapshot?.requiredFreeBytes ?? 2_080_435_084;
  const availableBytes = snapshot?.availableBytes ?? 0;
  const storageLow = Boolean(snapshot) && availableBytes < requiredFreeBytes;
  const ram = snapshot?.deviceRamBytes ?? 0;
  const tooLittleRam = Boolean(snapshot) && ram < 6_442_450_944;
  const lowRamWarning = Boolean(snapshot) && ram >= 6_442_450_944 && ram < 8_589_934_592;
  const runtimeUnavailable = snapshot?.runtimeAvailable === false;
  const canDownload = !loading && !isDownloading && !isReady && !storageLow && !tooLittleRam && !runtimeUnavailable;
  const title = isReady
    ? "ECHO AI görsel modeli hazır"
    : phase === "failed"
      ? "Model indirilemedi veya doğrulanamadı"
      : phase === "running" || phase === "pending"
        ? "ECHO AI görsel modeli indiriliyor"
        : phase === "paused"
          ? "İndirme beklemede"
          : "Çevrimdışı görsel üretimi";

  return (
    <View
      style={{
        borderColor: colors.border,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderRadius: 20,
        padding: 16,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 11 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={isReady ? "checkmark-circle-outline" : "image-outline"} size={20} color={colors.background} />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>{title}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            {isReady
              ? "PNG görsellerini internet bağlantısı olmadan cihazında üret."
              : "Model APK'ya eklenmez. Bir kez indirildikten sonra görsel üretimi cihazında ve çevrimdışı çalışır."}
          </Text>
        </View>
      </View>

      <View style={{ gap: 4, borderRadius: 13, padding: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
        <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "700" }}>
          İndirme: {formatBytes(snapshot?.totalBytes ?? 1_811_999_628)}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>
          İndirmeden önce en az {formatBytes(requiredFreeBytes)} boş alan gerekir. Şu an boş: {formatBytes(availableBytes)}.
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>
          En az 6 GB RAM gerekir; 8 GB veya üzeri önerilir.
        </Text>
      </View>

      {runtimeUnavailable ? (
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
          Bu Android cihazında görsel üretim motoru başlatılamadı.
        </Text>
      ) : null}
      {storageLow ? (
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
          İndirme için daha fazla boş alan aç. Gerekli alan: {formatBytes(requiredFreeBytes)}.
        </Text>
      ) : null}
      {tooLittleRam ? (
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
          Bu cihazın belleği görsel üretimi için yetersiz.
        </Text>
      ) : null}
      {lowRamWarning ? (
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
          Bu cihazda üretim daha yavaş olabilir; diğer uygulamaları kapatman gerekebilir.
        </Text>
      ) : null}
      {snapshot?.error ? (
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
          Önceki işlem tamamlanamadı. Tekrar deneyebilirsin.
        </Text>
      ) : null}

      {isDownloading ? (
        <View style={{ gap: 8 }}>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: snapshot?.progress ?? 0 }}
            style={{ height: 7, borderRadius: 99, backgroundColor: colors.border, overflow: "hidden" }}
          >
            <View
              style={{
                width: `${Math.max(snapshot?.progress ?? 0, 1)}%`,
                height: "100%",
                backgroundColor: colors.primary,
              }}
            />
          </View>
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            {snapshot?.progress === 100
              ? "Dosyalar doğrulanıyor…"
              : `${Math.round(snapshot?.progress ?? 0)}% · ${formatBytes(snapshot?.downloadedBytes ?? 0)} indirildi`}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>
            Sistem indiricisi aktarımı sürdürür; uygulamadan çıkabilirsin.
          </Text>
        </View>
      ) : null}

      {!isReady && !isDownloading && snapshot?.licenseAccepted ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "700" }}>Yalnızca Wi-Fi</Text>
            <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 15 }}>
              {wifiOnly ? "Mobil veri kullanılmaz." : "Mobil veri kullanımı ek ücret oluşturabilir."}
            </Text>
          </View>
          <Switch
            accessibilityLabel="Görsel modeli indirmek için yalnızca Wi-Fi kullan"
            value={wifiOnly}
            onValueChange={onWifiOnlyChange}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.background}
          />
        </View>
      ) : null}

      {isReady && runtimeUnavailable ? (
        <Text style={{ color: colors.muted, fontSize: 12 }}>Görsel motoru kullanılamıyor; bu APK’yı güncellemen gerekebilir.</Text>
      ) : null}

      {isDownloading ? (
        <AnimatedPressable
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed }) => ({
            minHeight: 44,
            borderRadius: 13,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.78 : 1,
          })}
        >
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>İndirmeyi iptal et</Text>
        </AnimatedPressable>
      ) : null}

      {!isReady && !isDownloading ? (
        <AnimatedPressable
          accessibilityRole="button"
          onPress={needsLicense ? onReviewLicense : onDownload}
          disabled={!canDownload && !needsLicense}
          style={({ pressed }) => ({
            minHeight: 48,
            borderRadius: 14,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            opacity: (!canDownload && !needsLicense) ? 0.55 : pressed ? 0.82 : 1,
          })}
        >
          <Text style={{ color: colors.background, fontSize: 14, fontWeight: "700" }}>
            {loading ? "Durum kontrol ediliyor…" : needsLicense ? "Lisans koşullarını incele" : phase === "failed" ? "Yeniden dene" : "ECHO AI görsel modelini indir"}
          </Text>
        </AnimatedPressable>
      ) : null}

      <AnimatedPressable
        accessibilityRole="button"
        onPress={onReviewLicense}
        style={({ pressed }) => ({ alignSelf: "flex-start", paddingVertical: 5, opacity: pressed ? 0.7 : 1 })}
      >
        <Text style={{ color: colors.muted, fontSize: 11, textDecorationLine: "underline" }}>Lisans ve açık kaynak bildirimleri</Text>
      </AnimatedPressable>
    </View>
  );
}
