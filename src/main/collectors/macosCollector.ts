import { execFile } from "node:child_process";
import { platform as _platform } from "node:os";
import { appendActivity } from "../storage/jsonStore";
import type { ActivityRecord } from "../../shared/types";

const PLATFORM = _platform();

// ─── Config ──────────────────────────────────────────────
let pollIntervalMs = 30_000;
let timer: ReturnType<typeof setInterval> | null = null;
let lastState = "";
let lastCaptureTs = 0;
let wasAfk = false;
const AFK_THRESHOLD_SEC = 300;
const DEDUP_WINDOW_MS = 2_000;

// ─── osascript helper ────────────────────────────────────
function osascript(script: string): Promise<string> {
  return new Promise((resolve) => {
    const child = execFile("osascript", ["-e", script], { timeout: 3_000 });
    let stdout = "";
    child.stdout?.on("data", (d: string) => { stdout += d; });
    child.on("close", () => resolve(stdout.trimEnd()));
    child.on("error", () => resolve(""));
  });
}

// ─── State collectors ────────────────────────────────────
async function getFrontmostApp(): Promise<string> {
  return osascript(
    'tell application "System Events" to get name of first process whose frontmost is true'
  );
}

async function getWindowTitle(appName: string): Promise<string> {
  const script = `
tell application "System Events"
  set p to first process whose name is "${appName}"
  try
    return title of front window of p
  on error
    return ""
  end try
end tell`;
  return osascript(script);
}

async function getBrowserInfo(appName: string): Promise<{ url: string; title: string }> {
  let script = "";
  switch (appName) {
    case "Google Chrome":
      script = `
tell application "Google Chrome"
  if not (exists window 1) then return "\\n"
  tell active tab of front window
    return (its URL) & "\\n" & (its title)
  end tell
end tell`;
      break;
    case "Safari":
      script = `
tell application "Safari"
  if not (exists front document) then return "\\n"
  tell front document
    return (its URL) & "\\n" & (its name)
  end tell
end tell`;
      break;
    case "Arc":
      script = `
tell application "Arc"
  if not (exists window 1) then return "\\n"
  tell front window's active tab
    return (its URL) & "\\n" & (its title)
  end tell
end tell`;
      break;
    case "Microsoft Edge":
      script = `
tell application "Microsoft Edge"
  if not (exists window 1) then return "\\n"
  tell active tab of front window
    return (its URL) & "\\n" & (its title)
  end tell
end tell`;
      break;
    case "Brave Browser":
      script = `
tell application "Brave Browser"
  if not (exists window 1) then return "\\n"
  tell active tab of front window
    return (its URL) & "\\n" & (its title)
  end tell
end tell`;
      break;
    default:
      return { url: "", title: "" };
  }
  const result = await osascript(script);
  if (result.includes("\n")) {
    const [url, ...rest] = result.split("\n");
    return { url: sanitizeUrl(url), title: rest.join("\n") };
  }
  return { url: "", title: "" };
}

function sanitizeUrl(url: string): string {
  if (!url) return "";
  return url.split("?")[0];
}

// ─── Idle detection ──────────────────────────────────────
async function getIdleSeconds(): Promise<number> {
  return new Promise((resolve) => {
    const child = execFile("ioreg", ["-c", "IOHIDSystem"], { timeout: 2_000 });
    let stdout = "";
    child.stdout?.on("data", (d: string) => { stdout += d; });
    child.on("close", () => {
      for (const line of stdout.split("\n")) {
        if (line.includes("HIDIdleTime")) {
          const parts = line.split("=");
          if (parts.length >= 2) {
            const ns = parseInt(parts[parts.length - 1].trim(), 10);
            if (!isNaN(ns)) {
              resolve(ns / 1_000_000_000);
              return;
            }
          }
        }
      }
      resolve(0);
    });
    child.on("error", () => resolve(0));
  });
}

// ─── ID generation ───────────────────────────────────────
let idCounter = 0;
function genId(): string {
  idCounter++;
  return `act_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

// ─── Core capture loop ───────────────────────────────────
async function captureState(): Promise<void> {
  const app = await getFrontmostApp();
  if (!app) return;

  let title = "";
  let url = "";

  const browserApps = ["Google Chrome", "Safari", "Arc", "Microsoft Edge", "Brave Browser"];
  if (browserApps.includes(app)) {
    const info = await getBrowserInfo(app);
    url = info.url;
    title = info.title || "";
  } else {
    title = await getWindowTitle(app);
  }

  const stateKey = `${app}|${title}|${url}`;
  if (stateKey !== lastState) {
    const record: ActivityRecord = {
      id: genId(),
      ts: nowISO(),
      app,
      title,
      url: url || undefined,
      event: "state_change",
      platform: PLATFORM,
    };
    appendActivity(record);
    lastState = stateKey;
  }
}

async function tick(): Promise<void> {
  try {
    const idle = await getIdleSeconds();
    if (idle > AFK_THRESHOLD_SEC) {
      if (!wasAfk) {
        appendActivity({
          id: genId(),
          ts: nowISO(),
          app: "(AFK)",
          title: `空闲 ${Math.floor(idle / 60)} 分钟`,
          event: "afk_start",
          platform: PLATFORM,
        });
        wasAfk = true;
      }
      return;
    } else if (wasAfk) {
      appendActivity({
        id: genId(),
        ts: nowISO(),
        app: "(AFK)",
        title: "回到前台",
        event: "afk_end",
        platform: PLATFORM,
      });
      wasAfk = false;
    }

    const now = Date.now();
    if (now - lastCaptureTs >= DEDUP_WINDOW_MS) {
      await captureState();
      lastCaptureTs = now;
    }
  } catch {
    // silently ignore errors in poll loop
  }
}

// ─── Public API ──────────────────────────────────────────
export function startMacOSCollector(intervalMs: number): void {
  pollIntervalMs = intervalMs;
  if (timer) return;
  tick(); // immediate first capture
  timer = setInterval(tick, pollIntervalMs);
}

export function stopMacOSCollector(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function isMacOSCollectorRunning(): boolean {
  return timer !== null;
}
