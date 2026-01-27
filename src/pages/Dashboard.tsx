import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { UsageSummary } from "../types";
import { UsageEvents } from "../components/UsageEvents";

interface DashboardProps {
  accounts: Array<{
    id: string;
    name: string;
    email: string;
    usage?: UsageSummary | null;
    is_current?: boolean;
  }>;
  hasLoaded?: boolean;
}

export function Dashboard({ accounts, hasLoaded = true }: DashboardProps) {
  const [themeColors, setThemeColors] = useState({
    primary: '#6366f1',
    secondary: '#e5e7eb',
    colors: ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef']
  });

  useEffect(() => {
    const updateColors = () => {
      const styles = getComputedStyle(document.documentElement);
      const primary = styles.getPropertyValue('--accent').trim() || '#6366f1';
      // 使用 border 颜色作为未使用的灰色部分，在深色模式下会更合适
      const secondary = styles.getPropertyValue('--bg-active').trim() || '#e5e7eb';
      
      // 生成基于主色的色板
      const colors = [
        primary,
        styles.getPropertyValue('--accent-hover').trim() || '#8b5cf6',
        styles.getPropertyValue('--accent-light').trim() || '#a855f7',
        // 第四个颜色稍微变暗或变亮一点
        primary
      ];
      
      setThemeColors({ primary, secondary, colors });
    };

    // 初始化颜色
    updateColors();

    // 监听主题变化
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          updateColors();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => observer.disconnect();
  }, []);

  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter(a => a.usage && a.usage.fast_request_left > 0).length;

  const totalUsed = accounts.reduce((sum, a) => {
    if (!a.usage) return sum;
    return sum + a.usage.fast_request_used + a.usage.extra_fast_request_used;
  }, 0);

  const totalLimit = accounts.reduce((sum, a) => {
    if (!a.usage) return sum;
    return sum + a.usage.fast_request_limit + a.usage.extra_fast_request_limit;
  }, 0);

  const totalLeft = accounts.reduce((sum, a) => {
    if (!a.usage) return sum;
    return sum + a.usage.fast_request_left + a.usage.extra_fast_request_left;
  }, 0);

  const usagePercent = totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0;

  const pieData = [
    { name: '已使用', value: totalUsed, color: themeColors.primary },
    { name: '剩余', value: totalLeft, color: themeColors.secondary },
  ];


  // 配额分布
  const quotaData = accounts.reduce((acc, a) => {
    if (!a.usage) return acc;
    const planType = a.usage.plan_type || 'Free';
    const existing = acc.find(item => item.name === planType);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: planType, value: 1 });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>欢迎回来 👋</h1>
          <p>这是您的 Trae 账号使用概览</p>
        </div>
        <div className="header-stats">
          <div className="quick-stat">
            <span className="quick-stat-value">{totalAccounts}</span>
            <span className="quick-stat-label">账号总数</span>
          </div>
          <div className="quick-stat">
            <span className="quick-stat-value success">{activeAccounts}</span>
            <span className="quick-stat-label">可用账号</span>
          </div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card gradient-purple">
          <div className="stat-card-content">
            <div className="stat-card-info">
              <span className="stat-card-label">总配额</span>
              <span className="stat-card-value">{totalLimit}</span>
              <span className="stat-card-change">Fast Requests</span>
            </div>
            <div className="stat-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="stat-card gradient-blue">
          <div className="stat-card-content">
            <div className="stat-card-info">
              <span className="stat-card-label">已使用</span>
              <span className="stat-card-value">{Math.round(totalUsed)}</span>
              <span className="stat-card-change">{usagePercent}% 使用率</span>
            </div>
            <div className="stat-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="stat-card gradient-green">
          <div className="stat-card-content">
            <div className="stat-card-info">
              <span className="stat-card-label">剩余可用</span>
              <span className="stat-card-value">{Math.round(totalLeft)}</span>
              <span className="stat-card-change">{100 - usagePercent}% 剩余</span>
            </div>
            <div className="stat-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="stat-card gradient-orange">
          <div className="stat-card-content">
            <div className="stat-card-info">
              <span className="stat-card-label">平均使用</span>
              <span className="stat-card-value">{totalAccounts > 0 ? Math.round(totalUsed / totalAccounts) : 0}</span>
              <span className="stat-card-change">每账号</span>
            </div>
            <div className="stat-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
      
      <div className="charts-grid-2col">
        <div className="chart-card">
          <div className="chart-header">
            <h3>使用量分布</h3>
            <span className="chart-badge">{usagePercent}%</span>
          </div>
          <div className="chart-body pie-chart-container">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-center-text">
              <span className="pie-value">{Math.round(totalLeft)}</span>
              <span className="pie-label">剩余</span>
            </div>
          </div>
          <div className="chart-legend">
            <div className="legend-item">
              <span className="legend-dot" style={{ background: themeColors.primary }}></span>
              <span>已使用 ({Math.round(totalUsed)})</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: themeColors.secondary }}></span>
              <span>剩余 ({Math.round(totalLeft)})</span>
            </div>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <h3>套餐分布</h3>
          </div>
          <div className="chart-body">
            {quotaData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={quotaData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {quotaData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={themeColors.colors[index % themeColors.colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">暂无数据</div>
            )}
          </div>
        </div>
      </div>

      {accounts.length > 0 && (
        <>
          <UsageEvents accountId={accounts.find(a => a.is_current)?.id || accounts[0]?.id || ''} />


        </>
      )}

      {accounts.length === 0 && (
        hasLoaded ? (
          <div className="dashboard-empty">
            <div className="empty-icon">📊</div>
            <h3>暂无账号数据</h3>
            <p>请先在"账号管理"中添加账号</p>
          </div>
        ) : (
          <div className="loading-state">加载中...</div>
        )
      )}
    </div>
  );
}
