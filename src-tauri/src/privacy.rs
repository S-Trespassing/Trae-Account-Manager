use std::collections::HashSet;
use std::path::PathBuf;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Result};
use chrono::Utc;
use rusqlite::{params, Connection};
use serde_json::json;

const KEY_PREFIX: &str = "currentAgentData_";
const DB_READY_TIMEOUT: Duration = Duration::from_secs(10);
const DB_RETRY_INTERVAL: Duration = Duration::from_secs(2);

fn get_default_db_path() -> Option<PathBuf> {
    if cfg!(target_os = "windows") {
        if let Some(base_dirs) = directories::BaseDirs::new() {
            return Some(
                base_dirs
                    .data_dir()
                    .join("Trae")
                    .join("User")
                    .join("globalStorage")
                    .join("state.vscdb"),
            );
        }
        std::env::var("APPDATA").ok().map(|appdata| {
            PathBuf::from(appdata)
                .join("Trae")
                .join("User")
                .join("globalStorage")
                .join("state.vscdb")
        })
    } else {
        let home = directories::BaseDirs::new().map(|dirs| dirs.home_dir().to_path_buf())?;
        if cfg!(target_os = "macos") {
            Some(
                home.join("Library")
                    .join("Application Support")
                    .join("Trae")
                    .join("User")
                    .join("globalStorage")
                    .join("state.vscdb"),
            )
        } else {
            Some(
                home.join(".config")
                    .join("Trae")
                    .join("User")
                    .join("globalStorage")
                    .join("state.vscdb"),
            )
        }
    }
}

fn extract_user_id(key: &str) -> Option<String> {
    let pos = key.find(KEY_PREFIX)?;
    let rest = &key[pos + KEY_PREFIX.len()..];
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    if digits.is_empty() {
        None
    } else {
        Some(digits)
    }
}

fn find_user_ids(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT key FROM ItemTable")?;
    let rows = stmt.query_map([], |row| row.get::<_, Option<String>>(0))?;
    let mut user_ids = HashSet::new();
    for row in rows {
        if let Some(key) = row? {
            if let Some(user_id) = extract_user_id(&key) {
                user_ids.insert(user_id);
            }
        }
    }
    Ok(user_ids.into_iter().collect())
}

fn has_item_table(conn: &Connection) -> rusqlite::Result<bool> {
    let mut stmt = conn.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='ItemTable'",
    )?;
    let mut rows = stmt.query([])?;
    Ok(rows.next()?.is_some())
}

fn is_retriable_error(err: &anyhow::Error) -> bool {
    let msg = err.to_string().to_lowercase();
    msg.contains("database is locked")
        || msg.contains("no such table")
        || msg.contains("unable to open database file")
}

pub fn enable_privacy_mode() -> Result<usize> {
    let db_path = get_default_db_path().ok_or_else(|| anyhow!("无法确定 Trae 数据库路径"))?;
    enable_privacy_mode_at_path(db_path)
}

pub fn enable_privacy_mode_at_path(db_path: PathBuf) -> Result<usize> {
    println!("[INFO] 正在查找 Trae 数据库: {}", db_path.display());
    let start = Instant::now();
    let mut attempt = 0;
    loop {
        attempt += 1;

        if !db_path.exists() {
            if start.elapsed() >= DB_READY_TIMEOUT {
                return Err(anyhow!(
                    "找不到 state.vscdb 文件，请确认 Trae 已安装并至少运行过一次。"
                ));
            }
            println!("[WARN] 未找到 state.vscdb，等待创建中...");
            std::thread::sleep(DB_RETRY_INTERVAL);
            continue;
        }

        let ready = match Connection::open(&db_path) {
            Ok(conn) => match has_item_table(&conn) {
                Ok(true) => true,
                Ok(false) => {
                    if start.elapsed() >= DB_READY_TIMEOUT {
                        return Err(anyhow!("ItemTable 未就绪，无法写入隐私模式设置"));
                    }
                    println!("[WARN] ItemTable 未就绪，等待初始化...");
                    std::thread::sleep(DB_RETRY_INTERVAL);
                    continue;
                }
                Err(err) => {
                    let err = anyhow!(err);
                    if is_retriable_error(&err) && start.elapsed() < DB_READY_TIMEOUT {
                        println!("[WARN] 打开数据库失败: {}，重试中...", err);
                        std::thread::sleep(DB_RETRY_INTERVAL);
                        continue;
                    }
                    println!("[ERROR] 打开数据库失败: {}", err);
                    return Err(err);
                }
            },
            Err(err) => {
                let err = anyhow!(err);
                if is_retriable_error(&err) && start.elapsed() < DB_READY_TIMEOUT {
                    println!("[WARN] 打开数据库失败: {}，重试中...", err);
                    std::thread::sleep(DB_RETRY_INTERVAL);
                    continue;
                }
                println!("[ERROR] 打开数据库失败: {}", err);
                return Err(err);
            }
        };

        if !ready {
            continue;
        }

        let user_ids = match Connection::open(&db_path) {
            Ok(conn) => match find_user_ids(&conn) {
                Ok(ids) => ids,
                Err(err) => {
                    if is_retriable_error(&err) && start.elapsed() < DB_READY_TIMEOUT {
                        println!("[WARN] 读取账号 ID 失败: {}，重试中...", err);
                        std::thread::sleep(DB_RETRY_INTERVAL);
                        continue;
                    }
                    println!("[ERROR] 读取账号 ID 失败: {}", err);
                    return Err(err);
                }
            },
            Err(err) => {
                let err = anyhow!(err);
                if is_retriable_error(&err) && start.elapsed() < DB_READY_TIMEOUT {
                    println!("[WARN] 打开数据库失败: {}，重试中...", err);
                    std::thread::sleep(DB_RETRY_INTERVAL);
                    continue;
                }
                println!("[ERROR] 打开数据库失败: {}", err);
                return Err(err);
            }
        };

        if user_ids.is_empty() {
            if start.elapsed() >= DB_READY_TIMEOUT {
                return Err(anyhow!("账号 ID 未写入，无法写入隐私模式设置"));
            }
            println!("[WARN] 账号 ID 尚未写入，等待中...");
            std::thread::sleep(DB_RETRY_INTERVAL);
            continue;
        }

        println!("[INFO] 发现 {} 个用户 ID", user_ids.len());
        println!(
            "[INFO] 账号 ID 已就绪，开始写入隐私模式设置 (尝试第 {} 次)",
            attempt
        );
        let result = (|| {
            let mut conn = Connection::open(&db_path)?;
            let tx = conn.transaction()?;
            let timestamp = Utc::now().timestamp_millis();
            let op_value = json!({
                "type": "manual",
                "timeStamp": timestamp
            })
            .to_string();
            let mut updated = 0;
            for user_id in &user_ids {
                let key_mode = format!("appPrivacyMode:{}", user_id);
                let key_op = format!("ai.privacy_mode_{}.operationType", user_id);
                tx.execute(
                    "INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?1, ?2)",
                    params![key_mode, "on"],
                )?;
                tx.execute(
                    "INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?1, ?2)",
                    params![key_op, op_value],
                )?;
                updated += 1;
                println!("[INFO] 用户 {}: 隐私模式已开启", user_id);
            }
            tx.commit()?;
            if updated > 0 {
                println!("[INFO] 已写入隐私模式设置: {} 条", updated);
            }
            Ok(updated)
        })();

        if let Err(err) = result {
            if is_retriable_error(&err) && start.elapsed() < DB_READY_TIMEOUT {
                println!("[WARN] 写入失败: {}，重试中...", err);
                std::thread::sleep(DB_RETRY_INTERVAL);
                continue;
            }
            println!("[ERROR] 写入失败: {}", err);
            println!("[ERROR] 如遇异常，请关闭自动开启隐私模式并重新登录 Trae。");
            return Err(err);
        }

        return result;
    }
}

pub fn enable_privacy_mode_at_path_with_restart(
    db_path: PathBuf,
    restart: impl FnOnce() -> Result<()>,
) -> Result<usize> {
    let result = enable_privacy_mode_at_path(db_path)?;
    println!("[INFO] 隐私模式写入完成，准备重启 Trae IDE");
    restart()?;
    Ok(result)
}
