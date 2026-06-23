import { useEffect, useState } from "react";
import type { ReportType } from "../../../../shared/types";

interface ReportFile {
  name: string;
  type: string;
  createdAt: string;
}

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
      setFeedback(`报告已保存: ${res.filePath.split("/").pop()}`);
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
    setOutputHtml("");
    setOutputMd("");
    setSummary("");
    try {
      const res = await window.rijiAPI.readReport(name);
      if (res.ok) {
        setOutputHtml(res.html);
        setOutputMd(res.markdown);
      }
    } catch { setFeedback("读取失败"); }
  }

  return (
    <div style={{ display: "flex", gap: 20, height: "100%" }}>
      {/* Left: Controls + List */}
      <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="card">
          <div className="card-title">生成报告</div>
          <div className="flex-row" style={{ gap: 4, marginBottom: 10 }}>
            {(["daily", "weekly", "monthly"] as ReportType[]).map((t) => (
              <button key={t} className={`btn btn-sm ${reportType === t ? "btn-primary" : "btn-ghost"}`} onClick={() => setReportType(t)}>
                {t === "daily" ? "日报" : t === "weekly" ? "周报" : "月报"}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => handleGenerate(reportType)} disabled={generating} style={{ width: "100%", justifyContent: "center" }}>
            {generating ? "生成中…" : `生成${reportType === "daily" ? "日报" : reportType === "weekly" ? "周报" : "月报"}`}
          </button>
          <div className="flex-row" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} id="useAI" />
            <label htmlFor="useAI" className="text-muted" style={{ cursor: "pointer", fontSize: 12 }}>AI 摘要</label>
          </div>
          {feedback && <div className="text-muted" style={{ marginTop: 4, fontSize: 12 }}>{feedback}</div>}
        </div>

        <div className="card" style={{ flex: 1, overflow: "auto" }}>
          <div className="card-title">历史报告 ({reports.length})</div>
          {reports.length === 0 ? (
            <div className="text-muted" style={{ fontSize: 13 }}>暂无已保存的报告</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {reports.map((r) => (
                <div
                  key={r.name}
                  onClick={() => handleReadReport(r.name)}
                  className="flex-between"
                  style={{
                    padding: "4px 6px",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 13,
                    background: activeReport === r.name ? "var(--border)" : "transparent",
                  }}
                >
                  <div>
                    <span className={`tag tag-${r.type === "daily" ? "doing" : r.type === "weekly" ? "todo" : "blocked"}`} style={{ marginRight: 4 }}>
                      {r.type === "daily" ? "日" : r.type === "weekly" ? "周" : "月"}
                    </span>
                    {r.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Preview */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {!outputHtml && !generating && !activeReport && (
          <div className="empty-state">
            <div className="empty-icon">▤</div>
            <div>生成或选择一份报告来预览</div>
            <div className="text-muted" style={{ marginTop: 4 }}>报告基于活动记录、任务和论文数据自动生成</div>
          </div>
        )}

        {summary && (
          <div className="card" style={{ marginBottom: 16, borderLeft: "3px solid var(--accent)" }}>
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
