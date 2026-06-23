import { loadConfig } from "../storage/jsonStore";

const API_URL = "https://api.deepseek.com/v1/chat/completions";

export async function generateAISummary(reportMarkdown: string): Promise<string> {
  const config = loadConfig();
  if (config.aiProvider !== "deepseek" || !config.deepseekKey) {
    return "";
  }

  const prompt = `你是一个工作助理。以下是一份工作日报/周报的原始数据（Markdown 格式），请用 2-3 句自然的中文总结今天的工作状态，语气温暖但克制，不要夸张。直接输出总结，不要前缀。\n\n${reportMarkdown}`;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.deepseekKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`DeepSeek API ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    // Log but don't throw — AI is optional
    console.error("[riji] AI summary failed:", err);
    return "";
  }
}
