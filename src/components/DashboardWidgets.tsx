import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts';
import type { UserStatisticData } from '../types';

interface DashboardWidgetsProps {
  data: UserStatisticData;
}

const COLORS = ['#4ade80', '#22c55e', '#16a34a', '#15803d'];
const BLUE_COLORS = ['#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8'];

// Helper to format date key "YYYYMMDD" to "MMM DD"
const formatDate = (dateStr: string) => {
  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// 1. Active Days Heatmap (Custom Implementation)
const ActiveDaysWidget: React.FC<{ data: Record<string, number> }> = ({ data }) => {
  // Generate last 365 days
  const days = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      result.push({
        date: d,
        count: data[key] || 0,
        key
      });
    }
    return result;
  }, [data]);

  // Group by weeks for vertical layout (columns are weeks, rows are days)
  const weeks = useMemo(() => {
    const weeksArr = [];
    let currentWeek: typeof days = [];
    
    // Align first day to Sunday (or Monday based on preference, using Sunday here)
    const firstDay = days[0].date.getDay();
    for (let i = 0; i < firstDay; i++) {
        currentWeek.push({ date: new Date(), count: -1, key: `empty-${i}` }); // Placeholder
    }

    days.forEach(day => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeksArr.push(currentWeek);
        currentWeek = [];
      }
    });
    if (currentWeek.length > 0) {
      weeksArr.push(currentWeek);
    }
    return weeksArr;
  }, [days]);

  const getColor = (count: number) => {
    if (count < 0) return 'transparent';
    if (count === 0) return '#1f2937'; // gray-800
    if (count < 5) return '#064e3b'; // emerald-900
    if (count < 10) return '#065f46'; // emerald-800
    if (count < 20) return '#10b981'; // emerald-500
    return '#34d399'; // emerald-400
  };

  return (
    <div className="widget-card active-days">
      <div className="widget-header">
        <h3>Active Days</h3>
        <span className="info-icon">ⓘ</span>
      </div>
      <div className="heatmap-container">
        <div className="heatmap-grid">
          {weeks.map((week, wIndex) => (
            <div key={wIndex} className="heatmap-col">
              {week.map((day, dIndex) => (
                <div
                  key={day.key}
                  className="heatmap-cell"
                  style={{ backgroundColor: getColor(day.count) }}
                  title={day.count >= 0 ? `${day.date.toLocaleDateString()}: ${day.count} contributions` : ''}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 2. AI Code Accepted
const AICodeAcceptedWidget: React.FC<{ count: number, breakdown: Record<string, number> }> = ({ count, breakdown }) => {
  const chartData = useMemo(() => {
    return Object.entries(breakdown)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [breakdown]);

  return (
    <div className="widget-card">
      <div className="widget-header">
        <h3>AI Code Accepted</h3>
        <span className="info-icon">ⓘ</span>
      </div>
      <div className="widget-stat-big">{count}</div>
      <div className="chart-container-sm">
        <ResponsiveContainer width="100%" height={60}>
          <BarChart layout="vertical" data={chartData} margin={{ left: 40, right: 10 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: '#9ca3af' }} interval={0} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '4px', fontSize: '12px' }}
              itemStyle={{ color: '#e5e7eb' }}
              cursor={{ fill: 'transparent' }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
                {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={BLUE_COLORS[index % BLUE_COLORS.length]} />
                ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// 3. Chat Count
const ChatCountWidget: React.FC<{ count: number }> = ({ count }) => {
  return (
    <div className="widget-card">
      <div className="widget-header">
        <h3>Chat Count</h3>
        <span className="info-icon">ⓘ</span>
      </div>
      <div className="widget-stat-big">{count}</div>
      <div className="widget-subtext">Agent</div>
      <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: '100%' }}></div>
      </div>
    </div>
  );
};

// 4. Most Frequent AI Partner
const PartnerFrequencyWidget: React.FC<{ data: Record<string, number> }> = ({ data }) => {
  const chartData = useMemo(() => {
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [data]);

  return (
    <div className="widget-card">
      <div className="widget-header">
        <h3>Most Frequent AI Partner</h3>
        <span className="info-icon">ⓘ</span>
      </div>
      <div className="chart-container-md">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} margin={{ top: 20 }}>
            <XAxis dataKey="name" tick={false} axisLine={false} />
            <Tooltip 
              cursor={{ fill: '#374151', opacity: 0.4 }}
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '4px' }}
              itemStyle={{ color: '#e5e7eb' }}
            />
            <Bar dataKey="value" fill="#4ade80" radius={[4, 4, 0, 0]} barSize={20}>
                {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fillOpacity={1 - (index * 0.15)} />
                ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="partner-legend">
        {chartData[0] && <div className="partner-name-highlight">{chartData[0].name}</div>}
        <div className="partner-count">Number of conversations: {chartData[0]?.value || 0}</div>
      </div>
    </div>
  );
};

// 5. Recent Model Invocation Preference
const ModelPreferenceWidget: React.FC<{ data: Record<string, number> }> = ({ data }) => {
  const chartData = useMemo(() => {
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  return (
    <div className="widget-card">
      <div className="widget-header">
        <h3>Recent Model Invocation Preference</h3>
        <span className="info-icon">ⓘ</span>
      </div>
      <div className="list-chart-container">
          {chartData.map((item, index) => (
              <div key={index} className="model-pref-row">
                  <div className="model-info">
                      <span className="model-name">{item.name}</span>
                  </div>
                  <div className="model-bar-container">
                    <div className="model-bar" style={{ width: `${(item.value / Math.max(...chartData.map(d => d.value))) * 100}%` }}></div>
                    <span className="model-value">{item.value}</span>
                  </div>
              </div>
          ))}
      </div>
    </div>
  );
};

// 6. Coding Activity Periods
const ActivityPeriodWidget: React.FC<{ data: Record<string, number> }> = ({ data }) => {
  const chartData = useMemo(() => {
    // 0-23 hours
    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      value: data[String(i)] || 0
    }));
  }, [data]);

  // Rotate to start from 06:00
  const rotatedData = useMemo(() => {
      return [...chartData.slice(6), ...chartData.slice(0, 6)].map((d, i) => ({
          ...d,
          displayHour: (d.hour) % 24
      }));
  }, [chartData]);

  return (
    <div className="widget-card full-width">
      <div className="widget-header">
        <h3>Coding Activity Periods</h3>
        <span className="info-icon">ⓘ</span>
      </div>
      <div className="chart-container-lg">
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={rotatedData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.5} />
            <XAxis 
                dataKey="displayHour" 
                tickFormatter={(tick) => `${String(tick).padStart(2, '0')}:00`}
                interval={5}
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
            />
            <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '4px' }}
                itemStyle={{ color: '#4ade80' }}
                labelStyle={{ color: '#9ca3af' }}
            />
            <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#4ade80" 
                fillOpacity={1} 
                fill="url(#colorActivity)" 
                strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const DashboardWidgets: React.FC<DashboardWidgetsProps> = ({ data }) => {
  return (
    <div className="dashboard-widgets-grid">
      <div className="widget-row-full">
        <ActiveDaysWidget data={data.AiCnt365d} />
      </div>
      <div className="widget-row-split">
        <div className="widget-col">
            <AICodeAcceptedWidget count={data.CodeAiAcceptCnt7d} breakdown={data.CodeAiAcceptDiffLanguageCnt7d} />
            <ChatCountWidget count={data.CodeCompCnt7d} />
        </div>
        <div className="widget-col">
            <PartnerFrequencyWidget data={data.CodeCompDiffAgentCnt7d} />
        </div>
        <div className="widget-col">
            <ModelPreferenceWidget data={data.CodeCompDiffModelCnt7d} />
        </div>
      </div>
      <div className="widget-row-full">
        <ActivityPeriodWidget data={data.IdeActiveDiffHourCnt7d} />
      </div>
    </div>
  );
};
