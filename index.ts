import { requireNativeModule } from "expo";

export type DownloadPhase =
  | "none"
  | "pending"
  | "running"
  | "paused"
  | "complete"
  | "failed";

export type DownloadSnapshot = {
  phase: DownloadPhase;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  localPath: string | null;
  reason: number | null;
};

type EchoAIDownloaderModule = {
  getState(): Promise<DownloadSnapshot>;
  startDownload(url: string): Promise<DownloadSnapshot>;
};

export const EchoAIDownloader =
  requireNativeModule<EchoAIDownloaderModule>("EchoAIDownloader");
