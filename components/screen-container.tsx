import { useEffect, useState } from "react";
import { Animated, Easing, Platform, View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { cn } from "@/lib/utils";

export interface ScreenContainerProps extends ViewProps {
  /**
   * SafeArea edges to apply. Defaults to ["top", "left", "right"].
   * Bottom is typically handled by Tab Bar.
   */
  edges?: Edge[];
  /**
   * Tailwind className for the content area.
   */
  className?: string;
  /**
   * Additional className for the outer container (background layer).
   */
  containerClassName?: string;
  /**
   * Additional className for the SafeAreaView (content layer).
   */
  safeAreaClassName?: string;
}

/**
 * A container component that properly handles SafeArea and background colors.
 *
 * The outer View extends to full screen (including status bar area) with the background color,
 * while the inner SafeAreaView ensures content is within safe bounds.
 *
 * Usage:
 * ```tsx
 * <ScreenContainer className="p-4">
 *   <Text className="text-2xl font-bold text-foreground">
 *     Welcome
 *   </Text>
 * </ScreenContainer>
 * ```
 */
export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  className,
  containerClassName,
  safeAreaClassName,
  style,
  ...props
}: ScreenContainerProps) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(7));

  useEffect(() => {
    const useNativeDriver = Platform.OS !== "web";
    const entrance = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 210,
        easing: Easing.out(Easing.quad),
        useNativeDriver,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 210,
        easing: Easing.out(Easing.quad),
        useNativeDriver,
      }),
    ]);
    entrance.start();
    return () => entrance.stop();
  }, [opacity, translateY]);

  return (
    <View
      className={cn(
        "flex-1",
        "bg-background",
        containerClassName
      )}
      {...props}
    >
      <SafeAreaView
        edges={edges}
        className={cn("flex-1", safeAreaClassName)}
        style={style}
      >
        <Animated.View
          className={cn("flex-1", className)}
          style={{ opacity, transform: [{ translateY }] }}
        >
          {children}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}
