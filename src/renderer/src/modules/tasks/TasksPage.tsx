import { useEffect, useState } from "react";
import type { Task, TaskStatus, TaskPriority, TimeBlock, Project, Workspace } from "../../../../shared/types";

function genId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── Helpers ────────────────────────────────────────────
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showTimeForm, setShowTimeForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterProject, setFilterProject] = useState<string>("");

  // Task form
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState("");

  // Time form
  const [tbTitle, setTbTitle] = useState("");
  const [tbStart, setTbStart] = useState("09:00");
  const [tbEnd, setTbEnd] = useState("10:00");
  const [tbTaskId, setTbTaskId] = useState("");

  // Project form
  const [projName, setProjName] = useState("");
  const [feedback, setFeedback] = useState("");

  function loadAll() {
    window.rijiAPI.getState().then((ws: Workspace) => {
      setTasks(ws.tasks);
      setTimeBlocks(ws.timeBlocks);
      setProjects(ws.projects);
    });
  }

  useEffect(() => { loadAll(); }, []);

  const today = todayStr();
  const todayBlocks = timeBlocks.filter((b) => b.date === today);

  // ─── Task CRUD ─────────────────────────────────────────
  function resetTaskForm() {
    setTitle("");
    setPriority("normal");
    setDueDate("");
    setProjectId("");
    setEditId(null);
  }

  function startEdit(t: Task) {
    setTitle(t.title);
    setPriority(t.priority);
    setDueDate(t.dueDate ?? "");
    setProjectId(t.projectId ?? "");
    setEditId(t.id);
    setShowTaskForm(true);
  }

  async function handleSaveTask() {
    if (!title.trim()) return;
    if (editId) {
      const patch: Partial<Task> = {
        title: title.trim(),
        priority,
        dueDate: dueDate || undefined,
        projectId: projectId || undefined,
        updatedAt: new Date().toISOString(),
      };
      await window.rijiAPI.updateTask(editId, patch);
    } else {
      await window.rijiAPI.addTask({
        id: genId("task_"),
        title: title.trim(),
        status: "todo",
        priority,
        dueDate: dueDate || undefined,
        projectId: projectId || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    resetTaskForm();
    setShowTaskForm(false);
    setFeedback(editId ? "任务已更新" : "任务已添加");
    loadAll();
    setTimeout(() => setFeedback(""), 2000);
  }

  async function handleStatusChange(id: string, status: TaskStatus) {
    const patch: Partial<Task> = { status };
    if (status === "done") patch.doneAt = new Date().toISOString();
    await window.rijiAPI.updateTask(id, patch);
    loadAll();
  }

  async function handleDeleteTask(id: string) {
    if (!confirm("确定删除这个任务？")) return;
    await window.rijiAPI.deleteTask(id);
    loadAll();
    setFeedback("任务已删除");
    setTimeout(() => setFeedback(""), 2000);
  }

  // ─── TimeBlock CRUD ────────────────────────────────────
  function resetTimeForm() {
    setTbTitle("");
    setTbStart("09:00");
    setTbEnd("10:00");
    setTbTaskId("");
  }

  async function handleAddTimeBlock() {
    if (!tbTitle.trim()) return;
    await window.rijiAPI.addTimeBlock({
      id: genId("tb_"),
      date: today,
      start: tbStart,
      end: tbEnd,
      title: tbTitle.trim(),
      taskId: tbTaskId || undefined,
      createdAt: new Date().toISOString(),
    });
    resetTimeForm();
    setShowTimeForm(false);
    loadAll();
    setFeedback("时间块已添加");
    setTimeout(() => setFeedback(""), 2000);
  }

  async function handleDeleteTimeBlock(id: string) {
    await window.rijiAPI.deleteTimeBlock(id);
    loadAll();
  }

  // ─── Project CRUD ──────────────────────────────────────
  async function handleAddProject() {
    if (!projName.trim()) return;
    await window.rijiAPI.addProject({
      id: genId("proj_"),
      name: projName.trim(),
      createdAt: new Date().toISOString(),
    });
    setProjName("");
    setShowProjectForm(false);
    loadAll();
    setFeedback("项目已添加");
    setTimeout(() => setFeedback(""), 2000);
  }

  async function handleDeleteProject(id: string) {
    if (!confirm("确定删除这个项目？关联的任务不会被删除。")) return;
    await window.rijiAPI.deleteProject(id);
    loadAll();
  }

  // ─── Filtering ─────────────────────────────────────────
  const filteredTasks = filterProject
    ? tasks.filter((t) => t.projectId === filterProject)
    : tasks;
  const todoTasks = filteredTasks.filter((t) => t.status !== "done");
  const doneTasks = filteredTasks.filter((t) => t.status === "done");

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 16 }}>
        <div className="flex-row">
          <button className="btn btn-primary" onClick={() => { resetTaskForm(); setShowTaskForm(!showTaskForm); }}>
            + 新增任务
          </button>
          <button className="btn btn-ghost" onClick={() => setShowTimeForm(!showTimeForm)}>
            + 时间块
          </button>
          <button className="btn btn-ghost" onClick={() => setShowProjectForm(!showProjectForm)}>
            + 项目
          </button>
          {feedback && <span className="text-muted">{feedback}</span>}
        </div>
        <select className="form-select" style={{ width: 140 }} value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
          <option value="">全部项目</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Task form */}
      {showTaskForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">{editId ? "编辑任务" : "新增任务"}</div>
          <div className="form-group">
            <label className="form-label">任务标题</label>
            <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="输入任务名称" onKeyDown={(e) => e.key === "Enter" && handleSaveTask()} autoFocus />
          </div>
          <div className="flex-row" style={{ gap: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">优先级</label>
              <select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                <option value="low">低</option>
                <option value="normal">普通</option>
                <option value="high">高</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">截止日期</label>
              <input className="form-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">所属项目</label>
              <select className="form-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">无</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex-row">
            <button className="btn btn-primary" onClick={handleSaveTask}>{editId ? "更新" : "保存"}</button>
            <button className="btn btn-ghost" onClick={() => { setShowTaskForm(false); resetTaskForm(); }}>取消</button>
          </div>
        </div>
      )}

      {/* TimeBlock form */}
      {showTimeForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">添加时间块 — {today}</div>
          <div className="form-group">
            <label className="form-label">标题</label>
            <input className="form-input" value={tbTitle} onChange={(e) => setTbTitle(e.target.value)} placeholder="例如：写引言" autoFocus />
          </div>
          <div className="flex-row" style={{ gap: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">开始</label>
              <input className="form-input" type="time" value={tbStart} onChange={(e) => setTbStart(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">结束</label>
              <input className="form-input" type="time" value={tbEnd} onChange={(e) => setTbEnd(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">关联任务</label>
              <select className="form-select" value={tbTaskId} onChange={(e) => setTbTaskId(e.target.value)}>
                <option value="">无</option>
                {tasks.filter((t) => t.status !== "done").map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleAddTimeBlock}>保存</button>
        </div>
      )}

      {/* Project form */}
      {showProjectForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">新增项目</div>
          <div className="form-group">
            <label className="form-label">项目名称</label>
            <input className="form-input" value={projName} onChange={(e) => setProjName(e.target.value)} placeholder="例如：博士论文" onKeyDown={(e) => e.key === "Enter" && handleAddProject()} autoFocus />
          </div>
          <button className="btn btn-primary" onClick={handleAddProject}>保存</button>
        </div>
      )}

      {/* Time blocks for today */}
      {todayBlocks.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, color: "var(--text-sec)", marginBottom: 8 }}>今日时间块</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {todayBlocks.sort((a, b) => a.start.localeCompare(b.start)).map((tb) => {
              const linkedTask = tb.taskId ? tasks.find((t) => t.id === tb.taskId) : null;
              return (
                <div key={tb.id} className="card" style={{ borderLeft: "3px solid var(--accent)" }}>
                  <div className="flex-between">
                    <div>
                      <span className="text-muted" style={{ marginRight: 8 }}>{tb.start} - {tb.end}</span>
                      <strong>{tb.title}</strong>
                      {linkedTask && <span className="tag tag-doing" style={{ marginLeft: 6 }}>{linkedTask.title}</span>}
                    </div>
                    <button className="btn btn-ghost" onClick={() => handleDeleteTimeBlock(tb.id)}>删除</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, color: "var(--text-sec)", marginBottom: 8 }}>项目 ({projects.length})</h3>
          <div className="flex-row" style={{ flexWrap: "wrap", gap: 6 }}>
            {projects.map((p) => (
              <span key={p.id} className="tag" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                onClick={() => setFilterProject(filterProject === p.id ? "" : p.id)}>
                {p.name}
                {filterProject === p.id && " ✓"}
                <span style={{ marginLeft: 2, opacity: 0.5, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id); }}>×</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Task list */}
      <h3 style={{ fontSize: 14, color: "var(--text-sec)", marginBottom: 8 }}>待办 ({todoTasks.length})</h3>
      {todoTasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">☑</div>
          <div>暂无待办任务</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {todoTasks.map((t) => (
            <div key={t.id} className="card" style={{ cursor: "pointer" }} onClick={() => startEdit(t)}>
              <div className="flex-between">
                <div>
                  <span className={`tag tag-${t.status}`}>{t.status}</span>{" "}
                  <strong>{t.title}</strong>
                  {t.priority === "high" && <span className="tag tag-blocked" style={{ marginLeft: 4 }}>高</span>}
                  {t.dueDate && <span className="text-muted" style={{ marginLeft: 6 }}>截止 {fmtDate(t.dueDate)}</span>}
                  {t.projectId && (
                    <span className="tag" style={{ marginLeft: 6, background: "#e0e7ff", color: "#3730a3" }}>
                      {projects.find((p) => p.id === t.projectId)?.name ?? t.projectId}
                    </span>
                  )}
                </div>
                <div className="flex-row" onClick={(e) => e.stopPropagation()}>
                  <select className="form-select" style={{ width: 80 }} value={t.status} onChange={(e) => handleStatusChange(t.id, e.target.value as TaskStatus)}>
                    <option value="todo">待办</option>
                    <option value="doing">进行中</option>
                    <option value="done">完成</option>
                    <option value="blocked">阻塞</option>
                  </select>
                  <button className="btn btn-ghost" onClick={() => handleDeleteTask(t.id)}>删除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {doneTasks.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, color: "var(--text-sec)", marginBottom: 8 }}>已完成 ({doneTasks.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {doneTasks.map((t) => (
              <div key={t.id} className="card" style={{ opacity: 0.7 }}>
                <div className="flex-between">
                  <div>
                    <span className="tag tag-done">完成</span>{" "}
                    <span style={{ textDecoration: "line-through" }}>{t.title}</span>
                  </div>
                  <button className="btn btn-ghost" onClick={() => handleDeleteTask(t.id)}>删除</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
