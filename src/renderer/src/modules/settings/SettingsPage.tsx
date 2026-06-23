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
    setTimeout(() => setFeedback(""), 2000);
  }

  async function save(partial: Partial<AppConfig>) {
    const updated = { ...config, ...partial };
    setConfig(updated);
    const res = await window.rijiAPI.saveConfig(partial);
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

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Activity */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">活动采集</div>
        <div className="setting-row">
          <div>
            <div className="s-label">当前状态</div>
            <div className="s-desc">
              {activityStatus?.running ? "采集中" : "未采集"}
              {activityStatus?.platform ? ` · ${activityStatus.platform}` : ""}
              {activityStatus?.lastActivity ? ` · 最近 ${new Date(activityStatus.lastActivity.ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}` : ""}
              {activityStatus?.lastError ? ` · ${activityStatus.lastError}` : ""}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={refreshActivityStatus}>刷新</button>
        </div>
        <div className="setting-row">
          <div>
            <div className="s-label">采集开关</div>
            <div className="s-desc">启用后自动记录前台应用与窗口标题</div>
          </div>
          <button className={`toggle ${config.collectorEnabled ? "on" : ""}`} onClick={() => save({ collectorEnabled: !config.collectorEnabled })} />
        </div>
        <div className="setting-row">
          <div>
            <div className="s-label">采集间隔</div>
            <div className="s-desc">轮询间隔（秒）</div>
          </div>
          <div className="flex-row">
            <input
              className="form-input"
              type="number"
              min={10}
              max={300}
              value={draftPollInterval}
              onChange={(e) => setDraftPollInterval(e.target.value)}
              onBlur={savePollInterval}
              style={{ width: 80 }}
            />
            <button className="btn btn-ghost btn-sm" onClick={savePollInterval}>保存</button>
          </div>
        </div>
      </div>

      {/* System */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">系统</div>
        <div className="setting-row">
          <div>
            <div className="s-label">系统托盘</div>
            <div className="s-desc">关闭窗口后保持托盘图标</div>
          </div>
          <button className={`toggle ${config.trayEnabled ? "on" : ""}`} onClick={() => save({ trayEnabled: !config.trayEnabled })} />
        </div>
        <div className="setting-row">
          <div>
            <div className="s-label">开机启动</div>
            <div className="s-desc">登录时自动启动刻迹</div>
          </div>
          <button className={`toggle ${config.launchAtLogin ? "on" : ""}`} onClick={() => save({ launchAtLogin: !config.launchAtLogin })} />
        </div>
      </div>

      {/* AI */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">AI 服务</div>
        <div className="setting-row">
          <div>
            <div className="s-label">AI 后端</div>
            <div className="s-desc">用于生成报告摘要的模型</div>
          </div>
          <select className="form-select" style={{ width: 140 }} value={config.aiProvider} onChange={(e) => save({ aiProvider: e.target.value as AppConfig["aiProvider"] })}>
            <option value="none">不使用</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>
        {config.aiProvider === "deepseek" && (
          <div className="setting-row">
            <div>
              <div className="s-label">API Key</div>
              <div className="s-desc">密钥仅存本地，不经过第三方</div>
            </div>
            <div className="flex-row">
              <input
                className="form-input"
                type="password"
                value={draftDeepseekKey}
                onChange={(e) => setDraftDeepseekKey(e.target.value)}
                placeholder="sk-..."
                style={{ width: 240 }}
              />
              <button className="btn btn-ghost btn-sm" onClick={saveDeepseekKey}>保存</button>
            </div>
          </div>
        )}
      </div>

      {/* Data */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">数据管理</div>
        <div className="setting-row">
          <div>
            <div className="s-label">创建备份</div>
            <div className="s-desc">备份 workspace.json 和 config.json</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={async () => {
            const res = await window.rijiAPI.createBackup();
            setFeedback(res.ok ? "备份已创建" : "备份失败");
            if (res.ok) setTimeout(() => setFeedback(""), 2000);
          }}>创建</button>
        </div>
        <div className="setting-row">
          <div>
            <div className="s-label">数据目录</div>
            <div className="s-desc">{dataPaths?.dataDir || "读取中..."}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => window.rijiAPI.openDataDir("data")}>打开</button>
        </div>
        <div className="setting-row">
          <div>
            <div className="s-label">报告目录</div>
            <div className="s-desc">{dataPaths?.reportsDir || "读取中..."}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => window.rijiAPI.openDataDir("reports")}>打开</button>
        </div>
        <div className="setting-row">
          <div>
            <div className="s-label">数据隐私</div>
            <div className="s-desc">所有数据默认仅存储在本地，不上传云端</div>
          </div>
          <span className="tag tag-done">本地优先</span>
        </div>
      </div>

      {feedback && <div className="text-muted" style={{ textAlign: "center", marginTop: 8 }}>{feedback}</div>}
    </div>
  );
}
