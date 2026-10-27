import { Ionicons } from "@expo/vector-icons";
import { AnimatedPressable } from "@/components/animated-pressable";
import { Linking, View } from "react-native";

import { EchoText as Text } from "@/components/echo-text";
import { useColors } from "@/hooks/use-colors";
import { useEchoAI } from "./echo-ai-context";

export function ModelInstallCard() {
  const colors = useColors();
  const { status, progress, message, startInstall } = useEchoAI();

  if (status === "ready") return null;

  const isBusy = status === "checking" || status === "requesting-permission" || status === "downloading" || status === "loading";
  const title =
    status === "unsupported"
      ? "Android uygulamasında kullanılabilir"
      : status === "downloading"
        ? "ECHO AI kuruluyor..."
        : status === "requesting-permission"
          ? "Bildirim izni bekleniyor"
        : status === "loading"
          ? "ECHO AI hazırlanıyor..."
          : status === "checking"
            ? "ECHO AI durumu kontrol ediliyor"
            : status === "failed"
              ? "Kurulum tamamlanamadı"
              : "ECHO AI'yi cihazına kur";

  const description =
    status === "unsupported"
      ? "Bu web önizlemesi ekranları gösterir; yerel yapay zekâ ve Android indirme bildirimi Android uygulamasında çalışır."
      : status === "downloading"
        ? "İndirme Android sistem bildirimiyle sürer. Uygulamayı kapatsan bile aktarım devam eder; bu sırada diğer sekmeleri kullanabilirsin."
        : status === "requesting-permission"
          ? "Uygulama kapalıyken indirme ilerlemesini gösterebilmek için Android bildirim izni istenir."
        : status === "loading"
          ? "İlk indirme tamamlandı. Uygulama cihaz içi çalışma için hazırlanıyor."
          : status === "checking"
            ? "Cihazındaki kurulum durumu kontrol ediliyor."
            : status === "failed"
              ? message ?? "Bağlantını kontrol edip yeniden deneyebilirsin."
              : "İlk kurulum yaklaşık 3,66 GB'tır; Android bildirim izni gerekir ve indirme varsayılan olarak yalnızca Wi-Fi üzerinden yapılır. 6 GB veya üzeri RAM önerilir. Sonrasında sohbet ve kanvas çevrimdışı çalışır.";

  return (
    <View
      style={{
        borderColor: colors.border,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderRadius: 20,
        padding: 18,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
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
          <Ionicons name="sparkles-outline" size={20} color={colors.background} />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>{title}</Text>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{description}</Text>
        </View>
      </View>

      {(status === "downloading" || status === "loading") && (
        <View style={{ gap: 7 }}>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: progress }}
            style={{ height: 7, borderRadius: 99, backgroundColor: colors.border, overflow: "hidden" }}
          >
            <View
              style={{
                width: `${Math.max(progress, status === "loading" ? 100 : 2)}%`,
                height: "100%",
                backgroundColor: colors.primary,
              }}
            />
          </View>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {status === "loading"
              ? "Cihazda hazırlanıyor"
              : progress >= 100
                ? "İndirilen dosya doğrulanıyor"
                : `${Math.round(progress)}% indirildi`}
          </Text>
        </View>
      )}

      {status !== "unsupported" && (
        status === "failed" && message?.includes("bildirim iznini") ? (
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="Bildirim ayarlarını aç"
            onPress={() => void Linking.openSettings()}
            style={({ pressed }) => ({
              minHeight: 44,
              borderRadius: 13,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>
              Bildirim ayarlarını aç
            </Text>
          </AnimatedPressable>
        ) : null
      )}

      {status !== "unsupported" && (
        <AnimatedPressable
          accessibilityRole="button"
          onPress={() => void startInstall()}
          disabled={isBusy}
          style={({ pressed }) => ({
            minHeight: 48,
            borderRadius: 14,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
              opacity: isBusy ? 0.68 : pressed ? 0.82 : 1,
          })}
        >
          <Text style={{ color: colors.background, fontSize: 15, fontWeight: "700" }}>
            {status === "failed" ? "Tekrar dene" : "ECHO AI indir"}
          </Text>
        </AnimatedPressable>
      )}
    </View>
  );
}
