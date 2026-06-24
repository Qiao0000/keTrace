import { desktopCapturer, nativeImage, screen, systemPreferences } from "electron";
import { createHash } from "node:crypto";
import { readFileSync, unlinkSync } from "node:fs";
import { platform as getPlatform } from "node:os";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { recognizeActivityFromScreenshot, recognizeActivityFromScreenshotDetailed, VISION_ACTIVITY_PROMPT } from "../ai/doubao";
import { appendActivity, loadConfig } from "../storage/jsonStore";
import type { ActivityRecord, ScreenVisionTestResult } from "../../shared/types";

const PLATFORM = getPlatform();
const MAX_IMAGE_WIDTH = 1280;
const SCREENSHOT_QUALITY = 72;
const LOW_CONFIDENCE_THRESHOLD = 0.25;
const execFileAsync = promisify(execFile);

let pollIntervalMs = 120_000;
let timer: ReturnType<typeof setInterval> | null = null;
let lastState = "";
let lastImageHash = "";
let idCounter = 0;
let screenLocked = false;

function genId(): string {
  idCounter++;
  return `act_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function normalizeImageBase64(raw: string): string {
  return raw.replace(/^data:image\/\w+;base64,/, "");
}

function screenAccessStatus(): string {
  if (PLATFORM !== "darwin") return "not-required";
  try {
    return systemPreferences.getMediaAccessStatus("screen") ?? "unknown";
  } catch {
    return "unknown";
  }
}

function normalizeScreenshot(image: Electron.NativeImage): {
  imageBase64: string;
  imageBytes: number;
  imageHash: string;
  fullSize: { width: number; height: number };
  upperSize: { width: number; height: number };
} {
  if (image.isEmpty()) throw new Error("截图为空，请检查屏幕录制权限");
  const size = image.getSize();
  const upper = image.crop({
    x: 0,
    y: 0,
    width: size.width,
    height: Math.max(1, Math.floor(size.height / 2)),
  });
  const upperSize = upper.getSize();
  const resized = upperSize.width > MAX_IMAGE_WIDTH
    ? upper.resize({ width: MAX_IMAGE_WIDTH })
    : upper;
  const finalSize = resized.getSize();
  const buffer = resized.toJPEG(SCREENSHOT_QUALITY);
  const imageBase64 = buffer.toString("base64");
  return {
    imageBase64,
    imageBytes: buffer.byteLength,
    imageHash: createHash("sha1").update(imageBase64).digest("hex"),
    fullSize: size,
    upperSize: finalSize,
  };
}

async function captureWithDesktopCapturer(): Promise<{
  imageBase64: string;
  imageBytes: number;
  imageHash: string;
  method: string;
  fullSize: { width: number; height: number };
  upperSize: { width: number; height: number };
}> {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.size;
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.max(1, Math.round(width * display.scaleFactor)),
      height: Math.max(1, Math.round(height * display.scaleFactor)),
    },
  });
  const source = sources.find((item) => !item.thumbnail.isEmpty()) ?? sources[0];
  if (!source || source.thumbnail.isEmpty()) {
    throw new Error(`Electron 未获取到屏幕源（${sources.length} 个候选）。屏幕录制权限：${screenAccessStatus()}`);
  }
  return { ...normalizeScreenshot(source.thumbnail), method: "desktopCapturer" };
}

async function captureWithMacScreencapture(): Promise<{
  imageBase64: string;
  imageBytes: number;
  imageHash: string;
  method: string;
  fullSize: { width: number; height: number };
  upperSize: { width: number; height: number };
}> {
  const filePath = join(tmpdir(), `ketrace-screen-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
  try {
    await execFileAsync("/usr/sbin/screencapture", ["-x", "-t", "png", filePath], { timeout: 12_000 });
    const image = nativeImage.createFromBuffer(readFileSync(filePath));
    return { ...normalizeScreenshot(image), method: "screencapture" };
  } catch (err) {
    throw new Error(`macOS screencapture 失败：${err instanceof Error ? err.message : String(err)}。屏幕录制权限：${screenAccessStatus()}`);
  } finally {
    try { unlinkSync(filePath); } catch {}
  }
}

export async function captureUpperScreenBase64(): Promise<{
  imageBase64: string;
  imageBytes: number;
  imageHash: string;
  method: string;
  screenAccess: string;
  display: NonNullable<ScreenVisionTestResult["display"]>;
}> {
  const display = screen.getPrimaryDisplay();
  const access = screenAccessStatus();
  let captured: Awaited<ReturnType<typeof captureWithDesktopCapturer>>;
  try {
    captured = await captureWithDesktopCapturer();
  } catch (err) {
    if (PLATFORM !== "darwin") throw err;
    captured = await captureWithMacScreencapture();
  }
  return {
    imageBase64: captured.imageBase64,
    imageBytes: captured.imageBytes,
    imageHash: captured.imageHash,
    method: captured.method,
    screenAccess: access,
    display: {
      id: display.id,
      scaleFactor: display.scaleFactor,
      workAreaSize: display.workAreaSize,
      fullSize: captured.fullSize,
      upperSize: captured.upperSize,
    },
  };
}

function buildStateKey(record: Pick<ActivityRecord, "app" | "title" | "tags">): string {
  return `${record.app}|${record.title}|${(record.tags ?? []).join(",")}`;
}

function appendStateRecord(record: ActivityRecord): void {
  const stateKey = buildStateKey(record);
  if (stateKey === lastState) return;
  appendActivity(record);
  lastState = stateKey;
}

export function markScreenLocked(locked: boolean): void {
  screenLocked = locked;
  if (!locked) {
    lastImageHash = "";
    lastState = "";
    return;
  }

  appendStateRecord({
    id: genId(),
    ts: nowISO(),
    app: "锁屏",
    title: "屏幕锁定",
    event: "state_change",
    platform: PLATFORM,
    category: "锁屏",
    tags: ["锁屏", "系统"],
    confidence: 1,
    source: "system",
  });
  lastImageHash = "";
}

async function tick(): Promise<void> {
  try {
    if (screenLocked) return;
    const capture = await captureUpperScreenBase64();
    const imageBase64 = normalizeImageBase64(capture.imageBase64);
    if (!imageBase64) return;

    const imageHash = capture.imageHash;
    if (imageHash === lastImageHash) return;

    const event = await recognizeActivityFromScreenshot(imageBase64);
    if (!event || event.confidence < LOW_CONFIDENCE_THRESHOLD) {
      lastImageHash = imageHash;
      return;
    }

    const record: ActivityRecord = {
      id: genId(),
      ts: nowISO(),
      app: event.category || "其他",
      title: event.title || "查看屏幕内容",
      event: "state_change",
      platform: PLATFORM,
      category: event.category || "其他",
      tags: event.tags,
      confidence: event.confidence,
      source: "vision",
    };
    appendStateRecord(record);
    lastImageHash = imageHash;
  } catch (err) {
    console.error("[riji] screen vision collector failed:", err);
  }
}

export async function testScreenVisionCapture(): Promise<ScreenVisionTestResult> {
  const config = loadConfig();
  const hasArkKey = Boolean(config.arkKey || process.env["ARK_API_KEY"]);
  let stage: ScreenVisionTestResult["stage"] = "config";
  let captureInfo: Pick<ScreenVisionTestResult, "display" | "imageBytes" | "imageHash" | "captureMethod" | "screenAccess"> = {
    screenAccess: screenAccessStatus(),
  };
  let aiInfo: Pick<ScreenVisionTestResult, "aiModel" | "aiStatus" | "aiResponsePreview"> = {};
  const base: Omit<ScreenVisionTestResult, "ok" | "stage"> = {
    provider: config.aiProvider,
    hasArkKey,
    promptPreview: VISION_ACTIVITY_PROMPT,
  };

  try {
    if (config.aiProvider !== "doubao") {
      return { ...base, ok: false, stage: "config", error: "AI 服务未设置为豆包 Ark" };
    }
    if (!hasArkKey) {
      return { ...base, ok: false, stage: "config", error: "缺少 ARK_API_KEY，请在设置中填写豆包 Ark Key" };
    }

    stage = "capture";
    const capture = await captureUpperScreenBase64();
    captureInfo = {
      display: capture.display,
      imageBytes: capture.imageBytes,
      imageHash: capture.imageHash,
      captureMethod: capture.method,
      screenAccess: capture.screenAccess,
    };
    stage = "ai";
    const result = await recognizeActivityFromScreenshotDetailed(capture.imageBase64, true);
    aiInfo = {
      aiModel: result.model,
      aiStatus: result.status,
      aiResponsePreview: result.responsePreview,
    };
    return {
      ...base,
      ok: true,
      stage: "done",
      ...captureInfo,
      ...aiInfo,
      event: result.event ?? undefined,
    };
  } catch (err) {
    return {
      ...base,
      ...captureInfo,
      ...aiInfo,
      ok: false,
      stage,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function startScreenVisionCollector(intervalMs: number): void {
  pollIntervalMs = intervalMs;
  if (timer) return;
  tick();
  timer = setInterval(tick, pollIntervalMs);
}

export function stopScreenVisionCollector(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function isScreenVisionCollectorRunning(): boolean {
  return timer !== null;
}
