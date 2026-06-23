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
const DEDUP_WINDOW_MS = 2_000;

// ─── PowerShell helper ───────────────────────────────────
/*
 * Uses Win32 API via PowerShell Add-Type to get:
 *   - Foreground window handle
 *   - Window title (GetWindowText)
 *   - Process ID (GetWindowThreadProcessId)
 *   - Process name (Get-Process)
 *
 * Returns "ProcessName|WindowTitle" or empty string on failure.
 */
const PS_SCRIPT = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class RijiWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@
$hwnd = [RijiWin]::GetForegroundWindow()
if ($hwnd -eq [IntPtr]::Zero) { exit 1 }
$sb = New-Object System.Text.StringBuilder(512)
[RijiWin]::GetWindowText($hwnd, $sb, 512) | Out-Null
$title = $sb.ToString()
$pid = 0
[RijiWin]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
if ($pid -eq 0) { exit 1 }
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
if (-not $proc) { exit 1 }
Write-Output "$($proc.ProcessName)|$title"
`;

async function psScript(): Promise<{ procName: string; title: string } | null> {
  return new Promise((resolve) => {
    const child = execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", PS_SCRIPT],
      { timeout: 8_000, windowsHide: true }
    );
    let stdout = "";
    child.stdout?.on("data", (d: string) => { stdout += d; });
    child.on("close", (code) => {
      if (code !== 0 || !stdout.trim()) {
        resolve(null);
        return;
      }
      const trimmed = stdout.trim();
      const pipeIdx = trimmed.indexOf("|");
      if (pipeIdx === -1) {
        resolve(null);
        return;
      }
      resolve({
        procName: trimmed.slice(0, pipeIdx),
        title: trimmed.slice(pipeIdx + 1),
      });
    });
    child.on("error", () => resolve(null));
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
async function tick(): Promise<void> {
  try {
    const info = await psScript();
    if (!info) return;

    const stateKey = `${info.procName}|${info.title}`;
    if (stateKey !== lastState) {
      const record: ActivityRecord = {
        id: genId(),
        ts: nowISO(),
        app: info.procName,
        title: info.title,
        event: "state_change",
        platform: PLATFORM,
      };
      appendActivity(record);
      lastState = stateKey;
    }
  } catch {
    // silently ignore
  }
}

// ─── Public API ──────────────────────────────────────────
export function startWindowsCollector(intervalMs: number): void {
  pollIntervalMs = intervalMs;
  if (timer) return;
  tick();
  timer = setInterval(tick, pollIntervalMs);
}

export function stopWindowsCollector(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function isWindowsCollectorRunning(): boolean {
  return timer !== null;
}
