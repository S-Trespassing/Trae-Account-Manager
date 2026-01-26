import { useEffect, useState } from "react";

interface AccountLoginModalProps {
  isOpen: boolean;
  accountId: string;
  accountName: string;
  initialEmail?: string;
  onClose: () => void;
  onSubmit: (accountId: string, email: string, password: string) => Promise<void>;
}

export function AccountLoginModal({
  isOpen,
  accountId,
  accountName,
  initialEmail = "",
  onClose,
  onSubmit,
}: AccountLoginModalProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail);
      setPassword("");
      setError("");
    }
  }, [isOpen, initialEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("请输入邮箱和密码");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onSubmit(accountId, email.trim(), password);
      onClose();
    } catch (err: any) {
      setError(err.message || "登录失败，请检查邮箱和密码");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setError("");
    setPassword("");
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>账号重新登录</h2>

        <p className="modal-desc">
          账号 <strong>{accountName}</strong> 的登录信息已失效，请输入邮箱和密码以刷新 Cookie 和 Token。
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <label className="form-label">
              邮箱<span className="required">*</span>
            </label>
            <input
              className="modal-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入账号邮箱"
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="form-section">
            <label className="form-label">
              密码<span className="required">*</span>
            </label>
            <input
              className="modal-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入账号密码"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" onClick={handleClose} disabled={loading}>
              取消
            </button>
            <button type="submit" className="primary" disabled={loading}>
              {loading ? "登录中..." : "确认登录"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
