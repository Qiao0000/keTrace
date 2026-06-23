import { useEffect, useState } from "react";
import type { Workspace, ThesisMeta, ThesisChapter, ThesisLog, Milestone, Submission, SubmissionLog, SubmissionStage, Task } from "../../../../shared/types";

function genId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function todayStr(): string { return new Date().toISOString().slice(0, 10); }

type Tab = "thesis" | "submission";

export function ThesisPage() {
  const [tab, setTab] = useState<Tab>("thesis");
  return (
    <div>
      <div className="flex-row" style={{ marginBottom: 16 }}>
        <button className={`btn ${tab === "thesis" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("thesis")}>论文</button>
        <button className={`btn ${tab === "submission" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("submission")}>投稿</button>
      </div>
      {tab === "thesis" ? <ThesisPanel /> : <SubmissionPanel />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Thesis Panel
// ═══════════════════════════════════════════════════════════

const THESIS_STAGES = ["选题", "开题", "初稿", "修改", "预答辩", "送审", "答辩", "定稿"];

function ThesisPanel() {
  const [meta, setMeta] = useState<ThesisMeta>({ title: "" });
  const [chapters, setChapters] = useState<ThesisChapter[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [logs, setLogs] = useState<ThesisLog[]>([]);
  const [showMeta, setShowMeta] = useState(false);
  const [showChapter, setShowChapter] = useState(false);
  const [showMilestone, setShowMilestone] = useState(false);
  const [showLog, setShowLog] = useState(false);

  // Meta form
  const [mTitle, setMTitle] = useState("");
  const [mField, setMField] = useState("");
  const [mStage, setMStage] = useState("");
  const [mTarget, setMTarget] = useState("");
  const [mNotes, setMNotes] = useState("");

  // Chapter form
  const [chTitle, setChTitle] = useState("");
  const [chStatus, setChStatus] = useState<"todo" | "drafting" | "revising" | "done">("todo");
  const [chWords, setChWords] = useState(0);
  const [chProgress, setChProgress] = useState(0);

  // Milestone form
  const [msTitle, setMsTitle] = useState("");
  const [msDate, setMsDate] = useState("");

  // Log form
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logType, setLogType] = useState("写作");
  const [logMinutes, setLogMinutes] = useState(60);
  const [logWords, setLogWords] = useState(0);
  const [logNote, setLogNote] = useState("");

  const [feedback, setFeedback] = useState("");

  function load() {
    window.rijiAPI.getState().then((ws: Workspace) => {
      setMeta(ws.thesis.meta);
      setChapters(ws.thesis.chapters);
      setMilestones(ws.thesis.milestones);
      setLogs(ws.thesis.logs);
    });
  }
  useEffect(() => { load(); }, []);

  function msg(s: string) { setFeedback(s); setTimeout(() => setFeedback(""), 2000); }

  // ── Meta ───────────────────────────────────────────────
  async function saveMeta() {
    const updated: ThesisMeta = { ...meta, title: mTitle || meta.title, field: mField || meta.field, stage: mStage || meta.stage, targetDate: mTarget || meta.targetDate, notes: mNotes || meta.notes };
    await window.rijiAPI.saveThesisMeta(updated);
    load(); setShowMeta(false); msg("论文信息已保存");
  }

  function startEditMeta() {
    setMTitle(meta.title); setMField(meta.field ?? ""); setMStage(meta.stage ?? "");
    setMTarget(meta.targetDate ?? ""); setMNotes(meta.notes ?? ""); setShowMeta(true);
  }

  // ── Chapters ───────────────────────────────────────────
  async function addChapter() {
    if (!chTitle.trim()) return;
    await window.rijiAPI.addThesisChapter({ id: genId("ch_"), title: chTitle.trim(), status: chStatus, progress: chProgress, words: chWords || undefined });
    setChTitle(""); setShowChapter(false); load(); msg("章节已添加");
  }

  async function toggleChapterDone(ch: ThesisChapter) {
    await window.rijiAPI.updateThesisChapter(ch.id, { status: ch.status === "done" ? "drafting" : "done", progress: ch.status === "done" ? ch.progress : 100 });
    load();
  }

  async function deleteChapter(id: string) {
    if (!confirm("删除这个章节？")) return;
    await window.rijiAPI.deleteThesisChapter(id);
    load(); msg("章节已删除");
  }

  async function logChapter(ch: ThesisChapter, minutes: number) {
    await window.rijiAPI.addThesisLog({ id: genId("thlog_"), date: todayStr(), type: "写作", minutes, note: `写 ${ch.title}`, createdAt: new Date().toISOString() });
    load(); msg(`已记录 ${minutes} 分钟`);
  }

  async function genChapterTask(ch: ThesisChapter) {
    await window.rijiAPI.addTask({ id: genId("task_"), title: `写 ${ch.title}`, status: "todo", priority: "normal", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Task);
    load(); msg("已生成任务");
  }

  // ── Milestones ─────────────────────────────────────────
  async function addMilestone() {
    if (!msTitle.trim()) return;
    await window.rijiAPI.addThesisMilestone({ id: genId("ms_"), title: msTitle.trim(), date: msDate || new Date().toISOString().slice(0, 10), done: false });
    setMsTitle(""); setMsDate(""); setShowMilestone(false); load(); msg("里程碑已添加");
  }

  async function toggleMilestone(m: Milestone) {
    await window.rijiAPI.updateThesisMilestone(m.id, { done: !m.done });
    load();
  }

  async function deleteMilestone(id: string) {
    await window.rijiAPI.deleteThesisMilestone(id);
    load(); msg("里程碑已删除");
  }

  // ── Logs ───────────────────────────────────────────────
  async function addLog() {
    if (!logNote.trim()) return;
    await window.rijiAPI.addThesisLog({ id: genId("thlog_"), date: logDate, type: logType, minutes: logMinutes, words: logWords || undefined, note: logNote.trim(), createdAt: new Date().toISOString() });
    setLogNote(""); setShowLog(false); load(); msg("推进日志已添加");
  }

  // ── Quick log ───────────────────────────────────────────
  const [quickLog, setQuickLog] = useState("");
  const [quickMinutes, setQuickMinutes] = useState(60);
  const [quickWords, setQuickWords] = useState(0);

  async function handleQuickLog() {
    if (!quickLog.trim()) return;
    const parts = quickLog.trim().split(/\s+/);
    let note = quickLog.trim();
    let minutes = quickMinutes;
    let words = quickWords;
    // Try to extract "90min" or "800字" from end
    const lastP = parts[parts.length - 1];
    const minM = lastP?.match(/^(\d+)min$/);
    const wordM = lastP?.match(/^(\d+)字$/);
    if (minM) { minutes = parseInt(minM[1]); parts.pop(); note = parts.join(" "); }
    else if (wordM) { words = parseInt(wordM[1]); parts.pop(); note = parts.join(" "); }
    if (!note) return;
    await window.rijiAPI.addThesisLog({ id: genId("thlog_"), date: todayStr(), type: "写作", minutes, words: words || undefined, note, createdAt: new Date().toISOString() });
    setQuickLog(""); load(); msg("进展已记录");
  }

  // ── Render ─────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Quick log */}
      <div className="card" style={{ borderLeft: "3px solid var(--accent)" }}>
        <div className="card-title">记录论文进展</div>
        <div className="flex-row" style={{ gap: 8 }}>
          <input className="form-input" value={quickLog} onChange={(e) => setQuickLog(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleQuickLog()} placeholder="写结果部分 90min 800字" style={{ flex: 1 }} />
          <input className="form-input" type="number" value={quickMinutes} onChange={(e) => setQuickMinutes(Number(e.target.value))} style={{ width: 70 }} placeholder="分钟" />
          <input className="form-input" type="number" value={quickWords} onChange={(e) => setQuickWords(Number(e.target.value))} style={{ width: 70 }} placeholder="字数" />
          <button className="btn btn-primary" onClick={handleQuickLog}>记录</button>
        </div>
      </div>

      {/* Meta */}
      <div className="card">
        <div className="flex-between">
          <div className="card-title" style={{ marginBottom: 0 }}>论文信息</div>
          <button className="btn btn-ghost" onClick={startEditMeta}>{meta.title ? "编辑" : "填写"}</button>
        </div>
        {meta.title ? (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            <div><strong>{meta.title}</strong></div>
            <div className="flex-row" style={{ gap: 12 }}>
              {meta.field && <span className="text-muted">方向: {meta.field}</span>}
              {meta.stage && <span className="tag tag-doing">{meta.stage}</span>}
              {meta.targetDate && <span className="text-muted">目标: {meta.targetDate}</span>}
            </div>
            {meta.notes && <div className="text-muted" style={{ fontSize: 13 }}>{meta.notes}</div>}
          </div>
        ) : (
          <div className="text-muted" style={{ marginTop: 4 }}>点击"填写"设置论文基本信息</div>
        )}
      </div>

      {showMeta && (
        <div className="card">
          <div className="card-title">编辑论文信息</div>
          <div className="form-group"><label className="form-label">题目</label><input className="form-input" value={mTitle} onChange={(e) => setMTitle(e.target.value)} placeholder="论文题目" autoFocus /></div>
          <div className="flex-row" style={{ gap: 12 }}>
            <div className="form-group" style={{ flex: 1 }}><label className="form-label">方向</label><input className="form-input" value={mField} onChange={(e) => setMField(e.target.value)} placeholder="研究方向" /></div>
            <div className="form-group" style={{ flex: 1 }}><label className="form-label">阶段</label><select className="form-select" value={mStage} onChange={(e) => setMStage(e.target.value)}>
              <option value="">选择阶段</option>
              {THESIS_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select></div>
          </div>
          <div className="form-group"><label className="form-label">目标日期</label><input className="form-input" type="date" value={mTarget} onChange={(e) => setMTarget(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">备注</label><input className="form-input" value={mNotes} onChange={(e) => setMNotes(e.target.value)} placeholder="补充说明" /></div>
          <button className="btn btn-primary" onClick={saveMeta}>保存</button>
        </div>
      )}

      {/* Milestones */}
      <div className="card">
        <div className="flex-between">
          <div className="card-title" style={{ marginBottom: 0 }}>里程碑 ({milestones.length})</div>
          <button className="btn btn-ghost" onClick={() => setShowMilestone(!showMilestone)}>+</button>
        </div>
        {milestones.length === 0 ? (
          <div className="text-muted" style={{ marginTop: 4 }}>暂无里程碑</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
            {milestones.sort((a, b) => a.date.localeCompare(b.date)).map((m) => (
              <div key={m.id} className="flex-between" style={{ padding: "2px 0" }}>
                <div className="flex-row">
                  <input type="checkbox" checked={m.done} onChange={() => toggleMilestone(m)} />
                  <span style={{ textDecoration: m.done ? "line-through" : "none", opacity: m.done ? 0.5 : 1 }}>{m.title}</span>
                  <span className="text-muted">{m.date}</span>
                </div>
                <button className="btn btn-ghost" onClick={() => deleteMilestone(m.id)} style={{ fontSize: 12 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showMilestone && (
        <div className="card">
          <div className="form-group"><label className="form-label">里程碑标题</label><input className="form-input" value={msTitle} onChange={(e) => setMsTitle(e.target.value)} placeholder="例如：完成初稿" autoFocus /></div>
          <div className="form-group"><label className="form-label">日期</label><input className="form-input" type="date" value={msDate} onChange={(e) => setMsDate(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={addMilestone}>保存</button>
        </div>
      )}

      {/* Chapters */}
      <div className="card">
        <div className="flex-between">
          <div className="card-title" style={{ marginBottom: 0 }}>章节进度 ({chapters.length})</div>
          <button className="btn btn-ghost" onClick={() => setShowChapter(!showChapter)}>+</button>
        </div>
        {chapters.length === 0 ? (
          <div className="text-muted" style={{ marginTop: 4 }}>暂无章节</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {chapters.map((ch) => (
              <div key={ch.id}>
                <div className="flex-between" style={{ marginBottom: 2 }}>
                  <div className="flex-row">
                    <span className={`tag tag-${ch.status === "done" ? "done" : ch.status === "drafting" ? "doing" : "todo"}`}>{ch.status}</span>
                    <span style={{ textDecoration: ch.status === "done" ? "line-through" : "none" }}>{ch.title}</span>
                    {ch.words ? <span className="text-muted">{ch.words} 字</span> : null}
                  </div>
                  <div className="flex-row" style={{ gap: 3 }}>
                    <span className="text-muted">{ch.progress}%</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => logChapter(ch, 30)} title="记录 30 分钟">30m</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => genChapterTask(ch)} title="生成任务">任务</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleChapterDone(ch)}>{ch.status === "done" ? "↩" : "✓"}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => deleteChapter(ch.id)} style={{ color: "var(--red)" }}>×</button>
                  </div>
                </div>
                <div style={{ background: "var(--border)", borderRadius: 4, height: 4, overflow: "hidden" }}>
                  <div style={{ width: `${ch.progress}%`, height: "100%", background: ch.status === "done" ? "#10b981" : "var(--accent)", borderRadius: 4, transition: "width 0.3s" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showChapter && (
        <div className="card">
          <div className="form-group"><label className="form-label">章节标题</label><input className="form-input" value={chTitle} onChange={(e) => setChTitle(e.target.value)} placeholder="例如：引言" autoFocus /></div>
          <div className="flex-row" style={{ gap: 12 }}>
            <div className="form-group" style={{ flex: 1 }}><label className="form-label">状态</label><select className="form-select" value={chStatus} onChange={(e) => setChStatus(e.target.value as typeof chStatus)}>
              <option value="todo">待写</option><option value="drafting">起草中</option><option value="revising">修改中</option><option value="done">完成</option>
            </select></div>
            <div className="form-group" style={{ flex: 1 }}><label className="form-label">字数</label><input className="form-input" type="number" value={chWords} onChange={(e) => setChWords(Number(e.target.value))} /></div>
            <div className="form-group" style={{ flex: 1 }}><label className="form-label">进度 %</label><input className="form-input" type="number" min={0} max={100} value={chProgress} onChange={(e) => setChProgress(Number(e.target.value))} /></div>
          </div>
          <button className="btn btn-primary" onClick={addChapter}>保存</button>
        </div>
      )}

      {/* Logs */}
      <div className="card">
        <div className="flex-between">
          <div className="card-title" style={{ marginBottom: 0 }}>推进日志 ({logs.length})</div>
          <button className="btn btn-ghost" onClick={() => setShowLog(!showLog)}>+</button>
        </div>
        {logs.length === 0 ? (
          <div className="text-muted" style={{ marginTop: 4 }}>暂无推进记录</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {logs.slice(-10).reverse().map((l) => (
              <div key={l.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                <div className="flex-between">
                  <div className="flex-row">
                    <span className="text-muted">{l.date}</span>
                    <span className="tag tag-doing">{l.type}</span>
                    <span>{l.note}</span>
                  </div>
                  <span className="text-muted">{l.minutes} 分钟 {l.words ? `· ${l.words} 字` : ""}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showLog && (
        <div className="card">
          <div className="flex-row" style={{ gap: 12, flexWrap: "wrap" }}>
            <div className="form-group" style={{ flex: 1, minWidth: 120 }}><label className="form-label">日期</label><input className="form-input" type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} /></div>
            <div className="form-group" style={{ flex: 1, minWidth: 100 }}><label className="form-label">类型</label><select className="form-select" value={logType} onChange={(e) => setLogType(e.target.value)}>
              <option value="写作">写作</option><option value="修改">修改</option><option value="阅读">阅读</option><option value="实验">实验</option><option value="讨论">讨论</option><option value="其他">其他</option>
            </select></div>
            <div className="form-group" style={{ flex: 1, minWidth: 80 }}><label className="form-label">分钟</label><input className="form-input" type="number" value={logMinutes} onChange={(e) => setLogMinutes(Number(e.target.value))} /></div>
            <div className="form-group" style={{ flex: 1, minWidth: 80 }}><label className="form-label">字数</label><input className="form-input" type="number" value={logWords} onChange={(e) => setLogWords(Number(e.target.value))} /></div>
          </div>
          <div className="form-group"><label className="form-label">备注</label><input className="form-input" value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="今天做了什么..." /></div>
          <button className="btn btn-primary" onClick={addLog}>保存</button>
        </div>
      )}

      {feedback && <div className="text-muted" style={{ textAlign: "center" }}>{feedback}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Submission Panel
// ═══════════════════════════════════════════════════════════

const SUBMISSION_STAGES: SubmissionStage[] = ["写作中", "待投稿", "已投稿", "审稿中", "返修中", "已接收", "搁置/拒稿"];
const STAGE_COLORS: Record<SubmissionStage, string> = {
  "写作中": "tag-todo", "待投稿": "tag-doing", "已投稿": "tag-doing",
  "审稿中": "tag-blocked", "返修中": "tag-blocked", "已接收": "tag-done", "搁置/拒稿": "tag-blocked",
};

function SubmissionPanel() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [viewLogId, setViewLogId] = useState<string | null>(null);

  // Form
  const [sTitle, setSTitle] = useState("");
  const [sVenue, setSVenue] = useState("");
  const [sDeadline, setSDeadline] = useState("");
  const [sStage, setSStage] = useState<SubmissionStage>("写作中");
  const [sNotes, setSNotes] = useState("");

  // Log form
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logType, setLogType] = useState("修改");
  const [logMinutes, setLogMinutes] = useState(30);
  const [logNote, setLogNote] = useState("");

  const [feedback, setFeedback] = useState("");

  function load() {
    window.rijiAPI.getState().then((ws: Workspace) => setSubmissions(ws.submissions));
  }
  useEffect(() => { load(); }, []);

  function msg(s: string) { setFeedback(s); setTimeout(() => setFeedback(""), 2000); }

  // ── Submission CRUD ────────────────────────────────────
  async function addSubmission() {
    if (!sTitle.trim()) return;
    await window.rijiAPI.addSubmission({
      id: genId("sub_"), title: sTitle.trim(), venue: sVenue.trim(), deadline: sDeadline || undefined,
      stage: sStage, notes: sNotes || undefined, logs: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    setSTitle(""); setSVenue(""); setSDeadline(""); setSNotes("");
    setShowForm(false); load(); msg("投稿已添加");
  }

  async function advanceStage(sub: Submission, newStage: SubmissionStage) {
    await window.rijiAPI.updateSubmission(sub.id, { stage: newStage });
    load(); msg(`已移至「${newStage}」`);
  }

  async function deleteSubmission(id: string) {
    if (!confirm("确定删除这个投稿？")) return;
    await window.rijiAPI.deleteSubmission(id);
    load(); msg("投稿已删除");
  }

  // ── Logs ───────────────────────────────────────────────
  async function addLog(subId: string) {
    if (!logNote.trim()) return;
    await window.rijiAPI.addSubmissionLog(subId, {
      id: genId("sublog_"), date: logDate, type: logType, minutes: logMinutes || undefined, note: logNote.trim(), createdAt: new Date().toISOString(),
    });
    setLogNote(""); load(); msg("日志已添加");
  }

  // ── Quick log ───────────────────────────────────────────
  const [quickSubLog, setQuickSubLog] = useState("");

  async function handleQuickSubLog() {
    if (!quickSubLog.trim()) return;
    // If no submissions, prompt to create one
    if (submissions.length === 0) { setFeedback("请先创建投稿项目"); setTimeout(() => setFeedback(""), 2000); return; }
    await window.rijiAPI.addSubmissionLog(submissions[0].id, { id: genId("sublog_"), date: todayStr(), type: "修改", note: quickSubLog.trim(), createdAt: new Date().toISOString() });
    setQuickSubLog(""); load(); msg("投稿进展已记录");
  }

  // ── Render: Kanban ─────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Quick log */}
      <div className="card" style={{ borderLeft: "3px solid var(--purple)" }}>
        <div className="card-title">记录投稿动作</div>
        <div className="flex-row" style={{ gap: 8 }}>
          <input className="form-input" value={quickSubLog} onChange={(e) => setQuickSubLog(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleQuickSubLog()} placeholder="补 cover letter 30min #Nature" style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={handleQuickSubLog}>记录</button>
        </div>
      </div>

      <div className="flex-between">
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ 新增投稿</button>
        {feedback && <span className="text-muted">{feedback}</span>}
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">新增投稿</div>
          <div className="form-group"><label className="form-label">标题</label><input className="form-input" value={sTitle} onChange={(e) => setSTitle(e.target.value)} placeholder="论文标题" autoFocus /></div>
          <div className="flex-row" style={{ gap: 12 }}>
            <div className="form-group" style={{ flex: 1 }}><label className="form-label">期刊/会议</label><input className="form-input" value={sVenue} onChange={(e) => setSVenue(e.target.value)} placeholder="例如：Nature" /></div>
            <div className="form-group" style={{ flex: 1 }}><label className="form-label">截止日期</label><input className="form-input" type="date" value={sDeadline} onChange={(e) => setSDeadline(e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label">阶段</label><select className="form-select" value={sStage} onChange={(e) => setSStage(e.target.value as SubmissionStage)}>
            {SUBMISSION_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select></div>
          <div className="form-group"><label className="form-label">备注</label><input className="form-input" value={sNotes} onChange={(e) => setSNotes(e.target.value)} placeholder="补充说明" /></div>
          <button className="btn btn-primary" onClick={addSubmission}>保存</button>
        </div>
      )}

      {submissions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">▤</div>
          <div>暂无投稿项目</div>
          <div className="text-muted" style={{ marginTop: 4 }}>添加投稿后可按阶段看板管理</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {submissions.map((sub) => (
            <div key={sub.id} className="card" style={{ borderTop: `3px solid var(--accent)` }}>
              <div className="flex-between" style={{ marginBottom: 6 }}>
                <strong style={{ fontSize: 14 }}>{sub.title}</strong>
                <button className="btn btn-ghost" onClick={() => deleteSubmission(sub.id)} style={{ fontSize: 12 }}>×</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                {sub.venue && <div className="text-muted">投稿: {sub.venue}</div>}
                {sub.deadline && <div className="text-muted">截止: {sub.deadline}</div>}
                <div className="flex-row" style={{ gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                  <span className={`tag ${STAGE_COLORS[sub.stage]}`}>{sub.stage}</span>
                </div>
                {sub.notes && <div className="text-muted">{sub.notes}</div>}

                {/* Stage advance */}
                <div className="flex-row" style={{ gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                  <span className="text-muted">推进:</span>
                  {SUBMISSION_STAGES.filter((s) => s !== sub.stage).slice(0, 4).map((s) => (
                    <button key={s} className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 6px" }} onClick={() => advanceStage(sub, s)}>{s}</button>
                  ))}
                </div>

                {/* Logs */}
                <div style={{ marginTop: 4 }}>
                  <div className="flex-between">
                    <span className="text-muted">日志 ({sub.logs.length})</span>
                    <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setViewLogId(viewLogId === sub.id ? null : sub.id)}>
                      {viewLogId === sub.id ? "收起" : "展开"}
                    </button>
                  </div>
                  {viewLogId === sub.id && (
                    <div style={{ marginTop: 4 }}>
                      {sub.logs.slice(-5).reverse().map((l) => (
                        <div key={l.id} style={{ padding: "2px 0", fontSize: 12 }}>
                          <span className="text-muted">{l.date}</span> {l.type} — {l.note} {l.minutes ? `(${l.minutes}分)` : ""}
                        </div>
                      ))}
                      <div className="flex-row" style={{ gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                        <input className="form-input" style={{ flex: 1, minWidth: 100, fontSize: 12, padding: "4px 6px" }} value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="日志备注" />
                        <select className="form-select" style={{ width: 70, fontSize: 12 }} value={logType} onChange={(e) => setLogType(e.target.value)}>
                          <option value="修改">修改</option><option value="提交">提交</option><option value="审稿回复">审稿回复</option><option value="其他">其他</option>
                        </select>
                        <input className="form-input" type="date" style={{ width: 120, fontSize: 12 }} value={logDate} onChange={(e) => setLogDate(e.target.value)} />
                        <button className="btn btn-primary" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => addLog(sub.id)}>+</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
