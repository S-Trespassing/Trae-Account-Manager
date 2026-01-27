// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod account;
mod machine;
mod privacy;

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex as StdMutex};
use std::time::{Duration, Instant};

use reqwest::Client;
use serde_json::Value;
use tokio::sync::{oneshot, Mutex};
use tauri::{AppHandle, Emitter, Manager, State, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri::webview::PageLoadEvent;
use uuid::Uuid;
use warp::Filter;

use account::{AccountBrief, AccountManager, Account};
use api::{TraeApiClient, UsageSummary, UsageQueryResponse, UserStatisticResult};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AppSettings {
    pub quick_register_show_window: bool,
    pub auto_refresh_enabled: bool,
    pub privacy_auto_enable: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            quick_register_show_window: true,
            auto_refresh_enabled: true,
            privacy_auto_enable: false,
        }
    }
}

fn get_settings_path() -> anyhow::Result<PathBuf> {
    let proj_dirs = directories::ProjectDirs::from("com", "sauce", "trae-auto")
        .ok_or_else(|| anyhow::anyhow!("无法获取应用配置目录"))?;
    let config_dir = proj_dirs.config_dir();
    fs::create_dir_all(config_dir)?;
    Ok(config_dir.join("settings.json"))
}

fn load_settings_from_disk() -> anyhow::Result<AppSettings> {
    let path = get_settings_path()?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let content = fs::read_to_string(&path)?;
    if content.trim().is_empty() {
        return Ok(AppSettings::default());
    }
    let settings = serde_json::from_str(&content)
        .unwrap_or_else(|_| AppSettings::default());
    Ok(settings)
}

fn save_settings_to_disk(settings: &AppSettings) -> anyhow::Result<()> {
    let path = get_settings_path()?;
    let content = serde_json::to_string_pretty(settings)?;
    fs::write(path, content)?;
    Ok(())
}

/// 应用状态
pub struct AppState {
    pub account_manager: Mutex<AccountManager>,
    browser_login: Mutex<Option<BrowserLoginSession>>,
    browser_login_cancel: Mutex<Option<oneshot::Sender<()>>>,
    settings: Mutex<AppSettings>,
}

struct BrowserLoginSession {
    receiver: oneshot::Receiver<String>,
    shutdown: Arc<StdMutex<Option<oneshot::Sender<()>>>>,
    cancel: oneshot::Receiver<()>,
    webview: WebviewWindow,
}

/// 错误类型
#[derive(Debug, serde::Serialize)]
pub struct ApiError {
    pub message: String,
}

impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        Self {
            message: err.to_string(),
        }
    }
}

type Result<T> = std::result::Result<T, ApiError>;

// ============ Tauri 命令 ============

#[derive(Debug, Clone, serde::Serialize)]
struct QuickRegisterNotice {
    id: String,
    message: String,
}

fn emit_quick_register_notice(app: &AppHandle, id: &str, message: &str) {
    let payload = QuickRegisterNotice {
        id: id.to_string(),
        message: message.to_string(),
    };
    let _ = app.emit("quick_register_notice", payload);
}

/// 添加账号（通过 Token，可选 Cookies）
#[tauri::command]
async fn add_account_by_token(token: String, cookies: Option<String>, state: State<'_, AppState>) -> Result<Account> {
    let mut manager = state.account_manager.lock().await;
    manager.add_account_by_token(token, cookies, None).await.map_err(ApiError::from)
}

/// 添加账号（通过邮箱密码登录）
#[tauri::command]
async fn add_account_by_email(email: String, password: String, state: State<'_, AppState>) -> Result<Account> {
    let mut manager = state.account_manager.lock().await;
    manager.add_account_by_email(email, password).await.map_err(ApiError::from)
}

#[tauri::command]
async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings> {
    let settings = state.settings.lock().await;
    Ok(settings.clone())
}

#[tauri::command]
async fn update_settings(settings: AppSettings, state: State<'_, AppState>) -> Result<AppSettings> {
    {
        let mut current = state.settings.lock().await;
        *current = settings.clone();
    }
    save_settings_to_disk(&settings).map_err(ApiError::from)?;
    Ok(settings)
}

const MAIL_API_BASE: &str = "https://api.mail.cx/api/v1";
const MAIL_DOMAINS: [&str; 3] = ["uuf.me", "nqmo.com", "end.tw"];

struct MailClient {
    client: Client,
    api_token: String,
    email: String,
    processed_ids: HashSet<String>,
}

impl MailClient {
    async fn new() -> anyhow::Result<Self> {
        let client = Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .timeout(Duration::from_secs(30))
            .build()?;

        let token = authorize_mail_token(&client).await?;
        Ok(Self {
            client,
            api_token: token,
            email: String::new(),
            processed_ids: HashSet::new(),
        })
    }

    fn set_email(&mut self, email: String) {
        self.email = email;
    }

    async fn check_for_code(&mut self) -> anyhow::Result<Option<String>> {
        if self.email.is_empty() {
            return Ok(None);
        }

        let url = format!("{MAIL_API_BASE}/mailbox/{}", self.email);
        let resp = self
            .client
            .get(&url)
            .bearer_auth(&self.api_token)
            .send()
            .await?;
        let data: Value = resp.json().await?;
        let messages = if let Some(list) = data.as_array() {
            list.to_vec()
        } else if let Some(list) = data.get("messages").and_then(|v| v.as_array()) {
            list.to_vec()
        } else {
            Vec::new()
        };

        if messages.is_empty() {
            return Ok(None);
        }

        let latest = &messages[0];
        let msg_id = latest
            .get("id")
            .and_then(|v| v.as_str())
            .map(|v| v.to_string())
            .or_else(|| latest.get("id").and_then(|v| v.as_i64()).map(|v| v.to_string()))
            .unwrap_or_default();

        if msg_id.is_empty() || self.processed_ids.contains(&msg_id) {
            return Ok(None);
        }

        self.processed_ids.insert(msg_id.clone());

        let content = self.fetch_message_content(&msg_id).await?;
        Ok(extract_verification_code(&content))
    }

    async fn fetch_message_content(&self, msg_id: &str) -> anyhow::Result<String> {
        let url = format!("{MAIL_API_BASE}/mailbox/{}/{}", self.email, msg_id);
        let resp = self
            .client
            .get(&url)
            .bearer_auth(&self.api_token)
            .send()
            .await?;
        let data: Value = resp.json().await?;
        let body = data.get("body").cloned().unwrap_or(Value::Null);
        let text = body
            .get("text")
            .and_then(|v| v.as_str())
            .map(|v| v.to_string())
            .or_else(|| body.get("html").and_then(|v| v.as_str()).map(|v| v.to_string()))
            .unwrap_or_default();
        Ok(text)
    }
}

async fn authorize_mail_token(client: &Client) -> anyhow::Result<String> {
    let url = format!("{MAIL_API_BASE}/auth/authorize_token");
    let resp = client.post(&url).json(&serde_json::json!({})).send().await?;
    let value: Value = resp.json().await?;
    let token = match value {
        Value::String(val) => Some(val),
        Value::Object(map) => map
            .get("token")
            .or_else(|| map.get("access_token"))
            .or_else(|| map.get("data"))
            .and_then(|v| v.as_str())
            .map(|v| v.to_string()),
        _ => None,
    };
    token.ok_or_else(|| anyhow::anyhow!("邮箱认证失败，未获取到 token"))
}

fn generate_email_address() -> String {
    let raw = Uuid::new_v4().simple().to_string();
    let username = raw[..8].to_string();
    let index = (raw.as_bytes()[0] as usize) % MAIL_DOMAINS.len();
    format!("{}@{}", username, MAIL_DOMAINS[index])
}

fn generate_password() -> String {
    let raw = Uuid::new_v4().simple().to_string();
    format!("A{}!{}", &raw[..6], &raw[6..12])
}

fn extract_verification_code(content: &str) -> Option<String> {
    let mut digits = String::new();
    for ch in content.chars() {
        if ch.is_ascii_digit() {
            digits.push(ch);
            if digits.len() == 6 {
                return Some(digits);
            }
        } else {
            digits.clear();
        }
    }
    None
}

async fn wait_for_verification_code(client: &mut MailClient, timeout: Duration) -> anyhow::Result<String> {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if let Some(code) = client.check_for_code().await? {
            return Ok(code);
        }
        tokio::time::sleep(Duration::from_secs(5)).await;
    }
    Err(anyhow::anyhow!("等待邮箱验证码超时"))
}

fn build_register_helper_script() -> String {
    r#"(function() {
  if (window.__traeAutoRegister) return;

  const normalize = (text) => (text || "").toLowerCase();
  const setValue = (input, value) => {
    if (!input) return false;
    const proto = Object.getPrototypeOf(input);
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    input.focus();
    if (setter) {
      setter.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  };
  const findInputByLabel = (labels) => {
    const labelEls = Array.from(document.querySelectorAll("label"));
    for (const label of labelEls) {
      const text = normalize(label.innerText);
      if (!labels.some((l) => text.includes(l))) continue;
      const forId = label.getAttribute("for");
      if (forId) {
        const target = document.getElementById(forId);
        if (target) return target;
      }
      const nested = label.querySelector("input");
      if (nested) return nested;
    }
    return null;
  };
  const findInput = (labels, selectors) => {
    const byLabel = findInputByLabel(labels);
    if (byLabel) return byLabel;
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  };
  const isVisible = (el) => {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const isClickable = (el) => {
    if (!el || el.disabled) return false;
    const tag = (el.tagName || "").toLowerCase();
    if (tag === "button" || tag === "a" || tag === "input") return true;
    const role = el.getAttribute && el.getAttribute("role");
    if (role === "button") return true;
    const style = window.getComputedStyle(el);
    if (style && style.cursor === "pointer") return true;
    return !!el.onclick;
  };
  const findClickableAncestor = (el) => {
    let current = el;
    let depth = 0;
    while (current && depth < 4) {
      if (isClickable(current)) return current;
      current = current.parentElement;
      depth += 1;
    }
    return null;
  };
  const findClickableByText = (labels, scope) => {
    const root = scope || document;
    const candidates = Array.from(
      root.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit'], a, div, span")
    );
    return (
      candidates.find((el) => {
        if (!isVisible(el)) return false;
        const text = normalize(el.innerText || el.textContent);
        if (!text) return false;
        if (!labels.some((label) => text.includes(label))) return false;
        return isClickable(el);
      }) || null
    );
  };
  const runWithRetry = (fn, maxTries = 40) => {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const ok = fn();
      if (ok || tries >= maxTries) {
        clearInterval(timer);
      }
    }, 500);
  };

  const findTextNodeElement = (labels) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.nodeValue) continue;
      const text = normalize(node.nodeValue);
      if (!text) continue;
      if (labels.some((label) => text.includes(label))) {
        return node.parentElement;
      }
    }
    return null;
  };

  const clickByText = (labels) => {
    const element = findTextNodeElement(labels);
    if (!element) return false;
    const clickable = findClickableAncestor(element) || element;
    clickable.click();
    return true;
  };

  const tryAcceptCookies = () => {
    const cookieSelectors = [
      'button.cm__btn',
      '.cm__btn[role=\"button\"]',
      '.cm__btn'
    ];
    for (const selector of cookieSelectors) {
      const btn = document.querySelector(selector);
      if (btn && isVisible(btn)) {
        btn.click();
        return true;
      }
    }
    const btn = findClickableByText(["got it", "accept", "agree", "允许", "同意"], document);
    if (btn) {
      btn.click();
      return true;
    }
    const wrapper = document.querySelector(".cm-wrapper, .cc__wrapper, .cookie-banner, .cookie-consent");
    if (wrapper) {
      wrapper.remove();
      return true;
    }
    return false;
  };

  const tryStart = (email) => {
    tryAcceptCookies();
    const emailInput = findInput(["email"], [
      'input[type="email"]',
      'input[name="email"]',
      'input[autocomplete="email"]',
      'input[placeholder*="Email"]'
    ]);
    if (emailInput) {
      setValue(emailInput, email);
      if (emailInput.value !== email) {
        return false;
      }
    }
    const codeInput = findInput(["verification", "code", "验证码", "验证"], [
      'input[name="code"]',
      'input[placeholder*="Verification"]',
      'input[placeholder*="Code"]'
    ]);
    const labels = ["send code", "send verification", "get code", "发送验证码", "获取验证码", "发送码"];
    const sendCodeSelectors = [
      ".right-part.send-code",
      ".send-code",
      ".verification-code",
      ".verification-code .send-code",
      ".input-con .right-part"
    ];
    const scope = codeInput ? codeInput.parentElement || codeInput.closest("div") : null;
    let btn = null;
    for (const selector of sendCodeSelectors) {
      const candidate = document.querySelector(selector);
      if (candidate && isVisible(candidate)) {
        btn = findClickableAncestor(candidate) || candidate;
        break;
      }
    }
    if (!btn) {
      btn = findClickableByText(labels, scope);
    }
    if (!btn) {
      btn = findClickableByText(labels, document);
    }
    if (!btn) {
      if (clickByText(labels)) return true;
    }
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  };

  const tryComplete = (code, password) => {
    tryAcceptCookies();
    const codeInput = findInput(["verification", "code"], [
      'input[name="code"]',
      'input[placeholder*="Verification"]',
      'input[placeholder*="Code"]'
    ]);
    const passInput = findInput(["password"], [
      'input[type="password"]',
      'input[name="password"]',
      'input[autocomplete="new-password"]'
    ]);
    if (codeInput) setValue(codeInput, code);
    if (passInput) setValue(passInput, password);
    const form = passInput?.closest("form") || codeInput?.closest("form");
    if (form) {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      if (typeof form.submit === "function") {
        form.submit();
      }
    }
    const signUpSelectors = [".btn-submit", ".trae__btn", ".btn-large", ".btn-submit.trae__btn"];
    let btn = null;
    for (const selector of signUpSelectors) {
      const candidate = document.querySelector(selector);
      if (candidate && isVisible(candidate)) {
        btn = findClickableAncestor(candidate) || candidate;
        break;
      }
    }
    if (!btn) {
      btn = findClickableByText(["sign up", "register", "注册"], document);
    }
    if (btn) {
      btn.click();
      return true;
    }
    if (clickByText(["sign up", "register", "注册"])) {
      return true;
    }
    return false;
  };

  window.__traeAutoRegister = {
    started: false,
    completed: false,
    start: function(email) {
      if (this.started) return;
      this.started = true;
      runWithRetry(() => tryStart(email));
    },
    complete: function(code, password) {
      if (this.completed) return;
      this.completed = true;
      runWithRetry(() => tryComplete(code, password));
    },
  };
  setInterval(tryAcceptCookies, 1500);
})();"#.to_string()
}

async fn wait_for_token_with_cookies(webview: &WebviewWindow, timeout: Duration) -> anyhow::Result<String> {
    let start = Instant::now();
    while start.elapsed() < timeout {
        let cookies = collect_trae_cookies(webview);
        if !cookies.is_empty() {
            let mut client = TraeApiClient::new(&cookies)?;
            if client.get_user_token().await.is_ok() {
                return Ok(cookies);
            }
        }
        tokio::time::sleep(Duration::from_secs(3)).await;
    }
    Err(anyhow::anyhow!("注册完成后未能获取 Token"))
}

#[tauri::command]
async fn quick_register(app: AppHandle, show_window: bool, state: State<'_, AppState>) -> Result<Account> {
    if state.browser_login.lock().await.is_some() {
        return Err(anyhow::anyhow!("浏览器登录正在进行中，请稍后再试").into());
    }

    let mut mail_client = MailClient::new().await.map_err(ApiError::from)?;
    let email = generate_email_address();
    let password = generate_password();
    mail_client.set_email(email.clone());

    let pending_completion: Arc<StdMutex<Option<(String, String)>>> = Arc::new(StdMutex::new(None));
    let pending_completion_onload = pending_completion.clone();
    let helper_script = build_register_helper_script();
    let helper_script_onload = helper_script.clone();
    let email_onload = email.clone();

    if let Some(existing) = app.get_webview_window("trae-register") {
        let _ = existing.close();
    }

    let webview = WebviewWindowBuilder::new(&app, "trae-register", WebviewUrl::External("about:blank".parse().unwrap()))
        .title("Trae 注册")
        .inner_size(1000.0, 720.0)
        .visible(show_window)
        .on_page_load(move |window, payload| {
            if payload.event() == PageLoadEvent::Finished {
                let _ = window.eval(helper_script_onload.clone());
                if let Some((code, password)) = pending_completion_onload.lock().unwrap().clone() {
                    let code_js = serde_json::to_string(&code).unwrap_or_else(|_| "\"\"".to_string());
                    let password_js = serde_json::to_string(&password).unwrap_or_else(|_| "\"\"".to_string());
                    let _ = window.eval(format!(
                        "window.__traeAutoRegister && window.__traeAutoRegister.complete({}, {});",
                        code_js, password_js
                    ));
                } else {
                    let email_js = serde_json::to_string(&email_onload).unwrap_or_else(|_| "\"\"".to_string());
                    let _ = window.eval(format!(
                        "window.__traeAutoRegister && window.__traeAutoRegister.start({});",
                        email_js
                    ));
                }
            }
        })
        .build()
        .map_err(|e| anyhow::anyhow!("无法打开注册窗口: {}", e))?;

    if !show_window {
        emit_quick_register_notice(&app, "quick_register_init", "初始化完成，等待接收邮箱验证码");
    }

    let _ = webview.clear_all_browsing_data();
    let _ = webview.navigate(Url::parse("https://www.trae.ai/sign-up").unwrap());
    if show_window {
        let _ = webview.set_focus();
    }
    let _ = webview.eval(helper_script);

    let code = match wait_for_verification_code(&mut mail_client, Duration::from_secs(60)).await {
        Ok(code) => code,
        Err(err) => {
            let _ = webview.close();
            if !show_window {
                emit_quick_register_notice(
                    &app,
                    "quick_register_failed",
                    "快速注册失败，可在设置中开启快速注册显示浏览器查看失败原因。",
                );
            }
            return Err(ApiError::from(err));
        }
    };

    if !show_window {
        emit_quick_register_notice(&app, "quick_register_code_ok", "邮箱验证码获取成功，正在登录");
    }

    *pending_completion.lock().unwrap() = Some((code.clone(), password.clone()));
    let code_js = serde_json::to_string(&code).unwrap_or_else(|_| "\"\"".to_string());
    let password_js = serde_json::to_string(&password).unwrap_or_else(|_| "\"\"".to_string());
    let _ = webview.eval(format!(
        "window.__traeAutoRegister && window.__traeAutoRegister.complete({}, {});",
        code_js, password_js
    ));

    let cookies = match wait_for_token_with_cookies(&webview, Duration::from_secs(90)).await {
        Ok(cookies) => cookies,
        Err(err) => {
            let _ = webview.close();
            if !show_window {
                emit_quick_register_notice(
                    &app,
                    "quick_register_failed",
                    "快速注册失败，可在设置中开启快速注册显示浏览器查看失败原因。",
                );
            }
            return Err(ApiError::from(err));
        }
    };

    if !show_window {
        emit_quick_register_notice(&app, "quick_register_login_ok", "登录成功，正在导入账号");
    }

    let _ = webview.close();
    let mut manager = state.account_manager.lock().await;
    let account = manager.add_account(cookies, Some(password)).await.map_err(ApiError::from)?;
    if !show_window {
        emit_quick_register_notice(&app, "quick_register_done", "导入成功");
    }
    Ok(account)
}

fn build_browser_login_script(port: u16) -> String {
    let script = r#"(function() {
  if (window.__traeAutoInjected) return;
  window.__traeAutoInjected = true;

  const callback = "http://127.0.0.1:__PORT__/callback";
  let loginTriggered = false;
  const tryAcceptCookies = () => {
    const cookieSelectors = [
      'button.cm__btn',
      '.cm__btn[role=\"button\"]',
      '.cm__btn'
    ];
    for (const selector of cookieSelectors) {
      const btn = document.querySelector(selector);
      if (btn) {
        btn.click();
        return true;
      }
    }
    const candidates = Array.from(
      document.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit'], a")
    );
    const matchText = (text) => {
      const val = (text || "").toLowerCase();
      return (
        val.includes("got it") ||
        val.includes("accept") ||
        val.includes("agree") ||
        val.includes("允许") ||
        val.includes("同意")
      );
    };
    for (const el of candidates) {
      const text = el.innerText || el.textContent || "";
      if (matchText(text)) {
        el.click();
        return true;
      }
    }
    const wrapper = document.querySelector(".cm-wrapper, .cc__wrapper, .cookie-banner, .cookie-consent");
    if (wrapper) {
      wrapper.remove();
      return true;
    }
    return false;
  };
  const sendToken = (token) => {
    if (!token || !loginTriggered) return;
    const url = callback + "?token=" + encodeURIComponent(token);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url);
    } else {
      fetch(url, { mode: "no-cors" });
    }
  };
  const sendState = (state, href) => {
    if (!state || !loginTriggered) return;
    const url = callback + "?state=" + encodeURIComponent(state) + "&href=" + encodeURIComponent(href || "");
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url);
    } else {
      fetch(url, { mode: "no-cors" });
    }
  };
  const isLoginCompleteUrl = (href) => {
    if (!href) return false;
    const lower = href.toLowerCase();
    if (lower.includes("/login")) return false;
    if (lower.includes("passport")) return false;
    return true;
  };
  const parseToken = (data) => {
    if (!data) return null;
    return (
      data.result?.token ||
      data.result?.Token ||
      data.Result?.token ||
      data.Result?.Token ||
      null
    );
  };

  const markLoginTriggered = () => {
    loginTriggered = true;
  };
  const tryFetch = async () => {
    if (!loginTriggered) return;
    try {
      const res = await fetch("https://api-sg-central.trae.ai/cloudide/api/v3/common/GetUserToken", {
        method: "POST",
        credentials: "include"
      });
      const data = await res.json();
      const token = parseToken(data);
      if (token) sendToken(token);
    } catch {}
  };

  const hookFetch = () => {
    const orig = window.fetch;
    window.fetch = async (...args) => {
      const res = await orig(...args);
      try {
        if (typeof res.url === "string" && res.url.includes("GetUserToken")) {
          const data = await res.clone().json();
          const token = parseToken(data);
          if (token) sendToken(token);
        }
      } catch {}
      return res;
    };
  };

  const hookXHR = () => {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this.__trae_url = url;
      return origOpen.apply(this, [method, url, ...rest]);
    };
    XMLHttpRequest.prototype.send = function(body) {
      this.addEventListener("load", function() {
        try {
          if ((this.__trae_url || "").includes("GetUserToken")) {
            const data = JSON.parse(this.responseText);
            const token = parseToken(data);
            if (token) sendToken(token);
          }
        } catch {}
      });
      return origSend.apply(this, arguments);
    };
  };

  hookFetch();
  hookXHR();
  tryFetch();
  tryAcceptCookies();
  setInterval(tryFetch, 3000);
  setInterval(tryAcceptCookies, 1500);
  document.addEventListener("submit", () => markLoginTriggered(), true);
  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!target) return;
    if (target.type === "password") markLoginTriggered();
  }, true);
  let lastHref = location.href;
  let stateSent = false;
  const checkHref = () => {
    const href = location.href;
    if (href !== lastHref) {
      lastHref = href;
      if (!stateSent && loginTriggered && isLoginCompleteUrl(href)) {
        stateSent = true;
        sendState("logged_in", href);
      }
    }
  };
  setInterval(checkHref, 1000);
  if (loginTriggered && isLoginCompleteUrl(location.href)) {
    stateSent = true;
    sendState("logged_in", location.href);
  }
})();"#;
    script.replace("__PORT__", &port.to_string())
}

fn collect_trae_cookies(webview: &WebviewWindow) -> String {
    let mut cookie_map: HashMap<String, String> = HashMap::new();
    for raw_url in [
        "https://www.trae.ai/",
        "https://api-sg-central.trae.ai/",
        "https://ug-normal.trae.ai/",
    ] {
        if let Ok(url) = Url::parse(raw_url) {
            if let Ok(cookies) = webview.cookies_for_url(url) {
                for cookie in cookies {
                    cookie_map
                        .entry(cookie.name().to_string())
                        .or_insert(cookie.value().to_string());
                }
            }
        }
    }

    let mut cookies = cookie_map
        .into_iter()
        .map(|(name, value)| format!("{name}={value}"))
        .collect::<Vec<_>>()
        .join("; ");
    if !cookies.is_empty()
        && !cookies.contains("store-idc=")
        && !cookies.contains("trae-target-idc=")
    {
        cookies.push_str("; store-idc=alisg");
    }
    cookies
}
#[tauri::command]
async fn start_browser_login(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    let mut browser_login = state.browser_login.lock().await;
    if browser_login.is_some() {
        return Err(anyhow::anyhow!("浏览器登录已在进行中").into());
    }
    println!("[browser-login] start_browser_login: launching login window");

    let (token_tx, token_rx) = oneshot::channel::<String>();
    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
    let (cancel_tx, cancel_rx) = oneshot::channel::<()>();
    let token_sender = Arc::new(StdMutex::new(Some(token_tx)));
    let shutdown_sender = Arc::new(StdMutex::new(Some(shutdown_tx)));

    let token_sender_route = token_sender.clone();
    let shutdown_sender_route = shutdown_sender.clone();
    let route = warp::path("callback")
        .and(warp::query::<HashMap<String, String>>())
        .map(move |query: HashMap<String, String>| {
            println!("[browser-login] callback query: {:?}", query);
            let token = query.get("token").cloned().unwrap_or_default();
            let state = query.get("state").cloned().unwrap_or_default();
            let href = query.get("href").cloned().unwrap_or_default();
            if !token.is_empty() {
                if let Some(tx) = token_sender_route.lock().unwrap().take() {
                    let _ = tx.send(token);
                }
                if let Some(tx) = shutdown_sender_route.lock().unwrap().take() {
                    let _ = tx.send(());
                }
                warp::reply::html("已收到 Token，可以关闭此页面并返回应用。".to_string())
            } else if state == "logged_in" {
                if let Some(tx) = token_sender_route.lock().unwrap().take() {
                    let _ = tx.send("__LOGIN_DONE__".to_string());
                }
                if let Some(tx) = shutdown_sender_route.lock().unwrap().take() {
                    let _ = tx.send(());
                }
                warp::reply::html(format!("检测到登录完成，可返回应用继续导入。{href}"))
            } else {
                warp::reply::html("未收到 Token，请重试。".to_string())
            }
        });

    let (addr, server): (std::net::SocketAddr, _) = warp::serve(route)
        .bind_with_graceful_shutdown(([127, 0, 0, 1], 0), async move {
            let _ = shutdown_rx.await;
        });

    tokio::spawn(server);

    let script = build_browser_login_script(addr.port());
    let script_onload = script.clone();

    if let Some(existing) = app.get_webview_window("trae-login") {
        let _ = existing.close();
    }

    let webview = WebviewWindowBuilder::new(&app, "trae-login", WebviewUrl::External("about:blank".parse().unwrap()))
        .title("Trae 登录")
        .inner_size(1000.0, 720.0)
        .on_page_load(move |window, payload| {
            if payload.event() == PageLoadEvent::Finished {
                println!("[browser-login] page load finished, injecting script");
                let _ = window.eval(script_onload.clone());
            }
        })
        .build()
        .map_err(|e| anyhow::anyhow!("无法打开登录窗口: {}", e))?;

    if let Err(e) = webview.clear_all_browsing_data() {
        println!("[browser-login] clear browsing data failed: {}", e);
    } else {
        println!("[browser-login] cleared browsing data");
    }
    let _ = webview.navigate(Url::parse("https://www.trae.ai/login").unwrap());

    let _ = webview.set_focus();
    let _ = webview.eval(script);

    *browser_login = Some(BrowserLoginSession {
        receiver: token_rx,
        shutdown: shutdown_sender,
        cancel: cancel_rx,
        webview,
    });
    *state.browser_login_cancel.lock().await = Some(cancel_tx);

    Ok(())
}

#[tauri::command]
async fn finish_browser_login(state: State<'_, AppState>) -> Result<Account> {
    println!("[browser-login] finish_browser_login: waiting for token");
    let session = {
        let mut browser_login = state.browser_login.lock().await;
        browser_login.take().ok_or_else(|| anyhow::anyhow!("浏览器登录未开始"))?
    };

    let token = tokio::select! {
        res = session.receiver => {
            match res {
                Ok(token) => token,
                Err(_) => {
                    let _ = state.browser_login_cancel.lock().await.take();
                    if let Some(tx) = session.shutdown.lock().unwrap().take() {
                        let _ = tx.send(());
                    }
                    let _ = session.webview.close();
                    return Err(anyhow::anyhow!("浏览器登录已取消").into());
                }
            }
        }
        _ = session.cancel => {
            let _ = state.browser_login_cancel.lock().await.take();
            if let Some(tx) = session.shutdown.lock().unwrap().take() {
                let _ = tx.send(());
            }
            let _ = session.webview.close();
            return Err(anyhow::anyhow!("浏览器登录已取消").into());
        }
        _ = tokio::time::sleep(Duration::from_secs(300)) => {
            let _ = state.browser_login_cancel.lock().await.take();
            if let Some(tx) = session.shutdown.lock().unwrap().take() {
                let _ = tx.send(());
            }
            let _ = session.webview.close();
            return Err(anyhow::anyhow!("等待浏览器登录超时").into());
        }
    };

    if let Some(tx) = session.shutdown.lock().unwrap().take() {
        let _ = tx.send(());
    }
    let _ = state.browser_login_cancel.lock().await.take();

    let cookies = collect_trae_cookies(&session.webview);
    println!("[browser-login] cookies collected: {}", if cookies.is_empty() { "empty" } else { "ok" });
    let token = if token == "__LOGIN_DONE__" {
        if cookies.is_empty() {
            let _ = session.webview.close();
            return Err(anyhow::anyhow!("登录完成但未获取到 Cookie").into());
        }
        println!("[browser-login] token not provided, requesting token via cookies");
        let mut client = TraeApiClient::new(&cookies).map_err(ApiError::from)?;
        let token_result = client.get_user_token().await.map_err(ApiError::from)?;
        token_result.token
    } else {
        token
    };
    let _ = session.webview.close();
    let cookies = if cookies.is_empty() { None } else { Some(cookies) };

    let mut manager = state.account_manager.lock().await;
    manager.add_account_by_token(token, cookies, None).await.map_err(ApiError::from)
}

#[tauri::command]
async fn cancel_browser_login(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    if let Some(tx) = state.browser_login_cancel.lock().await.take() {
        let _ = tx.send(());
    }
    let session = {
        let mut browser_login = state.browser_login.lock().await;
        browser_login.take()
    };
    if let Some(session) = session {
        if let Some(tx) = session.shutdown.lock().unwrap().take() {
            let _ = tx.send(());
        }
        let _ = session.webview.close();
    } else if let Some(window) = app.get_webview_window("trae-login") {
        let _ = window.close();
    }
    Ok(())
}

#[tauri::command]
async fn remove_account(account_id: String, state: State<'_, AppState>) -> Result<()> {
    let mut manager = state.account_manager.lock().await;
    manager.remove_account(&account_id).map_err(ApiError::from)
}

/// 获取所有账号
#[tauri::command]
async fn get_accounts(state: State<'_, AppState>) -> Result<Vec<AccountBrief>> {
    let manager = state.account_manager.lock().await;
    Ok(manager.get_accounts())
}

/// 获取单个账号详情
#[tauri::command]
async fn get_account(account_id: String, state: State<'_, AppState>) -> Result<Account> {
    let manager = state.account_manager.lock().await;
    manager.get_account(&account_id).map_err(ApiError::from)
}

/// 切换账号（设置活跃账号并更新机器码）
#[tauri::command]
async fn switch_account(account_id: String, force: Option<bool>, state: State<'_, AppState>) -> Result<()> {
    {
        let mut manager = state.account_manager.lock().await;
        let force = force.unwrap_or(false);
        manager.switch_account(&account_id, force).map_err(ApiError::from)?;
    }

    let settings = state.settings.lock().await.clone();
    if settings.privacy_auto_enable {
        println!("[INFO] 等待 Trae IDE 启动后写入隐私模式设置");
        let db_path = match machine::get_trae_state_db_path() {
            Ok(path) => path,
            Err(err) => {
                println!("[ERROR] 查找 Trae 数据库失败: {}", err);
                return Ok(());
            }
        };
        tokio::task::spawn_blocking(move || {
            let result = privacy::enable_privacy_mode_at_path_with_restart(db_path, || {
                println!("[INFO] 正在重启 Trae IDE...");
                machine::kill_trae()?;
                machine::open_trae()
            });
            if let Err(err) = result {
                println!("[ERROR] 自动开启隐私模式失败: {}", err);
            }
        });
    }

    Ok(())
}

/// 获取账号使用量
#[tauri::command]
async fn get_account_usage(account_id: String, state: State<'_, AppState>) -> Result<UsageSummary> {
    let mut manager = state.account_manager.lock().await;
    manager.get_account_usage(&account_id).await.map_err(ApiError::from)
}

/// 更新账号 Token
#[tauri::command]
async fn update_account_token(account_id: String, token: String, state: State<'_, AppState>) -> Result<UsageSummary> {
    let mut manager = state.account_manager.lock().await;
    manager.update_account_token(&account_id, token).await.map_err(ApiError::from)
}

/// 刷新 Token（使用 Cookies）
#[tauri::command]
async fn refresh_token(account_id: String, state: State<'_, AppState>) -> Result<()> {
    let mut manager = state.account_manager.lock().await;
    manager.refresh_token(&account_id).await.map_err(ApiError::from)
}

/// 使用密码刷新 Token/Cookies
#[tauri::command]
async fn refresh_token_with_password(
    account_id: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<()> {
    let mut manager = state.account_manager.lock().await;
    manager
        .refresh_token_with_password(&account_id, &password)
        .await
        .map_err(ApiError::from)
}

/// 使用邮箱密码重新登录并更新账号
#[tauri::command]
async fn login_account_with_email(
    account_id: String,
    email: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<UsageSummary> {
    let mut manager = state.account_manager.lock().await;
    manager
        .login_account_with_email(&account_id, email, password)
        .await
        .map_err(ApiError::from)
}

/// 更新账号邮箱/密码
#[tauri::command]
async fn update_account_profile(
    account_id: String,
    email: Option<String>,
    password: Option<String>,
    state: State<'_, AppState>,
) -> Result<Account> {
    let mut manager = state.account_manager.lock().await;
    manager
        .update_account_profile(&account_id, email, password)
        .map_err(ApiError::from)
}

/// 清空账号数据
#[tauri::command]
async fn clear_accounts(state: State<'_, AppState>) -> Result<usize> {
    let mut manager = state.account_manager.lock().await;
    manager.clear_accounts().map_err(ApiError::from)
}

/// 导出账号到指定路径
#[tauri::command]
async fn export_accounts_to_path(path: String, state: State<'_, AppState>) -> Result<()> {
    let manager = state.account_manager.lock().await;
    let content = manager.export_accounts().map_err(ApiError::from)?;
    fs::write(&path, content)
        .map_err(|err| ApiError::from(anyhow::Error::from(err)))?;
    Ok(())
}

/// 导出账号
#[tauri::command]
async fn export_accounts(state: State<'_, AppState>) -> Result<String> {
    let manager = state.account_manager.lock().await;
    manager.export_accounts().map_err(ApiError::from)
}

/// 导入账号
#[tauri::command]
async fn import_accounts(data: String, state: State<'_, AppState>) -> Result<usize> {
    let mut manager = state.account_manager.lock().await;
    manager.import_accounts(&data).await.map_err(ApiError::from)
}

/// 获取使用事件
#[tauri::command]
async fn get_usage_events(
    account_id: String,
    start_time: i64,
    end_time: i64,
    page_num: i32,
    page_size: i32,
    state: State<'_, AppState>
) -> Result<UsageQueryResponse> {
    let mut manager = state.account_manager.lock().await;
    manager.get_usage_events(&account_id, start_time, end_time, page_num, page_size)
        .await
        .map_err(ApiError::from)
}

/// 从 Trae IDE 读取账号
#[tauri::command]
async fn read_trae_account(state: State<'_, AppState>) -> Result<Option<Account>> {
    let mut manager = state.account_manager.lock().await;
    manager.read_trae_ide_account().await.map_err(ApiError::from)
}

/// 获取当前系统机器码
#[tauri::command]
async fn get_machine_id() -> Result<String> {
    machine::get_machine_guid().map_err(ApiError::from)
}

/// 重置系统机器码（生成新的随机机器码）
#[tauri::command]
async fn reset_machine_id() -> Result<String> {
    machine::reset_machine_guid().map_err(ApiError::from)
}

/// 设置系统机器码为指定值
#[tauri::command]
async fn set_machine_id(machine_id: String) -> Result<()> {
    machine::set_machine_guid(&machine_id).map_err(ApiError::from)
}

/// 绑定账号机器码（保存当前系统机器码到账号）
#[tauri::command]
async fn bind_account_machine_id(account_id: String, state: State<'_, AppState>) -> Result<String> {
    let mut manager = state.account_manager.lock().await;
    manager.bind_machine_id(&account_id).map_err(ApiError::from)
}

/// 获取 Trae IDE 的机器码
#[tauri::command]
async fn get_trae_machine_id() -> Result<String> {
    machine::get_trae_machine_id().map_err(ApiError::from)
}

/// 设置 Trae IDE 的机器码
#[tauri::command]
async fn set_trae_machine_id(machine_id: String) -> Result<()> {
    machine::set_trae_machine_id(&machine_id).map_err(ApiError::from)
}

/// 清除 Trae IDE 登录状态（让 IDE 变成全新安装状态）
#[tauri::command]
async fn clear_trae_login_state() -> Result<()> {
    machine::clear_trae_login_state().map_err(ApiError::from)
}

/// 获取保存的 Trae IDE 路径
#[tauri::command]
async fn get_trae_path() -> Result<String> {
    machine::get_saved_trae_path().map_err(ApiError::from)
}

/// 设置 Trae IDE 路径
#[tauri::command]
async fn set_trae_path(path: String) -> Result<()> {
    machine::save_trae_path(&path).map_err(ApiError::from)
}

/// 自动扫描 Trae IDE 路径
#[tauri::command]
async fn scan_trae_path() -> Result<String> {
    machine::scan_trae_path().map_err(ApiError::from)
}

/// 领取礼包
#[tauri::command]
async fn claim_gift(account_id: String, state: State<'_, AppState>) -> Result<()> {
    let mut manager = state.account_manager.lock().await;
    manager.claim_birthday_bonus(&account_id).await.map_err(ApiError::from)
}

/// 获取用户统计数据
#[tauri::command]
async fn get_user_statistics(account_id: String, state: State<'_, AppState>) -> Result<UserStatisticResult> {
    let manager = state.account_manager.lock().await;
    manager.get_account_statistics(&account_id).await.map_err(ApiError::from)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let account_manager = AccountManager::new().expect("无法初始化账号管理器");
    let settings = load_settings_from_disk().unwrap_or_else(|err| {
        println!("[WARN] 读取设置失败，使用默认值: {}", err);
        AppSettings::default()
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            account_manager: Mutex::new(account_manager),
            browser_login: Mutex::new(None),
            browser_login_cancel: Mutex::new(None),
            settings: Mutex::new(settings),
        })
        .invoke_handler(tauri::generate_handler![
            add_account_by_token,
            add_account_by_email,
            get_settings,
            update_settings,
            quick_register,
            start_browser_login,
            finish_browser_login,
            cancel_browser_login,
            remove_account,
            get_accounts,
            get_account,
            switch_account,
            get_account_usage,
            update_account_token,
            refresh_token,
            refresh_token_with_password,
            login_account_with_email,
            update_account_profile,
            export_accounts,
            export_accounts_to_path,
            import_accounts,
            clear_accounts,
            get_usage_events,
            read_trae_account,
            get_machine_id,
            reset_machine_id,
            set_machine_id,
            bind_account_machine_id,
            get_trae_machine_id,
            set_trae_machine_id,
            clear_trae_login_state,
            get_trae_path,
            set_trae_path,
            scan_trae_path,
            claim_gift,
            get_user_statistics,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
