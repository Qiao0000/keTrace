import { useState, useRef, useCallback, forwardRef, useImperativeHandle, useEffect as useMount } from "react";
import { registerCaptureFocus, unregisterCaptureFocus } from "../captureFocus";
import { executeQuickAction, undoQuickAction, type QuickUndoAction } from "../quickActions";

interface QuickCaptureBarProps {
  onCaptured?: () => void;
}

// Component
export const QuickCaptureBar = forwardRef<{ focus: () => void }, QuickCaptureBarProps>(function QuickCaptureBar({ onCaptured }, ref) {
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState("");
  const [lastAction, setLastAction] = useState<QuickUndoAction | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => { inputRef.current?.focus(); },
  }));

  useMount(() => {
    registerCaptureFocus(() => inputRef.current?.focus());
    return () => unregisterCaptureFocus();
  });

  const showFeedback = useCallback((msg: string, action?: QuickUndoAction) => {
    setFeedback(msg);
    if (action) setLastAction(action);
    setTimeout(() => {
      setFeedback("");
      setLastAction(null);
    }, 4000);
  }, []);

  async function handleUndo() {
    if (!lastAction) return;
    try {
      await undoQuickAction(lastAction);
      showFeedback("已撤销");
      onCaptured?.();
    } catch {
      showFeedback("撤销失败");
    }
    setLastAction(null);
  }

  async function handleSubmit() {
    const input = value.trim();
    if (!input) return;

    try {
      const res = await executeQuickAction(input);
      showFeedback(res.message, res.undo);
      if (res.ok) setValue("");
      onCaptured?.();
    } catch {
      showFeedback("操作失败");
    }
  }

  function primeInput(prefix: string) {
    setValue((current) => {
      if (!current.trim()) return prefix;
      return current.startsWith(prefix) ? current : `${prefix}${current}`;
    });
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div className="quick-capture">
      <div className="quick-capture-box">
        <span className="quick-capture-plus">+</span>
        <input
          ref={inputRef}
          type="text"
          className="quick-capture-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="写下任务、项目、论文或投稿动作，复杂句子可由 AI 理解"
        />
        <div className="quick-capture-actions">
          <button type="button" className="quick-chip" onClick={() => primeInput("任务 ")}>任务</button>
          <button type="button" className="quick-chip" onClick={() => primeInput("项目 ")}>项目</button>
          <button type="button" className="quick-chip" onClick={() => primeInput("论文 ")}>论文</button>
          <button type="button" className="quick-chip" onClick={() => primeInput("投稿 ")}>投稿</button>
          <button type="button" className="quick-chip" onClick={() => primeInput("新投稿 ")}>新投稿</button>
        </div>
      </div>

      {feedback && (
        <div className="quick-capture-feedback">
          <span>{feedback}</span>
          {lastAction && (
            <button className="btn btn-ghost btn-sm" onClick={handleUndo}>撤销</button>
          )}
        </div>
      )}
    </div>
  );
});
