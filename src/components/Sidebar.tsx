interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const menuItems = [
  { id: "dashboard", label: "仪表盘", icon: "📊" },
  { id: "accounts", label: "账号管理", icon: "👥" },
  { id: "settings", label: "设置", icon: "⚙️" },
  { id: "about", label: "关于", icon: "ℹ️" },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-icon">🚀</span>
        <span className="logo-text">Trae Auto</span>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <div
            key={item.id}
            className={`sidebar-item ${currentPage === item.id ? "active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="version">v1.0.0</span>
      </div>
    </aside>
  );
}
