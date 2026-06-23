// Module-level ref for global Cmd+K shortcut to focus QuickCaptureBar
let _focusFn: (() => void) | null = null;

export function registerCaptureFocus(fn: () => void) {
  _focusFn = fn;
}

export function unregisterCaptureFocus() {
  _focusFn = null;
}

export function focusCapture() {
  _focusFn?.();
}
