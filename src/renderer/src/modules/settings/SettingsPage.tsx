import { useEffect, useState } from "react";
import type { ActivityRecord, AppConfig } from "../../../../shared/types";
import { DEFAULT_CONFIG } from "../../../../shared/defaults";

interface ActivityStatus {
  running: boolean;
  platform: string;
  lastError: string;
  lastActivity?: ActivityRecord;
}

export function SettingsPage() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [draftPollInterval, setDraftPollInterval] = useState(String(DEFAULT_CONFIG.pollIntervalSeconds));
  const [draftDeepseekKey, setDraftDeepseekKey] = useState("");
  const [activityStatus, setActivityStatus] = useState<ActivityStatus | null>(null);
  const [dataPaths, setDataPaths] = useState<{ dataDir: string; reportsDir: string } | null>(null);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.rijiAPI.getConfig().then((cfg: AppConfig) => {
      setConfig(cfg);
      setDraftPollInterval(String(cfg.pollIntervalSeconds));
      setDraftDeepseekKey(cfg.deepseekKey || "");
      setLoading(false);
    });
    refreshActivityStatus();
    window.rijiAPI.getDataPaths().then(setDataPaths);
  }, []);

  async function refreshActivityStatus() {
    setActivityStatus(await window.rijiAPI.activityStatus());
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
    const value = Math.min(300, Math.max(10, Number(draftPollInterval) || config.pollIntervalSeconds));
    setDraftPollInterval(String(value));
    await save({ pollIntervalSeconds: value });
  }

  async function saveDeepseekKey() {
    await save({ deepseekKey: draftDeepseekKey.trim() });
  }

  if (loading) return <div className="text-muted">加载中...</div>;

  const lastActivityText = activityStatus?.lastActivity
    ? new Date(activityStatus.lastActivity.ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    : "暂无";

  return (
    <div className="settings-page">
      <div className="settings-hero">
        <div>
          <div className="settings-eyebrow">本地优先</div>
          <h3>设置</h3>
          <p>管理采集、快捷输入、系统行为和本地数据。</p>
        </div>
        {feedback && <div className="settings-feedback">{feedback}</div>}
      </div>

      <div className="settings-grid">
        <section className="settings-card primary">
          <div className="settings-card-head">
            <div>
              <h4>活动采集</h4>
              <p>{activityStatus?.running ? "正在记录前台应用与窗口标题" : "采集已暂停"}</p>
            </div>
            <button className={`toggle ${config.collectorEnabled ? "on" : ""}`} onClick={() => save({ collectorEnabled: !config.collectorEnabled })} />
          </div>

          <div className="settings-status-row">
            <div>
              <span>状态</span>
              <strong>{activityStatus?.running ? "采集中" : "未采集"}</strong>
            </div>
            <div>
              <span>平台</span>
              <strong>{activityStatus?.platform || "-"}</strong>
            </div>
            <div>
              <span>最近活动</span>
              <strong>{lastActivityText}</strong>
            </div>
          </div>

          {activityStatus?.lastError && <div className="settings-warning">{activityStatus.lastError}</div>}

          <div className="settings-inline">
            <label>
              <span>采集间隔</span>
              <input
                className="form-input"
                type="number"
                min={10}
                max={300}
                value={draftPollInterval}
                onChange={(e) => setDraftPollInterval(e.target.value)}
                onBlur={savePollInterval}
              />
            </label>
            <button className="btn btn-ghost btn-sm" onClick={savePollInterval}>保存</button>
            <button className="btn btn-ghost btn-sm" onClick={async () => {
              await refreshActivityStatus();
              flash("状态已刷新");
            }}>刷新</button>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-head">
            <div>
              <h4>快捷输入</h4>
              <p>连按两次 Ctrl 唤出输入框。</p>
            </div>
            <span className="shortcut-pill">Ctrl Ctrl</span>
          </div>
          <div className="settings-command-list">
            <span>任务 #项目 @明天 !高</span>
            <span>论文 写结果 90min 800字</span>
            <span>投稿 cover letter #期刊</span>
            <span>生成日报 / 备份 / 打开报告</span>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-head">
            <div>
              <h4>系统</h4>
              <p>菜单栏图标和启动行为。</p>
            </div>
          </div>
          <div className="setting-row compact">
            <div>
              <div className="s-label">菜单栏图标</div>
              <div className="s-desc">可从菜单栏打开刻迹或快速输入</div>
            </div>
            <button className={`toggle ${config.trayEnabled ? "on" : ""}`} onClick={() => save({ trayEnabled: !config.trayEnabled })} />
          </div>
          <div className="setting-row compact">
            <div>
              <div className="s-label">开机启动</div>
              <div className="s-desc">登录时自动启动刻迹</div>
            </div>
            <button className={`toggle ${config.launchAtLogin ? "on" : ""}`} onClick={() => save({ launchAtLogin: !config.launchAtLogin })} />
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-head">
            <div>
              <h4>AI 服务</h4>
              <p>用于生成报告摘要。</p>
            </div>
            <select className="form-select" value={config.aiProvider} onChange={(e) => save({ aiProvider: e.target.value as AppConfig["aiProvider"] })}>
              <option value="none">不使用</option>
              <option value="deepseek">DeepSeek</option>
            </select>
          </div>
          {config.aiProvider === "deepseek" && (
            <div className="settings-inline wide">
              <label>
                <span>API Key</span>
                <input
                  className="form-input"
                  type="password"
                  value={draftDeepseekKey}
                  onChange={(e) => setDraftDeepseekKey(e.target.value)}
                  placeholder="sk-..."
                />
              </label>
              <button className="btn btn-ghost btn-sm" onClick={saveDeepseekKey}>保存</button>
            </div>
          )}
        </section>

        <section className="settings-card data-card">
          <div className="settings-card-head">
            <div>
              <h4>数据管理</h4>
              <p>数据和报告都保存在本机。</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={async () => {
              const res = await window.rijiAPI.createBackup();
              flash(res.ok ? "备份已创建" : "备份失败");
            }}>创建备份</button>
          </div>
          <div className="path-row">
            <span>数据目录</span>
            <code>{dataPaths?.dataDir || "读取中..."}</code>
            <button className="btn btn-ghost btn-sm" onClick={async () => {
              const res = await window.rijiAPI.openDataDir("data");
              flash(res.ok ? "已打开数据目录" : "打开失败");
            }}>打开</button>
          </div>
          <div className="path-row">
            <span>报告目录</span>
            <code>{dataPaths?.reportsDir || "读取中..."}</code>
            <button className="btn btn-ghost btn-sm" onClick={async () => {
              const res = await window.rijiAPI.openDataDir("reports");
              flash(res.ok ? "已打开报告目录" : "打开失败");
            }}>打开</button>
          </div>
        </section>
      </div>
    </div>
  );
}
