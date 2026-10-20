import { Image, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";

export function EchoBrand({ subtitle }: { subtitle?: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Image
        source={require("../assets/images/icon.png")}
        accessibilityLabel="ECHO AI logosu"
        resizeMode="contain"
        style={{ width: 46, height: 46, backgroundColor: "#050505" }}
      />
      <View style={{ gap: 2 }}>
        <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "800", letterSpacing: 0.3 }}>
          ECHO AI
        </Text>
        {subtitle ? (
          <Text style={{ color: colors.muted, fontSize: 12 }}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}
