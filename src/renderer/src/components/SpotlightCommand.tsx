import { useEffect, useMemo, useRef, useState } from "react";
import { describeQuickAction, executeQuickAction, type QuickNavTarget } from "../quickActions";

interface SpotlightCommandProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (target: QuickNavTarget) => void;
  onExecuted?: () => void;
  standalone?: boolean;
  focusKey?: number;
}

const EXAMPLES = [
  "明天提醒我改论文摘要",
  "项目 博士论文",
  "整理文献 #论文 @明天 !高",
  "论文 写结果部分 90min 800字",
  "投稿 补 cover letter 30min #Nature",
  "打开项目与任务",
  "打开报告与活动",
  "生成日报",
  "备份",
];

export function SpotlightCommand({ open, onClose, onNavigate, onExecuted, standalone, focusKey = 0 }: SpotlightCommandProps) {
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState("");
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => describeQuickAction(value), [value]);

  async function closeSpotlight() {
    if (standalone) {
      await window.rijiAPI.hideSpotlightWindow();
    }
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    if (standalone) setValue("");
    setFeedback("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open, focusKey, standalone]);

  useEffect(() => {
    if (!open) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSpotlight();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, standalone]);

  useEffect(() => {
    if (!standalone || !open) return;

    const handler = () => {
      closeSpotlight();
    };
    window.addEventListener("blur", handler);
    return () => window.removeEventListener("blur", handler);
  }, [standalone, open]);

  async function submit() {
    const input = value.trim();
    if (!input || running) return;

    setRunning(true);
    try {
      const res = await executeQuickAction(input);
      setFeedback(res.message);
      if (res.navigate) {
        onNavigate(res.navigate);
        if (standalone) await window.rijiAPI.showMainWindow();
      }
      if (res.ok) {
        setValue("");
        onExecuted?.();
        if (standalone) {
          await window.rijiAPI.notifyQuickActionExecuted({ navigate: res.navigate, message: res.message });
        }
        setTimeout(() => { closeSpotlight(); }, 260);
      }
    } catch {
      setFeedback("操作失败");
    } finally {
      setRunning(false);
    }
  }

  if (!open) return null;

  return (
    <div className={standalone ? "spotlight-layer standalone" : "spotlight-layer"} onMouseDown={closeSpotlight}>
      <div className="spotlight-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="spotlight-input-row">
          <span className="spotlight-icon">{standalone ? "⌃" : "⌘"}</span>
          <input
            ref={inputRef}
            className="spotlight-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={standalone ? "例：明天提醒我改论文摘要 / 生成周报 / 投稿 30min" : "搜索、记录，或输入自然语言"}
          />
          <span className="spotlight-key">Enter</span>
        </div>

        <div className="spotlight-preview">
          <div>
            <div className="spotlight-preview-title">{preview.title}</div>
            <div className="spotlight-preview-detail">{feedback || preview.detail}</div>
          </div>
          {running && <span className="text-muted">执行中...</span>}
        </div>

        {!value.trim() && (
          <div className="spotlight-examples">
            {EXAMPLES.map((example) => (
              <button key={example} type="button" onClick={() => setValue(example)}>
                {example}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
