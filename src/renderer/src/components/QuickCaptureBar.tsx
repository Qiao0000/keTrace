import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import type { Task, TaskPriority } from "../../../shared/types";
import type { Workspace } from "../../../shared/types";

// ─── Parser ─────────────────────────────────────────────
interface ParsedCapture {
  title: string;
  projectName?: string;
  dueDate?: string;
  priority: TaskPriority;
}

function parseCapture(input: string): ParsedCapture {
  let text = input.trim();

  // Extract !priority
  let priority: TaskPriority = "normal";
  const prioMatch = text.match(/!(\S+)/);
  if (prioMatch) {
    const p = prioMatch[1];
    if (p === "高" || p === "high" || p === "!") priority = "high";
    else if (p === "低" || p === "low") priority = "low";
    text = text.replace(prioMatch[0], "").trim();
  }

  // Extract @date
  let dueDate: string | undefined;
  const dateMatch = text.match(/@(\S+)/);
  if (dateMatch) {
    const d = dateMatch[1];
    if (d === "今天" || d === "today") dueDate = new Date().toISOString().slice(0, 10);
    else if (d === "明天" || d === "tomorrow") {
      const t = new Date(); t.setDate(t.getDate() + 1);
      dueDate = t.toISOString().slice(0, 10);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      dueDate = d;
    }
    text = text.replace(dateMatch[0], "").trim();
  }

  // Extract #project
  let projectName: string | undefined;
  const projMatch = text.match(/#(\S+)/);
  if (projMatch) {
    projectName = projMatch[1];
    text = text.replace(projMatch[0], "").trim();
  }

  return { title: text, projectName, dueDate, priority };
}

function genId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── Component ──────────────────────────────────────────
export const QuickCaptureBar = forwardRef<{ focus: () => void }>(function QuickCaptureBar(_props, ref) {
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState("");
  const [lastAction, setLastAction] = useState<{ type: string; id: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => { inputRef.current?.focus(); }
  }));

  const showFeedback = useCallback((msg: string, action?: { type: string; id: string }) => {
    setFeedback(msg);
    if (action) setLastAction(action);
    setTimeout(() => { setFeedback(""); setLastAction(null); }, 4000);
  }, []);

  async function handleUndo() {
    if (!lastAction) return;
    try {
      if (lastAction.type === "task") {
        await window.rijiAPI.deleteTask(lastAction.id);
      }
      showFeedback("已撤销");
    } catch { showFeedback("撤销失败"); }
    setLastAction(null);
  }

  async function handleSubmit() {
    const input = value.trim();
    if (!input) return;

    const parsed = parseCapture(input);
    if (!parsed.title) { setValue(""); return; }

    try {
      // 1. Resolve project — auto-create if needed
      let projectId: string | undefined;
      if (parsed.projectName) {
        const ws: Workspace = await window.rijiAPI.getState();
        let proj = ws.projects.find((p) => p.name === parsed.projectName);
        if (!proj) {
          const res = await window.rijiAPI.addProject({
            id: genId("proj_"),
            name: parsed.projectName,
            createdAt: new Date().toISOString(),
          });
          if (res.ok) proj = res.project;
        }
        projectId = proj?.id;
      }

      // 2. Create task
      const task: Task = {
        id: genId("task_"),
        title: parsed.title,
        status: "todo",
        priority: parsed.priority,
        dueDate: parsed.dueDate,
        projectId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const res = await window.rijiAPI.addTask(task);

      if (res.ok) {
        const parts: string[] = ["任务已创建"];
        if (parsed.projectName) parts.push(`已归入项目「${parsed.projectName}」`);
        if (parsed.priority === "high") parts.push("高优先级");
        if (parsed.dueDate) parts.push(`截止 ${parsed.dueDate}`);
        showFeedback(parts.join(" · "), { type: "task", id: task.id });
        setValue("");
      } else {
        showFeedback("创建失败");
      }
    } catch {
      showFeedback("创建失败");
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 0, alignItems: "stretch" }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 8,
          background: "var(--bg)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "0 14px",
          height: 44, transition: "border-color .15s",
        }}>
          <span style={{ color: "var(--text-muted)", fontSize: 16, flexShrink: 0 }}>+</span>
          <input
            ref={inputRef}
            type="text"
            className="form-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="输入任务、论文进展、投稿动作…"
            style={{
              flex: 1, border: "none", background: "transparent", outline: "none",
              height: "100%", fontSize: 14, padding: 0,
              color: "var(--text)", fontFamily: "inherit",
            }}
          />
          <span style={{ color: "var(--text-muted)", fontSize: 11, flexShrink: 0, userSelect: "none" }}>
            #项目 @日期 !优先级
          </span>
        </div>
      </div>

      {feedback && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          padding: "6px 14px", fontSize: 12, color: "var(--text-sec)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span>{feedback}</span>
          {lastAction && (
            <button className="btn btn-ghost btn-sm" onClick={handleUndo} style={{ fontSize: 11 }}>撤销</button>
          )}
        </div>
      )}
    </div>
  );
});
