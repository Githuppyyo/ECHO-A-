import { Ionicons } from "@expo/vector-icons";
import { AnimatedPressable } from "@/components/animated-pressable";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EchoText as Text } from "@/components/echo-text";
import { useColors } from "@/hooks/use-colors";
import type { ChatConversation } from "@/lib/chat-history";

type Props = {
  visible: boolean;
  conversations: ChatConversation[];
  activeConversationId: string | null;
  onClose: () => void;
  onNewChat: () => void;
  onSelect: (conversation: ChatConversation) => void;
  actionsDisabled: boolean;
};

function formatConversationDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  return sameDay
    ? date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function conversationPreview(conversation: ChatConversation): string {
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  if (!lastMessage) return "Henüz mesaj yok";
  const prefix = lastMessage.imageUri ? "Görsel · " : "";
  return `${prefix}${lastMessage.content}`.replace(/\s+/g, " ").trim();
}

export function ChatHistoryDrawer({
  visible,
  conversations,
  activeConversationId,
  onClose,
  onNewChat,
  onSelect,
  actionsDisabled,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const drawerWidth = Math.min(360, Math.round(Dimensions.get("window").width * 0.88));
  const [translateX] = useState(() => new Animated.Value(-drawerWidth));
  const closingRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    closingRef.current = false;
    translateX.setValue(-drawerWidth);
    Animated.timing(translateX, {
      toValue: 0,
      duration: 210,
      useNativeDriver: true,
    }).start();
  }, [drawerWidth, translateX, visible]);

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.timing(translateX, {
      toValue: -drawerWidth,
      duration: 170,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
      closingRef.current = false;
    });
  };

  const startNewChat = () => {
    if (actionsDisabled) return;
    onNewChat();
    close();
  };

  const selectConversation = (conversation: ChatConversation) => {
    if (actionsDisabled) return;
    onSelect(conversation);
    close();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={{ flex: 1, flexDirection: "row" }}>
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel="Sohbet geçmişini kapat"
          onPress={close}
          animateScale={false}
          enableRipple={false}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: "rgba(0,0,0,0.48)",
          }}
        />
        <Animated.View
          style={{
            width: drawerWidth,
            maxWidth: "90%",
            height: "100%",
            backgroundColor: colors.background,
            borderRightWidth: 1,
            borderRightColor: colors.border,
            paddingTop: Math.max(insets.top, 12) + 10,
            paddingBottom: Math.max(insets.bottom, 12) + 8,
            paddingHorizontal: 16,
            transform: [{ translateX }],
            elevation: 24,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <View style={{ gap: 3 }}>
              <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "800" }}>
                Sohbet geçmişi
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Kayıtların bu cihazda
              </Text>
            </View>
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityLabel="Geçmiş panelini kapat"
              onPress={close}
              hitSlop={8}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.78 : 1,
              })}
            >
              <Ionicons name="close" size={22} color={colors.foreground} />
            </AnimatedPressable>
          </View>

          <AnimatedPressable
            accessibilityRole="button"
            disabled={actionsDisabled}
            onPress={startNewChat}
            style={({ pressed }) => ({
              minHeight: 46,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderRadius: 13,
              backgroundColor: colors.primary,
              opacity: actionsDisabled ? 0.62 : pressed ? 0.82 : 1,
              marginBottom: 18,
            })}
          >
            <Ionicons name="add" size={20} color={colors.background} />
            <Text style={{ color: colors.background, fontSize: 14, fontWeight: "700" }}>
              Yeni sohbet
            </Text>
          </AnimatedPressable>

          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", marginBottom: 9 }}>
            SON KONUŞMALAR
          </Text>
          {conversations.length === 0 ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 12 }}>
              <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.muted} />
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", textAlign: "center" }}>
                Henüz kayıtlı sohbet yok
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center" }}>
                İlk mesajından sonra konuşmaların burada görünecek.
              </Text>
            </View>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 7, paddingBottom: 14 }}
              renderItem={({ item }) => {
                const selected = item.id === activeConversationId;
                return (
                  <AnimatedPressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    disabled={actionsDisabled}
                    onPress={() => selectConversation(item)}
                    style={({ pressed }) => ({
                      borderRadius: 13,
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: colors.surface,
                      paddingHorizontal: 12,
                      paddingVertical: 11,
                      opacity: actionsDisabled ? 0.62 : pressed ? 0.82 : 1,
                    })}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <Text numberOfLines={1} style={{ flex: 1, color: colors.foreground, fontSize: 14, fontWeight: "700" }}>
                        {item.title}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 10 }}>
                        {formatConversationDate(item.updatedAt)}
                      </Text>
                    </View>
                    <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 5 }}>
                      {conversationPreview(item)}
                    </Text>
                  </AnimatedPressable>
                );
              }}
            />
          )}

          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>
              Sohbetlerin bu cihazda saklanır; çevrim içi bir yere gönderilmez.
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
