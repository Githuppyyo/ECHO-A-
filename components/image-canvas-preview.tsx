import { Ionicons } from "@expo/vector-icons";
import { AnimatedPressable } from "@/components/animated-pressable";
import { EchoText as Text } from "@/components/echo-text";
import { useColors } from "@/hooks/use-colors";
import { ActivityIndicator, Image, View } from "react-native";

type ImageCanvasPreviewProps = {
  uri: string | null;
  generating: boolean;
  progressStep: number;
  progressTotal: number;
  onCancel: () => void;
  onShare: () => void;
};

export function ImageCanvasPreview({
  uri,
  generating,
  progressStep,
  progressTotal,
  onCancel,
  onShare,
}: ImageCanvasPreviewProps) {
  const colors = useColors();

  if (generating) {
    return (
      <View style={{ gap: 12, borderRadius: 18, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <ActivityIndicator color={colors.primary} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>PNG cihazda oluşturuluyor</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Adım {Math.min(progressStep, progressTotal)} / {progressTotal}</Text>
          </View>
        </View>
        <AnimatedPressable
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed }) => ({
            minHeight: 42,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>Üretimi durdur</Text>
        </AnimatedPressable>
      </View>
    );
  }

  if (!uri) return null;

  return (
    <View style={{ gap: 11, borderRadius: 18, padding: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ overflow: "hidden", borderRadius: 13, backgroundColor: "#FFFFFF", aspectRatio: 1 }}>
        <Image
          accessibilityLabel="Oluşturulan PNG görseli"
          source={{ uri }}
          resizeMode="contain"
          style={{ width: "100%", height: "100%" }}
        />
      </View>
      <Text style={{ color: colors.muted, fontSize: 11, textAlign: "center" }}>512 × 512 PNG · cihazında oluşturuldu</Text>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel="PNG görselini kaydet veya paylaş"
        onPress={onShare}
        style={({ pressed }) => ({
          minHeight: 46,
          borderRadius: 13,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Ionicons name="download-outline" size={18} color={colors.foreground} />
        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>PNG’yi kaydet veya paylaş</Text>
      </AnimatedPressable>
    </View>
  );
}
