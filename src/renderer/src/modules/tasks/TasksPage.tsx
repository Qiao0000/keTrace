import { useEffect, useState } from "react";
import type { Task, TaskStatus, TimeBlock, Project, Workspace } from "../../../../shared/types";

function genId(prefix: string): string { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function todayStr(): string { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso: string): string { return iso.slice(0, 10); }

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filterProject, setFilterProject] = useState("");
  const [quickInput, setQuickInput] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState("");

  // Full form state (shown when editing or clicking "更多")
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"normal" | "high" | "low">("normal");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState("");

  function loadAll() {
    window.rijiAPI.getState().then((ws: Workspace) => {
      setTasks(ws.tasks); setTimeBlocks(ws.timeBlocks); setProjects(ws.projects);
    });
  }
  useEffect(() => { loadAll(); }, []);

  function msg(s: string) { setFeedback(s); setTimeout(() => setFeedback(""), 2000); }

  // ─── Quick add (parses #project @date !priority) ─────────
  async function handleQuickAdd() {
    const input = quickInput.trim();
    if (!input) return;
    let text = input;
    let prio: typeof priority = "normal";
    let dd: string | undefined;
    let projName: string | undefined;

    const prioM = text.match(/!(\S+)/);
    if (prioM) { prio = prioM[1] === "高" || prioM[1] === "high" ? "high" : prioM[1] === "低" || prioM[1] === "low" ? "low" : "normal"; text = text.replace(prioM[0], "").trim(); }
    const dateM = text.match(/@(\S+)/);
    if (dateM) { const d = dateM[1]; if (d === "今天" || d === "today") dd = todayStr(); else if (d === "明天") { const t = new Date(); t.setDate(t.getDate() + 1); dd = t.toISOString().slice(0, 10); } else if (/^\d{4}-\d{2}-\d{2}$/.test(d)) dd = d; text = text.replace(dateM[0], "").trim(); }
    const projM = text.match(/#(\S+)/);
    if (projM) { projName = projM[1]; text = text.replace(projM[0], "").trim(); }

    if (!text) { setQuickInput(""); return; }

    let pid: string | undefined;
    if (projName) {
      const ws: Workspace = await window.rijiAPI.getState();
      let proj = ws.projects.find((p) => p.name === projName);
      if (!proj) { const r = await window.rijiAPI.addProject({ id: genId("proj_"), name: projName, createdAt: new Date().toISOString() }); if (r.ok) proj = r.project; }
      pid = proj?.id;
    }

    await window.rijiAPI.addTask({ id: genId("task_"), title: text, status: "todo", priority: prio, dueDate: dd, projectId: pid, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setQuickInput("");
    loadAll();
    const parts = ["已添加"];
    if (projName) parts.push(`「${projName}」`);
    msg(parts.join(" "));
  }

  // ─── Full form (for editing) ─────────────────────────────
  function startEdit(t: Task) { setTitle(t.title); setPriority(t.priority); setDueDate(t.dueDate ?? ""); setProjectId(t.projectId ?? ""); setEditId(t.id); setShowForm(true); }
  function resetForm() { setTitle(""); setPriority("normal"); setDueDate(""); setProjectId(""); setEditId(null); setShowForm(false); }

  async function handleSave() {
    if (!title.trim()) return;
    if (editId) {
      await window.rijiAPI.updateTask(editId, { title: title.trim(), priority, dueDate: dueDate || undefined, projectId: projectId || undefined, updatedAt: new Date().toISOString() });
    } else {
      await window.rijiAPI.addTask({ id: genId("task_"), title: title.trim(), status: "todo", priority, dueDate: dueDate || undefined, projectId: projectId || undefined, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    resetForm(); loadAll(); msg(editId ? "已更新" : "已添加");
  }

  // ─── Inline actions ──────────────────────────────────────
  async function toggleDone(t: Task) {
    const newStatus: TaskStatus = t.status === "done" ? "todo" : "done";
    await window.rijiAPI.updateTask(t.id, { status: newStatus, doneAt: newStatus === "done" ? new Date().toISOString() : undefined });
    loadAll();
  }

  async function scheduleBlock(t: Task, minutes: number) {
    const now = new Date();
    const startH = now.getHours() >= 9 && now.getHours() < 18 ? now.getHours() + 1 : 9;
    const start = `${String(Math.min(startH, 23)).padStart(2, "0")}:00`;
    const endH = startH + Math.floor(minutes / 60);
    const end = `${String(Math.min(endH, 23)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    await window.rijiAPI.addTimeBlock({ id: genId("tb_"), date: todayStr(), start, end, title: t.title, taskId: t.id, createdAt: new Date().toISOString() });
    loadAll(); msg(`已排 ${minutes} 分钟`);
  }

  async function handleDelete(id: string) { if (!confirm("确定删除？")) return; await window.rijiAPI.deleteTask(id); loadAll(); msg("已删除"); }

  async function handleDeleteBlock(id: string) { await window.rijiAPI.deleteTimeBlock(id); loadAll(); }

  // ─── Project ─────────────────────────────────────────────
  async function handleAddProject() {
    const name = prompt("项目名称：");
    if (!name?.trim()) return;
    await window.rijiAPI.addProject({ id: genId("proj_"), name: name.trim(), createdAt: new Date().toISOString() });
    loadAll(); msg("项目已添加");
  }

  // ─── Filter ──────────────────────────────────────────────
  const filtered = filterProject ? tasks.filter((t) => t.projectId === filterProject) : tasks;
  const todoTasks = filtered.filter((t) => t.status !== "done");
  const doneTasks = filtered.filter((t) => t.status === "done");
  const today = todayStr();
  const todayBlocks = timeBlocks.filter((b) => b.date === today);

  return (
    <div>
      {/* Quick add */}
      <div className="flex-row" style={{ marginBottom: 16, gap: 8 }}>
        <div style={{ flex: 1, display: "flex", gap: 0, alignItems: "stretch", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", height: 36, padding: "0 10px" }}>
          <input className="form-input" style={{ border: "none", background: "transparent", height: "auto", flex: 1, fontSize: 13 }} value={quickInput} onChange={(e) => setQuickInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()} placeholder="新增任务 #项目 @今天 !高" />
        </div>
        <button className="btn btn-primary" onClick={handleQuickAdd}>添加</button>
        <button className="btn btn-ghost" onClick={() => { resetForm(); setShowForm(!showForm); }}>{showForm ? "收起" : "详情"}</button>
        <select className="form-select" style={{ width: 130, height: 32 }} value={filterProject} onChange={(e) => { if (e.target.value === "__new__") handleAddProject(); else setFilterProject(e.target.value); }}>
          <option value="">全部项目</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value="__new__">+ 新建项目…</option>
        </select>
      </div>

      {feedback && <div className="text-muted" style={{ marginBottom: 8 }}>{feedback}</div>}

      {/* Full form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-title">{editId ? "编辑任务" : "新增任务（详情）"}</div>
          <div className="form-group"><label className="form-label">标题</label><input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
          <div className="flex-row" style={{ gap: 10 }}>
            <div className="form-group" style={{ flex: 1 }}><label className="form-label">优先级</label><select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}><option value="low">低</option><option value="normal">普通</option><option value="high">高</option></select></div>
            <div className="form-group" style={{ flex: 1 }}><label className="form-label">截止日期</label><input className="form-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div className="form-group" style={{ flex: 1 }}><label className="form-label">项目</label><select className="form-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">无</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          </div>
          <div className="flex-row"><button className="btn btn-primary" onClick={handleSave}>{editId ? "更新" : "保存"}</button><button className="btn btn-ghost" onClick={resetForm}>取消</button></div>
        </div>
      )}

      {/* Today blocks */}
      {todayBlocks.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 6, fontSize: 13 }}>今日时间块</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {todayBlocks.sort((a, b) => a.start.localeCompare(b.start)).map((tb) => (
              <div key={tb.id} className="flex-row" style={{ padding: "4px 8px", background: "var(--card)", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13, justifyContent: "space-between" }}>
                <div className="flex-row" style={{ gap: 8 }}>
                  <span className="text-muted">{tb.start}-{tb.end}</span>
                  <span>{tb.title}</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteBlock(tb.id)}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="card-title" style={{ marginBottom: 6, fontSize: 13 }}>待办 ({todoTasks.length})</div>
      {todoTasks.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">☑</div><div>暂无待办任务</div></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 20 }}>
          {todoTasks.map((t) => (
            <div key={t.id} className="flex-row" style={{ padding: "6px 10px", background: "var(--card)", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13, justifyContent: "space-between", gap: 8 }}>
              <div className="flex-row" style={{ gap: 6, flex: 1, minWidth: 0 }}>
                <input type="checkbox" checked={false} onChange={() => toggleDone(t)} title="完成" />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} onClick={() => startEdit(t)} title="点击编辑">{t.title}</span>
                {t.projectId && <span className="tag tag-todo" style={{ flexShrink: 0 }}>{projects.find((p) => p.id === t.projectId)?.name ?? t.projectId}</span>}
                {t.dueDate && <span className="text-muted" style={{ flexShrink: 0, color: new Date(t.dueDate) < new Date() ? "var(--red)" : undefined }}>{fmtDate(t.dueDate)}</span>}
                {t.priority === "high" && <span className="tag tag-blocked" style={{ flexShrink: 0 }}>高</span>}
              </div>
              <div className="flex-row" style={{ gap: 4, flexShrink: 0 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => scheduleBlock(t, 30)} title="排 30 分钟">30m</button>
                <button className="btn btn-ghost btn-sm" onClick={() => scheduleBlock(t, 60)} title="排 60 分钟">60m</button>
                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(t)}>编辑</button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(t.id)} style={{ color: "var(--red)" }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {doneTasks.length > 0 && (
        <>
          <div className="card-title" style={{ marginBottom: 6, fontSize: 13 }}>已完成 ({doneTasks.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {doneTasks.map((t) => (
              <div key={t.id} className="flex-row" style={{ padding: "4px 10px", fontSize: 13, opacity: 0.6, justifyContent: "space-between" }}>
                <div className="flex-row" style={{ gap: 6 }}>
                  <input type="checkbox" checked onChange={() => toggleDone(t)} />
                  <span style={{ textDecoration: "line-through" }}>{t.title}</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(t.id)}>×</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
