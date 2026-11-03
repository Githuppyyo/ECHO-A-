import { requireNativeModule } from "expo";

export type OfflineVoiceAvailability = {
  available: boolean;
  name?: string;
  language?: string;
};

type EchoAIOfflineVoiceModule = {
  /** True only when Android reports an installed on-device Turkish recognition language. */
  isOfflineSpeechAvailable(languageTag: string): Promise<boolean>;
  /** Resolves when the on-device recognizer has started listening. */
  startOfflineTranscription(languageTag: string): Promise<void>;
  /** Stops listening and resolves with the final on-device transcription. */
  stopOfflineTranscription(): Promise<string>;
  /** Cancels the active transcription without saving audio. */
  cancelOfflineTranscription(): Promise<void>;
  getOfflineVoice(languageTag: string): Promise<OfflineVoiceAvailability>;
  /** Resolves true when speech finishes; false when no offline voice is available or speech fails/stops. */
  speakOffline(text: string, languageTag: string): Promise<boolean>;
  stopSpeaking(): void;
};

export const EchoAIOfflineVoice =
  requireNativeModule<EchoAIOfflineVoiceModule>("EchoAIOfflineVoice");
