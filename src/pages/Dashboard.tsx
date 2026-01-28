import { useMemo } from 'react';
import type { UsageSummary } from "../types";
import { UsageEvents } from "../components/UsageEvents";

interface DashboardProps {
  accounts: Array<{
    id: string;
    name: string;
    email: string;
    usage?: UsageSummary | null;
    is_current?: boolean;
    plan_type?: string;
  }>;
  hasLoaded?: boolean;
  onSwitchAccount: (accountId: string) => void;
  onNavigate?: (page: string) => void;
  onRefresh?: (accountId: string) => void;
  refreshingIds?: Set<string>;
}

export function Dashboard({ accounts, onSwitchAccount, onNavigate, onRefresh, refreshingIds }: DashboardProps) {
  // Helper to calculate percentage
  const getPercent = (used: number, limit: number) => {
    if (limit <= 0) return 0;
    return Math.round(((limit - used) / limit) * 100);
  };

  // 已用数量格式化不再需要，直接在 UsageBar 中计算剩余

  // 1. Calculate Stats
  const stats = useMemo(() => {
    const totalAccounts = accounts.length;
    
    // Fast 百分比按整体剩余/总额度计算，详见下方 fastQuotaPercentage

    // Average Slow Request (mapped to "Claude 平均配额")
    const totalSlowPercent = accounts.reduce((sum, a) => {
        if (!a.usage) return sum;
        return sum + getPercent(a.usage.slow_request_used, a.usage.slow_request_limit);
    }, 0);
    const avgSlowPercent = totalAccounts > 0 ? Math.round(totalSlowPercent / totalAccounts) : 0;

    // Low Quota Accounts (< 20% on Fast Requests)
    const lowQuotaCount = accounts.filter(a => {
        if (!a.usage) return false;
        return getPercent(a.usage.fast_request_used, a.usage.fast_request_limit) < 20;
    }).length;

    // Total Fast Quota
    const totalFastLimit = accounts.reduce((sum, a) => {
        if (!a.usage) return sum;
        return sum + a.usage.fast_request_limit + a.usage.extra_fast_request_limit;
    }, 0);

    // Total Fast Remaining
    const totalFastRemaining = Math.round(accounts.reduce((sum, a) => {
        if (!a.usage) return sum;
        return sum + a.usage.fast_request_left + a.usage.extra_fast_request_left;
    }, 0));

    // Calculate Average Fast Quota Percentage based on (Total Remaining / Total Limit) * 100
    // This is more accurate for "Average Quota" representation across the pool
    const fastQuotaPercentage = totalFastLimit > 0 
        ? Math.round((totalFastRemaining / totalFastLimit) * 100) 
        : 0;

    return {
        totalAccounts,
        avgFastPercent: fastQuotaPercentage, // Override with calculated global percentage
        avgSlowPercent,
        lowQuotaCount,
        totalFastLimit,
        totalFastRemaining
    };
  }, [accounts]);

  // 2. Identify Current Account
  const currentAccount = accounts.find(a => a.is_current);

  // 3. Identify Best Accounts
  const bestAccounts = useMemo(() => {
    const candidates = accounts.filter(a => {
      // Must have some usage data and not be the current one (optional, but usually we recommend others)
      // Actually, user might want to know if current is best. But usually "Switch to Best" implies changing.
      // Let's include all valid accounts in the sort, but visually highlight.
      if (!a.usage) return false;
      const totalLeft = a.usage.fast_request_left + a.usage.extra_fast_request_left;
      return totalLeft > 0;
    });

    return candidates.sort((a, b) => {
        if (!a.usage || !b.usage) return 0;

        // Calculate effective expiration time
        // If has fast quota, it expires at reset_time (daily)
        // If only has extra quota, it expires at extra_expire_time
        const getExpireTime = (acc: typeof accounts[0]) => {
           if (!acc.usage) return 0;
           if (acc.usage.fast_request_left > 0) return acc.usage.reset_time;
           return acc.usage.extra_expire_time || Number.MAX_SAFE_INTEGER;
        };

        const timeA = getExpireTime(a);
        const timeB = getExpireTime(b);

        // Priority 1: Expiring Soonest (Smallest timestamp)
        // Note: reset_time is usually a unix timestamp (seconds or ms). Let's assume seconds based on typical API, 
        // but need to be careful. If it's 0, treat as far future or expired?
        // Let's assume valid future timestamps.
        
        if (timeA !== timeB) {
            return timeA - timeB; 
        }

        // Priority 2: Most Quota Remaining (Descending)
        const quotaA = a.usage.fast_request_left + a.usage.extra_fast_request_left;
        const quotaB = b.usage.fast_request_left + b.usage.extra_fast_request_left;
        return quotaB - quotaA;
    });
  }, [accounts]);

  // Helper for progress bar color
  const getProgressColor = (percent: number) => {
      if (percent > 50) return 'var(--success)'; // Green
      if (percent > 20) return 'var(--warning)'; // Orange
      return 'var(--danger)'; // Red
  };

  const formatTimeRemaining = (resetTime: number) => {
      const target = resetTime > 10000000000 ? resetTime : resetTime * 1000;
      const diff = target - Date.now();
      if (diff <= 0) return '0m';
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m`;
  };

  return (
    <div className="dashboard">
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Top Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <StatCard 
                icon="👥" 
                value={stats.totalAccounts} 
                label="总账号数" 
                sub="Total Accounts"
            />
            <StatCard 
                icon="⚡" 
                value={stats.totalFastLimit} 
                label="快速请求总额度" 
                sub="Fast Request Total Limit"
                status="-"
            />
            <StatCard 
                icon="🔥" 
                value={stats.totalFastRemaining} 
                label="剩余快速请求额度" 
                sub="Fast Request Total Remaining"
                isWarning={false}
            />
             <StatCard 
                icon="✨" 
                value={`${stats.avgFastPercent}%`} 
                label="Fast Request 平均配额" 
                sub="Fast Request Avg Quota"
                status={stats.avgFastPercent > 10 ? "配额充足" : "配额紧张"}
                statusColor={stats.avgFastPercent > 10 ? "var(--success)" : "var(--warning)"}
            />
             <StatCard 
                icon="🎨" 
                value={`${stats.avgSlowPercent}%`} 
                label="Slow Request 平均配额" 
                sub="Slow Request Avg Quota"
                status="配额充足"
                statusColor="var(--success)"
            />
        </div>

        {/* Main Content Split */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
            {/* Left: Current Account */}
            <div className="card" style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow)' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                    <span style={{ color: 'var(--success)', marginRight: '8px' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </span>
                    <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: 'var(--text-primary)' }}>当前账号</h2>
                    {currentAccount && onRefresh && (
                        <button
                            onClick={() => onRefresh(currentAccount.id)}
                            title="刷新数据"
                            disabled={refreshingIds?.has(currentAccount.id)}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: refreshingIds?.has(currentAccount.id) ? 'not-allowed' : 'pointer',
                                padding: '4px',
                                marginLeft: '8px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-muted)',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => !refreshingIds?.has(currentAccount.id) && (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <svg 
                                width="16" 
                                height="16" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                style={{
                                    animation: refreshingIds?.has(currentAccount.id) ? 'spin 1s linear infinite' : 'none'
                                }}
                            >
                                <path d="M23 4v6h-6"></path>
                                <path d="M1 20v-6h6"></path>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                            </svg>
                        </button>
                    )}
                </div>

                {currentAccount ? (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-primary)' }}>{currentAccount.email || currentAccount.name}</span>
                                <span style={{ 
                                    background: 'var(--accent-bg)', 
                                    color: 'var(--accent)', 
                                    padding: '2px 8px', 
                                    borderRadius: '4px', 
                                    fontSize: '12px', 
                                    fontWeight: '600',
                                    border: '1px solid var(--accent)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    {currentAccount.plan_type || 'PRO'}
                                </span>
                            </div>
                            {onRefresh && (
                                <button
                                    onClick={() => onRefresh(currentAccount.id)}
                                    title="刷新数据"
                                    disabled={refreshingIds?.has(currentAccount.id)}
                                    style={{
                                        background: 'var(--bg-hover)',
                                        border: 'none',
                                        cursor: refreshingIds?.has(currentAccount.id) ? 'not-allowed' : 'pointer',
                                        padding: '8px',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--text-secondary)',
                                        transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={(e) => !refreshingIds?.has(currentAccount.id) && (e.currentTarget.style.color = 'var(--text-primary)')}
                                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                                >
                                    <svg 
                                        width="18" 
                                        height="18" 
                                        viewBox="0 0 24 24" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        strokeWidth="2" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round"
                                        style={{
                                            animation: refreshingIds?.has(currentAccount.id) ? 'spin 1s linear infinite' : 'none'
                                        }}
                                    >
                                        <path d="M23 4v6h-6"></path>
                                        <path d="M1 20v-6h6"></path>
                                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                                    </svg>
                                </button>
                            )}
                        </div>

                        <div className="usage-bars" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {currentAccount.usage ? (
                                <>
                                    <UsageBar 
                                        label="Fast Request" 
                                        percent={getPercent(currentAccount.usage.fast_request_used, currentAccount.usage.fast_request_limit)} 
                                        resetTime={currentAccount.usage.reset_time}
                                        formatTime={formatTimeRemaining}
                                        used={currentAccount.usage.fast_request_used}
                                        limit={currentAccount.usage.fast_request_limit}
                                    />
                                    <UsageBar 
                                        label="Slow Request" 
                                        percent={getPercent(currentAccount.usage.slow_request_used, currentAccount.usage.slow_request_limit)} 
                                        resetTime={currentAccount.usage.reset_time} // Usually same reset time
                                        formatTime={formatTimeRemaining}
                                        used={currentAccount.usage.slow_request_used}
                                        limit={currentAccount.usage.slow_request_limit}
                                    />
                                    {currentAccount.usage.extra_fast_request_limit > 0 && (
                                        <UsageBar 
                                            label={`Extra Quota (${currentAccount.usage.extra_package_name || 'Gift'})`}
                                            percent={getPercent(currentAccount.usage.extra_fast_request_used, currentAccount.usage.extra_fast_request_limit)} 
                                            resetTime={currentAccount.usage.extra_expire_time}
                                            formatTime={formatTimeRemaining}
                                            isExtra
                                            used={currentAccount.usage.extra_fast_request_used}
                                            limit={currentAccount.usage.extra_fast_request_limit}
                                        />
                                    )}
                                </>
                            ) : (
                                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>暂无使用量数据</div>
                            )}
                        </div>

                        <button 
                            style={{ 
                                width: '100%', 
                                marginTop: '30px', 
                                padding: '12px', 
                                background: 'var(--bg-secondary)', 
                                border: '1px solid var(--border)', 
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                color: 'var(--text-secondary)',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                            }}
                            onClick={() => {
                                if (onNavigate) {
                                    onNavigate('accounts');
                                }
                            }}
                        >
                            切换账号
                        </button>
                    </>
                ) : (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        未检测到当前登录账号
                    </div>
                )}
            </div>

            {/* Right: Best Account Recommendation */}
            <div className="card" style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                    <span style={{ color: 'var(--accent)', marginRight: '8px' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                    </span>
                    <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: 'var(--text-primary)' }}>最佳账号推荐</h2>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {bestAccounts.length > 0 ? (
                        <>
                            {bestAccounts.slice(0, 2).map((acc, idx) => {
                                const percent = acc.usage ? getPercent(acc.usage.fast_request_used, acc.usage.fast_request_limit) : 0;
                                return (
                                    <div key={acc.id} style={{ 
                                        background: idx === 0 ? 'var(--success-bg)' : 'var(--info-bg)',
                                        borderRadius: '12px',
                                        padding: '16px',
                                        border: '1px solid transparent',
                                        borderColor: idx === 0 ? 'var(--success-light)' : 'var(--info)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                    }}>
                                        <div style={{ fontSize: '12px', color: idx === 0 ? 'var(--success)' : 'var(--info)', fontWeight: '500' }}>
                                            {idx === 0 ? '首选推荐 (即将过期/额度最多)' : '备选推荐'}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontWeight: '500', color: 'var(--text-primary)', fontSize: '14px' }}>{acc.email || acc.name}</div>
                                            <div style={{ 
                                                background: getProgressColor(percent), 
                                                color: 'white', 
                                                padding: '2px 8px', 
                                                borderRadius: '12px', 
                                                fontSize: '12px', 
                                                fontWeight: 'bold' 
                                            }}>
                                                {percent}%
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                            暂无可用推荐账号
                        </div>
                    )}
                </div>

                {bestAccounts.length > 0 && (
                    <button 
                        style={{ 
                            width: '100%', 
                            marginTop: '20px', 
                            padding: '12px', 
                            background: bestAccounts[0].id === currentAccount?.id 
                                ? 'var(--bg-hover)' 
                                : 'var(--gradient-accent)', 
                            color: bestAccounts[0].id === currentAccount?.id 
                                ? 'var(--text-muted)' 
                                : 'var(--text-inverse)', 
                            border: 'none', 
                            borderRadius: '8px',
                            cursor: bestAccounts[0].id === currentAccount?.id ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            boxShadow: bestAccounts[0].id === currentAccount?.id ? 'none' : 'var(--shadow-md)'
                        }}
                        disabled={bestAccounts[0].id === currentAccount?.id}
                        onClick={() => {
                            if (bestAccounts[0].id !== currentAccount?.id) {
                                onSwitchAccount(bestAccounts[0].id);
                            }
                        }}
                    >
                        {bestAccounts[0].id === currentAccount?.id ? '正在使用' : '一键切换最佳'}
                    </button>
                )}
            </div>
        </div>
        
        {/* Usage Events (Keep existing logic but styled nicely if needed) */}
        {/* For now, we omit it to keep the UI clean as per the "Redo" request, or add it below if user wants history. 
            The user didn't explicitly say "remove history", but "Redo UI based on image". The image has no history.
            I'll add a small section below.
        */}
        {currentAccount && (
            <div style={{ marginTop: '32px' }}>
                <UsageEvents accountId={currentAccount.id} />
            </div>
        )}
      </div>
    </div>
  );
}

// Sub-components
function StatCard({ icon, value, label, status, statusColor, isWarning }: any) {
    return (
        <div style={{ 
            background: 'var(--bg-card)', 
            borderRadius: '16px', 
            padding: '20px', 
            boxShadow: 'var(--shadow)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '140px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    background: isWarning ? 'var(--danger-bg)' : 'var(--bg-hover)', 
                    borderRadius: '10px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: '20px',
                    color: isWarning ? 'var(--danger)' : 'var(--text-secondary)'
                }}>
                    {icon}
                </div>
            </div>
            <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px' }}>{value}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '2px' }}>{label}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     {/* <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</div> */}
                     {status && (
                         <div style={{ fontSize: '12px', color: statusColor, fontWeight: '500' }}>
                             {status === '-' ? '' : `✓ ${status}`}
                         </div>
                     )}
                     {isWarning && (
                         <div style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: '500' }}>
                             配额 {'<'} 20%
                         </div>
                     )}
                </div>
            </div>
        </div>
    );
}

function UsageBar({ label, percent, resetTime, formatTime, isExtra, used, limit }: any) {
    const color = percent > 50 ? 'var(--success)' : (percent > 20 ? 'var(--warning)' : 'var(--danger)');
    
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{label}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {isExtra ? 'Expires: ' : 'R: '} 
                    {resetTime ? formatTime(resetTime) : '--'} 
                    <span style={{ marginLeft: '8px', marginRight: '8px', color: 'var(--text-secondary)' }}>
                        {limit > 0 ? `剩余: ${Math.round(limit - used)}` : ''}
                    </span>
                    <span style={{ color: color, fontWeight: 'bold' }}>{percent}%</span>
                </span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--bg-hover)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ 
                    width: `${percent}%`, 
                    height: '100%', 
                    background: color, 
                    borderRadius: '4px',
                    transition: 'width 0.5s ease'
                }} />
            </div>
        </div>
    );
}
