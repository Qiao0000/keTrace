import { app } from "electron";
import { createRequire } from "node:module";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { openSpotlight } from "./window";

const require = createRequire(import.meta.url);

interface CtrlMonitorAddon {
  checkAccessibility(): boolean;
  requestAccessibility(): boolean;
  checkInputMonitoring(): boolean;
  requestInputMonitoring(): boolean;
  start(): boolean;
  stop(): void;
  pollTrigger(): boolean;
  isRunning(): boolean;
  pollTapDisabled(): boolean;
  pollCtrlEvents(): number;
}

let addon: CtrlMonitorAddon | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

let shortcutStatus = {
  supported: process.platform === "darwin",
  running: false,
  accessibilityRequired: false,
  inputMonitoringRequired: false,
  eventTapFailed: false,
  helperMissing: false,
  triggeredCount: 0,
  lastTriggeredAt: "",
  ctrlEventCount: 0,
  lastCtrlEventAt: "",
  ready: false,
  tapDisabled: false,
  lastMessage: "",
  helperPath: "",
  helperBuiltAt: "",
  helperPid: 0,
  startedAt: "",
  lastExitCode: null as number | null,
  lastExitSignal: "",
  lastExitAt: "",
  lastStderr: "",
};

function resolveAddonPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, "native/ctrl_monitor.node");
  }
  return join(__dirname, "../native/ctrl_monitor.node");
}

function loadAddon(): CtrlMonitorAddon | null {
  try {
    const p = resolveAddonPath();
    if (!existsSync(p)) return null;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(p) as CtrlMonitorAddon;
  } catch (err) {
    console.warn("[KeTrace] Failed to load native addon:", (err as Error).message);
    return null;
  }
}

export function startNativeShortcutMonitor(): void {
  if (process.platform !== "darwin") return;
  if (addon) return; // already started

  const path = resolveAddonPath();
  let builtAt = "";
  try {
    if (existsSync(path)) builtAt = statSync(path).mtime.toISOString();
  } catch { /* ignore */ }

  shortcutStatus = {
    supported: true,
    running: false,
    accessibilityRequired: false,
    inputMonitoringRequired: false,
    eventTapFailed: false,
    helperMissing: !existsSync(path),
    triggeredCount: 0,
    lastTriggeredAt: "",
    ctrlEventCount: 0,
    lastCtrlEventAt: "",
    ready: false,
    tapDisabled: false,
    lastMessage: existsSync(path) ? "" : "addon missing",
    helperPath: path,
    helperBuiltAt: builtAt,
    helperPid: 0,
    startedAt: new Date().toISOString(),
    lastExitCode: null,
    lastExitSignal: "",
    lastExitAt: "",
    lastStderr: "",
  };

  const loaded = loadAddon();
  if (!loaded) {
    shortcutStatus.helperMissing = true;
    shortcutStatus.lastMessage = "addon load failed";
    return;
  }

  addon = loaded;

  // Request permissions on first launch (dialogs appear for this process — 刻迹.app)
  const accessibility = addon.requestAccessibility();
  const inputMonitoring = addon.requestInputMonitoring();

  if (!accessibility) {
    shortcutStatus.accessibilityRequired = true;
    shortcutStatus.lastMessage = "accessibility required";
  }
  if (!inputMonitoring) {
    shortcutStatus.inputMonitoringRequired = true;
    shortcutStatus.lastMessage = "input monitoring required";
  }

  if (accessibility && inputMonitoring) {
    shortcutStatus.ready = true;
    shortcutStatus.lastMessage = "permissions ok, starting event tap";
    if (!addon.start()) {
      shortcutStatus.eventTapFailed = true;
      shortcutStatus.lastMessage = "event tap failed";
    } else {
      shortcutStatus.running = true;
    }
  }

  // Poll the addon for triggers, tap-disabled, and permission changes
  pollTimer = setInterval(() => {
    if (!addon) return;

    // Check for trigger
    if (addon.pollTrigger()) {
      shortcutStatus.triggeredCount += 1;
      shortcutStatus.lastTriggeredAt = new Date().toISOString();
      shortcutStatus.lastMessage = "triggered";
      openSpotlight();
    }

    // Accumulate ctrl events
    const ctrlCount = addon.pollCtrlEvents();
    if (ctrlCount > 0) {
      shortcutStatus.ctrlEventCount += ctrlCount;
      shortcutStatus.lastCtrlEventAt = new Date().toISOString();
      shortcutStatus.lastMessage = "ctrl event";
    }

    // Check tap-disabled
    if (addon.pollTapDisabled()) {
      shortcutStatus.tapDisabled = true;
      shortcutStatus.lastMessage = "tap disabled";
    }

    // If not running, re-check permissions and try to start
    if (!addon.isRunning()) {
      const acc = addon.checkAccessibility();
      const im = addon.checkInputMonitoring();

      const accChanged = shortcutStatus.accessibilityRequired === acc;
      const imChanged = shortcutStatus.inputMonitoringRequired === im;

      if (acc && !shortcutStatus.accessibilityRequired) {
        shortcutStatus.lastMessage = "accessibility granted";
      }
      if (im && !shortcutStatus.inputMonitoringRequired) {
        shortcutStatus.lastMessage = "input monitoring granted";
      }

      shortcutStatus.accessibilityRequired = !acc;
      shortcutStatus.inputMonitoringRequired = !im;

      if (accChanged || imChanged) {
        shortcutStatus.lastMessage = "permissions changed";
      }

      if (acc && im) {
        if (!addon.start()) {
          shortcutStatus.eventTapFailed = true;
          shortcutStatus.lastMessage = "event tap failed";
        } else {
          shortcutStatus.running = true;
          shortcutStatus.ready = true;
          shortcutStatus.eventTapFailed = false;
          shortcutStatus.lastMessage = "event tap started";
        }
      }
    }

    shortcutStatus.running = addon.isRunning();
  }, 150);
}

export function stopNativeShortcutMonitor(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (addon) {
    addon.stop();
    addon = null;
  }
  shortcutStatus.running = false;
}

export function restartNativeShortcutMonitor(_force?: boolean): void {
  stopNativeShortcutMonitor();
  startNativeShortcutMonitor();
}

export function getNativeShortcutStatus(): typeof shortcutStatus {
  return { ...shortcutStatus };
}
