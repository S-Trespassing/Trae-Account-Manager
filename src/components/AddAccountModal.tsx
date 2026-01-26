import { useRef, useState } from "react";
import * as api from "../api";

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast?: (type: "success" | "error" | "warning" | "info", message: string) => void;
  onAccountAdded?: () => void;
  quickRegisterShowWindow?: boolean;
}

type AddMode = "trae-ide" | "browser" | "register";

export function AddAccountModal({
  isOpen,
  onClose,
  onToast,
  onAccountAdded,
  quickRegisterShowWindow = true,
}: AddAccountModalProps) {
  const [mode, setMode] = useState<AddMode>("trae-ide");
  const [browserStarted, setBrowserStarted] = useState(false);
  const [browserWaiting, setBrowserWaiting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const browserRunRef = useRef(0);

  if (!isOpen) return null;

  const handleReadTraeAccount = async () => {
    setLoading(true);
    setError("");

    try {
      const account = await api.readTraeAccount();
      if (account) {
        onToast?.("success", `成功读取 Trae IDE 账号: ${account.email}`);
        onAccountAdded?.();
        handleClose();
      } else {
        setError("未找到 Trae IDE 登录账号或账号已存在");
      }
    } catch (err: any) {
      setError(err.message || "读取 Trae IDE 账号失败");
    } finally {
      setLoading(false);
    }
  };

  const handleBrowserStart = async () => {
    setLoading(true);
    setError("");
    const runId = browserRunRef.current + 1;
    browserRunRef.current = runId;

    try {
      await api.startBrowserLogin();
      setBrowserStarted(true);
      setBrowserWaiting(true);
      onToast?.("info", "已打开登录窗口，完成登录后将自动导入。");
      void (async () => {
        try {
          const account = await api.finishBrowserLogin();
          if (browserRunRef.current !== runId) return;
          onToast?.("success", `成功添加账号: ${account.email}`);
          onAccountAdded?.();
          handleClose();
        } catch (err: any) {
          if (browserRunRef.current !== runId) return;
          setError(err.message || "等待浏览器登录失败");
        } finally {
          if (browserRunRef.current === runId) {
            setBrowserWaiting(false);
          }
        }
      })();
    } catch (err: any) {
      if (browserRunRef.current === runId) {
        setError(err.message || "打开浏览器登录窗口失败");
        setBrowserStarted(false);
        setBrowserWaiting(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBrowserCancel = async () => {
    browserRunRef.current += 1;
    try {
      await api.cancelBrowserLogin();
    } catch {} finally {
      setBrowserStarted(false);
      setBrowserWaiting(false);
    }
  };

  const handleQuickRegister = async () => {
    setLoading(true);
    setError("");

    try {
      const account = await api.quickRegister(quickRegisterShowWindow);
      onToast?.("success", `注册成功，已导入账号: ${account.email}`);
      onAccountAdded?.();
      handleClose();
    } catch (err: any) {
      setError(err.message || "快速注册失败");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    browserRunRef.current += 1;
    setError("");
    setBrowserStarted(false);
    setBrowserWaiting(false);
    setMode("trae-ide");
    void api.cancelBrowserLogin();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content add-account-modal" onClick={(e) => e.stopPropagation()}>
        <h2>添加账号</h2>

        <div className="add-mode-tabs">
          <button
            className={`mode-tab ${mode === "trae-ide" ? "active" : ""}`}
            onClick={() => setMode("trae-ide")}
            disabled={loading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            从 Trae IDE 读取
          </button>
          <button
            className={`mode-tab ${mode === "browser" ? "active" : ""}`}
            onClick={() => setMode("browser")}
            disabled={loading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            浏览器登录
          </button>
          <button
            className={`mode-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => setMode("register")}
            disabled={loading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            快速注册
          </button>
        </div>

        {mode === "trae-ide" ? (
          <div className="trae-ide-mode">
            <div className="mode-description">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              <h3>自动检测本地 Trae IDE 账号</h3>
              <p>系统会自动读取本地 Trae IDE 当前登录的账号信息，无需手动输入。</p>
              <div className="mode-features">
                <div className="feature-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>自动获取 Token</span>
                </div>
                <div className="feature-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>自动获取用户信息</span>
                </div>
                <div className="feature-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>一键导入</span>
                </div>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="modal-actions">
              <button type="button" onClick={handleClose} disabled={loading}>
                取消
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleReadTraeAccount}
                disabled={loading}
              >
                {loading ? "读取中..." : "读取本地账号"}
              </button>
            </div>
          </div>
        ) : mode === "browser" ? (
          <div className="trae-ide-mode">
            <div className="mode-description">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <h3>使用浏览器登录并自动导入</h3>
              <ol>
                <li>点击下方按钮打开登录窗口</li>
                <li>在新窗口完成 Trae 登录</li>
                <li>系统会自动获取信息并导入</li>
              </ol>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="modal-actions">
              <button type="button" onClick={handleClose} disabled={loading}>
                取消
              </button>
              {!browserStarted ? (
                <button type="button" className="primary" onClick={handleBrowserStart} disabled={loading}>
                  {loading ? "正在打开..." : "打开登录窗口"}
                </button>
              ) : (
                <>
                  <button type="button" onClick={handleBrowserCancel} disabled={loading}>
                    重新开始
                  </button>
                  <button type="button" className="primary" disabled>
                    {browserWaiting ? "自动导入中..." : "等待登录完成"}
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="trae-ide-mode">
            <div className="mode-description">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              <h3>快速注册并自动导入</h3>
              <ol>
                <li>系统自动生成邮箱并完成注册</li>
                <li>注册成功后自动获取账号信息</li>
                <li>完成后会自动导入到列表</li>
              </ol>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="modal-actions">
              <button type="button" onClick={handleClose} disabled={loading}>
                取消
              </button>
              <button type="button" className="primary" onClick={handleQuickRegister} disabled={loading}>
                {loading ? "注册中..." : "快速注册并导入"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
