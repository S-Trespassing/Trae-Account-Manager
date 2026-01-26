export function About() {
  return (
    <div className="about-page">
      <h2 className="page-title">关于</h2>

      <div className="about-card">
        <div className="about-logo">🚀</div>
        <h3>Trae Auto</h3>
        <p className="about-version">版本 1.0.0</p>
        <p className="about-desc">
          Trae 账号使用量管理工具，帮助您轻松管理多个 Trae 账号的使用情况。
        </p>
      </div>

      <div className="about-section">
        <h3>功能特性</h3>
        <ul className="feature-list">
          <li>📊 多账号使用量统计</li>
          <li>🔄 实时刷新账号数据</li>
          <li>📋 一键复制账号信息</li>
          <li>🎨 简洁美观的界面</li>
        </ul>
      </div>

      <div className="about-section">
        <h3>技术栈</h3>
        <div className="tech-tags">
          <span className="tech-tag">Tauri</span>
          <span className="tech-tag">React</span>
          <span className="tech-tag">TypeScript</span>
          <span className="tech-tag">Rust</span>
        </div>
      </div>

      <div className="about-section">
        <h3>开源协议</h3>
        <p>MIT License</p>
      </div>
    </div>
  );
}
