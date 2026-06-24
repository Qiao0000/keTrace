import { useEffect, useState } from "react";
import type { ActivityRecord, AppConfig, DataStatus, ScreenVisionTestResult } from "../../../../shared/types";
import { DEFAULT_CONFIG, MAX_POLL_INTERVAL_SECONDS, MIN_POLL_INTERVAL_SECONDS } from "../../../../shared/defaults";
import { LoadingState } from "../../components/LoadingState";

interface ActivityStatus {
  running: boolean;
  platform: string;
  lastError: string;
  lastActivity?: ActivityRecord;
}

interface ShortcutStatus {
  supported: boolean;
  running: boolean;
  accessibilityRequired: boolean;
  inputMonitoringRequired: boolean;
  eventTapFailed: boolean;
  helperMissing: boolean;
  triggeredCount: number;
  lastTriggeredAt: string;
  ctrlEventCount: number;
  lastCtrlEventAt: string;
  ready: boolean;
  tapDisabled: boolean;
  lastMessage: string;
  helperPath: string;
  helperBuiltAt: string;
  helperPid: number;
  startedAt: string;
  lastExitCode: number | null;
  lastExitSignal: string;
  lastExitAt: string;
  lastStderr: string;
}

type ShortcutLevel = "ok" | "warn" | "error" | "off";

function shortcutLevel(status: ShortcutStatus | null): ShortcutLevel {
  if (!status || !status.supported) return "off";
  if (status.helperMissing || status.eventTapFailed) return "error";
  if (status.accessibilityRequired || status.inputMonitoringRequired) return "warn";
  if (status.running && status.ready) return "ok";
  return "warn";
}

function shortcutText(status: ShortcutStatus | null): string {
  if (!status || !status.supported) return "当前平台不支持";
  if (status.helperMissing) return "监听程序缺失";
  if (status.eventTapFailed) return "事件监听创建失败";
  if (status.accessibilityRequired && status.inputMonitoringRequired) return "需要辅助功能 + 输入监控授权";
  if (status.accessibilityRequired) return "需要辅助功能授权";
  if (status.inputMonitoringRequired) return "需要输入监控授权";
  if (status.running && status.ready) return "全局监听中";
  if (status.running) return "已启动，等待就绪";
  return "未运行";
}

function fmtTime(value: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function shortPath(value: string, max = 56): string {
  if (!value) return "—";
  if (value.length <= max) return value;
  return "…" + value.slice(value.length - max + 1);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(value: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SettingsPage() {
  const isMac = navigator.platform.toLowerCase().includes("mac");
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [draftPollInterval, setDraftPollInterval] = useState(String(DEFAULT_CONFIG.pollIntervalSeconds));
  const [draftArkKey, setDraftArkKey] = useState("");
  const [activityStatus, setActivityStatus] = useState<ActivityStatus | null>(null);
  const [shortcutStatus, setShortcutStatus] = useState<ShortcutStatus | null>(null);
  const [screenVisionTest, setScreenVisionTest] = useState<ScreenVisionTestResult | null>(null);
  const [screenVisionTesting, setScreenVisionTesting] = useState(false);
  const [dataPaths, setDataPaths] = useState<{ dataDir: string; reportsDir: string } | null>(null);
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const [selectedBackup, setSelectedBackup] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDiag, setShowDiag] = useState(false);

  useEffect(() => {
    window.rijiAPI.getConfig().then((cfg: AppConfig) => {
      setConfig(cfg);
      setDraftPollInterval(String(cfg.pollIntervalSeconds));
      setDraftArkKey(cfg.arkKey || "");
      setLoading(false);
    });
    refreshActivityStatus();
    refreshShortcutStatus();
    window.rijiAPI.getDataPaths().then(setDataPaths);
    refreshDataStatus();
  }, []);

  useEffect(() => {
    const id = setInterval(refreshShortcutStatus, 4000);
    return () => clearInterval(id);
  }, []);

  async function refreshActivityStatus() {
    setActivityStatus(await window.rijiAPI.activityStatus());
  }

  async function refreshShortcutStatus() {
    setShortcutStatus(await window.rijiAPI.shortcutStatus());
  }

  async function refreshDataStatus() {
    const status = await window.rijiAPI.getDataStatus();
    setDataStatus(status);
    setSelectedBackup((current) => current || status.latestBackup || "");
  }

  function flash(message: string) {
    setFeedback(message);
    setTimeout(() => setFeedback(""), 2200);
  }

  async function save(partial: Partial<AppConfig>) {
    const res = await window.rijiAPI.saveConfig(partial);
    setConfig(res.config ?? { ...config, ...partial });
    flash(res.ok ? "已保存" : "保存失败");
    await refreshActivityStatus();
  }

  async function savePollInterval() {
    const value = Math.min(
      MAX_POLL_INTERVAL_SECONDS,
      Math.max(MIN_POLL_INTERVAL_SECONDS, Number(draftPollInterval) || config.pollIntervalSeconds),
    );
    setDraftPollInterval(String(value));
    await save({ pollIntervalSeconds: value });
  }

  async function saveArkKey() {
    await save({ arkKey: draftArkKey.trim() });
  }

  async function runScreenVisionTest() {
    setScreenVisionTesting(true);
    try {
      const result = await window.rijiAPI.testScreenVision();
      setScreenVisionTest(result);
      flash(result.ok ? "截图识别测试通过" : "截图识别测试失败");
    } finally {
      setScreenVisionTesting(false);
      await refreshActivityStatus();
    }
  }

  async function createManualBackup() {
    const res = await window.rijiAPI.createBackup();
    await refreshDataStatus();
    flash(res.ok ? "备份已创建" : "备份失败");
  }

  async function restoreSelectedBackup() {
    if (!selectedBackup) {
      flash("暂无可恢复备份");
      return;
    }
    const confirmed = window.confirm(`确定恢复备份 ${selectedBackup}？当前数据会先自动备份。`);
    if (!confirmed) return;
    const res = await window.rijiAPI.restoreBackup(selectedBackup);
    await Promise.all([refreshDataStatus(), refreshActivityStatus()]);
    flash(res.ok ? "备份已恢复，建议重启应用" : "恢复失败");
  }

  if (loading) return <LoadingState label="正在加载设置…" rows={3} />;

  const lastActivityText = activityStatus?.lastActivity
    ? new Date(activityStatus.lastActivity.ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    : "暂无";

  const sLevel = shortcutLevel(shortcutStatus);
  const sLabel = shortcutText(shortcutStatus);
  const needsAccessibility = !!shortcutStatus?.accessibilityRequired;
  const needsInputMonitoring = !!shortcutStatus?.inputMonitoringRequired;

  return (
    <div className="settings-page">
      <div className="settings-hero">
        <div>
          <div className="settings-eyebrow">偏好</div>
          <h3>采集与系统</h3>
          <p>调整采集频率、快捷输入、启动行为和数据位置。</p>
        </div>
        <div className="settings-hero-meta">
          <span className={`status-chip ${activityStatus?.running ? "ok" : "off"}`}>
            <i /> 采集 {activityStatus?.running ? "运行中" : "已停止"}
          </span>
          <span className={`status-chip ${sLevel}`}>
            <i /> 快捷 {sLabel}
          </span>
          {feedback && <div className="settings-feedback">{feedback}</div>}
        </div>
      </div>

      <div className="settings-grid">
        <section className="settings-card">
          <div className="settings-card-head">
            <div>
              <h4>活动采集</h4>
              <p>{activityStatus?.running ? "正在截取上半屏并识别活动事件" : "采集已暂停"}</p>
            </div>
            <button className={`toggle ${config.collectorEnabled ? "on" : ""}`} onClick={() => save({ collectorEnabled: !config.collectorEnabled })} />
          </div>

          <div className="settings-meta-row">
            <span><b>{activityStatus?.running ? "采集中" : "未采集"}</b> · {activityStatus?.platform || "-"}</span>
            <span>最近活动 {lastActivityText}</span>
          </div>

          {activityStatus?.lastError && <div className="settings-warning sm">{activityStatus.lastError}</div>}

          <div className="settings-collector-controls">
            <label className="settings-mini-field">
              <span>采集间隔（秒）</span>
              <input
                className="form-input"
                type="number"
                min={MIN_POLL_INTERVAL_SECONDS}
                max={MAX_POLL_INTERVAL_SECONDS}
                step={30}
                value={draftPollInterval}
                onChange={(e) => setDraftPollInterval(e.target.value)}
                onBlur={savePollInterval}
              />
            </label>
            <div className="settings-collector-actions">
              <button className="btn btn-ghost btn-sm settings-action-btn" onClick={savePollInterval}>保存间隔</button>
              <button className="btn btn-ghost btn-sm settings-action-btn" onClick={async () => {
                await refreshActivityStatus();
                flash("状态已刷新");
              }}>刷新状态</button>
              <button className="btn btn-ghost btn-sm settings-action-btn" disabled={screenVisionTesting} onClick={runScreenVisionTest}>
                {screenVisionTesting ? "测试中..." : "测试截屏识别"}
              </button>
            </div>
          </div>

          {isMac && (
            <p className="settings-foot-note">需在系统设置开启屏幕录制权限；授权后重启应用更稳定。</p>
          )}

          {screenVisionTest && (
            <details className={`settings-test-result ${screenVisionTest.ok ? "ok" : "error"}`} open>
              <summary>
                {screenVisionTest.ok ? "测试通过" : "测试失败"} · {screenVisionTest.stage}
              </summary>
              <div className="settings-test-grid">
                <span>结果</span>
                <strong>{screenVisionTest.ok ? "通过" : "失败"}</strong>
                <span>阶段</span>
                <strong>{screenVisionTest.stage}</strong>
                <span>服务</span>
                <strong>{screenVisionTest.provider}</strong>
                <span>Key</span>
                <strong>{screenVisionTest.hasArkKey ? "已配置" : "缺失"}</strong>
                {screenVisionTest.screenAccess && (<><span>屏幕权限</span><strong>{screenVisionTest.screenAccess}</strong></>)}
                {screenVisionTest.captureMethod && (<><span>截图方式</span><strong>{screenVisionTest.captureMethod}</strong></>)}
                {screenVisionTest.aiModel && (<><span>AI模型</span><strong>{screenVisionTest.aiModel}</strong></>)}
                {typeof screenVisionTest.aiStatus === "number" && (<><span>API状态</span><strong>{screenVisionTest.aiStatus || "-"}</strong></>)}
                {screenVisionTest.display && (
                  <>
                    <span>截图</span>
                    <strong>
                      {screenVisionTest.display.upperSize?.width ?? "-"} × {screenVisionTest.display.upperSize?.height ?? "-"}
                      {screenVisionTest.imageBytes ? ` · ${Math.round(screenVisionTest.imageBytes / 1024)}KB` : ""}
                    </strong>
                  </>
                )}
                {screenVisionTest.imageHash && (<><span>哈希</span><strong>{screenVisionTest.imageHash.slice(0, 12)}</strong></>)}
                {screenVisionTest.event && (
                  <>
                    <span>事件</span>
                    <strong>
                      {screenVisionTest.event.title} · {screenVisionTest.event.category}
                      {screenVisionTest.event.tags.length ? ` · ${screenVisionTest.event.tags.join(" / ")}` : ""}
                    </strong>
                  </>
                )}
                {screenVisionTest.error && (<><span>错误</span><strong>{screenVisionTest.error}</strong></>)}
                {screenVisionTest.aiResponsePreview && (<><span>响应片段</span><strong>{screenVisionTest.aiResponsePreview}</strong></>)}
              </div>
              <details className="settings-test-prompt">
                <summary>识别提示词</summary>
                <pre>{screenVisionTest.promptPreview}</pre>
              </details>
            </details>
          )}
        </section>

        <section className={`settings-card shortcut-card level-${sLevel}`}>
          <div className="settings-card-head">
            <div>
              <h4>快捷输入</h4>
              <p>单击 Ctrl 唤出输入小窗（macOS 原生事件桥）。</p>
            </div>
            <span className={`status-chip ${sLevel}`}><i /> {sLabel}</span>
          </div>

          <div className="shortcut-metrics">
            <div>
              <span>触发次数</span>
              <strong>{shortcutStatus?.triggeredCount ?? 0}</strong>
            </div>
            <div>
              <span>Ctrl 事件</span>
              <strong>{shortcutStatus?.ctrlEventCount ?? 0}</strong>
            </div>
            <div>
              <span>最近触发</span>
              <strong>{fmtTime(shortcutStatus?.lastTriggeredAt ?? "")}</strong>
            </div>
            <div>
              <span>最近 Ctrl</span>
              <strong>{fmtTime(shortcutStatus?.lastCtrlEventAt ?? "")}</strong>
            </div>
          </div>

          {(needsAccessibility || needsInputMonitoring) && (
            <div className="settings-warning">
              <strong>请在系统设置里勾选 <code>刻迹</code>（开发模式请找 <code>Electron</code>）。</strong>
              {" "}事件监听已内置于 App 进程，授权一次即可。
              {needsAccessibility && needsInputMonitoring
                ? " 需要同时开启辅助功能 + 输入监控。"
                : needsAccessibility
                  ? " 仍缺辅助功能。"
                  : " 仍缺输入监控。"}
              {" "}如果列表里找不到，请点下方按钮打开系统设置，手动将 App 拖入列表。
            </div>
          )}
          {shortcutStatus?.helperMissing && (
            <div className="settings-warning">
              监听插件未找到：{shortPath(shortcutStatus.helperPath)}。请执行 <code>npm run dev</code> 或 <code>npm run build</code> 重新构建。
            </div>
          )}
          {shortcutStatus?.eventTapFailed && (
            <div className="settings-warning">事件监听创建失败。通常是输入监控权限缺失，或系统策略禁用了事件流。</div>
          )}

          <div className="settings-action-grid settings-action-grid-shortcut">
            {needsAccessibility && (
              <button className="btn btn-ghost btn-sm settings-action-btn" onClick={async () => {
                await window.rijiAPI.openShortcutPermissionSettings("accessibility");
                flash("已打开辅助功能");
              }}>开辅助功能</button>
            )}
            {needsInputMonitoring && (
              <button className="btn btn-ghost btn-sm settings-action-btn" onClick={async () => {
                await window.rijiAPI.openShortcutPermissionSettings("inputMonitoring");
                flash("已打开输入监控");
              }}>开输入监控</button>
            )}
            <button className="btn btn-ghost btn-sm settings-action-btn" onClick={async () => {
              const res = await window.rijiAPI.revealShortcutHelper();
              flash(res.ok ? "已在 Finder 显示" : "找不到 helper");
            }}>在 Finder 显示</button>
            <button className="btn btn-ghost btn-sm settings-action-btn" onClick={async () => {
              const path = shortcutStatus?.helperPath ?? "";
              if (!path) { flash("没有 helper 路径"); return; }
              try {
                await navigator.clipboard.writeText(path);
                flash("路径已复制");
              } catch {
                flash("复制失败");
              }
            }}>复制路径</button>
            <button className="btn btn-ghost btn-sm settings-action-btn" onClick={async () => {
              await window.rijiAPI.restartShortcutMonitor();
              await refreshShortcutStatus();
              flash("已重启监听");
            }}>重启监听</button>
            <button className="btn btn-ghost btn-sm settings-action-btn" onClick={async () => {
              await window.rijiAPI.restartShortcutMonitor(true);
              await refreshShortcutStatus();
              flash("已强杀重启");
            }}>硬重启</button>
            <button className="btn btn-ghost btn-sm settings-action-btn" onClick={async () => {
              if (!confirm("将清除 helper 的所有授权记录并重启，下次启动会重新弹权限框。继续？")) return;
              const res = await window.rijiAPI.resetShortcutTcc();
              await refreshShortcutStatus();
              flash(res.ok ? "TCC 已重置" : "重置失败：" + res.errors.join("; "));
            }}>重置授权</button>
            <button className="btn btn-ghost btn-sm settings-action-btn" onClick={async () => {
              await refreshShortcutStatus();
              flash("状态已刷新");
            }}>刷新</button>
            <button className="btn btn-ghost btn-sm settings-action-btn" onClick={async () => {
              await window.rijiAPI.openSpotlightWindow();
            }}>测试唤出</button>
          </div>

          <button className="settings-diag-toggle" onClick={() => setShowDiag((v) => !v)}>
            {showDiag ? "收起调试信息" : "展开调试信息"}
          </button>
          {showDiag && (
            <div className="settings-diag">
              <div className="settings-diag-grid">
                <span>插件</span>
                <strong className="mono" title={shortcutStatus?.helperPath}>{shortPath(shortcutStatus?.helperPath ?? "")}</strong>
                <span>构建于</span>
                <strong>{shortcutStatus?.helperBuiltAt ? new Date(shortcutStatus.helperBuiltAt).toLocaleString("zh-CN") : "—"}</strong>
                <span>Ready</span>
                <strong>{shortcutStatus?.ready ? "是" : "否"}</strong>
                <span>Running</span>
                <strong>{shortcutStatus?.running ? "是" : "否"}</strong>
                <span>Tap Disabled</span>
                <strong>{shortcutStatus?.tapDisabled ? "是" : "否"}</strong>
                <span>启动于</span>
                <strong>{fmtTime(shortcutStatus?.startedAt ?? "")}</strong>
                <span>最近消息</span>
                <strong>{shortcutStatus?.lastMessage || "—"}</strong>
                <span>辅助功能</span>
                <strong>{shortcutStatus?.accessibilityRequired ? "缺失" : "正常"}</strong>
                <span>输入监控</span>
                <strong>{shortcutStatus?.inputMonitoringRequired ? "缺失" : "正常"}</strong>
              </div>
              <p className="settings-diag-note">
                事件监听已内置于 App 进程（N-API addon），权限与 App 统一。授权对象：打包版本为 <code>刻迹</code>，开发版本为 <code>Electron</code>。如需重置请在终端执行 <code>tccutil reset Accessibility com.ketrace.app</code>。
              </p>
            </div>
          )}
        </section>

        <section className="settings-card">
          <div className="settings-card-head">
            <div>
              <h4>系统</h4>
              <p>菜单栏图标、Dock 入口和启动行为。</p>
            </div>
          </div>
          <div className="setting-row compact">
            <div>
              <div className="s-label">菜单栏图标</div>
              <div className="s-desc">macOS 会保留菜单栏入口，可从菜单栏打开刻迹或快速输入</div>
            </div>
            <div className="flex-row">
              {isMac && <span className="shortcut-pill">macOS 常驻</span>}
              <button className={`toggle ${config.trayEnabled || isMac ? "on" : ""}`} disabled={isMac} onClick={() => save({ trayEnabled: !config.trayEnabled })} />
            </div>
          </div>
          <div className="setting-row compact">
            <div>
              <div className="s-label">开机启动</div>
              <div className="s-desc">登录时自动启动刻迹</div>
            </div>
            <button className={`toggle ${config.launchAtLogin ? "on" : ""}`} onClick={() => save({ launchAtLogin: !config.launchAtLogin })} />
          </div>
        </section>

        <section className="settings-card settings-ai-card">
          <div className="settings-card-head settings-card-head-stacked">
            <div>
              <h4>AI 服务</h4>
              <p>用于截图识别、报告概括、看板总结和快速输入理解。</p>
            </div>
          </div>
          <label className="settings-ai-provider">
            <span>API 服务</span>
            <select className="form-select" value={config.aiProvider} onChange={(e) => save({ aiProvider: e.target.value as AppConfig["aiProvider"] })}>
              <option value="none">不使用</option>
              <option value="doubao">豆包 Ark</option>
            </select>
          </label>
          {config.aiProvider === "doubao" && (
            <div className="settings-ai-key">
              <label>
                <span>ARK_API_KEY</span>
                <input
                  className="form-input"
                  type="password"
                  value={draftArkKey}
                  onChange={(e) => setDraftArkKey(e.target.value)}
                  placeholder="豆包 Ark API Key"
                />
              </label>
              <button className="btn btn-ghost btn-sm settings-action-btn" onClick={saveArkKey}>保存</button>
            </div>
          )}
        </section>

        <section className="settings-card data-card">
          <div className="settings-card-head">
            <div>
              <h4>数据管理</h4>
              <p>数据和报告都保存在本机。</p>
            </div>
            <button className="btn btn-primary btn-sm settings-action-btn" onClick={createManualBackup}>创建备份</button>
          </div>
          <div className="data-status-grid">
            <div>
              <span>数据版本</span>
              <strong>v{dataStatus?.schemaVersion ?? "—"}</strong>
            </div>
            <div>
              <span>应用版本</span>
              <strong>{dataStatus?.appVersion || "—"}</strong>
            </div>
            <div>
              <span>活动日志</span>
              <strong>{dataStatus ? `${dataStatus.activityRecords} 条 · ${formatBytes(dataStatus.activityLogBytes)}` : "—"}</strong>
            </div>
            <div>
              <span>最近活动</span>
              <strong>{formatDateTime(dataStatus?.lastActivityAt || "")}</strong>
            </div>
            <div>
              <span>备份数量</span>
              <strong>{dataStatus?.backupCount ?? "—"}</strong>
            </div>
            <div>
              <span>最近备份</span>
              <strong>{dataStatus?.latestBackup || "—"}</strong>
            </div>
          </div>
          <div className="path-row">
            <span>数据目录</span>
            <code>{dataPaths?.dataDir || "读取中..."}</code>
            <button className="btn btn-ghost btn-sm settings-action-btn" onClick={async () => {
              const res = await window.rijiAPI.openDataDir("data");
              flash(res.ok ? "已打开数据目录" : "打开失败");
            }}>打开</button>
          </div>
          <div className="path-row path-row-actions">
            <span>报告目录</span>
            <code>{dataPaths?.reportsDir || "读取中..."}</code>
            <div className="path-actions">
              <button className="btn btn-ghost btn-sm settings-action-btn" onClick={async () => {
                const res = await window.rijiAPI.openDataDir("reports");
                flash(res.ok ? "已打开报告目录" : "打开失败");
              }}>打开</button>
              <button className="btn btn-ghost btn-sm settings-action-btn" onClick={async () => {
                const res = await window.rijiAPI.chooseReportsDir();
                if (res.ok) {
                  setDataPaths(await window.rijiAPI.getDataPaths());
                  flash("报告目录已更新");
                } else if (res.canceled) {
                  flash("已取消选择");
                } else {
                  flash("选择失败");
                }
              }}>选择</button>
            </div>
          </div>
          <div className="backup-restore-row">
            <select
              className="form-select"
              value={selectedBackup}
              onChange={(e) => setSelectedBackup(e.target.value)}
              disabled={!dataStatus?.backups.length}
            >
              {(dataStatus?.backups.length ? dataStatus.backups : [""]).map((backup) => (
                <option key={backup || "empty"} value={backup}>{backup || "暂无备份"}</option>
              ))}
            </select>
            <button className="btn btn-ghost btn-sm settings-action-btn" onClick={refreshDataStatus}>刷新状态</button>
            <button className="btn btn-ghost btn-sm settings-action-btn" onClick={restoreSelectedBackup} disabled={!selectedBackup}>恢复备份</button>
          </div>
        </section>
      </div>
    </div>
  );
}
