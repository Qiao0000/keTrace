import { useEffect, useState } from "react";
import type { JournalTemplateType, ReportType } from "../../../../shared/types";

interface ReportFile {
  name: string;
  type: string;
  createdAt: string;
}

const TEMPLATE_LABELS: Record<JournalTemplateType, string> = {
  day: "日记",
  week: "周记",
  month: "月记",
  year: "年记",
};

export function ReportsPage() {
  const [generating, setGenerating] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [useAI, setUseAI] = useState(false);
  const [outputHtml, setOutputHtml] = useState("");
  const [outputMd, setOutputMd] = useState("");
  const [summary, setSummary] = useState("");
  const [filePath, setFilePath] = useState("");
  const [reports, setReports] = useState<ReportFile[]>([]);
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<JournalTemplateType | null>(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => { loadReports(); }, []);

  function loadReports() {
    window.rijiAPI.listReports().then(setReports);
  }

  async function handleGenerate(type: ReportType) {
    setGenerating(true);
    setOutputHtml("");
    setOutputMd("");
    setSummary("");
    setFilePath("");
    try {
      const res = await window.rijiAPI.generateReport(type, { useAI });
      setOutputHtml(res.html);
      setOutputMd(res.markdown);
      if (res.summary) setSummary(res.summary);
      setFilePath(res.filePath);
      setActiveReport(null);
      setActiveTemplate(null);
      setFeedback(`报告已保存`);
      setTimeout(() => setFeedback(""), 3000);
      loadReports();
    } catch (e) {
      setFeedback("生成失败: " + String(e));
      setTimeout(() => setFeedback(""), 3000);
    }
    setGenerating(false);
  }

  async function handleReadReport(name: string) {
    setActiveReport(name);
    setActiveTemplate(null);
    setOutputHtml("");
    setOutputMd("");
    setSummary("");
    try {
      const res = await window.rijiAPI.readReport(name);
      if (res.ok) {
        setOutputHtml(res.html);
        setOutputMd(res.markdown);
      } else {
        setFeedback(res.error || "读取失败");
        setTimeout(() => setFeedback(""), 3000);
      }
    } catch {
      setFeedback("读取失败");
      setTimeout(() => setFeedback(""), 3000);
    }
  }

  async function handleTemplate(type: JournalTemplateType) {
    setActiveTemplate(type);
    setActiveReport(null);
    setSummary("");
    setFilePath("");
    const res = await window.rijiAPI.generateTemplate(type);
    if (res.ok) {
      setOutputHtml(res.html);
      setOutputMd(res.markdown);
      setFeedback(`${TEMPLATE_LABELS[type]}模板已生成`);
    } else {
      setFeedback("模板生成失败");
    }
    setTimeout(() => setFeedback(""), 3000);
  }

  async function handleSaveTemplate() {
    if (!activeTemplate) return;
    const res = await window.rijiAPI.saveTemplate(activeTemplate, outputMd);
    if (res.ok) {
      setOutputHtml(res.html);
      setOutputMd(res.markdown);
      setFilePath(res.filePath);
      setFeedback("模板已保存");
      loadReports();
    } else {
      setFeedback("保存失败");
    }
    setTimeout(() => setFeedback(""), 3000);
  }

  return (
    <div style={{ display: "flex", gap: 18, height: "calc(100vh - 120px)" }}>
      {/* Left panel */}
      <div style={{ width: 240, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
        <div className="card" style={{ flexShrink: 0 }}>
          <div className="card-title">生成报告</div>
          <div className="flex-row" style={{ gap: 4, marginBottom: 10 }}>
            {(["daily", "weekly", "monthly"] as ReportType[]).map((t) => (
              <button key={t} className={`btn btn-sm ${reportType === t ? "btn-primary" : "btn-ghost"}`} onClick={() => setReportType(t)}>
                {t === "daily" ? "日报" : t === "weekly" ? "周报" : "月报"}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => handleGenerate(reportType)} disabled={generating} style={{ width: "100%", justifyContent: "center" }}>
            {generating ? "生成中…" : "生成报告"}
          </button>
          <div className="flex-row" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} id="useAI" />
            <label htmlFor="useAI" className="text-muted" style={{ cursor: "pointer", fontSize: 12 }}>AI 摘要</label>
          </div>
          {feedback && <div className="text-muted" style={{ marginTop: 6, fontSize: 12 }}>{feedback}</div>}
        </div>

        <div className="card" style={{ flexShrink: 0 }}>
          <div className="card-title">复盘模板</div>
          <div className="report-template-grid">
            {(Object.keys(TEMPLATE_LABELS) as JournalTemplateType[]).map((t) => (
              <button
                key={t}
                className={`btn btn-sm ${activeTemplate === t ? "btn-primary" : "btn-ghost"}`}
                onClick={() => handleTemplate(t)}
              >
                {TEMPLATE_LABELS[t]}
              </button>
            ))}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            disabled={!activeTemplate}
            onClick={handleSaveTemplate}
            style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
          >
            保存模板
          </button>
        </div>

        <div className="card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div className="card-title" style={{ flexShrink: 0 }}>历史报告 ({reports.length})</div>
          <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
            {reports.length === 0 ? (
              <div className="text-muted" style={{ fontSize: 13 }}>暂无</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {reports.map((r) => (
                  <div
                    key={r.name}
                    onClick={() => handleReadReport(r.name)}
                    style={{
                      padding: "5px 8px", borderRadius: 6, cursor: "pointer", fontSize: 12,
                      background: activeReport === r.name ? "var(--accent-bg)" : "transparent",
                      border: activeReport === r.name ? "1px solid var(--accent-border)" : "1px solid transparent",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    <span className={`tag tag-${r.type === "daily" ? "doing" : r.type === "weekly" ? "todo" : r.type === "journal" ? "done" : "blocked"}`} style={{ marginRight: 4 }}>
                      {r.type === "daily" ? "日" : r.type === "weekly" ? "周" : r.type === "journal" ? "记" : "月"}
                    </span>
                    {r.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Preview */}
      <div style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        {!outputHtml && !generating && !activeReport && (
          <div className="empty-state">
            <div className="empty-icon">▤</div>
            <div>生成报告或选择复盘模板</div>
            <div className="text-muted" style={{ marginTop: 4 }}>报告自动汇总数据，模板用于日、周、月、年复盘</div>
          </div>
        )}

        {summary && (
          <div className="card" style={{ marginBottom: 14, borderLeft: "3px solid var(--accent)" }}>
            <div className="card-title">AI 摘要</div>
            <div style={{ fontSize: 14, lineHeight: 1.7 }}>{summary}</div>
          </div>
        )}

        {outputHtml && (
          <div className="card">
            <div
              dangerouslySetInnerHTML={{ __html: outputHtml }}
              style={{ lineHeight: 1.8 }}
            />
          </div>
        )}

        {outputMd && !outputHtml && (
          <div className="card" style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: 13, lineHeight: 1.6 }}>
            {outputMd}
          </div>
        )}
      </div>
    </div>
  );
}
