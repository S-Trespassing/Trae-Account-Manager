use anyhow::{anyhow, Result};
use std::path::PathBuf;

const AUTOSTART_NAME: &str = "TraeAccountManagerPro";
const AUTOSTART_LABEL: &str = "com.sauce.trae-auto";

#[cfg(target_os = "windows")]
pub fn set_auto_start(enabled: bool) -> Result<()> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let exe = std::env::current_exe()
        .map_err(|e| anyhow!("无法获取程序路径: {}", e))?;
    let exe_str = exe.to_string_lossy().to_string();

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hkcu
        .create_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Run")
        .map_err(|e| anyhow!("无法打开自启动注册表项: {}", e))?;

    if enabled {
        let cmd = format!("\"{}\" --silent", exe_str);
        key.set_value(AUTOSTART_NAME, &cmd)
            .map_err(|e| anyhow!("写入自启动注册表失败: {}", e))?;
    } else {
        let _ = key.delete_value(AUTOSTART_NAME);
    }

    Ok(())
}

#[cfg(target_os = "macos")]
pub fn set_auto_start(enabled: bool) -> Result<()> {
    use std::fs;

    let exe = std::env::current_exe()
        .map_err(|e| anyhow!("无法获取程序路径: {}", e))?;
    let home = std::env::var("HOME")
        .map_err(|_| anyhow!("无法获取 HOME 环境变量"))?;

    let launch_agents = PathBuf::from(home)
        .join("Library")
        .join("LaunchAgents");
    fs::create_dir_all(&launch_agents)
        .map_err(|e| anyhow!("创建 LaunchAgents 目录失败: {}", e))?;

    let plist_path = launch_agents.join(format!("{}.plist", AUTOSTART_LABEL));

    if enabled {
        let content = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>{label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>{exe}</string>
    <string>--silent</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
"#,
            label = AUTOSTART_LABEL,
            exe = exe.to_string_lossy()
        );
        fs::write(&plist_path, content)
            .map_err(|e| anyhow!("写入 LaunchAgent 失败: {}", e))?;
    } else if plist_path.exists() {
        let _ = fs::remove_file(&plist_path);
    }

    Ok(())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn set_auto_start(_enabled: bool) -> Result<()> {
    Err(anyhow!("当前系统不支持开机自启动设置"))
}
