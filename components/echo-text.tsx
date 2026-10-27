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

function fontFamilyFor(style: StyleProp<TextStyle> | undefined): string {
  const flattened = StyleSheet.flatten(style);
  if (flattened?.fontFamily) return flattened.fontFamily;
  return FONT_BY_WEIGHT[String(flattened?.fontWeight ?? "400")] ?? "Comfortaa_400Regular";
}

export function EchoText({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[{ fontFamily: fontFamilyFor(style) }, style]} />;
}

export function EchoTextInput({ style, ...props }: TextInputProps) {
  return <NativeTextInput {...props} style={[{ fontFamily: fontFamilyFor(style) }, style]} />;
}
