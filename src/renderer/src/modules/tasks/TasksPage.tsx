import { useEffect, useMemo, useState } from "react";
import type { Project, Task, TaskStatus, TimeBlock, Workspace } from "../../../../shared/types";
import { QuickCaptureBar } from "../../components/QuickCaptureBar";
import { EmptyState } from "../../components/EmptyState";

function genId(prefix: string): string { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function pad(n: number): string { return String(n).padStart(2, "0"); }
function localDateStr(date = new Date()): string { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function todayStr(): string { return localDateStr(); }

const PROJECT_COLORS = ["#ff8c42", "#43aa8b", "#f48c6e", "#4d9de0", "#9b5de5", "#45495f"];
const BUCKET_LABEL = { must: "Must", should: "Should", could: "Could", "": "未分类" } as const;
const BUCKET_RANK = { must: 0, should: 1, could: 2, "": 3 } as const;
const PRIORITY_RANK = { high: 0, normal: 1, low: 2 } as const;
type TasksTab = "projects" | "tasks";
type ProjectView = "list" | "detail";

export function TasksPage({ tab }: { tab: TasksTab }) {
  const [projectView, setProjectView] = useState<ProjectView>("list");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("__all__");
  const [feedback, setFeedback] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"normal" | "high" | "low">("normal");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState("");
  const [todayBucket, setTodayBucket] = useState<"" | "must" | "should" | "could">("");

  function loadAll() {
    window.rijiAPI.getState().then((ws: Workspace) => {
      setTasks(ws.tasks);
      setTimeBlocks(ws.timeBlocks);
      setProjects(ws.projects);
    });
  }

  useEffect(() => { loadAll(); }, []);
  useEffect(() => {
    if (tab === "tasks") {
      setSelectedProjectId("__all__");
    } else {
      setProjectView("list");
    }
    setShowForm(false);
    setEditId(null);
  }, [tab]);

  function msg(s: string) { setFeedback(s); setTimeout(() => setFeedback(""), 2000); }

  const projectStats = useMemo(() => {
    const base = projects.map((project) => {
      const related = tasks.filter((task) => task.projectId === project.id);
      const open = related.filter((task) => task.status !== "done");
      const done = related.filter((task) => task.status === "done");
      const due = open
        .map((task) => task.dueDate)
        .filter((date): date is string => Boolean(date))
        .sort()[0];
      return { project, total: related.length, open: open.length, done: done.length, due };
    });
    const inbox = tasks.filter((task) => !task.projectId);
    return [
      {
        project: { id: "__all__", name: "全部项目", color: "#4d9de0", createdAt: "" },
        total: tasks.length,
        open: tasks.filter((task) => task.status !== "done").length,
        done: tasks.filter((task) => task.status === "done").length,
        due: undefined,
      },
      ...base.sort((a, b) => b.open - a.open || a.project.name.localeCompare(b.project.name, "zh-CN")),
      {
        project: { id: "__inbox__", name: "未归项目", color: "#8a8fa6", createdAt: "" },
        total: inbox.length,
        open: inbox.filter((task) => task.status !== "done").length,
        done: inbox.filter((task) => task.status === "done").length,
        due: inbox.map((task) => task.dueDate).filter((date): date is string => Boolean(date)).sort()[0],
      },
    ];
  }, [projects, tasks]);

  const selectedStats = projectStats.find((item) => item.project.id === selectedProjectId) ?? projectStats[0];
  const projectNameById = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const visibleTasks = tasks
    .filter((task) => {
      if (selectedProjectId === "__all__") return true;
      if (selectedProjectId === "__inbox__") return !task.projectId;
      return task.projectId === selectedProjectId;
    })
    .sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (a.status !== "done" && b.status === "done") return -1;
      const bucketDiff = BUCKET_RANK[a.todayBucket ?? ""] - BUCKET_RANK[b.todayBucket ?? ""];
      if (bucketDiff !== 0) return bucketDiff;
      const dueDiff = (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99");
      if (dueDiff !== 0) return dueDiff;
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    });
  const openTasks = visibleTasks.filter((task) => task.status !== "done");
  const doneTasks = visibleTasks.filter((task) => task.status === "done");
  const todayBlocks = timeBlocks.filter((block) => block.date === todayStr());

  function resetForm() {
    setTitle("");
    setPriority("normal");
    setDueDate("");
    setProjectId(selectedProjectId === "__all__" || selectedProjectId === "__inbox__" ? "" : selectedProjectId);
    setTodayBucket("");
    setEditId(null);
    setShowForm(false);
  }

  function startAddTask() {
    resetForm();
    setProjectId(selectedProjectId === "__all__" || selectedProjectId === "__inbox__" ? "" : selectedProjectId);
    setShowForm(true);
  }

  function startEdit(task: Task) {
    setTitle(task.title);
    setPriority(task.priority);
    setDueDate(task.dueDate ?? "");
    setProjectId(task.projectId ?? "");
    setTodayBucket(task.todayBucket ?? "");
    setEditId(task.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!title.trim()) return;
    const base = {
      title: title.trim(),
      priority,
      dueDate: dueDate || undefined,
      projectId: projectId || undefined,
      todayBucket: todayBucket || undefined,
      updatedAt: new Date().toISOString(),
    };
    if (editId) {
      await window.rijiAPI.updateTask(editId, base);
      msg("已更新任务");
    } else {
      await window.rijiAPI.addTask({ id: genId("task_"), status: "todo", ...base, createdAt: new Date().toISOString() });
      msg("已添加任务");
    }
    resetForm();
    loadAll();
  }

  async function renameProject(project: Project) {
    const name = prompt("项目名称", project.name)?.trim();
    if (!name) return;
    await window.rijiAPI.updateProject(project.id, { name });
    loadAll();
    msg("项目已重命名");
  }

  async function setProjectColor(project: Project, color: string) {
    await window.rijiAPI.updateProject(project.id, { color });
    loadAll();
  }

  async function deleteProject(project: Project) {
    const count = tasks.filter((task) => task.projectId === project.id).length;
    if (!confirm(`删除项目「${project.name}」？${count > 0 ? ` ${count} 个任务会移出该项目。` : ""}`)) return;
    await window.rijiAPI.deleteProject(project.id);
    setSelectedProjectId("__all__");
    setProjectView("list");
    loadAll();
    msg("项目已删除");
  }

  function openProjectDetail(id: string) {
    setSelectedProjectId(id);
    setProjectView("detail");
    setShowForm(false);
    setEditId(null);
  }

  async function toggleDone(task: Task) {
    const status: TaskStatus = task.status === "done" ? "todo" : "done";
    await window.rijiAPI.updateTask(task.id, { status, doneAt: status === "done" ? new Date().toISOString() : undefined });
    loadAll();
  }

  async function deleteTask(id: string) {
    if (!confirm("确定删除这个任务？")) return;
    await window.rijiAPI.deleteTask(id);
    loadAll();
    msg("任务已删除");
  }

  async function deleteBlock(id: string) {
    await window.rijiAPI.deleteTimeBlock(id);
    loadAll();
  }

  const selectedIsRealProject = selectedProjectId !== "__all__" && selectedProjectId !== "__inbox__";
  const selectedProject = selectedIsRealProject ? projects.find((project) => project.id === selectedProjectId) : undefined;
  const realProjectStats = projectStats.filter((item) => item.project.id !== "__all__" && item.project.id !== "__inbox__");
  const isProjectDetailPage = tab === "projects" && projectView === "detail";

  return (
    <div className="tasks-workspace">
      {tab === "tasks" ? (
        <>
          <QuickCaptureBar onCaptured={loadAll} />

          {feedback && <div className="settings-feedback">{feedback}</div>}

          {showForm && (
            <div className="project-task-form task-inline-form">
              <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="任务标题" autoFocus />
              <select className="form-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">未归项目</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              <select className="form-select" value={todayBucket} onChange={(e) => setTodayBucket(e.target.value as typeof todayBucket)}>
                <option value="">未分类</option><option value="must">Must</option><option value="should">Should</option><option value="could">Could</option>
              </select>
              <select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
                <option value="normal">普通</option><option value="high">高</option><option value="low">低</option>
              </select>
              <input className="form-input date-icon-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="截止日期" title="截止日期" />
              <button className="btn btn-primary btn-sm" onClick={handleSave}>{editId ? "保存" : "添加"}</button>
              <button className="btn btn-ghost btn-sm" onClick={resetForm}>取消</button>
            </div>
          )}

          <section className="task-list-flat">
            {openTasks.length === 0 && doneTasks.length === 0 ? (
              <EmptyState icon="☑" title="还没有任务" hint="用上方快速输入创建任务" />
            ) : (
              <div className="task-row-list">
                {openTasks.map((task) => (
                  <div key={task.id} className="task-row-card">
                    <input type="checkbox" checked={false} onChange={() => toggleDone(task)} />
                    <div className="task-row-main">
                      <strong onClick={() => startEdit(task)}>{task.title}</strong>
                      <span>
                        {task.projectId ? projectNameById.get(task.projectId) ?? "未知项目" : "未归项目"}
                        {task.todayBucket ? ` · ${BUCKET_LABEL[task.todayBucket]}` : " · 未分类"}
                        {task.dueDate ? ` · 截止 ${task.dueDate}` : ""}
                      </span>
                    </div>
                    <span className={`tag tag-${task.todayBucket === "must" ? "blocked" : task.todayBucket === "should" ? "doing" : task.todayBucket === "could" ? "todo" : "done"}`}>
                      {BUCKET_LABEL[task.todayBucket ?? ""]}
                    </span>
                    {task.priority === "high" ? <span className="tag tag-blocked">高</span> : <span className="task-row-spacer" />}
                    <div className="task-row-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => startEdit(task)}>编辑</button>
                    </div>
                  </div>
                ))}

                {doneTasks.length > 0 && (
                  <div className="task-row-section">已完成 {doneTasks.length}</div>
                )}
                {doneTasks.map((task) => (
                  <div key={task.id} className="task-row-card done">
                    <input type="checkbox" checked onChange={() => toggleDone(task)} />
                    <div className="task-row-main">
                      <strong>{task.title}</strong>
                      <span>{task.projectId ? projectNameById.get(task.projectId) ?? "未知项目" : "未归项目"}</span>
                    </div>
                    <span className="tag tag-done">完成</span>
                    <span className="task-row-spacer" />
                    <div className="task-row-actions">
                      <button className="btn btn-ghost btn-sm danger-text" onClick={() => deleteTask(task.id)}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <>
      {feedback && <div className="settings-feedback">{feedback}</div>}

      {projectView === "list" ? (
        <section className="project-list-flat project-list-full">
          {realProjectStats.length === 0 ? (
            <EmptyState
              icon="＋"
              title="还没有项目"
              hint="用快速输入创建项目"
            />
          ) : (
            <div className="project-table project-table-cards">
              {realProjectStats.map((item) => {
              const progress = item.total > 0 ? Math.round((item.done / item.total) * 100) : 0;
              return (
                <button key={item.project.id} className="project-row project-row-card" onClick={() => openProjectDetail(item.project.id)}>
                  <span className="project-dot" style={{ background: item.project.color || "var(--accent)" }} />
                  <span className="project-row-main">
                    <span className="project-row-name">{item.project.name}</span>
                    <span className="project-row-meta">{item.open} 待办 · {item.done}/{item.total} 完成{item.due ? ` · 最近 ${item.due}` : " · 无截止"}</span>
                  </span>
                  <span className="project-row-progress">
                    <span>{progress}%</span>
                    <i><b style={{ width: `${progress}%` }} /></i>
                  </span>
                  <span className="project-row-action">查看</span>
                </button>
              );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="project-detail-panel project-detail-full">
          <div className="project-detail-head">
            <div>
              <div className="project-detail-kicker">项目详情</div>
              <h3>{selectedStats?.project.name ?? "全部项目"}</h3>
            </div>
            <div className="project-detail-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => { setProjectView("list"); resetForm(); }}>返回列表</button>
              {selectedProject && (
                <>
                  <div className="project-color-row">
                    {PROJECT_COLORS.map((color) => (
                      <button key={color} className={`project-color-dot ${(selectedProject.color || "") === color ? "active" : ""}`} style={{ background: color }} onClick={() => setProjectColor(selectedProject, color)} title={color} />
                    ))}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => renameProject(selectedProject)}>改名</button>
                  <button className="btn btn-ghost btn-sm danger-text" onClick={() => deleteProject(selectedProject)}>删除</button>
                </>
              )}
              <button className="btn btn-primary btn-sm" onClick={startAddTask}>新增任务</button>
            </div>
          </div>

          <div className="project-stat-row">
            <div><strong>{selectedStats?.open ?? 0}</strong><span>未完成</span></div>
            <div><strong>{selectedStats?.done ?? 0}</strong><span>已完成</span></div>
            <div><strong>{selectedStats?.due ?? "无"}</strong><span>最近截止</span></div>
          </div>

          {showForm && (
            <div className="project-task-form">
              <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="任务标题" autoFocus />
              <select className="form-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">未归项目</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              <select className="form-select" value={todayBucket} onChange={(e) => setTodayBucket(e.target.value as typeof todayBucket)}>
                <option value="">未分类</option><option value="must">Must</option><option value="should">Should</option><option value="could">Could</option>
              </select>
              <select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
                <option value="normal">普通</option><option value="high">高</option><option value="low">低</option>
              </select>
              <input className="form-input date-icon-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="截止日期" title="截止日期" />
              <button className="btn btn-primary btn-sm" onClick={handleSave}>{editId ? "保存" : "添加"}</button>
              <button className="btn btn-ghost btn-sm" onClick={resetForm}>取消</button>
            </div>
          )}

          {todayBlocks.length > 0 && (
            <div className="project-timeblocks">
              <strong>今日时间块</strong>
              {todayBlocks.sort((a, b) => a.start.localeCompare(b.start)).map((block) => (
                <div key={block.id}>
                  <span>{block.start}-{block.end}</span>
                  <span>{block.title}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => deleteBlock(block.id)}>×</button>
                </div>
              ))}
            </div>
          )}

          <div className="project-task-list">
            <div className="project-task-section-title">待办 {openTasks.length}</div>
            {openTasks.length === 0 ? (
              <EmptyState icon="☑" title="这个视图没有待办任务" />
            ) : openTasks.map((task) => (
              <div key={task.id} className="project-task-row">
                <div className="project-task-main">
                  <input type="checkbox" checked={false} onChange={() => toggleDone(task)} />
                  <strong onClick={() => startEdit(task)}>{task.title}</strong>
                  <span className={`tag tag-${task.todayBucket === "must" ? "blocked" : task.todayBucket === "should" ? "doing" : task.todayBucket === "could" ? "todo" : "done"}`}>{BUCKET_LABEL[task.todayBucket ?? ""]}</span>
                  {task.dueDate && <span className="text-muted">截止 {task.dueDate}</span>}
                  {task.priority === "high" && <span className="tag tag-blocked">高</span>}
                </div>
                <div className="project-task-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => startEdit(task)}>编辑</button>
                  <button className="btn btn-ghost btn-sm danger-text" onClick={() => deleteTask(task.id)}>×</button>
                </div>
              </div>
            ))}

            {doneTasks.length > 0 && (
              <>
                <div className="project-task-section-title">已完成 {doneTasks.length}</div>
                {doneTasks.map((task) => (
                  <div key={task.id} className="project-task-row done">
                    <div className="project-task-main">
                      <input type="checkbox" checked onChange={() => toggleDone(task)} />
                      <strong>{task.title}</strong>
                    </div>
                    <button className="btn btn-ghost btn-sm danger-text" onClick={() => deleteTask(task.id)}>×</button>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>
      )}
        </>
      )}
    </div>
  );
}
