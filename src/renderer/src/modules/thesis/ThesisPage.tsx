import { useEffect, useMemo, useState } from "react";
import type { Milestone, Submission, SubmissionLog, SubmissionStage, Task, ThesisChapter, ThesisLog, ThesisMeta, ThesisProject, Workspace } from "../../../../shared/types";
import { SectionTabs } from "../../components/SectionTabs";
import { CardHeader } from "../../components/CardHeader";
import { LoadingState } from "../../components/LoadingState";

function genId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function pad(n: number): string { return String(n).padStart(2, "0"); }
function todayStr(): string {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function minutesOf(logs: ThesisLog[]): number {
  return logs.reduce((sum, log) => sum + log.minutes, 0);
}
function wordsOf(logs: ThesisLog[]): number {
  return logs.reduce((sum, log) => sum + (log.words ?? 0), 0);
}

type Tab = "thesis" | "submission";

const THESIS_STAGES = ["选题", "开题", "初稿", "修改", "预答辩", "送审", "答辩", "定稿"];
const SUBMISSION_STAGES: SubmissionStage[] = ["选题中", "写作中", "待投稿", "已投稿", "审稿中", "返修中", "已接收", "已见刊/已收录", "搁置/拒稿"];
const STAGE_COLORS: Record<SubmissionStage, string> = {
  "选题中": "tag-todo",
  "写作中": "tag-todo",
  "待投稿": "tag-doing",
  "已投稿": "tag-doing",
  "审稿中": "tag-blocked",
  "返修中": "tag-blocked",
  "已接收": "tag-done",
  "已见刊/已收录": "tag-done",
  "搁置/拒稿": "tag-blocked",
};

export function ThesisPage({ tab }: { tab: Tab }) {
  return (
    <div className="thesis-page">
      {tab === "thesis" ? <ThesisPanel /> : <SubmissionPanel />}
    </div>
  );
}

function ThesisPanel() {
  const [theses, setTheses] = useState<ThesisProject[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState<"list" | "detail">("list");
  const [loaded, setLoaded] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const [showChapter, setShowChapter] = useState(false);
  const [showMilestone, setShowMilestone] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [feedback, setFeedback] = useState("");

  const [mTitle, setMTitle] = useState("");
  const [mField, setMField] = useState("");
  const [mStage, setMStage] = useState("");
  const [mTarget, setMTarget] = useState("");
  const [mNotes, setMNotes] = useState("");

  const [chTitle, setChTitle] = useState("");
  const [chStatus, setChStatus] = useState<ThesisChapter["status"]>("todo");
  const [chWords, setChWords] = useState(0);
  const [chProgress, setChProgress] = useState(0);

  const [msTitle, setMsTitle] = useState("");
  const [msDate, setMsDate] = useState("");

  const [logDate, setLogDate] = useState(todayStr());
  const [logType, setLogType] = useState("写作");
  const [logMinutes, setLogMinutes] = useState(60);
  const [logWords, setLogWords] = useState(0);
  const [logNote, setLogNote] = useState("");
  const [quickLog, setQuickLog] = useState("");

  function msg(value: string) {
    setFeedback(value);
    setTimeout(() => setFeedback(""), 2200);
  }

  function load(nextSelectedId?: string) {
    window.rijiAPI.getState().then((ws: Workspace) => {
      setTheses(ws.theses);
      const nextId = nextSelectedId || selectedId || ws.theses[0]?.id || "";
      setSelectedId(ws.theses.some((item) => item.id === nextId) ? nextId : ws.theses[0]?.id || "");
      if (ws.theses.length === 0) setShowCreate(true);
      setLoaded(true);
    });
  }

  useEffect(() => { load(); }, []);

  const selected = theses.find((item) => item.id === selectedId);
  const sortedTheses = useMemo(() => [...theses].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [theses]);
  function resetMetaForm(meta?: ThesisMeta) {
    setMTitle(meta?.title ?? "");
    setMField(meta?.field ?? "");
    setMStage(meta?.stage ?? "");
    setMTarget(meta?.targetDate ?? "");
    setMNotes(meta?.notes ?? "");
  }

  async function addThesis() {
    if (!mTitle.trim()) return;
    const now = new Date().toISOString();
    const thesis: ThesisProject = {
      id: genId("thesis_"),
      meta: { title: mTitle.trim(), field: mField || undefined, stage: mStage || undefined, targetDate: mTarget || undefined, notes: mNotes || undefined },
      chapters: [],
      milestones: [],
      logs: [],
      createdAt: now,
      updatedAt: now,
    };
    const res = await window.rijiAPI.addThesisProject(thesis);
    if (res.ok) {
      setShowCreate(false);
      resetMetaForm();
      setView("detail");
      load(thesis.id);
      msg("论文已新增");
    } else {
      msg("新增失败");
    }
  }

  async function saveMeta() {
    if (!selected) return;
    const meta: ThesisMeta = {
      ...selected.meta,
      title: mTitle.trim() || selected.meta.title,
      field: mField || undefined,
      stage: mStage || undefined,
      targetDate: mTarget || undefined,
      notes: mNotes || undefined,
    };
    await window.rijiAPI.updateThesisProjectMeta(selected.id, meta);
    setShowMeta(false);
    load(selected.id);
    msg("论文信息已保存");
  }

  async function deleteThesis() {
    if (!selected || theses.length <= 1) return;
    if (!confirm(`删除论文「${selected.meta.title || "未命名论文"}」？`)) return;
    const res = await window.rijiAPI.deleteThesisProject(selected.id);
    if (res.ok) {
      setView("list");
      load();
      msg("论文已删除");
    } else {
      msg("至少保留一篇论文");
    }
  }

  async function addChapter() {
    if (!selected || !chTitle.trim()) return;
    const chapter: ThesisChapter = { id: genId("ch_"), title: chTitle.trim(), status: chStatus, progress: chProgress, words: chWords || undefined, updatedAt: new Date().toISOString() };
    await window.rijiAPI.addThesisProjectChapter(selected.id, chapter);
    setChTitle("");
    setChWords(0);
    setChProgress(0);
    setShowChapter(false);
    load(selected.id);
    msg("章节已添加");
  }

  async function updateChapter(chapter: ThesisChapter, patch: Partial<ThesisChapter>) {
    if (!selected) return;
    await window.rijiAPI.updateThesisProjectChapter(selected.id, chapter.id, patch);
    load(selected.id);
  }

  async function deleteChapter(id: string) {
    if (!selected) return;
    await window.rijiAPI.deleteThesisProjectChapter(selected.id, id);
    load(selected.id);
    msg("章节已删除");
  }

  async function addMilestone() {
    if (!selected || !msTitle.trim()) return;
    await window.rijiAPI.addThesisProjectMilestone(selected.id, { id: genId("ms_"), title: msTitle.trim(), date: msDate || todayStr(), done: false });
    setMsTitle("");
    setMsDate("");
    setShowMilestone(false);
    load(selected.id);
    msg("里程碑已添加");
  }

  async function updateMilestone(milestone: Milestone, patch: Partial<Milestone>) {
    if (!selected) return;
    await window.rijiAPI.updateThesisProjectMilestone(selected.id, milestone.id, patch);
    load(selected.id);
  }

  async function deleteMilestone(id: string) {
    if (!selected) return;
    await window.rijiAPI.deleteThesisProjectMilestone(selected.id, id);
    load(selected.id);
    msg("里程碑已删除");
  }

  async function addLog(note = logNote, minutes = logMinutes, words = logWords) {
    if (!selected || !note.trim()) return;
    await window.rijiAPI.addThesisProjectLog(selected.id, {
      id: genId("thlog_"),
      date: logDate || todayStr(),
      type: logType,
      minutes,
      words: words || undefined,
      note: note.trim(),
      createdAt: new Date().toISOString(),
    });
    setLogNote("");
    setQuickLog("");
    setShowLog(false);
    load(selected.id);
    msg("推进日志已添加");
  }

  async function handleQuickLog() {
    if (!quickLog.trim()) return;
    const parts = quickLog.trim().split(/\s+/);
    let note = quickLog.trim();
    let minutes = 60;
    let words = 0;
    for (const part of [...parts]) {
      const minuteMatch = part.match(/^(\d+)\s*(?:min|m|分钟|分)$/i);
      const wordMatch = part.match(/^(\d+)\s*(?:字|words?|w)$/i);
      if (minuteMatch) {
        minutes = Number(minuteMatch[1]);
        note = note.replace(part, "").trim();
      }
      if (wordMatch) {
        words = Number(wordMatch[1]);
        note = note.replace(part, "").trim();
      }
    }
    await addLog(note, minutes, words);
  }

  async function genChapterTask(chapter: ThesisChapter) {
    await window.rijiAPI.addTask({ id: genId("task_"), title: `写 ${chapter.title}`, status: "todo", priority: "normal", source: "thesis", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Task);
    msg("已生成任务");
  }

  function openThesisDetail(id: string) {
    setSelectedId(id);
    setView("detail");
    setShowMeta(false);
    setShowChapter(false);
    setShowMilestone(false);
    setShowLog(false);
  }

  const createBox = (
    <div className="card library-create-card">
      <div className="card-title">{theses.length === 0 ? "新增第一篇论文" : "新增论文"}</div>
      <div className="library-create-form">
        <input className="form-input" value={mTitle} onChange={(e) => setMTitle(e.target.value)} placeholder="论文题目" autoFocus />
        <input className="form-input" value={mField} onChange={(e) => setMField(e.target.value)} placeholder="方向" />
        <select className="form-select" value={mStage} onChange={(e) => setMStage(e.target.value)}>
          <option value="">阶段</option>
          {THESIS_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
        </select>
        <input className="form-input" type="date" value={mTarget} onChange={(e) => setMTarget(e.target.value)} />
        <input className="form-input library-create-notes" value={mNotes} onChange={(e) => setMNotes(e.target.value)} placeholder="备注" />
        <button className="btn btn-primary" onClick={addThesis}>保存</button>
      </div>
    </div>
  );

  if (!loaded) {
    return <LoadingState label="正在加载论文列表…" rows={3} />;
  }

  if (theses.length === 0) {
    return <div className="library-empty">{createBox}</div>;
  }

  function thesisProgress(thesis?: ThesisProject) {
    const msDone = thesis?.milestones.filter((item) => item.done).length ?? 0;
    const milestoneRate = thesis && thesis.milestones.length > 0 ? msDone / thesis.milestones.length : 0;
    const chapterRate = thesis && thesis.chapters.length > 0 ? thesis.chapters.reduce((sum, item) => sum + item.progress, 0) / thesis.chapters.length / 100 : 0;
    return Math.round((milestoneRate * 0.4 + chapterRate * 0.6) * 100);
  }
  const overall = thesisProgress(selected);

  return (
    <div className="library-workspace">
      {view === "list" && (
        <>
          <div className="library-toolbar">
            <div>
              <strong>论文列表</strong>
              <span>{theses.length} 篇论文，点击进入详情</span>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => { resetMetaForm(); setShowCreate(!showCreate); }}>新增论文</button>
          </div>
          {showCreate && createBox}
        </>
      )}
      {feedback && <div className="settings-feedback">{feedback}</div>}

      {view === "list" ? (
        <section className="library-list-panel library-list-full">
          {sortedTheses.map((item) => {
            const progress = thesisProgress(item);
            return (
              <button key={item.id} className="library-row library-row-card" onClick={() => openThesisDetail(item.id)}>
                <span className="library-row-title">{item.meta.title || "未命名论文"}</span>
                <span>{item.meta.stage || "未设阶段"}</span>
                <span>{item.meta.targetDate ? `目标 ${item.meta.targetDate}` : `${item.chapters.length} 章`}</span>
                <span>{minutesOf(item.logs)} 分钟 · {progress}%</span>
              </button>
            );
          })}
        </section>
      ) : (
        <section className="library-detail-panel library-detail-full">
          {selected && (
            <>
              <div className="library-detail-head">
                <div>
                  <div className="library-kicker">论文详情</div>
                  <h3>{selected.meta.title || "未命名论文"}</h3>
                  <div className="library-meta-row">
                    {selected.meta.field && <span>{selected.meta.field}</span>}
                    {selected.meta.stage && <span className="tag tag-doing">{selected.meta.stage}</span>}
                    {selected.meta.targetDate && <span>目标 {selected.meta.targetDate}</span>}
                  </div>
                </div>
                <div className="library-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setView("list")}>返回列表</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { resetMetaForm(selected.meta); setShowMeta(!showMeta); }}>编辑信息</button>
                  {theses.length > 1 && <button className="btn btn-ghost btn-sm danger-text" onClick={deleteThesis}>删除</button>}
                </div>
              </div>

              <div className="library-stat-row">
                <div><strong>{overall}%</strong><span>综合进度</span></div>
                <div><strong>{selected.chapters.length}</strong><span>章节</span></div>
                <div><strong>{minutesOf(selected.logs)}</strong><span>分钟</span></div>
                <div><strong>{wordsOf(selected.logs)}</strong><span>字数</span></div>
              </div>

              {showMeta && (
                <div className="library-inline-form">
                  <input className="form-input" value={mTitle} onChange={(e) => setMTitle(e.target.value)} placeholder="论文题目" />
                  <input className="form-input" value={mField} onChange={(e) => setMField(e.target.value)} placeholder="方向" />
                  <select className="form-select" value={mStage} onChange={(e) => setMStage(e.target.value)}>
                    <option value="">阶段</option>
                    {THESIS_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                  </select>
                  <input className="form-input" type="date" value={mTarget} onChange={(e) => setMTarget(e.target.value)} />
                  <input className="form-input" value={mNotes} onChange={(e) => setMNotes(e.target.value)} placeholder="备注" />
                  <button className="btn btn-primary btn-sm" onClick={saveMeta}>保存</button>
                </div>
              )}

              <div className="card compact-card">
                <CardHeader title="记录论文进展" />
                <div className="flex-row" style={{ gap: 8 }}>
                  <input className="form-input" value={quickLog} onChange={(e) => setQuickLog(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleQuickLog()} placeholder="写结果部分 90min 800字" style={{ flex: 1 }} />
                  <button className="btn btn-primary" onClick={handleQuickLog}>记录</button>
                </div>
              </div>

              <div className="library-detail-grid">
                <section className="card compact-card">
                  <CardHeader
                    title="章节进度"
                    actions={<button className="btn btn-ghost btn-sm" onClick={() => setShowChapter(!showChapter)}>新增</button>}
                  />
                  {showChapter && (
                    <div className="library-mini-form">
                      <input className="form-input" value={chTitle} onChange={(e) => setChTitle(e.target.value)} placeholder="章节标题" />
                      <select className="form-select" value={chStatus} onChange={(e) => setChStatus(e.target.value as ThesisChapter["status"])}>
                        <option value="todo">待写</option><option value="drafting">起草中</option><option value="revising">修改中</option><option value="done">完成</option>
                      </select>
                      <input className="form-input" type="number" value={chWords || ""} onChange={(e) => setChWords(Number(e.target.value))} placeholder="字数" />
                      <input className="form-input" type="number" min={0} max={100} value={chProgress || ""} onChange={(e) => setChProgress(Number(e.target.value))} placeholder="进度" />
                      <button className="btn btn-primary btn-sm" onClick={addChapter}>保存</button>
                    </div>
                  )}
                  {selected.chapters.length === 0 ? <div className="list-empty">暂无章节</div> : selected.chapters.map((chapter) => (
                    <div key={chapter.id} className="library-item-row">
                      <div>
                        <strong>{chapter.title}</strong>
                        <span className="text-muted">{chapter.status} · {chapter.progress}%{chapter.words ? ` · ${chapter.words} 字` : ""}</span>
                      </div>
                      <div className="flex-row" style={{ gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => genChapterTask(chapter)}>任务</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => updateChapter(chapter, { status: chapter.status === "done" ? "drafting" : "done", progress: chapter.status === "done" ? chapter.progress : 100 })}>{chapter.status === "done" ? "撤回" : "完成"}</button>
                        <button className="btn btn-ghost btn-sm danger-text" onClick={() => deleteChapter(chapter.id)}>×</button>
                      </div>
                    </div>
                  ))}
                </section>

                <section className="card compact-card">
                  <CardHeader
                    title="里程碑"
                    actions={<button className="btn btn-ghost btn-sm" onClick={() => setShowMilestone(!showMilestone)}>新增</button>}
                  />
                  {showMilestone && (
                    <div className="library-mini-form">
                      <input className="form-input" value={msTitle} onChange={(e) => setMsTitle(e.target.value)} placeholder="里程碑" />
                      <input className="form-input" type="date" value={msDate} onChange={(e) => setMsDate(e.target.value)} />
                      <button className="btn btn-primary btn-sm" onClick={addMilestone}>保存</button>
                    </div>
                  )}
                  {selected.milestones.length === 0 ? <div className="list-empty">暂无里程碑</div> : selected.milestones.sort((a, b) => a.date.localeCompare(b.date)).map((milestone) => (
                    <div key={milestone.id} className="library-item-row">
                      <div>
                        <strong style={{ textDecoration: milestone.done ? "line-through" : "none", opacity: milestone.done ? 0.55 : 1 }}>{milestone.title}</strong>
                        <span className="text-muted">{milestone.date}</span>
                      </div>
                      <div className="flex-row" style={{ gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => updateMilestone(milestone, { done: !milestone.done })}>{milestone.done ? "撤回" : "完成"}</button>
                        <button className="btn btn-ghost btn-sm danger-text" onClick={() => deleteMilestone(milestone.id)}>×</button>
                      </div>
                    </div>
                  ))}
                </section>
              </div>

              <section className="card compact-card">
                <CardHeader
                  title="推进日志"
                  actions={<button className="btn btn-ghost btn-sm" onClick={() => setShowLog(!showLog)}>新增</button>}
                />
                {showLog && (
                  <div className="library-log-form">
                    <input className="form-input" type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
                    <select className="form-select" value={logType} onChange={(e) => setLogType(e.target.value)}>
                      <option value="写作">写作</option><option value="修改">修改</option><option value="阅读">阅读</option><option value="实验">实验</option><option value="讨论">讨论</option><option value="其他">其他</option>
                    </select>
                    <input className="form-input" type="number" value={logMinutes} onChange={(e) => setLogMinutes(Number(e.target.value))} placeholder="分钟" />
                    <input className="form-input" type="number" value={logWords || ""} onChange={(e) => setLogWords(Number(e.target.value))} placeholder="字数" />
                    <input className="form-input" value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="备注" />
                    <button className="btn btn-primary btn-sm" onClick={() => addLog()}>保存</button>
                  </div>
                )}
                {selected.logs.length === 0 ? <div className="list-empty">暂无推进记录</div> : selected.logs.slice(-12).reverse().map((log) => (
                  <div key={log.id} className="library-log-row">
                    <span>{log.date}</span>
                    <span className="tag tag-doing">{log.type}</span>
                    <strong>{log.note}</strong>
                    <span>{log.minutes} 分钟{log.words ? ` · ${log.words} 字` : ""}</span>
                  </div>
                ))}
              </section>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function SubmissionPanel() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState<"list" | "detail">("list");
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState("");

  const [sTitle, setSTitle] = useState("");
  const [sVenue, setSVenue] = useState("");
  const [sDeadline, setSDeadline] = useState("");
  const [sStage, setSStage] = useState<SubmissionStage>("写作中");
  const [sNotes, setSNotes] = useState("");

  const [logDate, setLogDate] = useState(todayStr());
  const [logType, setLogType] = useState("修改");
  const [logMinutes, setLogMinutes] = useState(30);
  const [logNote, setLogNote] = useState("");

  function msg(value: string) {
    setFeedback(value);
    setTimeout(() => setFeedback(""), 2200);
  }

  function load(nextSelectedId?: string) {
    window.rijiAPI.getState().then((ws: Workspace) => {
      setSubmissions(ws.submissions);
      const nextId = nextSelectedId || selectedId || ws.submissions[0]?.id || "";
      setSelectedId(ws.submissions.some((item) => item.id === nextId) ? nextId : ws.submissions[0]?.id || "");
      if (ws.submissions.length === 0) setShowForm(true);
      setLoaded(true);
    });
  }

  useEffect(() => { load(); }, []);

  const selected = submissions.find((item) => item.id === selectedId);
  const sortedSubmissions = useMemo(
    () => [...submissions].sort((a, b) => (a.deadline ?? "9999-99-99").localeCompare(b.deadline ?? "9999-99-99") || b.updatedAt.localeCompare(a.updatedAt)),
    [submissions],
  );
  function resetForm() {
    setSTitle("");
    setSVenue("");
    setSDeadline("");
    setSStage("写作中");
    setSNotes("");
  }

  async function addSubmission() {
    if (!sTitle.trim()) return;
    const submission: Submission = {
      id: genId("sub_"),
      title: sTitle.trim(),
      venue: sVenue.trim(),
      deadline: sDeadline || undefined,
      stage: sStage,
      notes: sNotes || undefined,
      logs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const res = await window.rijiAPI.addSubmission(submission);
    if (res.ok) {
      resetForm();
      setShowForm(false);
      setView("detail");
      load(submission.id);
      msg("投稿已添加");
    } else {
      msg("新增失败");
    }
  }

  async function updateSelected(patch: Partial<Submission>) {
    if (!selected) return;
    await window.rijiAPI.updateSubmission(selected.id, patch);
    load(selected.id);
  }

  async function deleteSubmission() {
    if (!selected) return;
    if (!confirm(`删除投稿「${selected.title}」？`)) return;
    await window.rijiAPI.deleteSubmission(selected.id);
    setView("list");
    load();
    msg("投稿已删除");
  }

  async function addLog() {
    if (!selected || !logNote.trim()) return;
    const log: SubmissionLog = {
      id: genId("sublog_"),
      date: logDate,
      type: logType,
      stage: selected.stage,
      minutes: logMinutes || undefined,
      note: logNote.trim(),
      createdAt: new Date().toISOString(),
    };
    await window.rijiAPI.addSubmissionLog(selected.id, log);
    setLogNote("");
    load(selected.id);
    msg("日志已添加");
  }

  async function exportSelected() {
    if (!selected) return;
    const res = await window.rijiAPI.exportSubmissionMd(selected.id);
    msg(res.ok ? `已导出: ${res.filePath.split("/").pop()}` : "导出失败");
  }

  function openSubmissionDetail(id: string) {
    setSelectedId(id);
    setView("detail");
  }

  const formBox = (
    <div className="card library-create-card">
      <div className="card-title">{submissions.length === 0 ? "新增第一条投稿" : "新增投稿"}</div>
      <div className="library-create-form">
        <input className="form-input" value={sTitle} onChange={(e) => setSTitle(e.target.value)} placeholder="论文标题" autoFocus />
        <input className="form-input" value={sVenue} onChange={(e) => setSVenue(e.target.value)} placeholder="期刊/会议" />
        <input className="form-input" type="date" value={sDeadline} onChange={(e) => setSDeadline(e.target.value)} />
        <select className="form-select" value={sStage} onChange={(e) => setSStage(e.target.value as SubmissionStage)}>
          {SUBMISSION_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
        </select>
        <input className="form-input library-create-notes" value={sNotes} onChange={(e) => setSNotes(e.target.value)} placeholder="备注" />
        <button className="btn btn-primary" onClick={addSubmission}>保存</button>
      </div>
    </div>
  );

  if (!loaded) {
    return <LoadingState label="正在加载投稿列表…" rows={3} />;
  }

  if (submissions.length === 0) {
    return <div className="library-empty">{formBox}</div>;
  }

  return (
    <div className="library-workspace">
      {view === "list" && (
        <>
          <div className="library-toolbar">
            <div>
              <strong>投稿列表</strong>
              <span>{submissions.length} 条投稿，点击进入详情</span>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>新增投稿</button>
          </div>
          {showForm && formBox}
        </>
      )}
      {feedback && <div className="settings-feedback">{feedback}</div>}

      {view === "list" ? (
        <section className="library-list-panel library-list-full">
          {sortedSubmissions.map((item) => (
            <button key={item.id} className="library-row library-row-card" onClick={() => openSubmissionDetail(item.id)}>
              <span className="library-row-title">{item.title}</span>
              <span>{item.venue || "未设期刊"}</span>
              <span>{item.deadline ? `截止 ${item.deadline}` : "无截止"}</span>
              <span>{item.stage} · {item.logs.length} 条日志</span>
            </button>
          ))}
        </section>
      ) : (
        <section className="library-detail-panel library-detail-full">
          {selected && (
            <>
              <div className="library-detail-head">
                <div>
                  <div className="library-kicker">投稿详情</div>
                  <h3>{selected.title}</h3>
                  <div className="library-meta-row">
                    <span className={`tag ${STAGE_COLORS[selected.stage]}`}>{selected.stage}</span>
                    {selected.venue && <span>{selected.venue}</span>}
                    {selected.deadline && <span>截止 {selected.deadline}</span>}
                  </div>
                </div>
                <div className="library-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setView("list")}>返回列表</button>
                  <button className="btn btn-ghost btn-sm" onClick={exportSelected}>导出</button>
                  <button className="btn btn-ghost btn-sm danger-text" onClick={deleteSubmission}>删除</button>
                </div>
              </div>

              {selected.notes && <div className="card compact-card text-muted">{selected.notes}</div>}

              <div className="card compact-card">
                <CardHeader title="阶段推进" />
                <SectionTabs<SubmissionStage>
                  value={selected.stage}
                  onChange={(stage) => updateSelected({ stage })}
                  size="sm"
                  className="submission-stage-row"
                  items={SUBMISSION_STAGES.map((stage) => ({ value: stage, label: stage }))}
                />
              </div>

              <section className="card compact-card">
                <CardHeader title="记录投稿动作" />
                <div className="submission-detail-form">
                  <input className="form-input" type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
                  <select className="form-select" value={logType} onChange={(e) => setLogType(e.target.value)}>
                    <option value="修改">修改</option><option value="提交">提交</option><option value="投稿材料">投稿材料</option><option value="审稿回复">审稿回复</option><option value="阶段推进">阶段推进</option><option value="其他">其他</option>
                  </select>
                  <input className="form-input" type="number" min={0} value={logMinutes} onChange={(e) => setLogMinutes(Number(e.target.value))} placeholder="分钟" />
                  <input className="form-input" value={logNote} onChange={(e) => setLogNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLog()} placeholder="补 cover letter 30min #Nature" />
                  <button className="btn btn-primary btn-sm" onClick={addLog}>添加</button>
                </div>
              </section>

              <section className="card compact-card">
                <CardHeader title="投稿日志" />
                {selected.logs.length === 0 ? <div className="list-empty">暂无日志</div> : selected.logs.slice(-16).reverse().map((log) => (
                  <div key={log.id} className="library-log-row">
                    <span>{log.date}</span>
                    <span className="tag tag-doing">{log.type}</span>
                    <strong>{log.note}</strong>
                    <span>{log.stage || selected.stage}{log.minutes ? ` · ${log.minutes} 分钟` : ""}</span>
                  </div>
                ))}
              </section>
            </>
          )}
        </section>
      )}
    </div>
  );
}
