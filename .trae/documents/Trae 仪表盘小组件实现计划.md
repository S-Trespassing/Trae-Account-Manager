# Trae 仪表盘小组件实现方案

基于对 `https://www.trae.ai/account-setting#profile` 的分析及网络请求捕获，我为您制定了以下实现方案。

## 1. 数据来源分析

通过 Playwright 网络监听，确定数据来源如下：
- **API 端点**: `https://ug-normal.trae.ai/cloudide/api/v3/trae/GetUserStasticData` (注意 API 拼写为 Stastic)
- **请求方式**: `POST`
- **关键数据结构**:
  - `AiCnt365d`: 过去一年每天的活跃度（用于热力图）
  - `CodeAiAcceptDiffLanguageCnt7d`: 过去7天各语言 AI 代码采纳数
  - `CodeCompCnt7d`: 对话总数
  - `CodeCompDiffAgentCnt7d`: 不同 AI 伙伴（Agent）的对话分布
  - `CodeCompDiffModelCnt7d`: 模型调用偏好
  - `IdeActiveDiffHourCnt7d`: 24小时活跃时段分布

## 2. 后端实现 (Rust)

需要在 `src-tauri` 中扩展 API 客户端以获取上述数据。

### 2.1 定义数据结构 (`src-tauri/src/api/types.rs`)
新增 `UserStatisticResponse` 结构体，映射上述 JSON 字段。

### 2.2 扩展 API 客户端 (`src-tauri/src/api/trae_api.rs`)
在 `TraeApiClient` 中添加 `get_user_statistic_data` 方法，复用现有的认证 Token 发送请求。

### 2.3 注册 Tauri 命令 (`src-tauri/src/lib.rs`)
新增 `get_user_statistics` 命令，供前端调用。

## 3. 前端实现 (React + TypeScript)

### 3.1 类型定义 (`src/types/index.ts`)
定义前端对应的 TypeScript 接口 `UserStatisticData`。

### 3.2 API 封装 (`src/api.ts`)
添加 `getUserStatistics()` 方法调用 Tauri 后端。

### 3.3 组件开发 (`src/components/DashboardWidgets.tsx`)
利用项目中已有的 `recharts` 库实现可视化图表：

1.  **ActiveDaysWidget (活跃天数)**
    - **实现**: 使用 CSS Grid 实现 GitHub 风格的贡献热力图 (7行 x 52列)。
    - **样式**: 深色背景，绿色色块 (`#4ade80` 系列)，支持 Tooltip 显示具体日期和次数。

2.  **AICodeAcceptedWidget (AI 代码采纳)**
    - **实现**: `recharts` 横向条形图 (BarChart)。
    - **样式**: 显示语言名称和采纳数量，使用 Trae 风格的蓝/灰色调。

3.  **ChatCountWidget (对话统计)**
    - **实现**: 简单的数据卡片，显示总数和 Agent 数量。

4.  **PartnerFrequencyWidget (最常协作 AI)**
    - **实现**: 竖向柱状图，展示不同 Agent 的调用次数。

5.  **ModelPreferenceWidget (模型偏好)**
    - **实现**: 横向条形图，展示不同模型的调用分布。

6.  **ActivityPeriodsWidget (编码活动时段)**
    - **实现**: `recharts` 面积图 (AreaChart) 或平滑曲线，模拟正弦波风格的 24 小时活跃度展示。

### 3.4 仪表盘集成 (`src/pages/Dashboard.tsx`)
- 在仪表盘页面引入上述组件。
- 实现数据加载状态 (Loading Skeleton) 和错误处理。
- 布局上采用响应式 Grid，大屏显示 2-3 列，小屏单列。

## 4. 样式与视觉 (CSS)
- 严格复刻网页端的深色模式设计。
- 使用 CSS 变量 (如 `var(--bg-secondary)`, `var(--accent)`) 确保与现有应用主题一致。
- 添加必要的圆角、边框微调和阴影效果。

确认该方案后，我将按照 后端 -> 前端类型 -> 组件开发 -> 页面集成的顺序开始编码。