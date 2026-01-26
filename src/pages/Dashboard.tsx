import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import * as api from "../api";
import type { UsageSummary, UserStatisticData } from "../types";
import { UsageEvents } from "../components/UsageEvents";
import { DashboardWidgets } from "../components/DashboardWidgets";

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
  const [userStats, setUserStats] = useState<UserStatisticData | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const statsCacheKey = (accountId: string) => `trae_user_stats_${accountId}`;
  const loadStatsCache = (accountId: string) => {
    try {
      const raw = localStorage.getItem(statsCacheKey(accountId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.data) return parsed.data as UserStatisticData;
      if (parsed && parsed.UserID) return parsed as UserStatisticData;
    } catch {
      return null;
    }
    return null;
  };
  const aggregateStats = (statsList: UserStatisticData[]): UserStatisticData => {
    const merged: UserStatisticData = {
      UserID: "ALL",
      RegisterDays: 0,
      AiCnt365d: {},
      CodeAiAcceptCnt7d: 0,
      CodeAiAcceptDiffLanguageCnt7d: {},
      CodeCompCnt7d: 0,
      CodeCompDiffAgentCnt7d: {},
      CodeCompDiffModelCnt7d: {},
      IdeActiveDiffHourCnt7d: {},
      DataDate: "",
      IsIde: false
    };
    for (const stats of statsList) {
      if (!stats) continue;
      merged.RegisterDays = Math.max(merged.RegisterDays, stats.RegisterDays || 0);
      merged.CodeAiAcceptCnt7d += stats.CodeAiAcceptCnt7d || 0;
      merged.CodeCompCnt7d += stats.CodeCompCnt7d || 0;
      merged.IsIde = merged.IsIde || !!stats.IsIde;
      if (stats.DataDate && stats.DataDate > merged.DataDate) {
        merged.DataDate = stats.DataDate;
      }
      const mergeMap = (target: Record<string, number>, source?: Record<string, number>) => {
        if (!source) return;
        Object.entries(source).forEach(([key, value]) => {
          target[key] = (target[key] || 0) + (value || 0);
        });
      };
      mergeMap(merged.AiCnt365d, stats.AiCnt365d);
      mergeMap(merged.CodeAiAcceptDiffLanguageCnt7d, stats.CodeAiAcceptDiffLanguageCnt7d);
      mergeMap(merged.CodeCompDiffAgentCnt7d, stats.CodeCompDiffAgentCnt7d);
      mergeMap(merged.CodeCompDiffModelCnt7d, stats.CodeCompDiffModelCnt7d);
      mergeMap(merged.IdeActiveDiffHourCnt7d, stats.IdeActiveDiffHourCnt7d);
    }
    return merged;
  };
  const saveStatsCache = (accountId: string, data: UserStatisticData) => {
    try {
      localStorage.setItem(statsCacheKey(accountId), JSON.stringify({
        data,
        cachedAt: new Date().toISOString()
      }));
    } catch {
      // ignore cache write errors
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!accounts.length) {
      setUserStats(null);
      setLoadingStats(false);
      setStatsError(null);
      return;
    }
    const cachedStats = accounts
      .map(account => loadStatsCache(account.id))
      .filter(Boolean) as UserStatisticData[];
    if (cachedStats.length > 0) {
      setUserStats(aggregateStats(cachedStats));
      setLoadingStats(false);
      setStatsError(null);
    } else {
      setUserStats(null);
      setLoadingStats(true);
      setStatsError(null);
    }
    (async () => {
      try {
        const results = await Promise.allSettled(
          accounts.map(async (account) => {
            console.log("Fetching stats for account:", account.id);
            const stats = await api.getUserStatistics(account.id);
            saveStatsCache(account.id, stats);
            return stats;
          })
        );
        if (cancelled) return;
        const freshStats = results
          .filter((res): res is PromiseFulfilledResult<UserStatisticData> => res.status === "fulfilled")
          .map(res => res.value);
        const fallbackStats = cachedStats.length > 0 ? cachedStats : [];
        const mergedList = freshStats.length > 0 ? freshStats : fallbackStats;
        if (mergedList.length > 0) {
          setUserStats(aggregateStats(mergedList));
          setStatsError(null);
        } else {
          setStatsError("获取统计数据失败");
        }
      } catch (e: any) {
        if (cancelled) return;
        if (!cachedStats.length) {
          setStatsError(e.message || "获取统计数据失败");
        }
      } finally {
        if (!cancelled) {
          setLoadingStats(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accounts.map(a => a.id).join("|")]);

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
    { name: '已使用', value: totalUsed, color: '#6366f1' },
    { name: '剩余', value: totalLeft, color: '#e5e7eb' },
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

  const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef'];

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
      
      {loadingStats && (
        <div className="dashboard-widgets-section loading-placeholder" style={{ marginBottom: '24px', textAlign: 'center', padding: '40px', background: 'var(--bg-card)', borderRadius: '16px' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
          <p style={{ color: 'var(--text-muted)' }}>正在加载统计数据...</p>
        </div>
      )}

      {statsError && !userStats && (
        <div className="dashboard-widgets-section error-placeholder" style={{ marginBottom: '24px', textAlign: 'center', padding: '20px', background: 'var(--danger-bg)', borderRadius: '16px', color: 'var(--danger)' }}>
          <p>⚠️ {statsError}</p>
          <button 
            onClick={() => {
              // Trigger re-fetch logic (simplified by just reloading page or we could add a refetch function)
              window.location.reload(); 
            }}
            style={{ marginTop: '10px', padding: '6px 12px', background: 'transparent', border: '1px solid currentColor', borderRadius: '4px', cursor: 'pointer', color: 'inherit' }}
          >
            重试
          </button>
        </div>
      )}

      {userStats && (
        <div className="dashboard-widgets-section" style={{ marginBottom: '24px' }}>
          <DashboardWidgets data={userStats} />
        </div>
      )}

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
              <span className="legend-dot" style={{ background: '#6366f1' }}></span>
              <span>已使用 ({Math.round(totalUsed)})</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: '#e5e7eb' }}></span>
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
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
