import { isScreenVisionCollectorRunning, startScreenVisionCollector, stopScreenVisionCollector } from "./screenVisionCollector";

export function startMacOSCollector(intervalMs: number): void {
  startScreenVisionCollector(intervalMs);
}

export function stopMacOSCollector(): void {
  stopScreenVisionCollector();
}

export function isMacOSCollectorRunning(): boolean {
  return isScreenVisionCollectorRunning();
}
