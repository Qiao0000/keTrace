import { useEffect, useState } from "react";
import type { JournalTemplateType, ReportType } from "../../../../shared/types";
import { ActivityPage } from "../activity/ActivityPage";
import { SectionTabs } from "../../components/SectionTabs";
import { EmptyState } from "../../components/EmptyState";
import { CardHeader } from "../../components/CardHeader";

interface ReportFile {
  name: string;
  type: string;
  createdAt: string;
}

const TEMPLATE_LABELS: Record<JournalTemplateType, string> = {
  day: "日复盘",
  week: "周复盘",
  month: "月复盘",
  year: "年复盘",
};

export function ReportsPage({ tab }: { tab: "reports" | "activity" }) {
  const [generating, setGenerating] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [useAI, setUseAI] = useState(false);
  const [outputHtml, setOutputHtml] = useState("");
  const [outputMd, setOutputMd] = useState("");
  const [filePath, setFilePath] = useState("");
  const [reports, setReports] = useState<ReportFile[]>([]);
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<JournalTemplateType | null>(null);
  const [templateEditing, setTemplateEditing] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => { loadReports(); }, []);

  function loadReports() {
    window.rijiAPI.listReports().then(setReports);
  }

  async function handleGenerate(type: ReportType) {
    setGenerating(true);
    setOutputHtml("");
    setOutputMd("");
    setFilePath("");
    try {
      const res = await window.rijiAPI.generateReport(type, { useAI });
      setOutputHtml(res.html);
      setOutputMd(res.markdown);
      setFilePath(res.filePath);
      setActiveReport(null);
      setActiveTemplate(null);
      setTemplateEditing(false);
      setFeedback(useAI && res.summary ? "报告已保存，AI 概括已写入正文" : "报告已保存");
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
    setTemplateEditing(false);
    setOutputHtml("");
    setOutputMd("");
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

  async function handleDeleteReport(name: string) {
    if (!confirm(`删除报告「${name}」？`)) return;
    const res = await window.rijiAPI.deleteReport(name);
    if (res.ok) {
      if (activeReport === name) {
        setActiveReport(null);
        setOutputHtml("");
        setOutputMd("");
      }
      setFeedback("报告已删除");
      loadReports();
    } else {
      setFeedback(res.error || "删除失败");
    }
    setTimeout(() => setFeedback(""), 3000);
  }

  async function handleTemplate(type: JournalTemplateType) {
    setActiveTemplate(type);
    setActiveReport(null);
    setTemplateEditing(false);
    setFilePath("");
    setFeedback("");
    const res = await window.rijiAPI.generateTemplate(type);
    if (res.ok) {
      setOutputHtml(res.html);
      setOutputMd(res.markdown);
    } else {
      setFeedback("模板生成失败");
      setTimeout(() => setFeedback(""), 3000);
    }
  }

  async function handleSaveTemplate() {
    if (!activeTemplate) return;
    const res = await window.rijiAPI.saveTemplate(activeTemplate, outputMd);
    if (res.ok) {
      setOutputHtml(res.html);
      setOutputMd(res.markdown);
      setFilePath(res.filePath);
      setTemplateEditing(false);
      setFeedback("模板已保存");
      loadReports();
    } else {
      setFeedback("保存失败");
    }
    setTimeout(() => setFeedback(""), 3000);
  }

  return (
    <div className="reports-shell">
      {tab === "activity" ? (
        <ActivityPage />
      ) : (
        <div className="reports-workspace">
          <div className="reports-sidebar">
            <div className="card report-generate-card">
              <CardHeader title="生成报告" />
              <div className="report-generate-tabs">
                <SectionTabs<ReportType>
                  value={reportType}
                  onChange={setReportType}
                  size="sm"
                  items={[
                    { value: "daily", label: "日报" },
                    { value: "weekly", label: "周报" },
                    { value: "monthly", label: "月报" },
                  ]}
                />
              </div>
              <button className="btn btn-primary report-generate-btn" onClick={() => handleGenerate(reportType)} disabled={generating}>
                {generating ? "生成中…" : "生成报告"}
              </button>
              <div className="flex-row report-generate-aibox">
                <input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} id="useAI" />
                <label htmlFor="useAI" className="text-muted report-generate-ailabel">AI 概括写入正文</label>
              </div>
              {feedback && <div className="text-muted report-generate-feedback">{feedback}</div>}
            </div>

            <div className="card report-template-card">
              <CardHeader title="复盘模板" />
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
              <div className="template-action-row">
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={!activeTemplate}
                  onClick={() => setTemplateEditing(true)}
                >
                  编辑
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={!activeTemplate}
                  onClick={handleSaveTemplate}
                >
                  保存模板
                </button>
              </div>
            </div>

            <div className="card reports-history-card">
              <CardHeader title={`历史报告 (${reports.length})`} />
              <div className="reports-history-list">
                {reports.length === 0 ? (
                  <div className="text-muted reports-history-empty">暂无</div>
                ) : (
                  <div className="reports-history-stack">
                    {reports.map((r) => (
                      <div key={r.name} className={`report-history-row ${activeReport === r.name ? "active" : ""}`}>
                        <button className="report-history-open" onClick={() => handleReadReport(r.name)}>
                          <span className={`tag tag-${r.type === "daily" ? "doing" : r.type === "weekly" ? "todo" : r.type === "journal" ? "done" : "blocked"}`}>
                            {r.type === "daily" ? "日" : r.type === "weekly" ? "周" : r.type === "journal" ? "记" : "月"}
                          </span>
                          <span>{r.name}</span>
                        </button>
                        <button className="report-history-delete" onClick={() => handleDeleteReport(r.name)} title="删除报告">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="reports-preview-pane">
            {!outputHtml && !generating && !activeReport && (
              <EmptyState
                icon="▤"
                title="生成报告或选择复盘模板"
                hint="报告自动汇总数据，模板用于日、周、月、年复盘"
              />
            )}

            {activeTemplate && templateEditing && (
              <div className="card report-editor-card">
                <textarea
                  className="report-template-editor"
                  value={outputMd}
                  onChange={(e) => {
                    setOutputMd(e.target.value);
                    setOutputHtml("");
                  }}
                  spellCheck={false}
                />
              </div>
            )}

            {outputHtml && !templateEditing && (
              <div className="card report-preview-card">
                <div dangerouslySetInnerHTML={{ __html: outputHtml }} />
              </div>
            )}

            {outputMd && !outputHtml && !templateEditing && (
              <div className="card report-markdown-preview">
                {outputMd}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
