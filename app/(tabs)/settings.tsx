import Constants from "expo-constants";
import { ScrollView, Text, View } from "react-native";
import { AnimatedPressable } from "@/components/animated-pressable";

import { useEchoAI } from "@/components/echo-ai-context";
import { EchoBrand } from "@/components/echo-brand";
import { ModelInstallCard } from "@/components/model-install-card";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useThemeContext } from "@/lib/theme-provider";

const STATUS_LABELS = {
  checking: "Kontrol ediliyor",
  "not-installed": "Henüz kurulmadı",
  "requesting-permission": "Bildirim izni",
  downloading: "Kuruluyor",
  loading: "Hazırlanıyor",
  ready: "Hazır · çevrimdışı kullanılabilir",
  failed: "Yeniden deneme gerekli",
  unsupported: "Android uygulamasında kullanılabilir",
} as const;

export default function SettingsScreen() {
  const colors = useColors();
  const { colorScheme, setColorScheme } = useThemeContext();
  const { status } = useEchoAI();
  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <ScreenContainer safeAreaClassName="bg-background">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 28, gap: 20 }}>
        <EchoBrand subtitle="Uygulama tercihleri" />
        <View style={{ gap: 5 }}>
          <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: "800" }}>Ayarlar</Text>
          <Text style={{ color: colors.muted, fontSize: 14 }}>ECHO AI deneyimini kendine göre düzenle.</Text>
        </View>

        <View style={{ gap: 12, borderRadius: 18, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>Görünüm</Text>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
            Seçimin bu cihazda saklanır ve sonraki açılışta uygulanır.
          </Text>
          <View style={{ flexDirection: "row", gap: 9 }}>
            {(["light", "dark"] as const).map((scheme) => {
              const selected = colorScheme === scheme;
              return (
                <AnimatedPressable
                  key={scheme}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setColorScheme(scheme)}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primary : colors.background,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: selected ? colors.background : colors.foreground, fontSize: 14, fontWeight: "700" }}>
                    {scheme === "light" ? "Açık" : "Koyu"}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 11, borderRadius: 18, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>Cihaz durumu</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>ECHO AI</Text>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", textAlign: "right", flexShrink: 1 }}>
              {STATUS_LABELS[status]}
            </Text>
          </View>
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Sürüm</Text>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>{version}</Text>
          </View>
        </View>

        {status !== "ready" ? <ModelInstallCard /> : null}

        <View style={{ gap: 8, borderRadius: 18, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>Veri ve gizlilik</Text>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
            Sohbet ve kanvas içeriği cihazında işlenir. Sohbet geçmişi sunucuya gönderilmez; kanvas taslağın bu cihazda saklanır. Uygulama verilerini temizlemek veya uygulamayı kaldırmak yerel modeli ve taslağı siler.
          </Text>
        </View>

        <Text style={{ color: colors.muted, fontSize: 11, textAlign: "center" }}>ECHO AI</Text>
      </ScrollView>
    </ScreenContainer>
  );
}
