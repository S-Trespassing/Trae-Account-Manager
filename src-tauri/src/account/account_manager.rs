use anyhow::{anyhow, Result};
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

use super::types::*;
use crate::api::{TraeApiClient, UsageSummary, UsageQueryResponse, login_with_email};

/// 账号管理器
pub struct AccountManager {
    store: AccountStore,
    data_path: PathBuf,
}

impl AccountManager {
    /// 创建账号管理器
    pub fn new() -> Result<Self> {
        let data_path = Self::get_data_path()?;
        let mut store = Self::load_store(&data_path)?;

        // 确保每个账号都有机器码
        let mut changed = false;
        for account in &mut store.accounts {
            if account.machine_id.is_none() {
                account.machine_id = Some(Uuid::new_v4().to_string());
                changed = true;
            }
        }

        let manager = Self { store, data_path };

        if changed {
            manager.save_store()?;
        }

        Ok(manager)
    }

    /// 获取数据存储路径
    fn get_data_path() -> Result<PathBuf> {
        let proj_dirs = directories::ProjectDirs::from("com", "sauce", "trae-auto")
            .ok_or_else(|| anyhow!("无法获取应用数据目录"))?;

        let data_dir = proj_dirs.data_dir();
        fs::create_dir_all(data_dir)?;

        Ok(data_dir.join("accounts.json"))
    }

    /// 加载账号存储
    fn load_store(path: &PathBuf) -> Result<AccountStore> {
        if path.exists() {
            let content = fs::read_to_string(path)?;
            let cleaned = content.trim_start_matches('\u{feff}');
            let trimmed = cleaned.trim();
            if trimmed.is_empty() {
                return Ok(AccountStore::default());
            }
            match serde_json::from_str::<AccountStore>(trimmed) {
                Ok(store) => Ok(store),
                Err(_) => {
                    let store = AccountStore::default();
                    let content = serde_json::to_string_pretty(&store)?;
                    fs::write(path, content)?;
                    Ok(store)
                }
            }
        } else {
            Ok(AccountStore::default())
        }
    }

    /// 保存账号存储
    fn save_store(&self) -> Result<()> {
        let content = serde_json::to_string_pretty(&self.store)?;
        fs::write(&self.data_path, content)?;
        Ok(())
    }

    pub fn update_account_email(&mut self, account_id: &str, email: String) -> Result<()> {
        let email = email.trim();
        if email.is_empty() {
            return Ok(());
        }

        let account = self.store.accounts.iter_mut()
            .find(|a| a.id == account_id)
            .ok_or_else(|| anyhow!("账号不存在"))?;

        account.email = email.to_string();
        account.updated_at = chrono::Utc::now().timestamp();
        self.save_store()?;
        Ok(())
    }

    pub fn update_account_profile(
        &mut self,
        account_id: &str,
        email: Option<String>,
        password: Option<String>,
    ) -> Result<Account> {
        let account_index = self.store.accounts
            .iter()
            .position(|a| a.id == account_id)
            .ok_or_else(|| anyhow!("账号不存在"))?;
        let mut changed = false;
        let account_snapshot = {
            let account = &mut self.store.accounts[account_index];
            if let Some(next_email) = email {
                let trimmed = next_email.trim();
                if !trimmed.is_empty() && trimmed != account.email {
                    account.email = trimmed.to_string();
                    changed = true;
                }
            }

            if let Some(next_password) = password {
                let trimmed = next_password.trim();
                let next_value = if trimmed.is_empty() { None } else { Some(trimmed.to_string()) };
                if next_value != account.password {
                    account.password = next_value;
                    changed = true;
                }
            }

            if changed {
                account.updated_at = chrono::Utc::now().timestamp();
            }

            account.clone()
        };

        if changed {
            self.save_store()?;
        }

        Ok(account_snapshot)
    }

    /// 添加账号（通过 cookies）
    pub async fn add_account(&mut self, cookies: String, password: Option<String>) -> Result<Account> {
        let mut client = TraeApiClient::new(&cookies)?;

        // 获取 token
        let token_result = client.get_user_token().await?;

        // 获取用户信息
        let user_info = client.get_user_info().await?;

        // 检查是否已存在
        if self
            .store
            .accounts
            .iter()
            .any(|a| a.user_id == token_result.user_id)
        {
            return Err(anyhow!("该账号已存在"));
        }

        let mut account = Account::new(
            user_info.screen_name.clone(),
            user_info.non_plain_text_email.unwrap_or_default(),
            cookies,
            token_result.user_id,
            token_result.tenant_id,
        );

        account.avatar_url = user_info.avatar_url;
        account.region = user_info.region;
        account.jwt_token = Some(token_result.token);
        account.token_expired_at = Some(token_result.expired_at);
        account.password = password;

        self.store.accounts.push(account.clone());

        // 如果是第一个账号，设为活跃账号
        if self.store.active_account_id.is_none() {
            self.store.active_account_id = Some(account.id.clone());
        }

        self.save_store()?;
        Ok(account)
    }

    /// 添加账号（通过 Token，可选 Cookies）
    pub async fn add_account_by_token(&mut self, token: String, cookies: Option<String>, password: Option<String>) -> Result<Account> {
        let client = TraeApiClient::new_with_token(&token)?;

        // 通过 Token 获取用户信息
        let user_info = client.get_user_info_by_token().await?;

        // 检查是否已存在
        if self
            .store
            .accounts
            .iter()
            .any(|a| a.user_id == user_info.user_id)
        {
            return Err(anyhow!("该账号已存在"));
        }

        // 如果提供了 Cookies，尝试获取更详细的用户信息
        let (name, email, avatar_url) = if let Some(ref cookies_str) = cookies {
            match self.get_user_info_with_cookies(cookies_str).await {
                Ok(info) => (
                    info.screen_name,
                    info.non_plain_text_email.unwrap_or_default(),
                    info.avatar_url,
                ),
                Err(_) => (
                    user_info.screen_name.unwrap_or_else(|| format!("User_{}", &user_info.user_id[..8.min(user_info.user_id.len())])),
                    user_info.email.unwrap_or_default(),
                    user_info.avatar_url.unwrap_or_default(),
                ),
            }
        } else {
            (
                user_info.screen_name.unwrap_or_else(|| format!("User_{}", &user_info.user_id[..8.min(user_info.user_id.len())])),
                user_info.email.unwrap_or_default(),
                user_info.avatar_url.unwrap_or_default(),
            )
        };

        let mut account = Account::new(
            name,
            email,
            cookies.unwrap_or_default(),
            user_info.user_id.clone(),
            user_info.tenant_id.clone(),
        );

        account.avatar_url = avatar_url;
        account.jwt_token = Some(token);
        account.token_expired_at = None;
        account.password = password;

        self.store.accounts.push(account.clone());

        // 如果是第一个账号，设为活跃账号
        if self.store.active_account_id.is_none() {
            self.store.active_account_id = Some(account.id.clone());
        }

        self.save_store()?;
        Ok(account)
    }

    /// Upsert account by token/cookies and refresh profile when it already exists.
    pub async fn upsert_account_by_token(
        &mut self,
        token: String,
        cookies: Option<String>,
        password: Option<String>,
    ) -> Result<Account> {
        let client = TraeApiClient::new_with_token(&token)?;
        let user_info = client.get_user_info_by_token().await?;

        if let Some(existing_id) = self
            .store
            .accounts
            .iter()
            .find(|a| a.user_id == user_info.user_id)
            .map(|a| a.id.clone())
        {
            // 先准备刷新账号信息（优先使用 cookies）
            let (name, email, avatar_url, region, tenant_id) = if let Some(ref cookies_str) = cookies {
                match self.get_user_info_with_cookies(cookies_str).await {
                    Ok(info) => (
                        info.screen_name,
                        info.non_plain_text_email.unwrap_or_default(),
                        info.avatar_url,
                        info.region,
                        info.tenant_id,
                    ),
                    Err(_) => (
                        user_info.screen_name.clone().unwrap_or_else(|| format!("User_{}", &user_info.user_id[..8.min(user_info.user_id.len())])),
                        user_info.email.clone().unwrap_or_default(),
                        user_info.avatar_url.clone().unwrap_or_default(),
                        String::new(),
                        user_info.tenant_id.clone(),
                    ),
                }
            } else {
                (
                    user_info.screen_name.clone().unwrap_or_else(|| format!("User_{}", &user_info.user_id[..8.min(user_info.user_id.len())])),
                    user_info.email.clone().unwrap_or_default(),
                    user_info.avatar_url.clone().unwrap_or_default(),
                    String::new(),
                    user_info.tenant_id.clone(),
                )
            };

            let updated = if let Some(acc) = self.store.accounts.iter_mut().find(|a| a.id == existing_id) {
                acc.jwt_token = Some(token.clone());
                acc.token_expired_at = None;
                if let Some(cookie_str) = cookies.as_ref().filter(|v| !v.is_empty()) {
                    acc.cookies = cookie_str.to_string();
                }
                if let Some(pass) = password.as_ref().filter(|v| !v.is_empty()) {
                    acc.password = Some(pass.to_string());
                }
                if !name.trim().is_empty() {
                    acc.name = name;
                }
                if !email.trim().is_empty() {
                    acc.email = email;
                }
                if !avatar_url.trim().is_empty() {
                    acc.avatar_url = avatar_url;
                }
                if !region.trim().is_empty() {
                    acc.region = region;
                }
                if !tenant_id.trim().is_empty() {
                    acc.tenant_id = tenant_id;
                }
                acc.updated_at = chrono::Utc::now().timestamp();
                Some(acc.clone())
            } else {
                None
            };

            if let Some(updated) = updated {
                self.save_store()?;
                return Ok(updated);
            }
        }

        self.add_account_by_token(token, cookies, password).await
    }

    /// 使用 Cookies 获取用户信息
    async fn get_user_info_with_cookies(&self, cookies: &str) -> Result<crate::api::UserInfoResult> {
        let client = TraeApiClient::new(cookies)?;
        client.get_user_info().await
    }

    /// 添加账号（通过邮箱密码登录）
    pub async fn add_account_by_email(&mut self, email: String, password: String) -> Result<Account> {
        // 通过邮箱密码登录
        let login_result = login_with_email(&email, &password).await?;

        // 检查是否已存在
        if self
            .store
            .accounts
            .iter()
            .any(|a| a.user_id == login_result.user_id)
        {
            return Err(anyhow!("该账号已存在"));
        }

        // 使用 Token 获取完整的用户信息
        let client = TraeApiClient::new_with_token(&login_result.token)?;
        let user_info = client.get_user_info_by_token().await?;

        let mut account = Account::new(
            user_info.screen_name.unwrap_or_else(|| email.split('@').next().unwrap_or("User").to_string()),
            email,
            login_result.cookies,
            login_result.user_id,
            login_result.tenant_id,
        );

        account.avatar_url = user_info.avatar_url.unwrap_or_default();
        account.jwt_token = Some(login_result.token);
        account.token_expired_at = Some(login_result.expired_at);
        account.password = Some(password);

        self.store.accounts.push(account.clone());

        // 如果是第一个账号，设为活跃账号
        if self.store.active_account_id.is_none() {
            self.store.active_account_id = Some(account.id.clone());
        }

        self.save_store()?;
        Ok(account)
    }

    /// 删除账号
    pub fn remove_account(&mut self, account_id: &str) -> Result<()> {
        let index = self
            .store
            .accounts
            .iter()
            .position(|a| a.id == account_id)
            .ok_or_else(|| anyhow!("账号不存在"))?;

        self.store.accounts.remove(index);

        // 如果删除的是活跃账号，重置活跃账号
        if self.store.active_account_id.as_deref() == Some(account_id) {
            self.store.active_account_id = self.store.accounts.first().map(|a| a.id.clone());
        }

        self.save_store()?;
        Ok(())
    }

    /// 清空所有账号
    pub fn clear_accounts(&mut self) -> Result<usize> {
        let count = self.store.accounts.len();
        self.store.accounts.clear();
        self.store.active_account_id = None;
        self.store.current_account_id = None;
        self.save_store()?;
        Ok(count)
    }

    /// 设置活跃账号
    pub fn set_active_account(&mut self, account_id: &str) -> Result<()> {
        if !self.store.accounts.iter().any(|a| a.id == account_id) {
            return Err(anyhow!("账号不存在"));
        }

        self.store.active_account_id = Some(account_id.to_string());
        self.save_store()?;
        Ok(())
    }

    /// 切换账号（设置活跃账号并将登录信息写入 Trae IDE）
    pub fn switch_account(&mut self, account_id: &str, force: bool) -> Result<()> {
        // 检查是否已经是当前使用的账号
        if !force && self.store.current_account_id.as_deref() == Some(account_id) {
            return Err(anyhow!("该账号已经是当前使用的账号"));
        }

        let account = self.store.accounts.iter()
            .find(|a| a.id == account_id)
            .ok_or_else(|| anyhow!("账号不存在"))?
            .clone();

        // 检查账号是否有有效的 Token
        let token = account.jwt_token.as_ref()
            .ok_or_else(|| anyhow!("账号没有有效的 Token，无法切换"))?;

        // 构建 Trae IDE 登录信息
        let login_info = crate::machine::TraeLoginInfo {
            token: token.clone(),
            refresh_token: None, // 如果有 refresh token 可以在这里设置
            user_id: account.user_id.clone(),
            email: account.email.clone(),
            username: account.name.clone(),
            avatar_url: account.avatar_url.clone(),
            host: String::new(), // 根据 region 自动选择
            region: if account.region.is_empty() { "SG".to_string() } else { account.region.clone() },
        };

        // 切换 Trae IDE 到该账号（清除旧登录状态并写入新账号信息）
        crate::machine::switch_trae_account(&login_info, account.machine_id.as_deref())?;

        // 如果账号有绑定的机器码，也更新系统机器码
        if let Some(machine_id) = &account.machine_id {
            match crate::machine::set_machine_guid(machine_id) {
                Ok(_) => println!("[INFO] 已切换系统机器码: {}", machine_id),
                Err(e) => println!("[WARN] 切换系统机器码失败（可能需要管理员权限）: {}", e),
            }
        }

        // 设置活跃账号和当前使用的账号
        self.store.active_account_id = Some(account_id.to_string());
        self.store.current_account_id = Some(account_id.to_string());
        self.save_store()?;

        println!("[INFO] 已切换到账号: {}", account.email);
        Ok(())
    }

    /// 绑定当前系统机器码到账号
    pub fn bind_machine_id(&mut self, account_id: &str) -> Result<String> {
        // 获取当前系统机器码
        let current_machine_id = crate::machine::get_machine_guid()?;

        // 更新账号的机器码
        let account = self.store.accounts.iter_mut()
            .find(|a| a.id == account_id)
            .ok_or_else(|| anyhow!("账号不存在"))?;

        account.machine_id = Some(current_machine_id.clone());
        account.updated_at = chrono::Utc::now().timestamp();
        let email = account.email.clone();

        self.save_store()?;
        println!("[INFO] 已绑定机器码 {} 到账号 {}", current_machine_id, email);

        Ok(current_machine_id)
    }

    /// 获取所有账号列表
    pub fn get_accounts(&self) -> Vec<AccountBrief> {
        let current_id = self.store.current_account_id.as_deref();
        self.store.accounts.iter().map(|account| {
            let is_current = current_id == Some(account.id.as_str());
            AccountBrief::from_account(account, is_current)
        }).collect()
    }

    /// 获取活跃账号
    pub fn get_active_account(&self) -> Option<&Account> {
        self.store
            .active_account_id
            .as_ref()
            .and_then(|id| self.store.accounts.iter().find(|a| &a.id == id))
    }

    /// 获取指定账号
    pub fn get_account(&self, account_id: &str) -> Result<Account> {
        self.store
            .accounts
            .iter()
            .find(|a| a.id == account_id)
            .cloned()
            .ok_or_else(|| anyhow!("账号不存在"))
    }

    /// 获取账号使用量
    pub async fn get_account_usage(&mut self, account_id: &str) -> Result<UsageSummary> {
        let account = self
            .store
            .accounts
            .iter()
            .find(|a| a.id == account_id)
            .ok_or_else(|| anyhow!("账号不存在"))?
            .clone();

        // 根据账号类型选择不同的方式获取使用量
        let summary = if let Some(token) = &account.jwt_token {
            // 优先使用 Token
            let client = TraeApiClient::new_with_token(token)?;
            match client.get_usage_summary_by_token().await {
                Ok(summary) => summary,
                Err(e) => {
                    let error_msg = e.to_string();
                    // 如果是 401 错误且有 Cookies，尝试刷新 Token
                    if error_msg.contains("401") && !account.cookies.is_empty() {
                        println!("[INFO] Token 已过期，尝试使用 Cookies 刷新...");
                        // 使用 Cookies 刷新 Token
                        let mut cookie_client = TraeApiClient::new(&account.cookies)?;
                        let token_result = cookie_client.get_user_token().await?;

                        // 更新存储的 Token
                        if let Some(acc) = self.store.accounts.iter_mut().find(|a| a.id == account_id) {
                            acc.jwt_token = Some(token_result.token.clone());
                            acc.token_expired_at = Some(token_result.expired_at.clone());
                        }
                        self.save_store()?;

                        if self.store.current_account_id.as_deref() == Some(account_id) {
                            let login_info = crate::machine::TraeLoginInfo {
                                token: token_result.token.clone(),
                                refresh_token: None,
                                user_id: account.user_id.clone(),
                                email: account.email.clone(),
                                username: account.name.clone(),
                                avatar_url: account.avatar_url.clone(),
                                host: String::new(),
                                region: if account.region.is_empty() { "SG".to_string() } else { account.region.clone() },
                            };

                            if let Err(e) = crate::machine::write_trae_login_info(&login_info) {
                                println!("[WARN] 更新 Trae IDE Token 失败: {}", e);
                            } else if crate::machine::is_trae_running() {
                                if let Err(e) = crate::machine::kill_trae() {
                                    println!("[WARN] 重启 Trae IDE 失败: {}", e);
                                } else if let Err(e) = crate::machine::open_trae() {
                                    println!("[WARN] 重启 Trae IDE 失败: {}", e);
                                }
                            }
                        }


                        // 使用新 Token 重新获取使用量
                        let new_client = TraeApiClient::new_with_token(&token_result.token)?;
                        new_client.get_usage_summary_by_token().await?
                    } else if error_msg.contains("401") {
                        return Err(anyhow!("Token 已过期，请更新 Token 或 Cookies"));
                    } else {
                        return Err(e);
                    }
                }
            }
        } else if !account.cookies.is_empty() {
            // 使用 Cookies
            let mut client = TraeApiClient::new(&account.cookies)?;
            client.get_usage_summary().await?
        } else {
            return Err(anyhow!("账号没有有效的 Token 或 Cookies"));
        };

        // 更新账号的 plan_type
        if let Some(acc) = self.store.accounts.iter_mut().find(|a| a.id == account_id) {
            acc.plan_type = summary.plan_type.clone();
            acc.updated_at = chrono::Utc::now().timestamp();
        }
        self.save_store()?;

        Ok(summary)
    }

    /// 刷新账号 Token
    pub async fn refresh_token(&mut self, account_id: &str) -> Result<()> {
        let account = self
            .store
            .accounts
            .iter()
            .find(|a| a.id == account_id)
            .ok_or_else(|| anyhow!("账号不存在"))?
            .clone();

        let mut client = TraeApiClient::new(&account.cookies)?;
        let token_result = client.get_user_token().await?;

        if let Some(acc) = self.store.accounts.iter_mut().find(|a| a.id == account_id) {
            acc.jwt_token = Some(token_result.token);
            acc.token_expired_at = Some(token_result.expired_at);
            acc.updated_at = chrono::Utc::now().timestamp();
        }

        self.save_store()?;
        Ok(())
    }

    /// 使用保存的密码重新登录并刷新 Token/Cookies
    pub async fn refresh_token_with_password(&mut self, account_id: &str, password: &str) -> Result<()> {
        let account = self
            .store
            .accounts
            .iter()
            .find(|a| a.id == account_id)
            .ok_or_else(|| anyhow!("账号不存在"))?
            .clone();

        if account.email.is_empty() {
            return Err(anyhow!("账号未绑定邮箱，无法使用密码登录"));
        }

        let login_result = login_with_email(&account.email, password).await?;

        if login_result.user_id != account.user_id {
            return Err(anyhow!("登录账号与当前账号不匹配"));
        }

        if let Some(acc) = self.store.accounts.iter_mut().find(|a| a.id == account_id) {
            acc.cookies = login_result.cookies;
            acc.jwt_token = Some(login_result.token);
            acc.token_expired_at = Some(login_result.expired_at);
            acc.password = Some(password.to_string());
            acc.updated_at = chrono::Utc::now().timestamp();
        }

        self.save_store()?;
        Ok(())
    }

    /// 使用用户输入的邮箱密码重新登录并更新账号信息
    pub async fn login_account_with_email(
        &mut self,
        account_id: &str,
        email: String,
        password: String,
    ) -> Result<UsageSummary> {
        let account = self
            .store
            .accounts
            .iter()
            .find(|a| a.id == account_id)
            .ok_or_else(|| anyhow!("账号不存在"))?
            .clone();

        let login_result = login_with_email(&email, &password).await?;

        if login_result.user_id != account.user_id {
            return Err(anyhow!("登录账号与当前账号不匹配"));
        }

        let summary = TraeApiClient::new_with_token(&login_result.token)?
            .get_usage_summary_by_token()
            .await?;

        if let Some(acc) = self.store.accounts.iter_mut().find(|a| a.id == account_id) {
            acc.email = email;
            acc.password = Some(password);
            acc.cookies = login_result.cookies;
            acc.jwt_token = Some(login_result.token);
            acc.token_expired_at = Some(login_result.expired_at);
            acc.tenant_id = login_result.tenant_id;
            acc.plan_type = summary.plan_type.clone();
            acc.updated_at = chrono::Utc::now().timestamp();
        }

        self.save_store()?;
        Ok(summary)
    }

    /// 使用 Token/Cookies 更新已有账号的登录信息
    pub async fn update_account_credentials(
        &mut self,
        account_id: &str,
        token: String,
        cookies: Option<String>,
        password: Option<String>,
    ) -> Result<()> {
        let client = TraeApiClient::new_with_token(&token)?;
        let user_info = client.get_user_info_by_token().await?;

        let acc = self.store.accounts.iter_mut()
            .find(|a| a.id == account_id)
            .ok_or_else(|| anyhow!("账号不存在"))?;

        if acc.user_id != user_info.user_id {
            return Err(anyhow!("Token 对应的用户与当前账号不匹配"));
        }

        let mut token_to_store = token;
        let mut expired_at = None;

        if let Some(cookie_str) = cookies.as_ref().filter(|v| !v.is_empty()) {
            match TraeApiClient::new(cookie_str) {
                Ok(mut cookie_client) => match cookie_client.get_user_token().await {
                    Ok(token_result) => {
                        if token_result.user_id != acc.user_id {
                            return Err(anyhow!("Cookies 对应的用户与当前账号不匹配"));
                        }
                        acc.cookies = cookie_str.to_string();
                        token_to_store = token_result.token;
                        expired_at = Some(token_result.expired_at);
                    }
                    Err(err) => {
                        println!("[WARN] cookies 登录验证失败，仍使用 Token: {}", err);
                    }
                },
                Err(err) => {
                    println!("[WARN] cookies 无效，仍使用 Token: {}", err);
                }
            }
        }

        acc.jwt_token = Some(token_to_store);
        acc.token_expired_at = expired_at;
        if let Some(pass) = password.filter(|v| !v.is_empty()) {
            acc.password = Some(pass);
        }
        acc.updated_at = chrono::Utc::now().timestamp();

        self.save_store()?;
        Ok(())
    }

    /// 更新账号 Token
    pub async fn update_account_token(&mut self, account_id: &str, token: String) -> Result<UsageSummary> {
        let client = TraeApiClient::new_with_token(&token)?;

        // 验证 Token 并获取用户信息
        let user_info = client.get_user_info_by_token().await?;

        // 查找账号
        let acc = self.store.accounts.iter_mut()
            .find(|a| a.id == account_id)
            .ok_or_else(|| anyhow!("账号不存在"))?;

        // 确保是同一个用户
        if acc.user_id != user_info.user_id {
            return Err(anyhow!("Token 对应的用户与当前账号不匹配"));
        }

        // 更新 Token
        acc.jwt_token = Some(token.clone());
        acc.updated_at = chrono::Utc::now().timestamp();

        // 获取最新使用量
        let summary = client.get_usage_summary_by_token().await?;
        acc.plan_type = summary.plan_type.clone();

        self.save_store()?;
        Ok(summary)
    }

    /// 更新账号 Cookies
    pub async fn update_cookies(&mut self, account_id: &str, cookies: String) -> Result<()> {
        // 验证新 cookies 是否有效
        let mut client = TraeApiClient::new(&cookies)?;
        let token_result = client.get_user_token().await?;

        if let Some(acc) = self.store.accounts.iter_mut().find(|a| a.id == account_id) {
            // 确保是同一个用户
            if acc.user_id != token_result.user_id {
                return Err(anyhow!("Cookies 对应的用户与当前账号不匹配"));
            }

            acc.cookies = cookies;
            acc.jwt_token = Some(token_result.token);
            acc.token_expired_at = Some(token_result.expired_at);
            acc.updated_at = chrono::Utc::now().timestamp();
        } else {
            return Err(anyhow!("账号不存在"));
        }

        self.save_store()?;
        Ok(())
    }

    /// 导出账号数据
    pub fn export_accounts(&self) -> Result<String> {
        let export_data: Vec<serde_json::Value> = self.store.accounts.iter().map(|acc| {
            serde_json::json!({
                "name": acc.name,
                "email": acc.email,
                "cookies": acc.cookies,
                "user_id": acc.user_id,
                "tenant_id": acc.tenant_id,
                "region": acc.region,
                "plan_type": acc.plan_type,
                "avatar_url": acc.avatar_url,
                "jwt_token": acc.jwt_token,
                "machine_id": acc.machine_id,
                "password": acc.password,
            })
        }).collect();

        serde_json::to_string_pretty(&export_data)
            .map_err(|e| anyhow!("导出失败: {}", e))
    }

    /// 导入账号数据
    pub async fn import_accounts(&mut self, data: &str) -> Result<usize> {
        let import_data: Vec<serde_json::Value> = serde_json::from_str(data)
            .map_err(|e| anyhow!("JSON 解析失败: {}", e))?;

        // 1. Prepare tasks for fetching account info
        let mut tasks = Vec::new();
        // Limit concurrency to 5 to avoid rate limits
        let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(5));
        
        // Pre-check for existing accounts by email to skip unnecessary requests
        let existing_emails: std::collections::HashSet<String> = self.store.accounts.iter()
            .map(|a| a.email.trim().to_lowercase())
            .filter(|e| !e.is_empty())
            .collect();

        for item in import_data {
            let cookies = item.get("cookies")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            
            let email = item.get("email")
                .and_then(|v| v.as_str())
                .map(|v| v.trim().to_string())
                .filter(|v| !v.is_empty());

            let password = item.get("password")
                .and_then(|v| v.as_str())
                .map(|v| v.to_string())
                .filter(|v| !v.is_empty());
                
            let machine_id = item.get("machine_id")
                .and_then(|v| v.as_str())
                .map(|v| v.to_string())
                .filter(|v| !v.is_empty());

            if cookies.is_empty() {
                continue;
            }
            
            // If email is provided in import data and already exists, update directly without network request
            if let Some(ref e) = email {
                if existing_emails.contains(&e.to_lowercase()) {
                    if let Some(existing) = self.store.accounts.iter_mut().find(|a| a.email.eq_ignore_ascii_case(e)) {
                        // Update existing account locally
                        if let Some(new_mid) = machine_id {
                             if existing.machine_id != Some(new_mid.clone()) {
                                 existing.machine_id = Some(new_mid);
                             }
                        }
                        if let Some(new_pass) = password {
                             if existing.password != Some(new_pass.clone()) {
                                 existing.password = Some(new_pass);
                             }
                        }
                        // Always update cookies for existing account
                        existing.cookies = cookies;
                        self.save_store()?;
                        continue;
                    }
                }
            }
            
            let cookies_clone = cookies.clone();
            let semaphore_clone = semaphore.clone();
            
            tasks.push(tokio::spawn(async move {
                let _permit = semaphore_clone.acquire().await.unwrap();
                // Perform network requests
                let result = fetch_account_info_internal(cookies_clone, password).await;
                (result, machine_id)
            }));
        }

        // 2. Wait for all tasks to complete
        let mut new_accounts = Vec::new();
        for task in tasks {
            if let Ok((Ok(mut account), machine_id)) = task.await {
                if let Some(mid) = machine_id {
                    account.machine_id = Some(mid);
                }
                new_accounts.push(account);
            }
        }

        // 3. Update store
        let mut imported_count = 0;
        let mut changed = false;
        
        for account in new_accounts {
             if let Some(existing) = self.store.accounts.iter_mut().find(|a| a.user_id == account.user_id) {
                 // Update existing account's machine_id if new one is provided
                 if let Some(new_mid) = account.machine_id {
                     if existing.machine_id != Some(new_mid.clone()) {
                         existing.machine_id = Some(new_mid);
                         changed = true;
                     }
                 }
                 // Update password if provided
                 if let Some(new_pass) = account.password {
                     if existing.password != Some(new_pass.clone()) {
                         existing.password = Some(new_pass);
                         changed = true;
                     }
                 }
                 continue;
             }
             
             self.store.accounts.push(account);
             imported_count += 1;
             changed = true;
        }

        if self.store.active_account_id.is_none() && !self.store.accounts.is_empty() {
            self.store.active_account_id = Some(self.store.accounts[0].id.clone());
            changed = true;
        }

        if changed {
            self.save_store()?;
        }

        Ok(imported_count)
    }

    /// 获取使用事件
    pub async fn get_usage_events(
        &mut self,
        account_id: &str,
        start_time: i64,
        end_time: i64,
        page_num: i32,
        page_size: i32,
    ) -> Result<UsageQueryResponse> {
        let account = self
            .store
            .accounts
            .iter()
            .find(|a| a.id == account_id)
            .ok_or_else(|| anyhow!("账号不存在"))?
            .clone();

        // 根据账号类型选择不同的方式调用 API
        if let Some(token) = &account.jwt_token {
            // 优先使用 Token
            let client = TraeApiClient::new_with_token(token)?;
            match client.query_usage(start_time, end_time, page_size, page_num).await {
                Ok(response) => Ok(response),
                Err(e) => {
                    let error_msg = e.to_string();
                    // 如果是 401 错误且有 Cookies，尝试刷新 Token
                    if error_msg.contains("401") && !account.cookies.is_empty() {
                        println!("[INFO] Token 已过期，尝试使用 Cookies 刷新...");
                        // 使用 Cookies 刷新 Token
                        let mut cookie_client = TraeApiClient::new(&account.cookies)?;
                        let token_result = cookie_client.get_user_token().await?;

                        // 更新存储的 Token
                        if let Some(acc) = self.store.accounts.iter_mut().find(|a| a.id == account_id) {
                            acc.jwt_token = Some(token_result.token.clone());
                            acc.token_expired_at = Some(token_result.expired_at.clone());
                        }
                        self.save_store()?;

                        // 使用新 Token 重新查询
                        let new_client = TraeApiClient::new_with_token(&token_result.token)?;
                        new_client.query_usage(start_time, end_time, page_size, page_num).await
                    } else if error_msg.contains("401") {
                        Err(anyhow!("Token 已过期，请更新 Token 或 Cookies"))
                    } else {
                        Err(e)
                    }
                }
            }
        } else if !account.cookies.is_empty() {
            // 使用 Cookies
            let mut client = TraeApiClient::new(&account.cookies)?;
            // 先获取 token
            client.get_user_token().await?;
            client.query_usage(start_time, end_time, page_size, page_num).await
        } else {
            Err(anyhow!("账号没有有效的 Token 或 Cookies"))
        }
    }

    /// 从 Trae IDE 读取当前登录账号
    pub async fn read_trae_ide_account(&mut self) -> Result<Option<Account>> {
        // 获取 Trae IDE 配置文件路径（跨平台支持）
        #[cfg(target_os = "windows")]
        let trae_data_path = {
            let appdata = std::env::var("APPDATA")
                .map_err(|_| anyhow!("无法获取 APPDATA 环境变量"))?;
            PathBuf::from(appdata).join("Trae")
        };
        
        #[cfg(target_os = "macos")]
        let trae_data_path = {
            let home = std::env::var("HOME")
                .map_err(|_| anyhow!("无法获取 HOME 环境变量"))?;
            PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("Trae")
        };
        
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        let trae_data_path: PathBuf = {
            return Err(anyhow!("此功能仅支持 Windows 和 macOS 系统"));
        };

        let storage_path = trae_data_path
            .join("User")
            .join("globalStorage")
            .join("storage.json");

        // 检查文件是否存在
        if !storage_path.exists() {
            return Ok(None);
        }

        // 读取文件内容
        let content = fs::read_to_string(&storage_path)
            .map_err(|e| anyhow!("读取 Trae IDE 配置文件失败: {}", e))?;

        // 解析 JSON
        let storage: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| anyhow!("解析 Trae IDE 配置文件失败: {}", e))?;

        // 获取 iCubeAuthInfo 字段
        let auth_info_str = storage
            .get("iCubeAuthInfo://icube.cloudide")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到 Trae IDE 登录信息"))?;

        // 解析嵌套的 JSON 字符串
        let auth_info: serde_json::Value = serde_json::from_str(auth_info_str)
            .map_err(|e| anyhow!("解析 Trae IDE 认证信息失败: {}", e))?;

        // 提取账号信息
        let token = auth_info
            .get("token")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到 Token"))?
            .to_string();

        let user_id = auth_info
            .get("userId")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到 User ID"))?
            .to_string();

        let email = auth_info
            .get("account")
            .and_then(|acc| acc.get("email"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let avatar_url = auth_info
            .get("account")
            .and_then(|acc| acc.get("avatar_url"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let username = auth_info
            .get("account")
            .and_then(|acc| acc.get("username"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // 检查账号是否已存在
        if self.store.accounts.iter().any(|a| a.user_id == user_id) {
            println!("[INFO] Trae IDE 账号已存在于账号管理中");
            return Ok(None);
        }

        // 使用 Token 获取完整的用户信息
        let client = TraeApiClient::new_with_token(&token)?;
        let user_info = client.get_user_info_by_token().await?;

        // 创建账号对象
        let mut account = Account::new(
            if username.is_empty() {
                user_info.screen_name.unwrap_or_else(|| format!("User_{}", &user_id[..8.min(user_id.len())]))
            } else {
                username
            },
            if email.is_empty() {
                user_info.email.unwrap_or_default()
            } else {
                email
            },
            String::new(), // Trae IDE 不存储 cookies
            user_id,
            user_info.tenant_id,
        );

        account.avatar_url = if avatar_url.is_empty() {
            user_info.avatar_url.unwrap_or_default()
        } else {
            avatar_url
        };
        account.jwt_token = Some(token);

        // 添加到账号列表
        self.store.accounts.push(account.clone());

        // 如果是第一个账号，设为活跃账号
        if self.store.active_account_id.is_none() {
            self.store.active_account_id = Some(account.id.clone());
        }

        self.save_store()?;

        println!("[INFO] 成功从 Trae IDE 读取并添加账号: {}", account.email);
        Ok(Some(account))
    }

    /// 领取生日礼包
    pub async fn claim_birthday_bonus(&mut self, account_id: &str) -> Result<()> {
        let account = self.store.accounts.iter()
            .find(|a| a.id == account_id)
            .ok_or_else(|| anyhow!("账号不存在"))?;

        let token = account.jwt_token.as_ref()
            .ok_or_else(|| anyhow!("账号没有 Token"))?;

        let client = TraeApiClient::new_with_token(token)?;

        // 先查询是否已领取
        let claimed = client.query_birthday_bonus().await?;
        if claimed {
            return Err(anyhow!("该账号已领取过礼包"));
        }

        // 领取礼包
        client.claim_birthday_bonus().await?;

        println!("[INFO] 成功领取礼包: {}", account.email);
        Ok(())
    }

    /// 获取账号统计数据
    pub async fn get_account_statistics(&self, account_id: &str) -> Result<crate::api::UserStatisticResult> {
        let account = self.store.accounts.iter()
            .find(|a| a.id == account_id)
            .ok_or_else(|| anyhow!("账号不存在"))?;

        let token = account.jwt_token.as_ref()
            .ok_or_else(|| anyhow!("账号没有有效的 Token"))?;

        let client = if account.cookies.trim().is_empty() {
            TraeApiClient::new_with_token(token)?
        } else {
            TraeApiClient::new_with_token_and_cookies(token, &account.cookies)?
        };
        client.get_user_statistic_data().await
    }

    pub fn update_account_info_after_usage_check(
        &mut self,
        account_id: &str,
        plan_type: String,
        new_token: Option<(String, String)>, // (token, expired_at)
    ) -> Result<()> {
        if let Some(acc) = self.store.accounts.iter_mut().find(|a| a.id == account_id) {
            acc.plan_type = plan_type;
            if let Some((token, expired_at)) = new_token {
                acc.jwt_token = Some(token);
                acc.token_expired_at = Some(expired_at);
            }
            acc.updated_at = chrono::Utc::now().timestamp();
            self.save_store()?;
        }
        Ok(())
    }
}

async fn fetch_account_info_internal(cookies: String, password: Option<String>) -> Result<Account> {
    let mut client = TraeApiClient::new(&cookies)?;
    let token_result = client.get_user_token().await?;
    let user_info = client.get_user_info().await?;
    
    let mut account = Account::new(
        user_info.screen_name.clone(),
        user_info.non_plain_text_email.unwrap_or_default(),
        cookies,
        token_result.user_id,
        token_result.tenant_id,
    );
    account.avatar_url = user_info.avatar_url;
    account.region = user_info.region;
    account.jwt_token = Some(token_result.token);
    account.token_expired_at = Some(token_result.expired_at);
    account.password = password;
    
    Ok(account)
}
