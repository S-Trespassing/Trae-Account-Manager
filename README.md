# 🚀 Trae Account Manager

<div align="center">

![Trae Account Manager](https://img.shields.io/badge/Trae-Account%20Manager-blue?style=for-the-badge)
![Version](https://img.shields.io/badge/version-2.0.0-green?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-orange?style=for-the-badge)

**一款强大的 Trae IDE 多账号管理工具**

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [使用指南](#-使用指南) • [常见问题](#-常见问题) • [贡献指南](#-贡献指南)

</div>
> ℹ️ 说明：本项目基于大佬 Yang-505 的 https://github.com/Yang-505/Trae-Account-Manager 项目修改并二次开源,重构了ui界面,多数功能优化,修复若干bug,优化页面加载速度

## ⭐ Star 星星走起 动动发财手点点 ⭐

> 如果这个项目对你有帮助，请不要吝啬你的 Star ⭐
> 你的支持是我持续更新的最大动力！💪

<div align="center">

### 👆 点击右上角 Star 按钮支持一下吧！ 👆

</div>

---

## 📖 项目简介

Trae Account Manager 是一款专为 Trae IDE 用户打造的多账号管理工具。通过本工具，你可以轻松管理多个 Trae 账号，一键切换账号，实时查看使用量，让你的 Trae IDE 使用体验更加便捷高效！

### 🎯 为什么选择 Trae Account Manager？

- 🔄 **一键切换账号** - 自动关闭 Trae IDE，切换账号后自动重新打开
- 📊 **实时使用量监控** - 随时查看每个账号的 Token 使用情况
- 🎨 **现代化界面** - 简洁美观的用户界面，操作流畅
- 🔒 **安全可靠** - 本地存储，数据安全有保障
- ⚡ **高效便捷** - 支持批量导入导出，快速管理多个账号
- 🛠️ **功能丰富** - 机器码管理、使用记录查询、账号详情查看

---

## ⚠️ 免责声明

<div align="center">

### 📢 重要提示：请仔细阅读以下声明

</div>

> **本工具仅供学习和技术研究使用，使用前请务必了解以下内容：**

- ⚠️ **风险自负**：使用者需自行承担所有风险，包括但不限于系统损坏、数据丢失、账号异常等
- ⚖️ **法律风险**：本工具可能违反软件使用协议，请自行评估法律风险
- 🚫 **责任豁免**：作者不承担任何直接或间接损失责任
- 📚 **使用限制**：仅限个人学习研究，严禁商业用途
- 🔒 **授权声明**：不得用于绕过软件正当授权机制
- ✅ **同意条款**：继续使用即表示您已理解并同意承担相应风险

<div align="center">

**⚠️ 如果您不同意以上条款，请立即停止使用本工具 ⚠️**

</div>

---

## ✨ 功能特性

### 🎭 账号管理

- ✅ **添加账号**
  - 支持通过 Token 添加账号
  - 自动获取账号信息（邮箱、用户名、头像等）
  - 自动绑定机器码

- ✅ **账号切换**
  - 一键切换到指定账号
  - 自动关闭 Trae IDE
  - 清除旧登录状态
  - 写入新账号信息
  - 自动重新打开 Trae IDE
  - 切换前弹出确认对话框

- ✅ **账号信息**
  - 显示账号邮箱、用户名
  - 显示账号状态（正常/异常）
  - 显示账号类型（礼包/普通）
  - 显示当前使用的账号
  - 显示账号添加时间

- ✅ **账号操作**
  - 查看账号详细信息
  - 更新账号 Token
  - 删除账号
  - 复制账号信息

### 📊 使用量监控

- ✅ **实时使用量**
  - 显示今日使用量
  - 显示总使用量
  - 显示剩余额度
  - 使用量进度条可视化

- ✅ **使用记录**
  - 查看详细使用事件
  - 按时间范围筛选
  - 显示每次使用的 Token 数量
  - 显示使用时间和模型信息

### 🔧 机器码管理

- ✅ **Trae IDE 机器码**
  - 查看当前 Trae IDE 机器码
  - 复制机器码到剪贴板
  - 刷新机器码
  - 清除 Trae IDE 登录状态
  - 重置机器码

- ✅ **账号机器码绑定**
  - 每个账号独立绑定机器码
  - 切换账号时自动更新机器码
  - 支持手动绑定机器码

### ⚙️ 系统设置

- ✅ **Trae IDE 路径配置**
  - 自动扫描 Trae IDE 安装路径
  - 手动选择 Trae.exe 文件
  - 保存路径配置
  - 切换账号后自动打开 Trae IDE

- ✅ **数据管理**
  - 导出所有账号数据为 JSON
  - 从 JSON 文件导入账号
  - 清空所有账号数据

### 🎨 界面特性

- ✅ **现代化设计**
  - 简洁美观的卡片式布局
  - 流畅的动画效果
  - 响应式设计

- ✅ **交互体验**
  - Toast 消息提示
  - 确认对话框
  - 加载状态提示
  - 右键菜单

---

## 🚀 快速开始

### 📋 系统要求

- Windows 10/11
- Trae IDE 已安装
- Node.js 16+ (开发环境)

### 📥 下载安装

1. 前往 [Releases](https://github.com/S-Trespassing/Trae-Account-Manager/releases) 页面
2. 下载最新版本的安装包
3. 运行安装程序
4. 启动 Trae Account Manager

### 🔨 从源码构建

```bash
# 克隆仓库
git clone https://github.com/S-Trespassing/Trae-Account-Manager.git
cd Trae-Account-Manager

# 安装依赖
npm install

# 开发模式运行
npm run tauri dev

# 构建生产版本
npm run tauri build
```

---

## 📚 使用指南

### 首次使用

#### 配置 Trae IDE 路径

1. 打开应用后，点击左侧菜单的 **设置**
2. 在 "Trae IDE 路径" 部分：
   - 点击 **自动扫描** 按钮，系统会自动查找 Trae IDE
   - 或点击 **手动设置** 按钮，选择 `Trae.exe` 文件位置
3. 路径配置成功后会显示完整路径


## 🎯 使用场景

### 场景一：多账号轮换使用

如果你有多个 Trae 账号，可以通过本工具快速切换，充分利用每个账号的额度。

### 场景二：团队协作

团队成员可以导出自己的账号配置，分享给其他成员，快速配置开发环境。

### 场景三：账号使用量监控

实时监控每个账号的使用情况，合理分配使用额度，避免超额。

### 场景四：测试不同账号

开发者可以快速切换不同账号，测试不同权限下的功能表现。

---

## 🛠️ 技术栈

### 前端

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **CSS3** - 样式设计

### 后端

- **Tauri 2** - 桌面应用框架
- **Rust** - 后端逻辑
- **Tokio** - 异步运行时
- **Reqwest** - HTTP 客户端
- **Serde** - 序列化/反序列化

### 功能模块

- **账号管理** - 多账号存储与切换
- **API 客户端** - Trae API 交互
- **机器码管理** - Windows 注册表操作
- **文件系统** - Trae IDE 配置文件操作
- **进程管理** - Trae IDE 进程控制

---

## 📁 项目结构

```
Trae-Account-Manager/
├── src/                      # 前端源码
│   ├── components/          # React 组件
│   │   ├── AccountCard.tsx      # 账号卡片
│   │   ├── AddAccountModal.tsx  # 添加账号弹窗
│   │   ├── ConfirmModal.tsx     # 确认对话框
│   │   ├── DetailModal.tsx      # 详情弹窗
│   │   └── ...
│   ├── pages/               # 页面组件
│   │   ├── Dashboard.tsx        # 仪表板
│   │   ├── Settings.tsx         # 设置页面
│   │   └── About.tsx            # 关于页面
│   ├── api.ts               # API 接口
│   ├── types/               # TypeScript 类型定义
│   └── App.tsx              # 主应用组件
├── src-tauri/               # Tauri 后端
│   ├── src/
│   │   ├── account/         # 账号管理模块
│   │   │   ├── account_manager.rs  # 账号管理器
│   │   │   └── types.rs            # 账号类型定义
│   │   ├── api/             # API 客户端模块
│   │   │   ├── trae_api.rs         # Trae API 客户端
│   │   │   └── types.rs            # API 类型定义
│   │   ├── machine.rs       # 机器码管理
│   │   ├── lib.rs           # Tauri 命令注册
│   │   └── main.rs          # 应用入口
│   ├── Cargo.toml           # Rust 依赖配置
│   └── tauri.conf.json      # Tauri 配置
├── package.json             # Node.js 依赖配置
└── README.md                # 项目文档
```

---

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

### 如何贡献

1. Fork 本仓库 (https://github.com/S-Trespassing/Trae-Account-Manager)
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

### 报告问题

如果你发现了 Bug 或有功能建议，请：

1. 前往 [Issues](https://github.com/S-Trespassing/Trae-Account-Manager-Pro-Pro/issues) 页面
2. 点击 "New Issue"
3. 选择合适的模板
4. 详细描述问题或建议


---

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

---

## 💖 致谢

感谢所有为本项目做出贡献的开发者！

特别感谢：
- [Tauri](https://tauri.app/) - 优秀的桌面应用框架
- [React](https://react.dev/) - 强大的 UI 框架
- [Rust](https://www.rust-lang.org/) - 安全高效的系统编程语言

---

## 📞 联系方式

- GitHub: [@S-Trespassing](https://github.com/S-Trespassing)
- Issues: [项目 Issues](https://github.com/S-Trespassing/Trae-Account-Manager/issues)

---

<div align="center">

## ⭐ 再次提醒：别忘了点 Star 哦！⭐

**如果觉得这个项目不错，请给个 Star 支持一下！**

**你的 Star持续更新的动力！💪**

Made with ❤️ by S-Trespassing

</div>

---

## 🎉 Star 历史

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=S-Trespassing/Trae-Account-Manager&type=date&legend=top-left)](https://www.star-history.com/#S-Trespassing/Trae-Account-Manager&type=date&legend=top-left)