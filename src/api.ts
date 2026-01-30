import { invoke } from "@tauri-apps/api/core";
import type { Account, AccountBrief, AppSettings, UsageSummary, UsageEventsResponse, UserStatisticData } from "./types";

function checkNetwork() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error("网络连接已断开，请检查网络设置");
  }
}

async function invokeNetwork<T>(cmd: string, args?: any): Promise<T> {
  checkNetwork();
  return invoke(cmd, args);
}

// 添加账号（通过 Cookies）
export async function addAccount(cookies: string): Promise<Account> {
  return invokeNetwork("add_account", { cookies });
}

// 添加账号（通过 Token，可选 Cookies）
export async function addAccountByToken(token: string, cookies?: string): Promise<Account> {
  return invokeNetwork("add_account_by_token", { token, cookies });
}

// 添加账号（通过邮箱密码登录）
export async function addAccountByEmail(email: string, password: string): Promise<Account> {
  return invokeNetwork("add_account_by_email", { email, password });
}

export async function quickRegister(showWindow?: boolean): Promise<Account> {
  if (typeof showWindow === "boolean") {
    return invokeNetwork("quick_register", { showWindow });
  }
  return invokeNetwork("quick_register");
}

export async function startBrowserLogin(): Promise<void> {
  return invokeNetwork("start_browser_login");
}

export async function finishBrowserLogin(): Promise<Account> {
  return invokeNetwork("finish_browser_login");
}

export async function cancelBrowserLogin(): Promise<void> {
  return invoke("cancel_browser_login");
}

// 下载并运行更新安装包（Windows: .msi）
export async function downloadAndRunInstaller(url: string): Promise<string> {
  return invokeNetwork("download_and_run_installer", { url });
}

// 删除账号
export async function removeAccount(accountId: string): Promise<void> {
  return invoke("remove_account", { accountId });
}

// 获取所有账号
export async function getAccounts(): Promise<AccountBrief[]> {
  return invoke("get_accounts");
}

// 获取单个账号详情（包含 token）
export async function getAccount(accountId: string): Promise<Account> {
  return invoke("get_account", { accountId });
}

// 设置活跃账号
export async function setActiveAccount(
  accountId: string,
  options?: { force?: boolean }
): Promise<void> {
  return invoke("switch_account", { accountId, force: options?.force });
}

// 切换账号（设置活跃账号并更新机器码）
export async function switchAccount(
  accountId: string,
  options?: { force?: boolean }
): Promise<void> {
  return invoke("switch_account", { accountId, force: options?.force });
}

// 获取账号使用量
export async function getAccountUsage(accountId: string): Promise<UsageSummary> {
  return invokeNetwork("get_account_usage", { accountId });
}

// 更新账号 Token
export async function updateAccountToken(accountId: string, token: string): Promise<UsageSummary> {
  return invokeNetwork("update_account_token", { accountId, token });
}

// 刷新 Token
export async function refreshToken(accountId: string): Promise<void> {
  return invokeNetwork("refresh_token", { accountId });
}

export async function refreshTokenWithPassword(accountId: string, password: string): Promise<void> {
  return invokeNetwork("refresh_token_with_password", { accountId, password });
}

export async function loginAccountWithEmail(
  accountId: string,
  email: string,
  password: string
): Promise<UsageSummary> {
  return invokeNetwork("login_account_with_email", { accountId, email, password });
}

export async function updateAccountProfile(
  accountId: string,
  updates: { email?: string | null; password?: string | null }
): Promise<Account> {
  return invokeNetwork("update_account_profile", {
    accountId,
    email: updates.email ?? null,
    password: updates.password ?? null,
  });
}

// 更新 Cookies
export async function updateCookies(accountId: string, cookies: string): Promise<void> {
  return invokeNetwork("update_cookies", { accountId, cookies });
}

// 导出账号
export async function exportAccounts(): Promise<string> {
  return invoke("export_accounts");
}

export async function exportAccountsToPath(path: string): Promise<void> {
  return invoke("export_accounts_to_path", { path });
}

// 导入账号
export async function importAccounts(data: string): Promise<number> {
  return invoke("import_accounts", { data });
}

export async function clearAccounts(): Promise<number> {
  return invoke("clear_accounts");
}

export async function getSettings(): Promise<AppSettings> {
  return invoke("get_settings");
}

export async function updateSettings(settings: AppSettings): Promise<AppSettings> {
  return invoke("update_settings", { settings });
}

// 获取使用事件
export async function getUsageEvents(
  accountId: string,
  startTime: number,
  endTime: number,
  pageNum: number = 1,
  pageSize: number = 20
): Promise<UsageEventsResponse> {
  return invokeNetwork("get_usage_events", {
    accountId,
    startTime,
    endTime,
    pageNum,
    pageSize
  });
}

// 从 Trae IDE 读取当前登录账号
export async function readTraeAccount(): Promise<Account | null> {
  return invoke("read_trae_account");
}

// ============ 机器码相关 API ============

// 获取当前系统机器码
export async function getMachineId(): Promise<string> {
  return invoke("get_machine_id");
}

// 重置系统机器码（生成新的随机机器码）
export async function resetMachineId(): Promise<string> {
  return invoke("reset_machine_id");
}

// 设置系统机器码为指定值
export async function setMachineId(machineId: string): Promise<void> {
  return invoke("set_machine_id", { machineId });
}

// 绑定账号机器码（保存当前系统机器码到账号）
export async function bindAccountMachineId(accountId: string): Promise<string> {
  return invoke("bind_account_machine_id", { accountId });
}

// ============ Trae IDE 机器码相关 API ============

// 获取 Trae IDE 的机器码
export async function getTraeMachineId(): Promise<string> {
  return invoke("get_trae_machine_id");
}

// 设置 Trae IDE 的机器码
export async function setTraeMachineId(machineId: string): Promise<void> {
  return invoke("set_trae_machine_id", { machineId });
}

// 清除 Trae IDE 登录状态（让 IDE 变成全新安装状态）
export async function clearTraeLoginState(): Promise<void> {
  return invoke("clear_trae_login_state");
}

// ============ Trae IDE 路径相关 API ============

// 获取保存的 Trae IDE 路径
export async function getTraePath(): Promise<string> {
  return invoke("get_trae_path");
}

// 设置 Trae IDE 路径
export async function setTraePath(path: string): Promise<void> {
  return invoke("set_trae_path", { path });
}

// 自动扫描 Trae IDE 路径
export async function scanTraePath(): Promise<string> {
  return invoke("scan_trae_path");
}

// ============ 礼包相关 API ============

// 领取礼包
export async function claimGift(accountId: string): Promise<void> {
  return invokeNetwork("claim_gift", { accountId });
}

// 获取用户统计数据
export async function getUserStatistics(accountId: string): Promise<UserStatisticData> {
  return invokeNetwork("get_user_statistics", { accountId });
}

// 打开购买页面（内置浏览器，携带账号 Cookies）
export async function openPricing(accountId: string): Promise<void> {
  return invokeNetwork("open_pricing", { accountId });
}
