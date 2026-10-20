import { useState } from "react";
import type { ComponentProps } from "react";
import {
  Animated,
  Platform,
  Pressable,
  type PressableProps,
  type PressableStateCallbackType,
} from "react-native";

const NativeAnimatedPressable = Animated.createAnimatedComponent(Pressable);
const DEFAULT_RIPPLE = {
  color: "rgba(120, 128, 140, 0.16)",
  foreground: true,
};

type AnimatedPressableProps = PressableProps & {
  animateScale?: boolean;
  enableRipple?: boolean;
};

export function AnimatedPressable({
  style,
  onPressIn,
  onPressOut,
  disabled,
  android_ripple,
  animateScale = true,
  enableRipple = true,
  ...props
}: AnimatedPressableProps) {
  const [scale] = useState(() => new Animated.Value(1));
  const [pressed, setPressed] = useState(false);

  const animateTo = (toValue: number) => {
    if (!animateScale) return;
    Animated.spring(scale, {
      toValue,
      speed: 30,
      bounciness: 1,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  };

  const handlePressIn: NonNullable<PressableProps["onPressIn"]> = (event) => {
    if (!disabled) {
      setPressed(true);
      animateTo(0.985);
    }
    onPressIn?.(event);
  };

  const handlePressOut: NonNullable<PressableProps["onPressOut"]> = (event) => {
    setPressed(false);
    animateTo(1);
    onPressOut?.(event);
  };

  const pressableState: PressableStateCallbackType = { pressed, hovered: false };
  const baseStyle = typeof style === "function" ? style(pressableState) : style;
  const combinedStyle = [
    baseStyle,
    animateScale ? { transform: [{ scale }] } : undefined,
  ];

  return (
    <NativeAnimatedPressable
      {...props}
      disabled={disabled}
      android_ripple={
        enableRipple && Platform.OS === "android"
          ? android_ripple ?? DEFAULT_RIPPLE
          : undefined
      }
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={combinedStyle as unknown as ComponentProps<typeof NativeAnimatedPressable>["style"]}
    />
  );
}
