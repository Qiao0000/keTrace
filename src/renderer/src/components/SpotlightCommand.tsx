import { useEffect, useMemo, useRef, useState } from "react";
import { describeQuickAction, executeQuickAction, type QuickNavTarget } from "../quickActions";

interface SpotlightCommandProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (target: QuickNavTarget) => void;
  onExecuted?: () => void;
}

const EXAMPLES = [
  "整理文献 #论文 @明天 !高",
  "论文 写结果部分 90min 800字",
  "投稿 补 cover letter 30min #Nature",
  "打开报告",
  "生成日报",
  "备份",
];

export function SpotlightCommand({ open, onClose, onNavigate, onExecuted }: SpotlightCommandProps) {
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState("");
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => describeQuickAction(value), [value]);

  useEffect(() => {
    if (!open) return;
    setFeedback("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  async function submit() {
    const input = value.trim();
    if (!input || running) return;

    setRunning(true);
    try {
      const res = await executeQuickAction(input);
      setFeedback(res.message);
      if (res.navigate) onNavigate(res.navigate);
      if (res.ok) {
        setValue("");
        onExecuted?.();
        setTimeout(onClose, 260);
      }
    } catch {
      setFeedback("操作失败");
    } finally {
      setRunning(false);
    }
  }

  if (!open) return null;

  return (
    <div className="spotlight-layer" onMouseDown={onClose}>
      <div className="spotlight-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="spotlight-input-row">
          <span className="spotlight-icon">⌘</span>
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
            placeholder="搜索或输入要记录的内容"
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
