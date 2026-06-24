#include <napi.h>
#include <ApplicationServices/ApplicationServices.h>
#include <CoreGraphics/CoreGraphics.h>
#include <atomic>

static CFMachPortRef gEventTap = nullptr;
static CFRunLoopSourceRef gRunLoopSource = nullptr;
static std::atomic<bool> gRunning{false};
static std::atomic<bool> gTriggered{false};
static std::atomic<bool> gTapDisabled{false};
static std::atomic<int64_t> gCtrlEvents{0};

// ── Event-tap callback (runs on CGEvent thread — NO N-API calls) ────────

static CGEventRef eventTapCallback(CGEventTapProxy proxy, CGEventType type,
                                    CGEventRef event, void * /*userInfo*/) {
  if (type == kCGEventTapDisabledByTimeout || type == kCGEventTapDisabledByUserInput) {
    gTapDisabled.store(true);
    if (gEventTap) CGEventTapEnable(gEventTap, true);
    return event;
  }

  if (type != kCGEventFlagsChanged) return event;

  int64_t keyCode = CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode);
  if (keyCode != 59 && keyCode != 62) return event;  // left / right Ctrl

  gCtrlEvents.fetch_add(1);

  CGEventFlags flags = CGEventGetFlags(event);
  bool isDown = (flags & kCGEventFlagMaskControl) != 0;

  static std::atomic<bool> ctrlIsDown{false};

  if (!isDown) {
    bool wasDown = ctrlIsDown.exchange(false);
    if (wasDown) {
      bool solo = (flags & (kCGEventFlagMaskShift | kCGEventFlagMaskAlternate |
                            kCGEventFlagMaskCommand)) == 0;
      if (solo) {
        gTriggered.store(true);
        return nullptr;  // consume the event
      }
    }
  } else {
    bool solo = (flags & (kCGEventFlagMaskShift | kCGEventFlagMaskAlternate |
                          kCGEventFlagMaskCommand)) == 0;
    ctrlIsDown.store(solo);
  }

  return event;
}

// ── Exported helpers ────────────────────────────────────────────────────

Napi::Value CheckAccessibility(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), AXIsProcessTrusted());
}

Napi::Value RequestAccessibility(const Napi::CallbackInfo& info) {
  CFStringRef key = kAXTrustedCheckOptionPrompt;
  const void* keys[] = {key};
  const void* vals[] = {kCFBooleanTrue};
  CFDictionaryRef opts = CFDictionaryCreate(
    kCFAllocatorDefault, keys, vals, 1,
    &kCFTypeDictionaryKeyCallBacks, &kCFTypeDictionaryValueCallBacks);
  if (!opts) return Napi::Boolean::New(info.Env(), false);
  Boolean result = AXIsProcessTrustedWithOptions(opts);
  CFRelease(opts);
  return Napi::Boolean::New(info.Env(), result);
}

Napi::Value CheckInputMonitoring(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), CGPreflightListenEventAccess());
}

Napi::Value RequestInputMonitoring(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), CGRequestListenEventAccess());
}

Napi::Value Start(const Napi::CallbackInfo& info) {
  if (gRunning.load()) return Napi::Boolean::New(info.Env(), true);

  CGEventMask mask = CGEventMaskBit(kCGEventFlagsChanged);
  gEventTap = CGEventTapCreate(
    kCGHIDEventTap, kCGHeadInsertEventTap, kCGEventTapOptionDefault,
    mask, eventTapCallback, nullptr);

  if (!gEventTap) return Napi::Boolean::New(info.Env(), false);

  gRunLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, gEventTap, 0);
  CFRunLoopAddSource(CFRunLoopGetCurrent(), gRunLoopSource, kCFRunLoopCommonModes);
  CGEventTapEnable(gEventTap, true);
  gRunning.store(true);
  return Napi::Boolean::New(info.Env(), true);
}

void Stop(const Napi::CallbackInfo& /*info*/) {
  if (gEventTap) {
    CGEventTapEnable(gEventTap, false);
    CFRelease(gEventTap);
    gEventTap = nullptr;
  }
  if (gRunLoopSource) {
    CFRunLoopRemoveSource(CFRunLoopGetCurrent(), gRunLoopSource, kCFRunLoopCommonModes);
    CFRelease(gRunLoopSource);
    gRunLoopSource = nullptr;
  }
  gRunning.store(false);
}

Napi::Value PollTrigger(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), gTriggered.exchange(false));
}

Napi::Value IsRunning(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), gRunning.load());
}

Napi::Value PollTapDisabled(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), gTapDisabled.exchange(false));
}

Napi::Value PollCtrlEvents(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), gCtrlEvents.exchange(0));
}

// ── Module init ─────────────────────────────────────────────────────────

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("checkAccessibility", Napi::Function::New(env, CheckAccessibility));
  exports.Set("requestAccessibility", Napi::Function::New(env, RequestAccessibility));
  exports.Set("checkInputMonitoring", Napi::Function::New(env, CheckInputMonitoring));
  exports.Set("requestInputMonitoring", Napi::Function::New(env, RequestInputMonitoring));
  exports.Set("start", Napi::Function::New(env, Start));
  exports.Set("stop", Napi::Function::New(env, Stop));
  exports.Set("pollTrigger", Napi::Function::New(env, PollTrigger));
  exports.Set("isRunning", Napi::Function::New(env, IsRunning));
  exports.Set("pollTapDisabled", Napi::Function::New(env, PollTapDisabled));
  exports.Set("pollCtrlEvents", Napi::Function::New(env, PollCtrlEvents));
  return exports;
}

NODE_API_MODULE(ctrl_monitor, Init)
