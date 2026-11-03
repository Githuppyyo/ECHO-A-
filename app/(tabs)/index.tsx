import { Ionicons } from "@expo/vector-icons";
import { AnimatedPressable } from "@/components/animated-pressable";
import type { ConversationHandle } from "react-native-litert-lm";
import { useEffect, useRef, useState } from "react";
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
  ScrollView,
  View,
} from "react-native";

import { ChatActivityStatus } from "@/components/chat-activity-status";
import { ChatMessageContent } from "@/components/chat-message-content";
import { EchoText as Text, EchoTextInput as TextInput } from "@/components/echo-text";
import { ChatHistoryDrawer } from "@/components/chat-history-drawer";
import { useEchoAI } from "@/components/echo-ai-context";
import { EchoBrand } from "@/components/echo-brand";
import { ModelInstallCard } from "@/components/model-install-card";
import { ScreenContainer } from "@/components/screen-container";
import { EchoAIOfflineVoice } from "@/modules/echo-ai-downloader/src/offline-voice";
import { useColors } from "@/hooks/use-colors";
import {
  getChatThinkingOptions,
  inferChatActivity,
  type ChatActivityKind,
} from "@/lib/chat-activity";
import {
  MAX_CHAT_IMAGES_PER_MESSAGE,
  pickChatImages,
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
  getChatMessageImages,
  type ChatConversation,
  type ChatHistorySnapshot,
  type ChatMessage,
} from "@/lib/chat-history";
import { useThemeContext } from "@/lib/theme-provider";
import { concealInternalModelName } from "@/lib/brand-policy";

const CHAT_SYSTEM_PROMPT =
  "Önce kısa ve doğrudan yanıt ver; basit selamlaşmalara tek cümleyle dön. Kullanıcı ayrıntı isterse genişlet. Varsayılan olarak Türkçe, doğal ve açık yaz. Gerekirse kısa başlıklar, maddeler ve kod bloğu kullan. Matematik ve kimya denklemlerini LaTeX biçiminde yazma; okunabilir Unicode alt/üst indisler ve → işareti kullan. Kullanıcı teknik altyapı sorarsa yalnızca ECHO AI olduğunu söyle; teknik model ve sağlayıcı adlarını açıklama. Görsel eklendiğinde yalnızca gerçekten gördüğün ayrıntıları anlat. Sesli mesaj eklendiğinde konuşmayı anlayıp doğal Türkçe yanıt ver.";
const SUGGESTIONS = [
  "Karmaşık bir konuyu sade anlat",
  "Bu fikri uygulanabilir adımlara böl",
  "Bir metni daha net ve güçlü yaz",
];

async function buildConversationParts(
  previousMessages: ChatMessage[],
  currentText: string,
  restoreHistory: boolean,
  currentImageUris: string[] = [],
): Promise<Parameters<ConversationHandle["execute"]>[0]> {
  const parts: Parameters<ConversationHandle["execute"]>[0] = [];
  if (restoreHistory && previousMessages.length > 0) {
    let contextText = "Önceki konuşma bağlamı:\n";
    let replayedImages = 0;

    for (const message of previousMessages.slice(-8)) {
      const speaker = message.role === "user" ? "Kullanıcı" : "ECHO AI";
      const content = message.content.length > 700 ? `${message.content.slice(0, 700)}…` : message.content;
      const messageImages = getChatMessageImages(message);
      const attachedPaths: string[] = [];
      let missingImages = 0;
      let omittedImages = 0;
      for (const image of messageImages) {
        if (replayedImages >= 2) {
          omittedImages += 1;
          continue;
        }
        const imagePath = await resolveChatImagePath(image.uri);
        if (imagePath) {
          attachedPaths.push(imagePath);
          replayedImages += 1;
        } else {
          missingImages += 1;
        }
      }
      const imageNotes = [
        attachedPaths.length ? `${attachedPaths.length} önceki görsel eklendi` : "",
        missingImages ? `${missingImages} görsel dosyası bulunamadı` : "",
        omittedImages ? `${omittedImages} eski görsel bağlam sınırı nedeniyle eklenmedi` : "",
      ].filter(Boolean);
      contextText += `${speaker}: ${content}${imageNotes.length ? `\n[${imageNotes.join("; ")}]` : ""}\n\n`;
      if (attachedPaths.length) {
        parts.push({ type: "text", text: contextText.trim() });
        for (const path of attachedPaths) parts.push({ type: "image", path });
        contextText = "";
      }
    }

    if (contextText.trim()) parts.push({ type: "text", text: contextText.trim() });
  }

  parts.push({
    type: "text",
    text: restoreHistory && previousMessages.length > 0 ? `Yeni mesaj:\n${currentText}` : currentText,
  });
  for (const uri of currentImageUris.slice(0, MAX_CHAT_IMAGES_PER_MESSAGE)) {
    const imagePath = await resolveChatImagePath(uri);
    if (!imagePath) throw new Error("image-not-found");
    parts.push({ type: "image", path: imagePath });
  }
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
  const [draftImages, setDraftImages] = useState<ChatImageSelection[]>([]);
  const [pickingImage, setPickingImage] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
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
  const voiceRecordingRef = useRef(false);
  const voiceElapsedRef = useRef(0);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceSpeechIdRef = useRef(0);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      subscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(
    () => () => {
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      if (Platform.OS !== "android") return;
      if (voiceRecordingRef.current) {
        voiceRecordingRef.current = false;
        EchoAIOfflineVoice.cancelOfflineTranscription();
      }
      voiceSpeechIdRef.current += 1;
      EchoAIOfflineVoice.stopSpeaking();
    },
    [],
  );

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

  const sendMessage = async (value: string, options: { images?: ChatImageSelection[]; speakResponse?: boolean } = {}) => {
    const images = (options.images ?? []).slice(0, MAX_CHAT_IMAGES_PER_MESSAGE);
    const defaultImagePrompt = images.length === 1
      ? "Bu görseli analiz et."
      : images.length > 1
        ? `Bu ${images.length} görseli birlikte analiz et.`
        : "";
    const text = value.trim() || defaultImagePrompt;
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
      ...(images.length > 0
        ? { imageUris: images.map((image) => image.uri), imageNames: images.map((image) => image.name) }
        : {}),
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
    setDraftImages([]);
    setSending(true);
    setActivity(inferChatActivity(text, images.length > 0));
    setStreamingAssistantId(assistantMessageId);
    historyNeedsReplayRef.current = false;
    let streamedText = "";

    try {
      const parts = await buildConversationParts(
        previousMessages,
        text,
        restoreHistory,
        images.map((image) => image.uri),
      );
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
        { thinking: getChatThinkingOptions(text, images.length > 0) },
      );
      const answer = concealInternalModelName(response.trim() || streamedText.trim()).trim();
      if (!answer) throw new Error("empty-response");
      persistConversation(
        conversationId,
        messagesRef.current.map((message) =>
          message.id === assistantMessageId ? { ...message, content: answer } : message,
        ),
      );
      if ((voiceOutputEnabled || options.speakResponse) && Platform.OS === "android") {
        const speechId = ++voiceSpeechIdRef.current;
        void EchoAIOfflineVoice.speakOffline(answer.slice(0, 2800), "tr-TR")
          .then((spoke) => {
            if (speechId !== voiceSpeechIdRef.current || spoke) return;
            setVoiceOutputEnabled(false);
            setError("Cihazda çevrimdışı Türkçe ses bulunamadı; yazılı yanıt hazır.");
          })
          .catch(() => {
            if (speechId !== voiceSpeechIdRef.current) return;
            setVoiceOutputEnabled(false);
            setError("Çevrimdışı seslendirme kullanılamadı; yazılı yanıt hazır.");
          });
      }
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

  const stopVoiceCapture = async () => {
    if (!voiceRecordingRef.current) return;
    voiceRecordingRef.current = false;
    if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    voiceTimerRef.current = null;
    setVoiceRecording(false);
    setVoiceProcessing(true);
    setError(null);

    try {
      const transcript = await EchoAIOfflineVoice.stopOfflineTranscription();
      if (!transcript.trim()) {
        setError("Konuşma anlaşılamadı. Tekrar deneyebilir veya yazarak devam edebilirsin.");
        return;
      }
      await sendMessage(transcript.trim(), { images: draftImages, speakResponse: true });
    } catch {
      setError("Çevrimdışı konuşma çözümlenemedi. Metin yazarak devam edebilirsin.");
    } finally {
      setVoiceProcessing(false);
    }
  };

  const startVoiceCapture = async () => {
    if (
      Platform.OS !== "android" ||
      status !== "ready" ||
      sending ||
      voiceRecordingRef.current ||
      voiceProcessing ||
      !historyLoaded
    ) return;

    voiceRecordingRef.current = true;
    setVoiceProcessing(true);
    try {
      const recognitionAvailable = await EchoAIOfflineVoice.isOfflineSpeechAvailable("tr-TR");
      if (!recognitionAvailable) {
        voiceRecordingRef.current = false;
        setVoiceProcessing(false);
        setError("Bu cihazda Türkçe çevrimdışı ses paketi hazır değil. Yazıyla sohbete devam edebilirsin.");
        return;
      }
      const permission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: "Mikrofon izni",
          message: "Sesli mesajını cihazda işlemek için mikrofon erişimi gerekir.",
          buttonPositive: "İzin ver",
          buttonNegative: "Vazgeç",
        },
      );
      if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
        voiceRecordingRef.current = false;
        setVoiceProcessing(false);
        setError("Mikrofon izni verilmedi; yazıyla sohbete devam edebilirsin.");
        return;
      }

      await EchoAIOfflineVoice.startOfflineTranscription("tr-TR");
      if (!voiceRecordingRef.current) {
        EchoAIOfflineVoice.cancelOfflineTranscription();
        return;
      }
      setVoiceProcessing(false);
      setVoiceRecording(true);
      setVoiceSeconds(0);
      voiceElapsedRef.current = 0;
      voiceTimerRef.current = setInterval(() => {
        if (!voiceRecordingRef.current) return;
        voiceElapsedRef.current += 1;
        const elapsed = voiceElapsedRef.current;
        setVoiceSeconds(Math.min(elapsed, 45));
        if (elapsed >= 45) void stopVoiceCapture();
      }, 1000);
    } catch {
      voiceRecordingRef.current = false;
      setVoiceRecording(false);
      setVoiceProcessing(false);
      EchoAIOfflineVoice.cancelOfflineTranscription();
      setError("Çevrimdışı konuşma başlatılamadı. Metin yazarak devam edebilirsin.");
    }
  };

  const toggleVoiceOutput = async () => {
    if (Platform.OS !== "android") return;
    if (voiceOutputEnabled) {
      voiceSpeechIdRef.current += 1;
      EchoAIOfflineVoice.stopSpeaking();
      setVoiceOutputEnabled(false);
      return;
    }
    try {
      const voice = await EchoAIOfflineVoice.getOfflineVoice("tr-TR");
      if (!voice.available) {
        setError("Cihazda çevrimdışı Türkçe ses bulunamadı. Yazılı yanıtlar kullanılabilir.");
        return;
      }
      setError(null);
      setVoiceOutputEnabled(true);
    } catch {
      setError("Çevrimdışı ses durumu okunamadı; yazılı sohbet kullanılabilir.");
    }
  };

  const startNewChat = async () => {
    if (sending || voiceRecording || voiceProcessing || !historyLoaded) return;
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
    setDraftImages([]);
    persistSnapshot(conversationsRef.current, null);
  };

  const selectConversation = async (selected: ChatConversation) => {
    if (sending || voiceRecording || voiceProcessing || !historyLoaded) return;
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
    setDraftImages([]);
    setError(null);
    setHistoryError(null);
    persistSnapshot(conversationsRef.current, selected.id);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 60);
  };

  const chooseImages = async () => {
    const remaining = MAX_CHAT_IMAGES_PER_MESSAGE - draftImages.length;
    if (status !== "ready" || sending || voiceRecording || voiceProcessing || pickingImage || !historyLoaded || remaining <= 0) return;
    setPickingImage(true);
    setError(null);
    try {
      const images = await pickChatImages(remaining);
      if (images.length) setDraftImages((current) => [...current, ...images].slice(0, MAX_CHAT_IMAGES_PER_MESSAGE));
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
    !voiceRecording &&
    !voiceProcessing &&
    (Boolean(draft.trim()) || draftImages.length > 0);

  return (
    <ScreenContainer safeAreaClassName="bg-background">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
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
              disabled={sending || voiceRecording || voiceProcessing || !historyLoaded}
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
                opacity: sending || voiceRecording || voiceProcessing || !historyLoaded ? 0.62 : pressed ? 0.78 : 1,
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
                        onPress={() => void sendMessage(suggestion)}
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
                const messageImages = getChatMessageImages(message);
                return (
                  <View
                    key={message.id}
                    style={{ width: "100%", alignItems: fromUser ? "flex-end" : "flex-start", gap: 5 }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 11, paddingHorizontal: 4 }}>
                      {fromUser ? "Sen" : "ECHO AI"}
                    </Text>
                    <View
                      style={{
                        width: fromUser ? undefined : "100%",
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
                      {messageImages.length > 0 ? (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          {messageImages.map((image, index) => (
                            <Image
                              key={`${message.id}-image-${index}`}
                              source={{ uri: image.uri }}
                              accessibilityLabel={image.name}
                              resizeMode="cover"
                              style={{ width: 128, height: 94, borderRadius: 12, backgroundColor: colors.surface }}
                            />
                          ))}
                        </View>
                      ) : null}
                      {message.content ? fromUser ? (
                        <Text selectable style={{ color: colors.foreground, fontSize: 15, lineHeight: 23 }}>
                          {message.content}
                        </Text>
                      ) : (
                        <ChatMessageContent content={message.content} colors={colors} colorScheme={colorScheme} />
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
              paddingVertical: 5,
              marginBottom: keyboardVisible ? 20 : 4,
            }}
          >
            {draftImages.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 4, paddingTop: 3 }}
              >
                {draftImages.map((image, index) => (
                  <View key={`${image.uri}-${index}`} style={{ width: 76, gap: 3 }}>
                    <View>
                      <Image
                        source={{ uri: image.uri }}
                        accessibilityLabel={`Eklenecek görsel ${index + 1}`}
                        resizeMode="cover"
                        style={{ width: 76, height: 54, borderRadius: 10, backgroundColor: colors.background }}
                      />
                      <AnimatedPressable
                        accessibilityRole="button"
                        accessibilityLabel={`${image.name} görselini kaldır`}
                        onPress={() => setDraftImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        style={({ pressed }) => ({
                          position: "absolute",
                          right: 2,
                          top: 2,
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "rgba(0,0,0,0.68)",
                          opacity: pressed ? 0.72 : 1,
                        })}
                      >
                        <Ionicons name="close" size={15} color="#fff" />
                      </AnimatedPressable>
                    </View>
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10 }}>{image.name}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}
            {voiceRecording || voiceProcessing ? (
              <Text style={{ color: voiceRecording ? colors.primary : colors.muted, fontSize: 12, paddingHorizontal: 4 }}>
                {voiceRecording
                  ? `Dinleme · ${String(Math.floor(voiceSeconds / 60)).padStart(2, "0")}:${String(voiceSeconds % 60).padStart(2, "0")} / 00:45 · durdurunca gönderilir`
                  : "Konuşma cihazda çevrimdışı metne çevriliyor…"}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 7 }}>
              {Platform.OS === "android" ? (
                <>
                  <AnimatedPressable
                    accessibilityRole="button"
                    accessibilityLabel={`Görsel ekle, ${draftImages.length}/${MAX_CHAT_IMAGES_PER_MESSAGE} seçili`}
                    disabled={status !== "ready" || sending || voiceRecording || voiceProcessing || pickingImage || !historyLoaded || draftImages.length >= MAX_CHAT_IMAGES_PER_MESSAGE}
                    onPress={() => void chooseImages()}
                    style={({ pressed }) => ({
                      width: 38,
                      height: 42,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: status !== "ready" || sending || voiceRecording || voiceProcessing || pickingImage || !historyLoaded || draftImages.length >= MAX_CHAT_IMAGES_PER_MESSAGE ? 0.62 : pressed ? 0.78 : 1,
                    })}
                  >
                    <Ionicons name={pickingImage ? "ellipsis-horizontal" : "image-outline"} size={21} color={colors.muted} />
                  </AnimatedPressable>
                  <AnimatedPressable
                    accessibilityRole="button"
                    accessibilityLabel={voiceRecording ? "Konuşmayı durdur ve gönder" : "Çevrimdışı konuşmaya başla"}
                    disabled={!voiceRecording && (status !== "ready" || sending || voiceProcessing || !historyLoaded)}
                    onPress={() => voiceRecording ? void stopVoiceCapture() : void startVoiceCapture()}
                    style={({ pressed }) => ({
                      width: 38,
                      height: 42,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: voiceRecording ? colors.error : colors.border,
                      backgroundColor: voiceRecording ? colors.error : colors.surface,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: !voiceRecording && (status !== "ready" || sending || voiceProcessing || !historyLoaded) ? 0.62 : pressed ? 0.78 : 1,
                    })}
                  >
                    <Ionicons name={voiceRecording ? "stop" : "mic-outline"} size={20} color={voiceRecording ? colors.background : colors.muted} />
                  </AnimatedPressable>
                  <AnimatedPressable
                    accessibilityRole="button"
                    accessibilityLabel={voiceOutputEnabled ? "Çevrimdışı sesli yanıtı kapat" : "Çevrimdışı sesli yanıtı aç"}
                    disabled={status !== "ready" || sending || voiceRecording || voiceProcessing || !historyLoaded}
                    onPress={() => void toggleVoiceOutput()}
                    style={({ pressed }) => ({
                      width: 38,
                      height: 42,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: voiceOutputEnabled ? colors.primary : colors.border,
                      backgroundColor: voiceOutputEnabled ? `${colors.primary}22` : colors.surface,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: status !== "ready" || sending || voiceRecording || voiceProcessing || !historyLoaded ? 0.62 : pressed ? 0.78 : 1,
                    })}
                  >
                    <Ionicons name={voiceOutputEnabled ? "volume-high" : "volume-mute"} size={20} color={voiceOutputEnabled ? colors.primary : colors.muted} />
                  </AnimatedPressable>
                </>
              ) : null}
              <TextInput
                accessibilityLabel="Mesajını yaz"
                value={draft}
                onChangeText={setDraft}
                editable={status === "ready" && historyLoaded && !sending && !voiceRecording && !voiceProcessing}
                placeholder={
                  !historyLoaded
                    ? "Sohbet geçmişi yükleniyor..."
                    : voiceRecording
                      ? "Kaydediliyor..."
                      : status === "ready"
                        ? "Mesajını yaz..."
                      : "Önce ECHO AI'yi kur"
                }
                placeholderTextColor={colors.muted}
                multiline
                maxLength={6000}
                textAlignVertical="top"
                onFocus={() => requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))}
                style={{
                  flex: 1,
                  color: colors.foreground,
                  fontSize: 15,
                  lineHeight: 22,
                  minHeight: 36,
                  maxHeight: 96,
                  paddingTop: 7,
                  paddingBottom: 5,
                }}
              />
              <AnimatedPressable
                accessibilityRole="button"
                accessibilityLabel="Mesajı gönder"
                disabled={!canSend}
                onPress={() => void sendMessage(draft, { images: draftImages })}
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
        actionsDisabled={sending || voiceRecording || voiceProcessing || !historyLoaded}
        onClose={() => setHistoryVisible(false)}
        onNewChat={() => void startNewChat()}
        onSelect={(conversation) => void selectConversation(conversation)}
      />
    </ScreenContainer>
  );
}
