import { Platform } from "react-native";
import { requireNativeModule } from "expo";

export type ImageModelPhase =
  | "none"
  | "pending"
  | "running"
  | "paused"
  | "complete"
  | "failed";

export type ImageModelSnapshot = {
  phase: ImageModelPhase;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  availableBytes: number;
  requiredFreeBytes: number;
  deviceRamBytes: number;
  licenseAccepted: boolean;
  runtimeAvailable: boolean;
  canGenerate: boolean;
  error: string | null;
};

export type ImageGenerationProgress = {
  step: number;
  total: number;
  cancelled: boolean;
};

type EchoAIImageGenModule = {
  getState(): Promise<ImageModelSnapshot>;
  acceptModelLicense(): Promise<boolean>;
  startModelDownload(wifiOnly: boolean): Promise<ImageModelSnapshot>;
  cancelModelDownload(): Promise<ImageModelSnapshot>;
  generatePng(prompt: string): Promise<string>;
  getGenerationProgress(): ImageGenerationProgress;
  cancelGeneration(): void;
  releaseModelContext(): Promise<void>;
};

let nativeModule: EchoAIImageGenModule | null = null;
if (Platform.OS === "android") {
  try {
    nativeModule = requireNativeModule<EchoAIImageGenModule>("EchoAIImageGen");
  } catch {
    nativeModule = null;
  }
}

export const EchoAIImageGen = nativeModule;
