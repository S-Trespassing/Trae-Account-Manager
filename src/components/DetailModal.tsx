import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import type { UsageSummary } from "../types";

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: {
    id: string;
    name: string;
    email: string;
    avatar_url: string;
    plan_type: string;
    password?: string | null;
  } | null;
  usage: UsageSummary | null;
  onUpdateCredentials: (accountId: string, updates: { email?: string; password?: string }) => Promise<void>;
}

export function DetailModal({ isOpen, onClose, account, usage, onUpdateCredentials }: DetailModalProps) {
  if (!isOpen || !account) return null;
  const [showPassword, setShowPassword] = useState(false);
  const [editingField, setEditingField] = useState<"email" | "password" | null>(null);
  const [emailDraft, setEmailDraft] = useState(account.email || "");
  const [passwordDraft, setPasswordDraft] = useState(account.password || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEmailDraft(account.email || "");
    setPasswordDraft(account.password || "");
    setEditingField(null);
    setShowPassword(false);
  }, [account.id, account.email, account.password]);

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "-";
    return new Date(timestamp * 1000).toLocaleString("zh-CN");
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
  };

  const handleClose = () => {
    setShowPassword(false);
    setEditingField(null);
    onClose();
  };

  const startEdit = (field: "email" | "password") => {
    if (isSaving) return;
    if (editingField && editingField !== field) return;
    setEditingField(field);
    if (field === "email") {
      setEmailDraft(account.email || "");
    } else {
      setPasswordDraft(account.password || "");
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEmailDraft(account.email || "");
    setPasswordDraft(account.password || "");
  };

  const handleSave = async (field: "email" | "password") => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (field === "email") {
        await onUpdateCredentials(account.id, { email: emailDraft.trim() });
      } else {
        await onUpdateCredentials(account.id, { password: passwordDraft });
      }
      setEditingField(null);
      setShowPassword(false);
    } catch {
      // 保持编辑状态，错误由上层提示
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>, field: "email" | "password") => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleSave(field);
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
        <h2>账号详情</h2>

        <div className="detail-section">
          <h3>基本信息</h3>
          <div className="detail-row">
            <span className="detail-label">用户名</span>
            <span className="detail-value">{account.name}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">邮箱</span>
            <span
              className={`detail-value ${editingField ? "" : "editable"}`}
              onDoubleClick={() => startEdit("email")}
              title="双击编辑"
            >
              {editingField === "email" ? (
                <span className="detail-edit">
                  <input
                    type="text"
                    value={emailDraft}
                    onChange={(event) => setEmailDraft(event.target.value)}
                    onKeyDown={(event) => handleKeyDown(event, "email")}
                    autoFocus
                  />
                  <div className="detail-edit-actions">
                    <button
                      type="button"
                      className="detail-edit-btn primary"
                      onClick={() => handleSave("email")}
                      disabled={isSaving}
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      className="detail-edit-btn"
                      onClick={cancelEdit}
                      disabled={isSaving}
                    >
                      取消
                    </button>
                  </div>
                </span>
              ) : (
                account.email || "-"
              )}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">密码</span>
            <span className="detail-value detail-password">
              {editingField === "password" ? (
                <span className="detail-edit">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={passwordDraft}
                    onChange={(event) => setPasswordDraft(event.target.value)}
                    onKeyDown={(event) => handleKeyDown(event, "password")}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                  <div className="detail-edit-actions">
                    <button
                      type="button"
                      className="detail-edit-btn primary"
                      onClick={() => handleSave("password")}
                      disabled={isSaving}
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      className="detail-edit-btn"
                      onClick={cancelEdit}
                      disabled={isSaving}
                    >
                      取消
                    </button>
                  </div>
                </span>
              ) : (
                <>
                  <span
                    className="detail-edit-trigger"
                    onDoubleClick={() => startEdit("password")}
                    title="双击编辑"
                  >
                    {account.password ? (showPassword ? account.password : "••••••••") : "-"}
                  </span>
                  {account.password && (
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    >
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  )}
                </>
              )}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">套餐类型</span>
            <span className="detail-value">{usage?.plan_type || account.plan_type || "Free"}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">重置时间</span>
            <span className="detail-value">{usage ? formatDate(usage.reset_time) : "-"}</span>
          </div>
        </div>

        {usage && (
          <>
            <div className="detail-section">
              <h3>Fast Request</h3>
              <div className="detail-row">
                <span className="detail-label">已使用</span>
                <span className="detail-value">{formatNumber(usage.fast_request_used)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">总配额</span>
                <span className="detail-value">{formatNumber(usage.fast_request_limit)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">剩余</span>
                <span className="detail-value success">{formatNumber(usage.fast_request_left)}</span>
              </div>
            </div>

            {usage.extra_fast_request_limit > 0 && (
              <div className="detail-section">
                <h3>额外礼包 {usage.extra_package_name && `(${usage.extra_package_name})`}</h3>
                <div className="detail-row">
                  <span className="detail-label">已使用</span>
                  <span className="detail-value">{formatNumber(usage.extra_fast_request_used)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">总配额</span>
                  <span className="detail-value">{formatNumber(usage.extra_fast_request_limit)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">剩余</span>
                  <span className="detail-value success">{formatNumber(usage.extra_fast_request_left)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">过期时间</span>
                  <span className="detail-value">{formatDate(usage.extra_expire_time)}</span>
                </div>
              </div>
            )}

            <div className="detail-section">
              <h3>其他配额</h3>
              <div className="detail-row">
                <span className="detail-label">Slow Request</span>
                <span className="detail-value">
                  {formatNumber(usage.slow_request_used)} / {formatNumber(usage.slow_request_limit)}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Advanced Model</span>
                <span className="detail-value">
                  {formatNumber(usage.advanced_model_used)} / {formatNumber(usage.advanced_model_limit)}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Autocomplete</span>
                <span className="detail-value">
                  {formatNumber(usage.autocomplete_used)} / {formatNumber(usage.autocomplete_limit)}
                </span>
              </div>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button onClick={handleClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
