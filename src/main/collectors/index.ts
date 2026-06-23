import { platform } from "node:os";
import { startMacOSCollector, stopMacOSCollector, isMacOSCollectorRunning } from "./macosCollector";
import { startWindowsCollector, stopWindowsCollector, isWindowsCollectorRunning } from "./windowsCollector";

let running = false;
let lastError = "";

export function startCollector(intervalMs: number): void {
  if (running) return;
  const p = platform();
  try {
    if (p === "darwin") {
      startMacOSCollector(intervalMs);
    } else if (p === "win32") {
      startWindowsCollector(intervalMs);
    } else {
      lastError = `Unsupported platform: ${p}`;
      return;
    }
    running = true;
    lastError = "";
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
  }
}

export function stopCollector(): void {
  const p = platform();
  if (p === "darwin") {
    stopMacOSCollector();
  } else if (p === "win32") {
    stopWindowsCollector();
  }
  running = false;
}

export function isCollectorRunning(): boolean {
  return running;
}

export function getCollectorStatus(): { running: boolean; platform: string; lastError: string } {
  const p = platform();
  const actualRunning = p === "darwin"
    ? isMacOSCollectorRunning()
    : p === "win32"
      ? isWindowsCollectorRunning()
      : false;
  running = actualRunning;
  return { running: actualRunning, platform: p, lastError };
}
