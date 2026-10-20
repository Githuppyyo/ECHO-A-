import { useState } from "react";
import type { BottomTabBarButtonProps } from "expo-router/js-tabs";
import { PlatformPressable } from "expo-router/react-navigation";
import * as Haptics from "expo-haptics";
import { Animated } from "react-native";

const AnimatedPlatformPressable = Animated.createAnimatedComponent(PlatformPressable);

export function HapticTab(props: BottomTabBarButtonProps) {
  const [scale] = useState(() => new Animated.Value(1));

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      speed: 30,
      bounciness: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedPlatformPressable
      {...props}
      android_ripple={{ color: "rgba(120, 128, 140, 0.16)", borderless: true }}
      style={[props.style, { transform: [{ scale }] }]}
      onPressIn={(event) => {
        animateTo(0.97);
        if (process.env.EXPO_OS === "ios") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateTo(1);
        props.onPressOut?.(event);
      }}
    />
  );
}
