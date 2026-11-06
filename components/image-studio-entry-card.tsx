import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { AnimatedPressable } from "@/components/animated-pressable";
import { EchoText as Text } from "@/components/echo-text";
import { useColors } from "@/hooks/use-colors";
import { View } from "react-native";

export function ImageStudioEntryCard() {
  const colors = useColors();
  return (
    <View style={{ gap: 12, borderRadius: 18, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="image-outline" size={20} color={colors.background} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>Görsel Kanvası</Text>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            Ayrı ekranda 512 × 512 PNG oluştur; modeli bir kez indir, sonra internet olmadan kullan.
          </Text>
        </View>
      </View>
      <AnimatedPressable
        accessibilityRole="button"
        onPress={() => router.push("/image-studio")}
        style={({ pressed }) => ({
          minHeight: 46,
          borderRadius: 13,
          backgroundColor: colors.primary,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: pressed ? 0.82 : 1,
        })}
      >
        <Ionicons name="arrow-forward-outline" size={18} color={colors.background} />
        <Text style={{ color: colors.background, fontSize: 13, fontWeight: "700" }}>Görsel Kanvası’nı aç</Text>
      </AnimatedPressable>
    </View>
  );
}
