import { useState } from "react";

interface UpdateTokenModalProps {
  isOpen: boolean;
  accountId: string;
  accountName: string;
  onClose: () => void;
  onUpdate: (accountId: string, token: string) => Promise<void>;
}

export function UpdateTokenModal({
  isOpen,
  accountId,
  accountName,
  onClose,
  onUpdate,
}: UpdateTokenModalProps) {
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  // 从输入中提取 Token
  const extractToken = (input: string): string | null => {
    const trimmed = input.trim();

    // 情况1: 直接是 JWT Token (以 eyJ 开头)
    if (trimmed.startsWith("eyJ")) {
      return trimmed;
    }

    // 情况2: 是 JSON 响应，尝试解析
    try {
      const json = JSON.parse(trimmed);

      // GetUserToken 接口的响应格式
      if (json.Result?.Token) {
        return json.Result.Token;
      }

      // 可能是其他格式
      if (json.token) {
        return json.token;
      }
      if (json.Token) {
        return json.Token;
      }
    } catch {
      // 不是有效的 JSON，继续尝试其他方式
    }

    // 情况3: 尝试用正则提取 Token
    const tokenMatch = trimmed.match(/"Token"\s*:\s*"(eyJ[^"]+)"/);
    if (tokenMatch) {
      return tokenMatch[1];
    }

    // 情况4: 尝试提取任何 eyJ 开头的字符串
    const jwtMatch = trimmed.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
    if (jwtMatch) {
      return jwtMatch[0];
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) {
      setError("请输入新的 Token");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = extractToken(inputValue);

      if (!token) {
        setError("无法识别 Token，请确保输入正确的 Token 或 GetUserToken 接口响应");
        setLoading(false);
        return;
      }

      await onUpdate(accountId, token);
      setInputValue("");
      onClose();
    } catch (err: any) {
      setError(err.message || "更新 Token 失败");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError("");
    setInputValue("");
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>更新 Token</h2>

        <p className="modal-desc">
          为账号 <strong>{accountName}</strong> 更新 Token。
          <br />
          <small>请确保新 Token 属于同一个用户，否则更新会失败。</small>
        </p>

        <div className="token-help">
          <details>
            <summary>如何获取新 Token？</summary>
            <ol>
              <li>打开 <a href="https://www.trae.ai/account-setting#usage" target="_blank" rel="noopener noreferrer">trae.ai 账号设置页面</a> 并登录对应账号</li>
              <li>按 <kbd>F12</kbd> 打开开发者工具</li>
              <li>切换到 <strong>Network</strong> 标签</li>
              <li>刷新页面</li>
   <li>在请求列表中找到 <code>GetUserToken</code></li>
              <li>点击该请求，在右侧找到 <strong>Response</strong> 标签</li>
              <li>复制整个响应内容，粘贴到下方</li>
            </ol>
          </details>
        </div>

        <form onSubmit={handleSubmit}>
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder='粘贴新的 Token 或 API 响应...'
            rows={8}
            disabled={loading}
          />

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" onClick={handleClose} disabled={loading}>
              取消
            </button>
            <button type="submit" className="primary" disabled={loading}>
              {loading ? "更新中..." : "更新 Token"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
