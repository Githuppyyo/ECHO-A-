import { StyleSheet, Text as NativeText, TextInput as NativeTextInput } from "react-native";
import type { StyleProp, TextInputProps, TextProps, TextStyle } from "react-native";

const FONT_BY_WEIGHT: Record<string, string> = {
  "300": "Comfortaa_300Light",
  "400": "Comfortaa_400Regular",
  normal: "Comfortaa_400Regular",
  "500": "Comfortaa_500Medium",
  "600": "Comfortaa_600SemiBold",
  "700": "Comfortaa_700Bold",
  "800": "Comfortaa_700Bold",
  "900": "Comfortaa_700Bold",
  bold: "Comfortaa_700Bold",
};

// Keep moderate system text enlargement, but prevent extreme scaling from breaking mobile layouts.
const MAX_FONT_SIZE_MULTIPLIER = 1.3;

function fontFamilyFor(style: StyleProp<TextStyle> | undefined): string {
  const flattened = StyleSheet.flatten(style);
  if (flattened?.fontFamily) return flattened.fontFamily;
  return FONT_BY_WEIGHT[String(flattened?.fontWeight ?? "400")] ?? "Comfortaa_400Regular";
}

export function EchoText({ style, maxFontSizeMultiplier = MAX_FONT_SIZE_MULTIPLIER, ...props }: TextProps) {
  return (
    <NativeText
      {...props}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[{ fontFamily: fontFamilyFor(style) }, style]}
    />
  );
}

export function EchoTextInput({ style, maxFontSizeMultiplier = MAX_FONT_SIZE_MULTIPLIER, ...props }: TextInputProps) {
  return (
    <NativeTextInput
      {...props}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[{ fontFamily: fontFamilyFor(style) }, style]}
    />
  );
}
