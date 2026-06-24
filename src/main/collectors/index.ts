import { platform } from "node:os";
import { startMacOSCollector, stopMacOSCollector, isMacOSCollectorRunning } from "./macosCollector";
import { startWindowsCollector, stopWindowsCollector, isWindowsCollectorRunning } from "./windowsCollector";
import { MAX_POLL_INTERVAL_SECONDS, MIN_POLL_INTERVAL_SECONDS } from "../../shared/defaults";

let running = false;
let lastError = "";

export function startCollector(intervalMs: number): void {
  if (running) return;
  const p = platform();
  const safeIntervalMs = Math.min(
    MAX_POLL_INTERVAL_SECONDS * 1000,
    Math.max(MIN_POLL_INTERVAL_SECONDS * 1000, Math.round(intervalMs)),
  );
  try {
    if (p === "darwin") {
      startMacOSCollector(safeIntervalMs);
    } else if (p === "win32") {
      startWindowsCollector(safeIntervalMs);
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
