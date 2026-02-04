import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { save } from "@tauri-apps/plugin-dialog";
import { Sidebar } from "./components/Sidebar";
import { AccountCard } from "./components/AccountCard";
import { AccountListItem } from "./components/AccountListItem";
import { AddAccountModal } from "./components/AddAccountModal";
import { ContextMenu } from "./components/ContextMenu";
import { DetailModal } from "./components/DetailModal";
import { AccountLoginModal } from "./components/AccountLoginModal";
import { Toast, ToastMessage } from "./components/Toast";
import { ConfirmModal } from "./components/ConfirmModal";
import { UpdateModal } from "./components/UpdateModal";
import { Dashboard } from "./pages/Dashboard";
import { Stats } from "./pages/Stats";
import { Settings } from "./pages/Settings";
import { About } from "./pages/About";
import * as api from "./api";
import type { AccountBrief, AppSettings, UsageSummary } from "./types";
import "./App.css";

interface AccountWithUsage extends AccountBrief {
  usage?: UsageSummary | null;
  password?: string | null;
}

type ViewMode = "grid" | "list";
const USAGE_CACHE_KEY = "trae_usage_cache_v1";
const UPDATE_CHECK_URL = "https://api.github.com/repos/S-Trespassing/Trae-Account-Manager/releases/latest";
const UPDATE_IGNORE_KEY = "trae_update_ignore_version_v1";

const normalizeVersion = (value: string) => value.trim().replace(/^v/i, "");
const parseVersion = (value: string) =>
  normalizeVersion(value)
    .match(/\d+/g)
    ?.map((part) => Number(part)) ?? [];
const compareVersions = (a: string, b: string) => {
  const aParts = parseVersion(a);
  const bParts = parseVersion(b);
  const length = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < length; i += 1) {
    const left = aParts[i] ?? 0;
    const right = bParts[i] ?? 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }
  return 0;
};

type UpdateInfo = {
  currentVersion: string;
  latestVersion: string;
  installerUrl: string | null;
  notes?: string;
};

function App() {
  const [accounts, setAccounts] = useState<AccountWithUsage[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [emailFilter, setEmailFilter] = useState("");

  // Toast 通知状态
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // 更新提示弹窗状态
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updating, setUpdating] = useState(false);

  // 确认弹窗状态
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "danger" | "warning" | "info";
    onConfirm: () => void;
  } | null>(null);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    accountId: string;
  } | null>(null);

  // 详情弹窗状态
  const [detailAccount, setDetailAccount] = useState<AccountWithUsage | null>(null);

  // 刷新中的账号 ID
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());

  // 重新登录弹窗状态
  const [loginModal, setLoginModal] = useState<{
    accountId: string;
    accountName: string;
    initialEmail?: string;
  } | null>(null);

  const quickRegisterNoticeRef = useRef<Map<string, number>>(new Map());
  const toastDedupRef = useRef<Map<string, number>>(new Map());
  const updateCheckRef = useRef(false);
  const quickRegisterShowWindow = appSettings?.quick_register_show_window ?? true;

  // 网络状态监听
  const offlineToastIdRef = useRef<string | null>(null);



  // 添加 Toast 通知
  const addToast = useCallback(
    (type: ToastMessage["type"], message: string, duration?: number, dedupeKey?: string) => {
      if (dedupeKey) {
        const now = Date.now();
        const last = toastDedupRef.current.get(dedupeKey);
        if (last && now - last < 800) {
          return;
        }
        toastDedupRef.current.set(dedupeKey, now);
      }
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((prev) => [...prev, { id, type, message, duration }]);
    },
    []
  );

  // 移除 Toast 通知
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const checkForUpdates = useCallback(async () => {
    if (!navigator.onLine) return;
    if (updateInfo) return;
    try {
      const response = await fetch(UPDATE_CHECK_URL, {
        headers: {
          Accept: "application/vnd.github+json",
        },
      });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as {
        tag_name?: string;
        name?: string;
        body?: string;
        assets?: Array<{ name?: string; browser_download_url?: string }>;
      };
      const latestTag = String(data.tag_name || data.name || "").trim();
      if (!latestTag) return;
      const currentVersion = await getVersion();
      if (!currentVersion) return;
      if (compareVersions(latestTag, currentVersion) > 0) {
        try {
          const ignoredVersion = localStorage.getItem(UPDATE_IGNORE_KEY) || "";
          if (
            ignoredVersion &&
            normalizeVersion(ignoredVersion) === normalizeVersion(latestTag)
          ) {
            return;
          }
        } catch {}

        const assets = Array.isArray(data.assets) ? data.assets : [];
        const msiAsset = assets.find((asset) =>
          String(asset.name || "")
            .toLowerCase()
            .endsWith(".msi")
        );
        const installerUrl = String(msiAsset?.browser_download_url || "").trim() || null;
        const notes = typeof data.body === "string" ? data.body.trim() : "";
        setUpdateInfo({
          currentVersion,
          latestVersion: latestTag,
          installerUrl,
          notes: notes ? notes.slice(0, 2000) : undefined,
        });
      }
    } catch {
      // silent on auto check
    }
  }, [updateInfo]);

  const handleUpdateLater = useCallback(() => {
    if (updating) return;
    setUpdateInfo(null);
  }, [updating]);

  const handleIgnoreUpdateVersion = useCallback(() => {
    if (!updateInfo || updating) return;
    try {
      localStorage.setItem(UPDATE_IGNORE_KEY, normalizeVersion(updateInfo.latestVersion));
    } catch {}
    addToast("info", `已忽略版本 ${updateInfo.latestVersion}`, 3000, "update-ignored");
    setUpdateInfo(null);
  }, [addToast, updateInfo, updating]);

  const handleOneClickUpdate = useCallback(async () => {
    if (!updateInfo || updating) return;
    if (!updateInfo.installerUrl) {
      addToast("error", "未找到可用的 Windows 安装包（.msi），请前往 GitHub 手动下载。", 5000, "update-missing-msi");
      return;
    }
    setUpdating(true);
    try {
      await api.downloadAndRunInstaller(updateInfo.installerUrl);
      addToast("success", "已启动安装程序，请按提示完成更新。", 6000, "update-started");
      setUpdateInfo(null);
    } catch (err: any) {
      addToast("error", err?.message || "更新失败，请稍后重试。");
    } finally {
      setUpdating(false);
    }
  }, [addToast, updateInfo, updating]);

  useEffect(() => {
    const handleOffline = () => {
      const id = "network-offline";
      setToasts((prev) => {
        // 防止重复添加
        if (prev.some((t) => t.id === id)) return prev;
        return [...prev, { id, type: "error", message: "网络连接已断开，请检查网络设置", duration: 0 }];
      });
      offlineToastIdRef.current = id;
    };

    const handleOnline = () => {
      if (offlineToastIdRef.current) {
        removeToast(offlineToastIdRef.current);
        offlineToastIdRef.current = null;
      }
      addToast("success", "网络已重新连接", 3000);
    };

    // 初始化检查
    if (!navigator.onLine) {
      handleOffline();
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [addToast, removeToast]);

  const readUsageCache = useCallback((): Record<string, UsageSummary> => {
    try {
      const raw = localStorage.getItem(USAGE_CACHE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      return parsed as Record<string, UsageSummary>;
    } catch {
      return {};
    }
  }, []);

  const updateUsageCache = useCallback(
    (updates: Record<string, UsageSummary>, accountIds?: string[]) => {
      const cache = readUsageCache();
      Object.entries(updates).forEach(([id, usage]) => {
        cache[id] = usage;
      });
      if (accountIds) {
        Object.keys(cache).forEach((id) => {
          if (!accountIds.includes(id)) {
            delete cache[id];
          }
        });
      }
      localStorage.setItem(USAGE_CACHE_KEY, JSON.stringify(cache));
    },
    [readUsageCache]
  );

  useEffect(() => {
    let active = true;
    api.getSettings()
      .then((settings) => {
        if (active) setAppSettings(settings);
      })
      .catch(() => {
        if (active) {
          setAppSettings({
            quick_register_show_window: true,
            auto_refresh_enabled: true,
            privacy_auto_enable: false,
            auto_update_check: true,
            auto_start_enabled: false,
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!appSettings?.auto_update_check) return;
    if (updateCheckRef.current) return;
    updateCheckRef.current = true;
    void checkForUpdates();
  }, [appSettings, checkForUpdates]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<{ id?: string; message: string }>("quick_register_notice", (event) => {
      if (quickRegisterShowWindow) {
        return;
      }
      const { id, message } = event.payload || {};
      if (!message) return;
      const key = id || message;
      const now = Date.now();
      const last = quickRegisterNoticeRef.current.get(key);
      if (last && now - last < 800) {
        return;
      }
      quickRegisterNoticeRef.current.set(key, now);
      addToast("success", message, 2500);
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [addToast, quickRegisterShowWindow]);

  const refreshUsageForAccounts = useCallback(
    async (list: AccountBrief[]) => {
      if (list.length === 0) return;
      const results = await Promise.allSettled(
        list.map((account) => api.getAccountUsage(account.id))
      );
      const updates: Record<string, UsageSummary> = {};
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          updates[list[index].id] = result.value;
        }
      });
      if (Object.keys(updates).length > 0) {
        setAccounts((prev) =>
          prev.map((account) =>
            updates[account.id] ? { ...account, usage: updates[account.id] } : account
          )
        );
        updateUsageCache(updates, list.map((a) => a.id));
      } else {
        updateUsageCache({}, list.map((a) => a.id));
      }
    },
    [updateUsageCache]
  );

  // 加载账号列表
  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.getAccounts();
      const cache = readUsageCache();
      const accountsWithUsage = list.map((account) => ({
        ...account,
        usage: cache[account.id] ?? null,
      }));
      setAccounts(accountsWithUsage);
      setError(null);
      setHasLoaded(true);
      updateUsageCache({}, list.map((a) => a.id));
      setLoading(false);
      void refreshUsageForAccounts(list);
    } catch (err: any) {
      setError(err.message || "加载账号失败");
      setHasLoaded(true);
      setLoading(false);
    }
  }, [readUsageCache, refreshUsageForAccounts, updateUsageCache]);

  // 初始加载
  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // 删除账号
  const handleDeleteAccount = async (accountId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "删除账号",
      message: "确定要删除此账号吗？删除后无法恢复。",
      type: "danger",
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await api.removeAccount(accountId);
          setAccounts((prev) => prev.filter((account) => account.id !== accountId));
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(accountId);
            return next;
          });
          addToast("success", "账号已删除");
        } catch (err: any) {
          addToast("error", err.message || "删除账号失败");
        }
      },
    });
  };

  // 刷新单个账号
  const handleRefreshAccount = async (
    accountId: string,
    options?: { silent?: boolean }
  ) => {
    // 防止重复刷新
    if (refreshingIds.has(accountId)) {
      return;
    }

    setRefreshingIds((prev) => new Set(prev).add(accountId));

    try {
      const usage = await api.getAccountUsage(accountId);
      setAccounts((prev) =>
        prev.map((a) => (a.id === accountId ? { ...a, usage } : a))
      );
      updateUsageCache({ [accountId]: usage });
      if (!options?.silent) {
        addToast("success", "数据刷新成功", 1500, "refresh-success");
      }
    } catch (err: any) {
      addToast("error", err.message || "刷新失败");
    } finally {
      setRefreshingIds((prev) => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
    }
  };

  // 选择账号
  const handleSelectAccount = (accountId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedIds.size === accounts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(accounts.map((account) => account.id)));
    }
  };

  // 右键菜单
  const handleContextMenu = (e: React.MouseEvent, accountId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, accountId });
  };

  // 复制 Token
  const handleCopyToken = async (accountId: string) => {
    try {
      const account = await api.getAccount(accountId);
      if (account.jwt_token) {
        await navigator.clipboard.writeText(account.jwt_token);
        addToast("success", "Token 已复制到剪贴板");
      } else {
        addToast("warning", "该账号没有有效的 Token");
      }
    } catch (err: any) {
      addToast("error", err.message || "获取 Token 失败");
    }
  };

  // 切换账号 / 重新登录（同逻辑）
  const handleSwitchAccount = async (
    accountId: string,
    options?: { mode?: "switch" | "relogin"; force?: boolean }
  ) => {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return;

    const mode = options?.mode ?? "switch";
    const force = options?.force ?? mode === "relogin";
    const title = mode === "relogin" ? "重新登录" : "切换账号";
    const message =
      mode === "relogin"
        ? `确定要重新登录账号 "${account.email || account.name}" 吗？\n\n系统将自动关闭 Trae IDE 并重新写入登录信息。`
        : `确定要切换到账号 "${account.email || account.name}" 吗？\n\n系统将自动关闭 Trae IDE 并切换登录信息。`;
    const infoToast = mode === "relogin" ? "正在重新登录，请稍候..." : "正在切换账号，请稍候...";
    const successToast = mode === "relogin" ? "账号重新登录完成，请重新打开 Trae IDE" : "账号切换成功，请重新打开 Trae IDE";
    const errorToast = mode === "relogin" ? "重新登录失败" : "切换账号失败";

    setConfirmModal({
      isOpen: true,
      title,
      message,
      type: "warning",
      onConfirm: async () => {
        setConfirmModal(null);
        addToast("info", infoToast);
        try {
          await api.switchAccount(accountId, { force });
          await loadAccounts();
          addToast("success", successToast);
        } catch (err: any) {
          addToast("error", err.message || errorToast);
        }
      },
    });
  };

  // 查看详情
  const handleViewDetail = async (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return;
    try {
      const full = await api.getAccount(accountId);
      setDetailAccount({
        ...account,
        email: full.email,
        password: full.password ?? null,
      });
    } catch (err: any) {
      addToast("error", err.message || "获取账号详情失败");
      setDetailAccount(account);
    }
  };

  const handleUpdateCredentials = async (
    accountId: string,
    updates: { email?: string; password?: string }
  ) => {
    try {
      const updated = await api.updateAccountProfile(accountId, {
        email: updates.email ?? null,
        password: updates.password ?? null,
      });
      setAccounts((prev) =>
        prev.map((account) =>
          account.id === accountId
            ? { ...account, email: updated.email, password: updated.password ?? null }
            : account
        )
      );
      setDetailAccount((prev) =>
        prev && prev.id === accountId
          ? { ...prev, email: updated.email, password: updated.password ?? null }
          : prev
      );
      addToast("success", "账号信息已更新", 1000);
    } catch (err: any) {
      addToast("error", err.message || "更新账号信息失败");
      throw err;
    }
  };

  const handleRelogin = async (
    accountId: string,
    options?: { forceManual?: boolean; source?: "update-token" | "relogin" }
  ) => {
    try {
      if (options?.source === "update-token") {
        addToast("info", "正在更新 Token...", 2000, "update-token-progress");
      }
      const account = await api.getAccount(accountId);
      const email = account.email || account.name;
      const maskedEmail = account.email?.includes("*") ?? false;

      if (!options?.forceManual) {
        if (account.cookies) {
          try {
            await api.refreshToken(accountId);
            await handleRefreshAccount(accountId, { silent: true });
            addToast("success", "已使用 Cookie 刷新 Token");
            return;
          } catch {}
        }

        if (account.password && account.email && !maskedEmail) {
          try {
            await api.refreshTokenWithPassword(accountId, account.password);
            await handleRefreshAccount(accountId, { silent: true });
            addToast("success", "已使用保存的密码刷新 Token");
            return;
          } catch {}
        }
      }

      if (options?.source === "update-token") {
        const accountLabel = account.email || account.name || "未知账号";
        const passwordLabel = account.password || "未保存";
        setConfirmModal({
          isOpen: true,
          title: "凭据已失效",
          message:
            `账号: ${accountLabel}\n` +
            `密码: ${passwordLabel}\n\n` +
            "该账号凭据已失效，请通过账号密码重新导入。",
          type: "warning",
          confirmText: "知道了",
          cancelText: "关闭",
          onConfirm: () => {
            setConfirmModal(null);
          },
        });
        return;
      }

      setLoginModal({
        accountId,
        accountName: email,
        initialEmail: maskedEmail ? "" : account.email,
      });
    } catch (err: any) {
      addToast("error", err.message || "重新登录失败");
    }
  };

  const handleUpdateToken = async (accountId: string) => {
    await handleRelogin(accountId, { source: "update-token" });
  };

  const handleLoginSubmit = async (accountId: string, email: string, password: string) => {
    const usage = await api.loginAccountWithEmail(accountId, email, password);
    setAccounts((prev) =>
      prev.map((account) =>
        account.id === accountId
          ? { ...account, email, password, usage }
          : account
      )
    );
    updateUsageCache({ [accountId]: usage });
    setDetailAccount((prev) =>
      prev && prev.id === accountId
        ? { ...prev, email, password }
        : prev
    );
    addToast("success", "重新登录成功");
  };

  // 获取礼包
  const handleClaimGift = async (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return;

    setConfirmModal({
      isOpen: true,
      title: "获取礼包",
      message: `确定要为账号 "${account.email || account.name}" 领取周年礼包吗？\n\n领取后将自动刷新账号额度。`,
      type: "info",
      onConfirm: async () => {
        setConfirmModal(null);
        addToast("info", "正在领取礼包，请稍候...");
        try {
          await api.claimGift(accountId);
          // 刷新账号数据
          await handleRefreshAccount(accountId, { silent: true });
          addToast("success", "礼包领取成功！额度已更新");
        } catch (err: any) {
          addToast("error", err.message || "领取礼包失败");
        }
      },
    });
  };

  const handleBuyPro = async (accountId: string) => {
    try {
      await api.openPricing(accountId);
      addToast("info", "已打开购买页面");
    } catch (err: any) {
      addToast("error", err.message || "打开购买页面失败");
    }
  };

  // 导出账号
  const handleExportAccounts = async () => {
    try {
      const date = new Date().toISOString().split("T")[0];
      const path = await save({
        defaultPath: `trae-accounts-${date}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path) return;
      await api.exportAccountsToPath(path as string);
      addToast("success", `已导出 ${accounts.length} 个账号`);
    } catch (err: any) {
      addToast("error", err.message || "导出失败");
    }
  };

  // 导入账号
  const handleImportAccounts = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const count = await api.importAccounts(text);
        addToast("success", `成功导入 ${count} 个账号`);
        await loadAccounts();
      } catch (err: any) {
        addToast("error", err.message || "导入失败");
      }
    };
    input.click();
  };

  // 批量刷新选中账号
  const handleBatchRefresh = async () => {
    if (selectedIds.size === 0) {
      addToast("warning", "请先选择要刷新的账号");
      return;
    }

    addToast("info", `正在刷新 ${selectedIds.size} 个账号...`);

    for (const id of selectedIds) {
      await handleRefreshAccount(id, { silent: true });
    }
  };

  // 批量删除选中账号
  const handleBatchDelete = () => {
    if (selectedIds.size === 0) {
      addToast("warning", "请先选择要删除的账号");
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: "批量删除",
      message: `确定要删除选中的 ${selectedIds.size} 个账号吗？此操作无法撤销。`,
      type: "danger",
      onConfirm: async () => {
        try {
          for (const id of selectedIds) {
            await api.removeAccount(id);
          }
          setSelectedIds(new Set());
          addToast("success", `已删除 ${selectedIds.size} 个账号`);
          await loadAccounts();
        } catch (err: any) {
          addToast("error", err.message || "删除失败");
        }
        setConfirmModal(null);
      },
    });
  };

  const normalizedFilter = (emailFilter || "").trim().toLowerCase();
  const visibleAccounts = Array.isArray(accounts)
    ? (normalizedFilter
        ? accounts.filter((account) => (account.email || account.name || "").toLowerCase().includes(normalizedFilter))
        : accounts)
    : [];

  return (
    <div className="app">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

      <div className="app-content">
        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {currentPage === "dashboard" && (
          <Dashboard 
            accounts={accounts} 
            hasLoaded={hasLoaded} 
            onSwitchAccount={(id) => handleSwitchAccount(id)}
            onNavigate={setCurrentPage}
            onRefresh={(id) => handleRefreshAccount(id)}
            refreshingIds={refreshingIds}
          />
        )}

        {currentPage === "stats" && (
          <Stats accounts={accounts} hasLoaded={hasLoaded} />
        )}

        {currentPage === "accounts" && (
          <>
            <main className="app-main">
              {accounts.length > 0 && (
                <div className="toolbar">
                  <div className="toolbar-left">
                    <button
                      type="button"
                      className="header-btn"
                      onClick={handleSelectAll}
                      style={{ padding: "8px 14px" }}
                    >
                      {selectedIds.size === accounts.length && accounts.length > 0 ? "取消全选" : "全选"}
                    </button>
                    <div className="toolbar-search">
                      <svg
                        className="search-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                      <input
                        type="text"
                        className="toolbar-search-input"
                        placeholder="搜索邮箱..."
                        value={emailFilter}
                        onChange={(event) => setEmailFilter(event.target.value)}
                      />
                    </div>
                    <div className="view-toggle">
                      <button
                        className={`view-btn ${viewMode === "grid" ? "active" : ""}`}
                        onClick={() => setViewMode("grid")}
                        title="卡片视图"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                          <rect x="3" y="3" width="7" height="7"/>
                          <rect x="14" y="3" width="7" height="7"/>
                          <rect x="3" y="14" width="7" height="7"/>
                          <rect x="14" y="14" width="7" height="7"/>
                        </svg>
                      </button>
                      <button
                        className={`view-btn ${viewMode === "list" ? "active" : ""}`}
                        onClick={() => setViewMode("list")}
                        title="列表视图"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                          <line x1="8" y1="6" x2="21" y2="6"/>
                          <line x1="8" y1="12" x2="21" y2="12"/>
                          <line x1="8" y1="18" x2="21" y2="18"/>
                          <line x1="3" y1="6" x2="3.01" y2="6"/>
                          <line x1="3" y1="12" x2="3.01" y2="12"/>
                          <line x1="3" y1="18" x2="3.01" y2="18"/>
                        </svg>
                      </button>
                    </div>
                    {selectedIds.size > 0 && (
                      <div className="batch-actions">
                        <button className="batch-btn" onClick={handleBatchRefresh}>
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            width="14"
                            height="14"
                          >
                            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                          </svg>
                          刷新
                        </button>
                        <button className="batch-btn danger" onClick={handleBatchDelete}>
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            width="14"
                            height="14"
                          >
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="toolbar-right">
                    <button className="header-btn" onClick={handleImportAccounts} title="导入账号" style={{padding: '8px 14px'}}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                      </svg>
                      导入
                    </button>
                    <button className="header-btn" onClick={handleExportAccounts} title="导出账号" disabled={accounts.length === 0} style={{padding: '8px 14px'}}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                      </svg>
                      导出
                    </button>
                    <button className="add-btn" onClick={() => setShowAddModal(true)} style={{padding: '8px 16px', fontSize: '13px'}}>
                      <span>+</span> 添加账号
                    </button>

                  </div>
                </div>
              )}

              {loading ? (
                <div className="loading">
                  <div className="spinner"></div>
                  <p>加载中...</p>
                </div>
              ) : accounts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <h3>暂无账号</h3>
                  <p>点击上方按钮添加账号，或导入已有账号</p>
                  <div className="empty-actions">
                    <button className="empty-btn primary" onClick={() => setShowAddModal(true)}>
                      添加账号
                    </button>
                    <button className="empty-btn" onClick={handleImportAccounts}>
                      导入账号
                    </button>
                  </div>
                </div>
              ) : viewMode === "grid" ? (
                <div className="account-grid">
                  {visibleAccounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      usage={account.usage || null}
                      selected={selectedIds.has(account.id)}
                      onSelect={handleSelectAccount}
                      onContextMenu={handleContextMenu}
                    />
                  ))}
                </div>
              ) : (
                <div className="account-list">
                  <div className="list-header">
                    <div className="list-col checkbox"></div>
                    <div className="list-col avatar"></div>
                    <div className="list-col info">账号信息</div>
                    <div className="list-col plan">套餐</div>
                    <div className="list-col usage">使用量</div>
                    <div className="list-col reset">重置时间</div>
                    <div className="list-col status">状态</div>
                    <div className="list-col actions"></div>
                  </div>
                  {visibleAccounts.map((account) => (
                    <AccountListItem
                      key={account.id}
                      account={account}
                      usage={account.usage || null}
                      selected={selectedIds.has(account.id)}
                      onSelect={handleSelectAccount}
                      onContextMenu={handleContextMenu}
                    />
                  ))}
                </div>
              )}
            </main>
          </>
        )}

        {currentPage === "settings" && (
          <Settings
            onToast={addToast}
            settings={appSettings}
            onSettingsChange={setAppSettings}
          />
        )}

        {currentPage === "about" && <About />}
      </div>

      {/* Toast 通知 */}
      <Toast messages={toasts} onRemove={removeToast} />

      {/* 确认弹窗 */}
      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          confirmText="确定"
          cancelText="取消"
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {/* 右键菜单 */}
      {/* 自动更新弹窗 */}
      <UpdateModal
        isOpen={!!updateInfo}
        currentVersion={updateInfo?.currentVersion || ""}
        latestVersion={updateInfo?.latestVersion || ""}
        notes={updateInfo?.notes}
        isBusy={updating}
        onLater={handleUpdateLater}
        onIgnore={handleIgnoreUpdateVersion}
        onUpdate={handleOneClickUpdate}
      />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onRelogin={() => {
            handleSwitchAccount(contextMenu.accountId, { mode: "relogin" });
            setContextMenu(null);
          }}
          onViewDetail={() => {
            void handleViewDetail(contextMenu.accountId);
            setContextMenu(null);
          }}
          onRefresh={() => {
            handleRefreshAccount(contextMenu.accountId);
            setContextMenu(null);
          }}
          onUpdateToken={() => {
            void handleUpdateToken(contextMenu.accountId);
            setContextMenu(null);
          }}
          onCopyToken={() => {
            handleCopyToken(contextMenu.accountId);
            setContextMenu(null);
          }}
          onSwitchAccount={() => {
            handleSwitchAccount(contextMenu.accountId);
            setContextMenu(null);
          }}
          onClaimGift={() => {
            handleClaimGift(contextMenu.accountId);
            setContextMenu(null);
          }}
          onBuyPro={() => {
            void handleBuyPro(contextMenu.accountId);
            setContextMenu(null);
          }}
          onDelete={() => {
            handleDeleteAccount(contextMenu.accountId);
            setContextMenu(null);
          }}
          isCurrent={accounts.find(a => a.id === contextMenu.accountId)?.is_current || false}
        />
      )}

      {/* 添加账号弹窗 */}
      <AddAccountModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onToast={addToast}
        onAccountAdded={loadAccounts}
        quickRegisterShowWindow={quickRegisterShowWindow}
      />

      {/* 详情弹窗 */}
      <DetailModal
        isOpen={!!detailAccount}
        onClose={() => setDetailAccount(null)}
        account={detailAccount}
        usage={detailAccount?.usage || null}
        onUpdateCredentials={handleUpdateCredentials}
      />

      <AccountLoginModal
        isOpen={!!loginModal}
        accountId={loginModal?.accountId || ""}
        accountName={loginModal?.accountName || ""}
        initialEmail={loginModal?.initialEmail}
        onClose={() => setLoginModal(null)}
        onSubmit={handleLoginSubmit}
      />
    </div>
  );
}

export default App;
