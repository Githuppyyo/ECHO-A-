import { Ionicons } from "@expo/vector-icons";
import { AnimatedPressable } from "@/components/animated-pressable";
import type { ConversationHandle } from "react-native-litert-lm";
import { useEffect, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { ChatActivityStatus } from "@/components/chat-activity-status";
import { ChatHistoryDrawer } from "@/components/chat-history-drawer";
import { useEchoAI } from "@/components/echo-ai-context";
import { EchoBrand } from "@/components/echo-brand";
import { ModelInstallCard } from "@/components/model-install-card";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getChatThinkingOptions,
  inferChatActivity,
  type ChatActivityKind,
} from "@/lib/chat-activity";
import {
  pickChatImage,
  resolveChatImagePath,
  type ChatImageSelection,
} from "@/lib/chat-images";
import {
  createConversationId,
  createMessageId,
  createEmptyChatHistory,
  loadChatHistory,
  saveChatHistory,
  upsertChatConversation,
  type ChatConversation,
  type ChatHistorySnapshot,
  type ChatMessage,
} from "@/lib/chat-history";
import { useThemeContext } from "@/lib/theme-provider";
import { concealInternalModelName } from "@/lib/brand-policy";

const CHAT_SYSTEM_PROMPT =
  "Önce kısa ve doğrudan yanıt ver; basit selamlaşmalara tek cümleyle dön. Kullanıcı ayrıntı isterse genişlet. Varsayılan olarak Türkçe, doğal ve açık yaz. Gerekirse kısa başlıklar, maddeler ve kod bloğu kullan. Kullanıcı teknik altyapı sorarsa yalnızca ECHO AI olduğunu söyle; teknik model ve sağlayıcı adlarını açıklama. Görsel eklendiğinde yalnızca gerçekten gördüğün ayrıntıları anlat.";
const SUGGESTIONS = [
  "Karmaşık bir konuyu sade anlat",
  "Bu fikri uygulanabilir adımlara böl",
  "Bir metni daha net ve güçlü yaz",
];

async function buildConversationParts(
  previousMessages: ChatMessage[],
  currentText: string,
  restoreHistory: boolean,
  currentImageUri?: string,
): Promise<Parameters<ConversationHandle["execute"]>[0]> {
  const parts: Parameters<ConversationHandle["execute"]>[0] = [];
  if (restoreHistory && previousMessages.length > 0) {
    let contextText = "Önceki konuşma bağlamı:\n";
    let replayedImages = 0;

    for (const message of previousMessages.slice(-8)) {
      const speaker = message.role === "user" ? "Kullanıcı" : "ECHO AI";
      const content = message.content.length > 700 ? `${message.content.slice(0, 700)}…` : message.content;

      if (message.imageUri && replayedImages < 2) {
        const imagePath = await resolveChatImagePath(message.imageUri);
        if (imagePath) {
          contextText += `${speaker}: ${content}\n[Önceki görsel ${replayedImages + 1}]\n\n`;
          parts.push({ type: "text", text: contextText.trim() });
          parts.push({ type: "image", path: imagePath });
          contextText = "";
          replayedImages += 1;
          continue;
        }
        contextText += `${speaker}: ${content}\n[Görsel dosyası bu cihazda bulunamadı]\n\n`;
        continue;
      }

      const imageNote = message.imageUri ? "[Eski görsel bağlam sınırı nedeniyle eklenmedi] " : "";
      contextText += `${speaker}: ${imageNote}${content}\n\n`;
    }

    if (contextText.trim()) parts.push({ type: "text", text: contextText.trim() });
  }

  const currentImagePath = currentImageUri
    ? await resolveChatImagePath(currentImageUri)
    : null;
  if (currentImageUri && !currentImagePath) throw new Error("image-not-found");

  parts.push({
    type: "text",
    text: restoreHistory && previousMessages.length > 0 ? `Yeni mesaj:\n${currentText}` : currentText,
  });
  if (currentImagePath) parts.push({ type: "image", path: currentImagePath });
  return parts;
}

export default function ChatScreen() {
  const colors = useColors();
  const { colorScheme } = useThemeContext();
  const { status, createConversation } = useEchoAI();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftImage, setDraftImage] = useState<ChatImageSelection | null>(null);
  const [pickingImage, setPickingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const [activity, setActivity] = useState<ChatActivityKind>("thinking");
  const [streamingAssistantId, setStreamingAssistantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const conversationRef = useRef<ConversationHandle | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const conversationsRef = useRef<ChatConversation[]>([]);
  const activeConversationIdRef = useRef<string | null>(null);
  const historyNeedsReplayRef = useRef(false);

  const userBubbleBackground = colorScheme === "dark" ? "#292C30" : "#E8E9EB";
  const userBubbleBorder = colorScheme === "dark" ? "#373A3F" : "#DEE0E3";

  useEffect(() => {
    let active = true;
    void loadChatHistory()
      .then((stored) => {
        if (!active) return;
        conversationsRef.current = stored.conversations;
        setConversations(stored.conversations);
        const selected = stored.conversations.find(
          (conversation) => conversation.id === stored.activeConversationId,
        );
        const restoredMessages = selected?.messages ?? [];
        activeConversationIdRef.current = selected?.id ?? null;
        setActiveConversationId(selected?.id ?? null);
        messagesRef.current = restoredMessages;
        setMessages(restoredMessages);
        historyNeedsReplayRef.current = restoredMessages.length > 0;
      })
      .catch(() => {
        if (active) setHistoryError("Sohbet geçmişi açılamadı; yeni bir sohbet başlatabilirsin.");
      })
      .finally(() => {
        if (active) setHistoryLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (status === "ready") {
      if (!conversationRef.current) {
        conversationRef.current = createConversation(CHAT_SYSTEM_PROMPT);
        if (messagesRef.current.length > 0) historyNeedsReplayRef.current = true;
      }
      return;
    }

    const previous = conversationRef.current;
    conversationRef.current = null;
    if (previous) void previous.release();
    if (messagesRef.current.length > 0) historyNeedsReplayRef.current = true;
  }, [createConversation, status]);

  useEffect(
    () => () => {
      const conversation = conversationRef.current;
      conversationRef.current = null;
      if (conversation) void conversation.release();
    },
    [],
  );

  const persistSnapshot = (nextConversations: ChatConversation[], selectedId: string | null) => {
    const snapshot: ChatHistorySnapshot = {
      ...createEmptyChatHistory(),
      activeConversationId: selectedId,
      conversations: nextConversations,
    };
    void saveChatHistory(snapshot)
      .then(() => setHistoryError(null))
      .catch(() => setHistoryError("Sohbet geçmişi cihazda saklanamadı."));
  };

  const persistConversation = (id: string, nextMessages: ChatMessage[]) => {
    const nextConversations = upsertChatConversation(conversationsRef.current, id, nextMessages);
    conversationsRef.current = nextConversations;
    setConversations(nextConversations);
    activeConversationIdRef.current = id;
    setActiveConversationId(id);
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    persistSnapshot(nextConversations, id);
  };

  const sendMessage = async (value: string, image: ChatImageSelection | null = draftImage) => {
    const text = value.trim() || (image ? "Bu görseli analiz et." : "");
    if (!text || sending || !historyLoaded || status !== "ready") return;

    const conversation = conversationRef.current;
    if (!conversation) {
      setError("ECHO AI henüz hazır değil. Biraz bekleyip yeniden dene.");
      return;
    }

    const previousMessages = messagesRef.current;
    const conversationId = activeConversationIdRef.current ?? createConversationId();
    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: text,
      ...(image ? { imageUri: image.uri, imageName: image.name } : {}),
    };
    const assistantMessageId = createMessageId();
    const assistantPlaceholder: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
    };
    const nextMessages = [...previousMessages, userMessage, assistantPlaceholder];
    const restoreHistory = historyNeedsReplayRef.current && previousMessages.length > 0;

    persistConversation(conversationId, nextMessages);
    setError(null);
    setDraft("");
    setDraftImage(null);
    setSending(true);
    setActivity(inferChatActivity(text, Boolean(image)));
    setStreamingAssistantId(assistantMessageId);
    historyNeedsReplayRef.current = false;
    let streamedText = "";

    try {
      const parts = await buildConversationParts(previousMessages, text, restoreHistory, image?.uri);
      const response = await conversation.executeWithEvents(
        parts,
        (event) => {
          if (event.type !== "token" || !event.text) return;
          streamedText += event.text;
          const visibleText = concealInternalModelName(streamedText);
          const updatedMessages = messagesRef.current.map((message) =>
            message.id === assistantMessageId ? { ...message, content: visibleText } : message,
          );
          messagesRef.current = updatedMessages;
          setMessages(updatedMessages);
        },
        { thinking: getChatThinkingOptions(text, Boolean(image)) },
      );
      const answer = concealInternalModelName(response.trim() || streamedText.trim()).trim();
      if (!answer) throw new Error("empty-response");
      persistConversation(
        conversationId,
        messagesRef.current.map((message) =>
          message.id === assistantMessageId ? { ...message, content: answer } : message,
        ),
      );
    } catch {
      if (restoreHistory) historyNeedsReplayRef.current = true;
      const partialAnswer = concealInternalModelName(streamedText.trim()).trim();
      const remainingMessages = partialAnswer
        ? messagesRef.current.map((message) =>
            message.id === assistantMessageId ? { ...message, content: partialAnswer } : message,
          )
        : messagesRef.current.filter((message) => message.id !== assistantMessageId);
      persistConversation(conversationId, remainingMessages);
      setError("Yanıt alınamadı. Biraz bekleyip yeniden deneyebilirsin.");
    } finally {
      setStreamingAssistantId(null);
      setSending(false);
    }
  };

  const startNewChat = async () => {
    if (sending || !historyLoaded) return;
    const previous = conversationRef.current;
    conversationRef.current = null;
    if (previous) await previous.release().catch(() => undefined);
    conversationRef.current = status === "ready" ? createConversation(CHAT_SYSTEM_PROMPT) : null;
    historyNeedsReplayRef.current = false;
    activeConversationIdRef.current = null;
    setActiveConversationId(null);
    messagesRef.current = [];
    setMessages([]);
    setError(null);
    setHistoryError(null);
    setDraft("");
    setDraftImage(null);
    persistSnapshot(conversationsRef.current, null);
  };

  const selectConversation = async (selected: ChatConversation) => {
    if (sending || !historyLoaded) return;
    const previous = conversationRef.current;
    conversationRef.current = null;
    if (previous) await previous.release().catch(() => undefined);
    conversationRef.current = status === "ready" ? createConversation(CHAT_SYSTEM_PROMPT) : null;
    historyNeedsReplayRef.current = selected.messages.length > 0;
    activeConversationIdRef.current = selected.id;
    setActiveConversationId(selected.id);
    messagesRef.current = selected.messages;
    setMessages(selected.messages);
    setDraft("");
    setDraftImage(null);
    setError(null);
    setHistoryError(null);
    persistSnapshot(conversationsRef.current, selected.id);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 60);
  };

  const chooseImage = async () => {
    if (status !== "ready" || sending || pickingImage || !historyLoaded) return;
    setPickingImage(true);
    setError(null);
    try {
      const image = await pickChatImage();
      if (image) setDraftImage(image);
    } catch {
      setError("Görsel eklenemedi. Başka bir görsel seçip yeniden deneyebilirsin.");
    } finally {
      setPickingImage(false);
    }
  };

  const canSend =
    status === "ready" &&
    historyLoaded &&
    !sending &&
    (Boolean(draft.trim()) || Boolean(draftImage));

  return (
    <ScreenContainer safeAreaClassName="bg-background">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 8 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 14,
              gap: 6,
            }}
          >
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4 }}>
              <AnimatedPressable
                accessibilityRole="button"
                accessibilityLabel="Sohbet geçmişini aç"
                onPress={() => setHistoryVisible(true)}
                hitSlop={6}
                style={({ pressed }) => ({
                  width: 42,
                  height: 42,
                  borderRadius: 13,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.78 : 1,
                })}
              >
                <Ionicons name="menu-outline" size={23} color={colors.foreground} />
              </AnimatedPressable>
              <EchoBrand subtitle="Çevrimdışı çalışma alanın" />
            </View>
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityLabel="Yeni sohbet başlat"
              disabled={sending || !historyLoaded}
              onPress={() => void startNewChat()}
              hitSlop={6}
              style={({ pressed }) => ({
                width: 42,
                height: 42,
                borderRadius: 13,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
                opacity: sending || !historyLoaded ? 0.62 : pressed ? 0.78 : 1,
              })}
            >
              <Ionicons name="create-outline" size={22} color={colors.foreground} />
            </AnimatedPressable>
          </View>

          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 18, gap: 14 }}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 ? (
              <View style={{ flex: 1, justifyContent: "center", gap: 20, paddingBottom: 14 }}>
                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.foreground, fontSize: 30, lineHeight: 36, fontWeight: "800" }}>
                    Sorunu yaz. Fikri birlikte açalım.
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}>
                    Metin, kod ve günlük soruların için sade, Türkçe yanıtlar.
                  </Text>
                </View>
                {status === "ready" ? (
                  <View style={{ gap: 9 }}>
                    {SUGGESTIONS.map((suggestion) => (
                      <AnimatedPressable
                        key={suggestion}
                        accessibilityRole="button"
                        onPress={() => void sendMessage(suggestion, null)}
                        style={({ pressed }) => ({
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                          borderRadius: 14,
                          minHeight: 48,
                          paddingVertical: 13,
                          paddingHorizontal: 15,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          opacity: pressed ? 0.72 : 1,
                        })}
                      >
                        <Text style={{ color: colors.foreground, fontSize: 14 }}>{suggestion}</Text>
                        <Ionicons name="arrow-forward" size={17} color={colors.muted} />
                      </AnimatedPressable>
                    ))}
                  </View>
                ) : (
                  <ModelInstallCard />
                )}
              </View>
            ) : (
              messages.map((message) => {
                const fromUser = message.role === "user";
                return (
                  <View
                    key={message.id}
                    style={{ alignItems: fromUser ? "flex-end" : "flex-start", gap: 5 }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 11, paddingHorizontal: 4 }}>
                      {fromUser ? "Sen" : "ECHO AI"}
                    </Text>
                    <View
                      style={{
                        maxWidth: fromUser ? "86%" : "96%",
                        alignItems: fromUser ? "flex-end" : "flex-start",
                        gap: 7,
                        borderRadius: fromUser ? 17 : 0,
                        borderTopRightRadius: fromUser ? 6 : 0,
                        paddingVertical: fromUser ? 10 : 2,
                        paddingHorizontal: fromUser ? 13 : 4,
                        backgroundColor: fromUser ? userBubbleBackground : "transparent",
                        borderWidth: fromUser ? 1 : 0,
                        borderColor: userBubbleBorder,
                      }}
                    >
                      {message.imageUri ? (
                        <Image
                          source={{ uri: message.imageUri }}
                          accessibilityLabel={message.imageName ?? "Sohbette paylaşılan görsel"}
                          resizeMode="cover"
                          style={{ width: 176, height: 124, borderRadius: 12, backgroundColor: colors.surface }}
                        />
                      ) : null}
                      {message.content ? (
                        <Text
                          selectable
                          style={{
                            color: colors.foreground,
                            fontSize: 15,
                            lineHeight: 22,
                          }}
                        >
                          {message.content}
                        </Text>
                      ) : null}
                      {!fromUser &&
                      sending &&
                      streamingAssistantId === message.id &&
                      !message.content ? (
                        <ChatActivityStatus activity={activity} />
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
            {historyError ? <Text style={{ color: colors.error, fontSize: 12 }}>{historyError}</Text> : null}
            {error ? <Text style={{ color: colors.error, fontSize: 13 }}>{error}</Text> : null}
          </ScrollView>

          <View
            style={{
              gap: 7,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              borderRadius: 22,
              paddingHorizontal: 8,
              paddingVertical: 7,
              marginBottom: 8,
            }}
          >
            {draftImage ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 4, paddingTop: 3 }}>
                <Image
                  source={{ uri: draftImage.uri }}
                  accessibilityLabel="Eklenecek görsel"
                  resizeMode="cover"
                  style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: colors.background }}
                />
                <Text numberOfLines={1} style={{ flex: 1, color: colors.muted, fontSize: 12 }}>
                  {draftImage.name}
                </Text>
                <AnimatedPressable
                  accessibilityRole="button"
                  accessibilityLabel="Görseli kaldır"
                  onPress={() => setDraftImage(null)}
                  style={{ padding: 7 }}
                >
                  <Ionicons name="close-circle" size={20} color={colors.muted} />
                </AnimatedPressable>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 7 }}>
              {Platform.OS === "android" ? (
                <AnimatedPressable
                  accessibilityRole="button"
                  accessibilityLabel="Görsel ekle"
                  disabled={status !== "ready" || sending || pickingImage || !historyLoaded}
                  onPress={() => void chooseImage()}
                  style={({ pressed }) => ({
                    width: 38,
                    height: 42,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: status !== "ready" || sending || pickingImage || !historyLoaded ? 0.62 : pressed ? 0.78 : 1,
                  })}
                >
                  <Ionicons name={pickingImage ? "ellipsis-horizontal" : "image-outline"} size={21} color={colors.muted} />
                </AnimatedPressable>
              ) : null}
              <TextInput
                accessibilityLabel="Mesajını yaz"
                value={draft}
                onChangeText={setDraft}
                editable={status === "ready" && historyLoaded && !sending}
                placeholder={
                  !historyLoaded
                    ? "Sohbet geçmişi yükleniyor..."
                    : status === "ready"
                      ? "Mesajını yaz..."
                      : "Önce ECHO AI'yi kur"
                }
                placeholderTextColor={colors.muted}
                multiline
                maxLength={6000}
                style={{
                  flex: 1,
                  color: colors.foreground,
                  fontSize: 15,
                  lineHeight: 21,
                  minHeight: 40,
                  maxHeight: 120,
                  paddingTop: 9,
                  paddingBottom: 7,
                }}
              />
              <AnimatedPressable
                accessibilityRole="button"
                accessibilityLabel="Mesajı gönder"
                disabled={!canSend}
                onPress={() => void sendMessage(draft, draftImage)}
                style={({ pressed }) => ({
                  width: 40,
                  height: 42,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: !canSend ? 0.62 : pressed ? 0.82 : 1,
                })}
              >
                <Ionicons name="arrow-up" size={21} color={colors.background} />
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
      <ChatHistoryDrawer
        visible={historyVisible}
        conversations={conversations}
        activeConversationId={activeConversationId}
        actionsDisabled={sending || !historyLoaded}
        onClose={() => setHistoryVisible(false)}
        onNewChat={() => void startNewChat()}
        onSelect={(conversation) => void selectConversation(conversation)}
      />
    </ScreenContainer>
  );
}
