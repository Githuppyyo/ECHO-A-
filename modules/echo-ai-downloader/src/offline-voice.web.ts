export type OfflineVoiceAvailability = {
  available: boolean;
  name?: string;
  language?: string;
};

const unsupported = async (): Promise<never> => {
  throw new Error("Offline voice is available only in the Android application.");
};

export const EchoAIOfflineVoice = {
  isOfflineSpeechAvailable: async (_languageTag: string): Promise<boolean> => false,
  startOfflineTranscription: unsupported,
  stopOfflineTranscription: unsupported,
  cancelOfflineTranscription: async (): Promise<void> => undefined,
  getOfflineVoice: async (_languageTag: string): Promise<OfflineVoiceAvailability> => ({ available: false }),
  speakOffline: async (_text: string, _languageTag: string): Promise<boolean> => false,
  stopSpeaking: () => undefined,
};
