import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import * as api from "../api";
import type { AppSettings } from "../types";

interface SettingsProps {
  onToast?: (type: "success" | "error" | "warning" | "info", message: string, duration?: number) => void;
  settings?: AppSettings | null;
  onSettingsChange?: (settings: AppSettings) => void;
}

export function Settings({
  onToast,
  settings,
  onSettingsChange,
}: SettingsProps) {
  const [traeMachineId, setTraeMachineId] = useState<string>("");
  const [traeRefreshing, setTraeRefreshing] = useState(false);
  const [clearingTrae, setClearingTrae] = useState(false);
  const [traePath, setTraePath] = useState<string>("");
  const [traePathLoading, setTraePathLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const defaultSettings = useMemo<AppSettings>(
    () => ({
      quick_register_show_window: true,
      auto_refresh_enabled: true,
      privacy_auto_enable: false,
    }),
    []
  );
  const [appSettings, setAppSettings] = useState<AppSettings | null>(settings ?? null);

  // 加载 Trae IDE 机器码
  const loadTraeMachineId = async () => {
    setTraeRefreshing(true);
    try {
      const id = await api.getTraeMachineId();
      setTraeMachineId(id);
    } catch (err: any) {
      console.error("获取 Trae IDE 机器码失败:", err);
      setTraeMachineId("未找到");
    } finally {
      setTraeRefreshing(false);
    }
  };

  // 加载 Trae IDE 路径
  const loadTraePath = async () => {
    setTraePathLoading(true);
    try {
      const path = await api.getTraePath();
      setTraePath(path);
    } catch (err: any) {
      console.error("获取 Trae IDE 路径失败:", err);
      setTraePath("");
    } finally {
      setTraePathLoading(false);
    }
  };

  useEffect(() => {
    loadTraeMachineId();
    loadTraePath();
  }, []);

  useEffect(() => {
    if (settings) {
      setAppSettings(settings);
    }
  }, [settings]);

  useEffect(() => {
    if (appSettings) return;
    api.getSettings()
      .then((value) => setAppSettings(value))
      .catch(() => setAppSettings(defaultSettings));
  }, [appSettings, defaultSettings]);

  // 复制 Trae IDE 机器码
  const handleCopyTraeMachineId = async () => {
    try {
      await navigator.clipboard.writeText(traeMachineId);
      onToast?.("success", "Trae IDE 机器码已复制到剪贴板");
    } catch {
      onToast?.("error", "复制失败");
    }
  };

  // 清除 Trae IDE 登录状态
  const handleClearTraeLoginState = async () => {
    if (!confirm("确定要清除 Trae IDE 登录状态吗？\n\n这将：\n• 重置 Trae IDE 机器码\n• 清除所有登录信息\n• 删除本地缓存数据\n\n操作后 Trae IDE 将变成全新安装状态，需要重新登录。\n\n请确保 Trae IDE 已关闭！")) {
      return;
    }

    setClearingTrae(true);
    try {
      await api.clearTraeLoginState();
      await loadTraeMachineId(); // 重新加载新的机器码
      onToast?.("success", "Trae IDE 登录状态已清除，请重新打开 Trae IDE 登录");
    } catch (err: any) {
      onToast?.("error", err.message || "清除失败");
    } finally {
      setClearingTrae(false);
    }
  };

  // 自动扫描 Trae IDE 路径
  const handleScanTraePath = async () => {
    setScanning(true);
    try {
      const path = await api.scanTraePath();
      setTraePath(path);
      onToast?.("success", "已找到 Trae IDE: " + path);
    } catch (err: any) {
      onToast?.("error", err.message || "未找到 Trae IDE，请手动设置路径");
    } finally {
      setScanning(false);
    }
  };

  // 手动设置 Trae IDE 路径
  const handleSetTraePath = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: "Trae IDE",
          extensions: ["exe"]
        }],
        title: "选择 Trae.exe 文件"
      });

      if (selected) {
        const path = selected as string;
        await api.setTraePath(path);
        setTraePath(path);
        onToast?.("success", "Trae IDE 路径已保存");
      }
    } catch (err: any) {
      onToast?.("error", err.message || "选择文件失败");
    }
  };

  const updateSettings = async (updates: Partial<AppSettings>, successMessage: string) => {
    const base = appSettings ?? defaultSettings;
    const next = { ...base, ...updates };
    try {
      const saved = await api.updateSettings(next);
      setAppSettings(saved);
      onSettingsChange?.(saved);
      onToast?.("success", successMessage, 1000);
    } catch (err: any) {
      onToast?.("error", err.message || "更新设置失败");
    }
  };

  const currentSettings = appSettings ?? defaultSettings;
  const settingsDisabled = !appSettings;
  const handlePrivacyHelp = () => {
    const message =
      "启用隐私模式后，TRAE不会存储或使用您的任何聊天交互内容（包括相关代码片段）用于分析、产品改进或模型训练。";
    if (onToast) {
      onToast("info", message, 4000);
    } else {
      alert(message);
    }
  };

  return (
    <div className="settings-page">
      {/* Trae IDE 机器码 */}
      <div className="settings-section">
        <h3>Trae IDE 机器码</h3>
        <div className="machine-id-card trae-card">
          <div className="machine-id-header">
            <div className="machine-id-icon trae-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div className="machine-id-title">
              <span>Trae IDE MachineId</span>
              <span className="machine-id-subtitle">Trae IDE 客户端唯一标识符</span>
            </div>
          </div>
          <div className="machine-id-value">
            <code>{traeRefreshing ? "加载中..." : traeMachineId}</code>
          </div>
          <div className="machine-id-actions">
            <button
              className="machine-id-btn"
              onClick={loadTraeMachineId}
              disabled={traeRefreshing}
              title="刷新"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              刷新
            </button>
            <button
              className="machine-id-btn"
              onClick={handleCopyTraeMachineId}
              disabled={!traeMachineId || traeRefreshing || traeMachineId === "未找到"}
              title="复制"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              复制
            </button>
            <button
              className="machine-id-btn danger"
              onClick={handleClearTraeLoginState}
              disabled={clearingTrae || traeRefreshing}
              title="清除登录状态"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
              {clearingTrae ? "清除中..." : "清除登录状态"}
            </button>
          </div>
          <div className="machine-id-tip warning">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>清除登录状态会重置机器码并删除所有登录信息，Trae IDE 将需要重新登录。请先关闭 Trae IDE。</span>
          </div>
        </div>
      </div>

      {/* Trae IDE 路径设置 */}
      <div className="settings-section">
        <h3>Trae IDE 路径</h3>
        <div className="machine-id-card trae-card">
          <div className="machine-id-header">
            <div className="machine-id-icon trae-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div className="machine-id-title">
              <span>Trae IDE 安装路径</span>
              <span className="machine-id-subtitle">用于自动打开 Trae IDE</span>
            </div>
          </div>
          <div className="machine-id-value">
            <code>{traePathLoading ? "加载中..." : (traePath || "未设置")}</code>
          </div>
          <div className="machine-id-actions">
            <button
              className="machine-id-btn"
              onClick={handleScanTraePath}
              disabled={scanning}
              title="自动扫描"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              {scanning ? "扫描中..." : "自动扫描"}
            </button>
            <button
              className="machine-id-btn"
              onClick={handleSetTraePath}
              title="手动设置"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              手动设置
            </button>
          </div>
          <div className="machine-id-tip">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4"/>
              <path d="M12 8h.01"/>
            </svg>
            <span>切换账号后会自动打开 Trae IDE。如果自动扫描找不到，请手动设置 Trae.exe 的完整路径。</span>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>通用设置</h3>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">
              自动开启隐私模式
              <button type="button" className="setting-help" onClick={handlePrivacyHelp}>
                ?
              </button>
            </div>
            <div className="setting-desc">切换账号后自动开启 Trae 隐私模式，Trae将额外重启一次用来应用配置</div>
          </div>
          <div className="setting-action">
            <button
              type="button"
              className={`pill-toggle ${currentSettings.privacy_auto_enable ? "on" : ""}`}
              onClick={() =>
                updateSettings(
                  { privacy_auto_enable: !currentSettings.privacy_auto_enable },
                  "已更新隐私模式设置"
                )
              }
              disabled={settingsDisabled}
              role="switch"
              aria-checked={currentSettings.privacy_auto_enable}
            >
              <span className="pill-track"></span>
              <span className="pill-thumb"></span>
            </button>
          </div>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">快速注册显示浏览器窗口</div>
            <div className="setting-desc">关闭后在后台完成注册并通过通知提示进度</div>
          </div>
          <div className="setting-action">
            <button
              type="button"
              className={`pill-toggle ${currentSettings.quick_register_show_window ? "on" : ""}`}
              onClick={() =>
                updateSettings(
                  { quick_register_show_window: !currentSettings.quick_register_show_window },
                  "已更新快速注册显示设置"
                )
              }
              disabled={settingsDisabled}
              role="switch"
              aria-checked={currentSettings.quick_register_show_window}
            >
              <span className="pill-track"></span>
              <span className="pill-thumb"></span>
            </button>
          </div>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">自动刷新</div>
            <div className="setting-desc">定时自动刷新账号使用量数据</div>
          </div>
          <div className="setting-action">
            <button
              type="button"
              className={`pill-toggle ${currentSettings.auto_refresh_enabled ? "on" : ""}`}
              onClick={() =>
                updateSettings(
                  { auto_refresh_enabled: !currentSettings.auto_refresh_enabled },
                  "已更新自动刷新设置"
                )
              }
              disabled={settingsDisabled}
              role="switch"
              aria-checked={currentSettings.auto_refresh_enabled}
            >
              <span className="pill-track"></span>
              <span className="pill-thumb"></span>
            </button>
          </div>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">刷新间隔</div>
            <div className="setting-desc">自动刷新的时间间隔（分钟）</div>
          </div>
          <div className="setting-action">
            <select className="setting-select" disabled={settingsDisabled}>
              <option value="5">5 分钟</option>
              <option value="10">10 分钟</option>
              <option value="30">30 分钟</option>
              <option value="60">60 分钟</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
