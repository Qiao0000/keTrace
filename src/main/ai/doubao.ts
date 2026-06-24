import { loadConfig } from "../storage/jsonStore";
import type { AppDuration, ReportType } from "../../shared/types";

const API_URL = "https://ark.cn-beijing.volces.com/api/v3/responses";
const DEFAULT_TEXT_MODEL = "doubao-seed-1-6-flash-250828";
const DEFAULT_VISION_MODEL = "doubao-seed-1-6-vision-250815";

type ArkContent =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string };

type ArkInput = {
  role: "user";
  content: ArkContent[];
};

interface DoubaoCallResult {
  text: string;
  model: string;
  status: number;
  responsePreview: string;
}

function getArkKey(): string {
  const config = loadConfig();
  if (config.aiProvider !== "doubao") return "";
  return config.arkKey || process.env["ARK_API_KEY"] || "";
}

function collectText(value: unknown, out: string[]): void {
  if (!value) return;
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, out);
    return;
  }
  if (typeof value !== "object") return;

  const obj = value as Record<string, unknown>;
  if (typeof obj.text === "string") out.push(obj.text);
  if (typeof obj.output_text === "string") out.push(obj.output_text);
  if (typeof obj.content === "string") out.push(obj.content);
  if (Array.isArray(obj.content)) collectText(obj.content, out);
  if (Array.isArray(obj.output)) collectText(obj.output, out);
  if (Array.isArray(obj.choices)) collectText(obj.choices, out);
  if (obj.message) collectText(obj.message, out);
}

function extractArkText(data: unknown): string {
  const direct = data as { output_text?: unknown };
  if (typeof direct?.output_text === "string" && direct.output_text.trim()) {
    return direct.output_text.trim();
  }
  const parts: string[] = [];
  collectText(data, parts);
  return parts.join("\n").trim();
}

async function callDoubao(
  input: ArkInput[],
  options: { maxTokens: number; temperature: number; throwOnError?: boolean; model?: string },
): Promise<string> {
  const result = await callDoubaoWithMeta(input, options);
  return result.text;
}

async function callDoubaoWithMeta(
  input: ArkInput[],
  options: { maxTokens: number; temperature: number; throwOnError?: boolean; model?: string },
): Promise<DoubaoCallResult> {
  const apiKey = getArkKey();
  const model = options.model ?? DEFAULT_TEXT_MODEL;
  if (!apiKey) return { text: "", model, status: 0, responsePreview: "缺少 ARK_API_KEY" };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input,
        max_output_tokens: options.maxTokens,
        temperature: options.temperature,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Doubao API ${res.status}: ${body || res.statusText}`);
    }

    const data = await res.json();
    return {
      text: extractArkText(data),
      model,
      status: res.status,
      responsePreview: JSON.stringify(data).slice(0, 1000),
    };
  } catch (err) {
    if (options.throwOnError) throw err;
    console.error("[riji] Doubao request failed:", err);
    return {
      text: "",
      model,
      status: 0,
      responsePreview: err instanceof Error ? err.message : String(err),
    };
  }
}

async function callDoubaoText(prompt: string, maxTokens: number, temperature: number): Promise<string> {
  return callDoubao(
    [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
    { maxTokens, temperature },
  );
}

export async function generateReportNarrative(type: ReportType, reportMarkdown: string): Promise<string> {
  const label = type === "daily" ? "今日" : type === "weekly" ? "本周" : "本月";
  const focus = type === "daily"
    ? "今天做了什么、主要时间投入在哪里、明天最值得注意的一件事"
    : type === "weekly"
      ? "本周关键推进、时间结构、论文/投稿/任务的节奏、下周重点"
      : "本月主线、趋势变化、主要成果、风险和下月策略";
  const sentenceCount = type === "daily" ? "2-3" : type === "weekly" ? "3-4" : "4-5";
  const prompt = `你是刻迹 KeTrace 的本地工作复盘助手。下面是一份 ${label} Markdown 报告，请依据报告中的活动、任务、论文和投稿数据，写一段适合放在报告标题下方的“${label} AI 概括”。

要求：
1. 用 ${sentenceCount} 句自然中文概括，语气温暖、克制、直接。
2. 聚焦：${focus}。
3. 只能依据报告内容，不要编造不存在的项目、应用、任务、期刊或成果。
4. 不要使用 Markdown 标题、列表、前缀或客套话，直接输出正文。

报告内容：
${reportMarkdown}`;
  return callDoubaoText(prompt, type === "monthly" ? 520 : 420, 0.45);
}

export async function generateTodayActivityNarrative(input: {
  dateLabel: string;
  activityCount: number;
  activeMinutes: number;
  topApps: AppDuration[];
  recent: { time: string; app: string; title: string }[];
  tasks: { title: string; priority: string; bucket?: string; dueDate?: string }[];
  timeBlocks: { start: string; end: string; title: string }[];
}): Promise<string> {
  const prompt = `你是刻迹 KeTrace 的今日活动观察助手。请根据用户今天的本地活动监控、任务和日程，写一段适合放在今日页的小卡片文案。

要求：
1. 输出 1-2 句自然中文，温暖但直接。
2. 只依据输入数据，不要编造不存在的应用、项目、任务或成果。
3. 如果活动很少，就轻轻提示可以先写下今天第一件要推进的事。
4. 不要 Markdown、标题、列表或客套前缀。

数据：
${JSON.stringify(input, null, 2)}`;
  return callDoubaoText(prompt, 220, 0.35);
}

export async function generateDashboardNarrative(input: {
  rangeLabel: string;
  totalActivityMinutes: number;
  topApps: AppDuration[];
  taskStats: { total: number; done: number; rate: number; open: number };
  projects: { total: number; active: number; inbox: number; top?: { name: string; open: number; progress: number } };
  thesis: { active: number; minutes: number; words: number; top?: { title: string; progress: number; minutes: number } };
  submissions: { active: number; dueSoon?: { title: string; deadline: string } };
}): Promise<string> {
  const prompt = `你是刻迹 KeTrace 的数据看板总结助手。请根据下面的看板数据，为顶部看板写一段总结。

要求：
1. 输出 1-2 句自然中文，直接说重点。
2. 聚焦项目、任务、论文、投稿和活动投入之间的关系。
3. 只能依据输入数据，不要编造不存在的项目、论文、投稿、应用或成果。
4. 不要 Markdown、标题、列表或客套前缀。

数据：
${JSON.stringify(input, null, 2)}`;
  return callDoubaoText(prompt, 260, 0.35);
}

export interface VisionActivityEvent {
  title: string;
  category: string;
  tags: string[];
  confidence: number;
}

export interface VisionActivityResult {
  raw: string;
  event: VisionActivityEvent | null;
  model: string;
  status: number;
  responsePreview: string;
}

export const VISION_ACTIVITY_PROMPT = `你是刻迹 KeTrace 的屏幕活动识别器。请根据截图上半屏判断用户当前正在做什么，输出一个具体活动事件。

只能输出 JSON，不要 Markdown，不要解释：
{"title":"当前用户正在做的具体事件","category":"工作|学习|娱乐|沟通|写作|研究|开发|系统|休息|其他","tags":["标签1","标签2"],"confidence":0.0}

要求：
1. title 用一句中文概括具体事件，必须包含应用/页面/任务线索，不超过 50 个字。
2. category 必须从给定分类中选择一个。
3. tags 输出 2-5 个短标签，可包含应用、任务类型、内容主题。
4. 示例 title：当前用户正在用浏览器查看日报工具代码提交记录。
5. 如果截图信息不足，category 用“其他”，title 写“查看屏幕内容”，confidence 低于 0.45。
6. 不要输出截图中的隐私文本全文，只做任务级概括。`;

function parseVisionActivity(raw: string): VisionActivityEvent | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Partial<VisionActivityEvent>;
    const title = typeof parsed.title === "string" ? parsed.title.trim().slice(0, 50) : "";
    const category = typeof parsed.category === "string" ? parsed.category.trim().slice(0, 20) : "其他";
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim().slice(0, 16)).filter(Boolean).slice(0, 5)
      : [];
    const confidence = typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.5;
    if (!title) return null;
    return { title, category: category || "其他", tags, confidence };
  } catch {
    return null;
  }
}

async function requestVisionActivity(
  imageBase64: string,
  throwOnError = false,
): Promise<VisionActivityResult | null> {
  if (!imageBase64) return null;
  const input: ArkInput[] = [{
    role: "user",
    content: [
      { type: "input_image", image_url: `data:image/jpeg;base64,${imageBase64}` },
      { type: "input_text", text: VISION_ACTIVITY_PROMPT },
    ],
  }];
  const models = [DEFAULT_VISION_MODEL];
  let lastResult: VisionActivityResult | null = null;
  let lastError: unknown;

  for (const model of models) {
    try {
      const call = await callDoubaoWithMeta(input, {
        maxTokens: 220,
        temperature: 0.1,
        throwOnError: true,
        model,
      });
      const result: VisionActivityResult = {
        raw: call.text,
        event: parseVisionActivity(call.text),
        model: call.model,
        status: call.status,
        responsePreview: call.responsePreview,
      };
      lastResult = result;
      if (result.event) return result;
    } catch (err) {
      lastError = err;
      lastResult = {
        raw: "",
        event: null,
        model,
        status: 0,
        responsePreview: err instanceof Error ? err.message : String(err),
      };
    }
  }

  if (throwOnError && lastError && !lastResult) throw lastError;
  return lastResult;
}

export async function recognizeActivityFromScreenshot(imageBase64: string): Promise<VisionActivityEvent | null> {
  if (!imageBase64) return null;
  const result = await requestVisionActivity(imageBase64);
  return result?.event ?? null;
}

export async function recognizeActivityFromScreenshotStrict(imageBase64: string): Promise<VisionActivityEvent> {
  if (!imageBase64) throw new Error("截图为空");
  const result = await recognizeActivityFromScreenshotDetailed(imageBase64, true);
  const event = result.event;
  if (!event) throw new Error("豆包未返回可用活动事件");
  return event;
}

export async function recognizeActivityFromScreenshotDetailed(
  imageBase64: string,
  throwOnError = false,
): Promise<VisionActivityResult> {
  if (!imageBase64) throw new Error("截图为空");
  const result = await requestVisionActivity(imageBase64, throwOnError);
  if (!result?.event) {
    const detail = result?.raw.slice(0, 240) || result?.responsePreview.slice(0, 240) || "空响应";
    throw new Error(`豆包返回为空或不是合法 JSON（模型：${result?.model ?? "unknown"}）：${detail}`);
  }
  return result;
}

export async function parseQuickInputWithAI(input: string): Promise<string> {
  const text = input.trim();
  if (!text || text.length > 300) return "";
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const prompt = `你是刻迹 KeTrace 的快速输入解析器。把用户自然语言转换成一组可执行的快速输入命令。

只能输出 JSON，不要 Markdown，不要解释：
{"commands":["..."]}

可用命令格式：
- 任务：任务 标题 #项目 @今天|@明天|@后天 !高|!低
- 任务日期也可使用 @YYYY-MM-DD
- 项目：项目 项目名称
- 论文进展：论文 内容 60min 800字
- 投稿动作：投稿 内容 30min #期刊或投稿项目
- 新投稿：新投稿 论文标题 #期刊 @截止日期
- 报告：生成日报|生成周报|生成月报
- 模板：日复盘模板|周复盘模板|月复盘模板|年复盘模板
- 页面：打开今日|打开项目与任务|打开论文与投稿|打开报告与活动|打开数据看板|打开洞察分析|打开系统设置
- 系统：开始采集|停止采集|备份|打开数据|打开报告

规则：
1. 当前日期是 ${today}。可以把“下个月25号”“下周五”“7月25日”这类明确相对日期换算为 @YYYY-MM-DD。
2. 不确定时优先转成“任务 ...”。
3. 不要编造日期，只能使用用户明确提到的日期；“明天/后天/今天”可保留为 @明天/@后天/@今天。
4. 不要添加用户没说的项目、期刊、分钟或字数。
5. 如果用户同时描述“项目/目标 + 截止日期 + 当前正在做的内容”，返回两条命令：先“项目 项目名”，再“任务 当前内容 #项目名 @截止日期”。
6. 如果输入已经是可执行命令，commands 返回单条原命令。

示例：
用户：我现在在完成一个后期资助，截止在下个月25号，现在在进行第四章撰写等内容
输出：{"commands":["项目 后期资助","任务 第四章撰写 #后期资助 @YYYY-MM-DD"]}

用户输入：
${JSON.stringify(text)}`;

  const raw = await callDoubaoText(prompt, 220, 0.1);
  if (!raw) return "";

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return "";

  try {
    const parsed = JSON.parse(match[0]) as { command?: unknown; commands?: unknown };
    const commands = Array.isArray(parsed.commands)
      ? parsed.commands
      : typeof parsed.command === "string"
        ? [parsed.command]
        : [];
    return commands
      .filter((command): command is string => typeof command === "string")
      .map((command) => command.replace(/\s+/g, " ").trim().slice(0, 300))
      .filter(Boolean)
      .slice(0, 4)
      .join("\n");
  } catch {
    return "";
  }
}
