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

  const CheckIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );

  const XIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );

  const EyeIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  );

  const EyeOffIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
      <line x1="1" y1="1" x2="23" y2="23"></line>
    </svg>
  );

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
        <h2>账号详情</h2>

        <div className="detail-section">
          <h3 style={{ display: 'flex', alignItems: 'center' }}>
            基本信息
            <span style={{ 
              fontSize: '12px', 
              color: 'var(--text-muted)', 
              fontWeight: 'normal',
              marginLeft: '8px',
              background: 'var(--bg-hover)',
              padding: '2px 8px',
              borderRadius: '4px'
            }}>
              双击邮箱或密码可编辑
            </span>
          </h3>
          <div className="detail-row">
            <span className="detail-label">用户名</span>
            <span className="detail-value">{account.name}</span>
          </div>
          <div className="detail-row" style={{ alignItems: 'center' }}>
            <span className="detail-label">邮箱</span>
            <span
              className={`detail-value ${editingField ? "" : "editable"}`}
              style={{ flex: 1, marginLeft: '12px', textAlign: 'right' }}
              onDoubleClick={() => startEdit("email")}
              title="双击编辑"
            >
              {editingField === "email" ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'flex-end' }}>
                  <input
                    type="text"
                    value={emailDraft}
                    onChange={(event) => setEmailDraft(event.target.value)}
                    onKeyDown={(event) => handleKeyDown(event, "email")}
                    autoFocus
                    style={{ 
                      width: '240px',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => handleSave("email")}
                      disabled={isSaving}
                      title="保存"
                      style={{ 
                        width: '28px', 
                        height: '28px', 
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'var(--success-bg)',
                        color: 'var(--success)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                         e.currentTarget.style.background = 'var(--success)';
                         e.currentTarget.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                         e.currentTarget.style.background = 'var(--success-bg)';
                         e.currentTarget.style.color = 'var(--success)';
                      }}
                    >
                      <CheckIcon />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={isSaving}
                      title="取消"
                      style={{ 
                        width: '28px', 
                        height: '28px', 
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'var(--bg-hover)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                         e.currentTarget.style.background = 'var(--bg-active)';
                         e.currentTarget.style.color = 'var(--text-primary)';
                      }}
                      onMouseLeave={(e) => {
                         e.currentTarget.style.background = 'var(--bg-hover)';
                         e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                    >
                      <XIcon />
                    </button>
                  </div>
                </div>
              ) : (
                account.email || "-"
              )}
            </span>
          </div>
          <div className="detail-row" style={{ alignItems: 'center' }}>
            <span className="detail-label">密码</span>
            <span className="detail-value detail-password" style={{ flex: 1, marginLeft: '12px' }}>
              {editingField === "password" ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ position: 'relative', width: '240px', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={passwordDraft}
                      onChange={(event) => setPasswordDraft(event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, "password")}
                      autoFocus
                      style={{ 
                        width: '100%',
                        padding: '6px 30px 6px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                      }}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                      style={{ 
                        position: 'absolute', 
                        right: '8px', 
                        display: 'flex', 
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        color: 'var(--text-muted)'
                      }}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => handleSave("password")}
                      disabled={isSaving}
                      title="保存"
                      style={{ 
                        width: '28px', 
                        height: '28px', 
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'var(--success-bg)',
                        color: 'var(--success)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                         e.currentTarget.style.background = 'var(--success)';
                         e.currentTarget.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                         e.currentTarget.style.background = 'var(--success-bg)';
                         e.currentTarget.style.color = 'var(--success)';
                      }}
                    >
                      <CheckIcon />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={isSaving}
                      title="取消"
                      style={{ 
                        width: '28px', 
                        height: '28px', 
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'var(--bg-hover)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                         e.currentTarget.style.background = 'var(--bg-active)';
                         e.currentTarget.style.color = 'var(--text-primary)';
                      }}
                      onMouseLeave={(e) => {
                         e.currentTarget.style.background = 'var(--bg-hover)';
                         e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                    >
                      <XIcon />
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
                  <span
                    className="detail-edit-trigger"
                    onDoubleClick={() => startEdit("password")}
                    title="双击编辑"
                    style={{ cursor: 'pointer' }}
                  >
                    {account.password ? (showPassword ? account.password : "••••••••") : "-"}
                  </span>
                  {account.password && (
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                      style={{ display: 'flex', alignItems: 'center' }}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  )}
                </div>
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
