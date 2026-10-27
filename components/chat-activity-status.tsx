import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, View } from "react-native";

import { EchoText as Text } from "@/components/echo-text";
import { useColors } from "@/hooks/use-colors";
import { getChatActivityLabel, type ChatActivityKind } from "@/lib/chat-activity";

type Props = {
  activity: ChatActivityKind;
  label?: string;
};

const ICONS: Record<ChatActivityKind, keyof typeof Ionicons.glyphMap> = {
  thinking: "sparkles-outline",
  code: "code-slash-outline",
  pdf: "document-text-outline",
  image: "image-outline",
  text: "create-outline",
};

export function ChatActivityStatus({ activity, label }: Props) {
  const colors = useColors();
  const statusLabel = label ?? getChatActivityLabel(activity);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={statusLabel}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 4,
        paddingVertical: 7,
      }}
    >
      <ActivityIndicator size="small" color={colors.muted} />
      <Ionicons name={ICONS[activity]} size={15} color={colors.muted} />
      <Text accessibilityLiveRegion="polite" style={{ color: colors.muted, fontSize: 13 }}>
        {statusLabel}
      </Text>
    </View>
  );
}
