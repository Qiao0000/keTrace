import { platform } from "node:os";
import { startMacOSCollector, stopMacOSCollector, isMacOSCollectorRunning } from "./macosCollector";
import { startWindowsCollector, stopWindowsCollector, isWindowsCollectorRunning } from "./windowsCollector";

let running = false;

export function startCollector(intervalMs: number): void {
  if (running) return;
  const p = platform();
  if (p === "darwin") {
    startMacOSCollector(intervalMs);
  } else if (p === "win32") {
    startWindowsCollector(intervalMs);
  }
  running = true;
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
