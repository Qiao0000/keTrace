import ApplicationServices
import CoreGraphics
import Foundation

let ctrlKeyCodes: Set<Int64> = [59, 62]

var ctrlIsDown = false
var eventTapPort: CFMachPort?
var runLoopSource: CFRunLoopSource?
var isRunning = false

func checkAccessibility(prompt: Bool) -> Bool {
  let key = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
  let opts: CFDictionary = [key: prompt] as CFDictionary
  return AXIsProcessTrustedWithOptions(opts)
}

func checkInputMonitoring(request: Bool) -> Bool {
  if request {
    // Triggers the system to add this binary to "Input Monitoring" list.
    // Returns true immediately if already granted.
    return CGRequestListenEventAccess()
  }
  return CGPreflightListenEventAccess()
}

var lastAccessibilityReport: Bool? = nil
var lastInputMonitoringReport: Bool? = nil

func reportStatus(accessibility: Bool, inputMonitoring: Bool) {
  if lastAccessibilityReport != accessibility {
    print(accessibility ? "ACCESSIBILITY_OK" : "ACCESSIBILITY_REQUIRED")
    lastAccessibilityReport = accessibility
  }
  if lastInputMonitoringReport != inputMonitoring {
    print(inputMonitoring ? "INPUT_MONITORING_OK" : "INPUT_MONITORING_REQUIRED")
    lastInputMonitoringReport = inputMonitoring
  }
  fflush(stdout)
}

func hasOnlyCtrlReleased(_ flags: CGEventFlags) -> Bool {
  let blocked: CGEventFlags = [.maskShift, .maskAlternate, .maskCommand]
  return flags.intersection(blocked).isEmpty
}

let callback: CGEventTapCallBack = { _, type, event, _ in
  if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
    print("TAP_DISABLED")
    fflush(stdout)
    if let tap = eventTapPort {
      CGEvent.tapEnable(tap: tap, enable: true)
    }
    return Unmanaged.passUnretained(event)
  }

  guard type == .flagsChanged else {
    return Unmanaged.passUnretained(event)
  }

  let keyCode = event.getIntegerValueField(.keyboardEventKeycode)
  guard ctrlKeyCodes.contains(keyCode) else {
    return Unmanaged.passUnretained(event)
  }

  let flags = event.flags
  let isDown = flags.contains(.maskControl)
  print("CTRL_EVENT")
  fflush(stdout)

  if isDown {
    ctrlIsDown = hasOnlyCtrlReleased(flags)
    return Unmanaged.passUnretained(event)
  }

  if ctrlIsDown && hasOnlyCtrlReleased(flags) {
    print("CTRL_TRIGGER")
    fflush(stdout)
    ctrlIsDown = false
    return nil
  }

  ctrlIsDown = false
  return Unmanaged.passUnretained(event)
}

func startEventTap() -> Bool {
  if isRunning { return true }
  let mask = CGEventMask(1 << CGEventType.flagsChanged.rawValue)
  guard let eventTap = CGEvent.tapCreate(
    tap: .cghidEventTap,
    place: .headInsertEventTap,
    options: .defaultTap,
    eventsOfInterest: mask,
    callback: callback,
    userInfo: nil
  ) else {
    print("EVENT_TAP_FAILED")
    fflush(stdout)
    return false
  }

  eventTapPort = eventTap
  let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0)
  runLoopSource = source
  CFRunLoopAddSource(CFRunLoopGetCurrent(), source, .commonModes)
  CGEvent.tapEnable(tap: eventTap, enable: true)
  isRunning = true
  print("READY")
  fflush(stdout)
  return true
}

// ── Bootstrap ────────────────────────────────────────────────
let helperPid = ProcessInfo.processInfo.processIdentifier
let helperPath = CommandLine.arguments.first ?? "?"
print("STARTUP pid=\(helperPid) path=\(helperPath)")
fflush(stdout)

// Request permissions on first launch so macOS adds this helper
// to the Accessibility and Input Monitoring lists.
let initialAccessibility = checkAccessibility(prompt: true)
let initialInputMonitoring = checkInputMonitoring(request: true)
reportStatus(accessibility: initialAccessibility, inputMonitoring: initialInputMonitoring)

if initialAccessibility && initialInputMonitoring {
  if !startEventTap() {
    exit(2)
  }
}

// Poll for permission grants while running, then start the tap
// without requiring the user to manually restart the helper.
let pollSource = DispatchSource.makeTimerSource(queue: DispatchQueue.main)
pollSource.schedule(deadline: .now() + 2.0, repeating: 2.0)
pollSource.setEventHandler {
  if isRunning { return }
  let accessibility = checkAccessibility(prompt: false)
  let inputMonitoring = checkInputMonitoring(request: false)
  reportStatus(accessibility: accessibility, inputMonitoring: inputMonitoring)
  if accessibility && inputMonitoring {
    _ = startEventTap()
  }
}
pollSource.resume()

CFRunLoopRun()
