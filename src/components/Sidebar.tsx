import { ThemeSwitcher } from "./ThemeSwitcher";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const menuItems = [
  { id: "dashboard", label: "仪表盘", icon: "📊" },
  { id: "accounts", label: "账号管理", icon: "👥" },
  { id: "stats", label: "统计数据", icon: "📈" },
  { id: "settings", label: "设置", icon: "⚙️" },
  { id: "about", label: "关于", icon: "ℹ️" },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <svg
          className="logo-icon-img"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(0 12 12)" strokeOpacity="0.4" />
          <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" strokeOpacity="0.4" />
          <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" strokeOpacity="0.4" />
          <circle cx="12" cy="12" r="3.3" className="logo-core" stroke="none" />
        </svg>
        <span className="logo-text">Trae Account Manager</span>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <div
            key={item.id}
            className={`sidebar-item ${currentPage === item.id ? "active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            {/* <span className="sidebar-icon">{item.icon}</span> */}
            <span className="sidebar-label">{item.label}</span>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <ThemeSwitcher />
        <span className="version">v2.0.0</span>
      </div>
    </aside>
  );
}
