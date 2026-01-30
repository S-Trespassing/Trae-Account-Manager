interface UpdateModalProps {
  isOpen: boolean;
  currentVersion: string;
  latestVersion: string;
  notes?: string;
  isBusy?: boolean;
  onLater: () => void;
  onIgnore: () => void;
  onUpdate: () => void;
}

export function UpdateModal({
  isOpen,
  currentVersion,
  latestVersion,
  notes,
  isBusy = false,
  onLater,
  onIgnore,
  onUpdate,
}: UpdateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={isBusy ? undefined : onLater}>
      <div className="update-modal" onClick={(e) => e.stopPropagation()}>
        <div className="update-icon">⬆️</div>
        <h3 className="update-title">发现新版本</h3>
        <p className="update-message">
          当前版本 {currentVersion}，可更新到 {latestVersion}。
        </p>
        {notes ? <pre className="update-notes">{notes}</pre> : null}
        <div className="update-actions">
          <button className="update-btn secondary" onClick={onLater} disabled={isBusy}>
            稍后
          </button>
          <button className="update-btn secondary" onClick={onIgnore} disabled={isBusy}>
            忽略此版本
          </button>
          <button className="update-btn primary" onClick={onUpdate} disabled={isBusy}>
            {isBusy ? "下载并安装中..." : "一键更新"}
          </button>
        </div>
      </div>
    </div>
  );
}

