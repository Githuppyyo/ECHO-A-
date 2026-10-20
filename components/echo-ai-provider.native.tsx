import { createLLM, getRecommendedBackend } from "react-native-litert-lm";
import type { ConversationHandle, LiteRTLMInstance } from "react-native-litert-lm";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";

import { EchoAIDownloader, type DownloadSnapshot } from "@/modules/echo-ai-downloader/src";
import { EchoAIContext, type EchoAIStatus } from "./echo-ai-context";

const BASE_SYSTEM_PROMPT = `Sen ECHO AI'sin. Varsayılan dilin doğal ve akıcı Türkçedir; kullanıcı başka bir dil isterse o dilde yanıt ver. Net, yararlı ve dikkatli ol. Altyapıda kullanılan model veya sağlayıcı adlarını, indirme adreslerini ya da uygulamanın iç teknik detaylarını açıklama; kullanıcı sorarsa yalnızca ECHO AI olarak kendini tanıt. Bilmediğin bilgiyi uydurma.`;

const MODEL_DOWNLOAD_URL =
  "https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/2eee7ac325f20eb8c9ac1d0e972f7c84663062da/gemma-4-E4B-it.litertlm";

const MODEL_CONFIG = {
  backend: getRecommendedBackend(),
  multimodal: true,
  thinking: { enabled: true, tokenBudget: 128 },
  temperature: 0.55,
  maxContextTokens: 2048,
  maxOutputTokens: 768,
  systemPrompt: BASE_SYSTEM_PROMPT,
} as const;

const isInProgress = (phase: DownloadSnapshot["phase"]) =>
  phase === "pending" || phase === "running" || phase === "paused";

export function EchoAIProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<EchoAIStatus>("checking");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const refreshingRef = useRef(false);
  const loadingPathRef = useRef<string | null>(null);
  const readyPathRef = useRef<string | null>(null);
  const engineRef = useRef<LiteRTLMInstance | null>(null);

  const loadLocalModel = useCallback(async (localPath: string) => {
    if (readyPathRef.current === localPath && engineRef.current) {
      setStatus("ready");
      setMessage(null);
      return;
    }
    if (loadingPathRef.current === localPath) return;

    loadingPathRef.current = localPath;
    setStatus("loading");
    setMessage(null);
    const candidate = createLLM({ enableMemoryTracking: true, maxMemorySnapshots: 32 });

    try {
      await candidate.loadModel(localPath, MODEL_CONFIG);
      if (!mountedRef.current) {
        candidate.close();
        return;
      }
      engineRef.current?.close();
      engineRef.current = candidate;
      readyPathRef.current = localPath;
      setStatus("ready");
    } catch {
      candidate.close();
      if (mountedRef.current) {
        setStatus("failed");
        setMessage("Bu cihazda ECHO AI başlatılamadı. Cihaz belleğini kontrol edip yeniden deneyebilirsin.");
      }
    } finally {
      loadingPathRef.current = null;
    }
  }, []);

  const refreshDownloadState = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const snapshot = await EchoAIDownloader.getState();
      if (!mountedRef.current) return;
      setProgress(snapshot.progress ?? 0);

      if (snapshot.phase === "complete" && snapshot.localPath) {
        await loadLocalModel(snapshot.localPath);
        return;
      }
      if (isInProgress(snapshot.phase)) {
        setStatus("downloading");
        setMessage(
          snapshot.phase === "paused"
            ? "Bağlantı bekleniyor; Android indirmeyi yeniden deneyecek."
            : null,
        );
        return;
      }
      if (snapshot.phase === "failed") {
        setStatus("failed");
        setMessage("İndirme tamamlanamadı. Bağlantını kontrol edip yeniden deneyebilirsin.");
        return;
      }
      if (!engineRef.current) setStatus("not-installed");
      setMessage(null);
    } catch {
      if (mountedRef.current) {
        setStatus("failed");
        setMessage("ECHO AI durumu okunamadı. Uygulamayı yeniden açıp tekrar deneyebilirsin.");
      }
    } finally {
      refreshingRef.current = false;
    }
  }, [loadLocalModel]);

  const startInstall = useCallback(async () => {
    setMessage(null);
    setStatus("requesting-permission");
    try {
      const currentPermission = await Notifications.getPermissionsAsync();
      const permission = currentPermission.granted
        ? currentPermission
        : await Notifications.requestPermissionsAsync();

      if (!permission.granted) {
        setStatus("failed");
        setMessage("Android bildirim iznini açıp yeniden dene. İndirme ilerlemesini göstermek için bu izin gerekli.");
        return;
      }

      setStatus("downloading");
      const snapshot = await EchoAIDownloader.startDownload(MODEL_DOWNLOAD_URL);
      setProgress(snapshot.progress ?? 0);
      if (snapshot.phase === "complete" && snapshot.localPath) {
        await loadLocalModel(snapshot.localPath);
      } else if (snapshot.phase === "failed") {
        setStatus("failed");
        setMessage("İndirme başlatılamadı. Bağlantını kontrol edip yeniden deneyebilirsin.");
      } else {
        setStatus("downloading");
      }
    } catch {
      setStatus("failed");
      setMessage("İndirme başlatılamadı. Biraz sonra yeniden deneyebilirsin.");
    }
  }, [loadLocalModel]);

  const createConversation = useCallback((systemPrompt: string): ConversationHandle | null => {
    const engine = engineRef.current;
    if (!engine) return null;
    return engine.createConversation({ systemPrompt: `${BASE_SYSTEM_PROMPT}\n\n${systemPrompt}` });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const initialRefresh = setTimeout(() => void refreshDownloadState(), 0);
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void refreshDownloadState();
    });
    return () => {
      clearTimeout(initialRefresh);
      mountedRef.current = false;
      subscription.remove();
      const engine = engineRef.current;
      engineRef.current = null;
      if (engine) void engine.close();
    };
  }, [refreshDownloadState]);

  useEffect(() => {
    if (status !== "downloading") return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void refreshDownloadState();
    }, 1200);
    return () => clearInterval(timer);
  }, [refreshDownloadState, status]);

  const value = useMemo(
    () => ({ status, progress, message, startInstall, createConversation }),
    [status, progress, message, startInstall, createConversation],
  );

  return <EchoAIContext.Provider value={value}>{children}</EchoAIContext.Provider>;
}
