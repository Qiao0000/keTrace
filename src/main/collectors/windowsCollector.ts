import { isScreenVisionCollectorRunning, startScreenVisionCollector, stopScreenVisionCollector } from "./screenVisionCollector";

export function startWindowsCollector(intervalMs: number): void {
  startScreenVisionCollector(intervalMs);
}

export function stopWindowsCollector(): void {
  stopScreenVisionCollector();
}

export function isWindowsCollectorRunning(): boolean {
  return isScreenVisionCollectorRunning();
}
