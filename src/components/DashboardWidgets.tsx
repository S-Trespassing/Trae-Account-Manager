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
import { useThemeColors, ThemeColors } from '../hooks/useThemeColors';

interface DashboardWidgetsProps {
  data: UserStatisticData;
}

// 1. Active Days Heatmap (Custom Implementation)
const ActiveDaysWidget: React.FC<{ data: Record<string, number>, theme: ThemeColors }> = ({ data, theme }) => {
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

    // 1. Find the Sunday before (or on) the first date
    const firstDate = days[0].date;
    const startDayOfWeek = firstDate.getDay(); // 0=Sun
    // We need to prepend 'startDayOfWeek' days

    // 2. Find the Saturday after (or on) the last date
    const lastDate = days[days.length - 1].date;
    const endDayOfWeek = lastDate.getDay(); // 6=Sat
    // We need to append '6 - endDayOfWeek' days

    // Create a new full list
    const fullList = [];

    // Prepend
    for (let i = startDayOfWeek; i > 0; i--) {
        const d = new Date(firstDate);
        d.setDate(d.getDate() - i);
        fullList.push({ date: d, count: -1, key: `pre-${d.toISOString()}` });
    }

    // Add data
    fullList.push(...days);

    // Append
    for (let i = 1; i <= 6 - endDayOfWeek; i++) {
        const d = new Date(lastDate);
        d.setDate(d.getDate() + i);
        fullList.push({ date: d, count: -1, key: `post-${d.toISOString()}` });
    }

    // Chunk into weeks
    for (let i = 0; i < fullList.length; i += 7) {
        weeksArr.push(fullList.slice(i, i + 7));
    }

    return weeksArr;
  }, [days]);

  // Generate Month Labels
  const monthLabels = useMemo(() => {
      const labels: { text: string, index: number }[] = [];

      weeks.forEach((week, index) => {
          // Label the month if the week contains the 1st day of the month
          const firstDayOfMonth = week.find(day => day.date.getDate() === 1);
          if (firstDayOfMonth) {
              labels.push({
                  text: firstDayOfMonth.date.toLocaleString('default', { month: 'short' }),
                  index
              });
          }
      });

      // If the first and last labels are the same (e.g. "Jan" ... "Jan"), remove the first one
      // This happens when the data spans exactly a year or slightly more, showing the same month at both ends
      if (labels.length > 1) {
          const first = labels[0];
          const last = labels[labels.length - 1];
          if (first.text === last.text) {
              labels.shift();
          }
      }

      return labels;
  }, [weeks]);

  const getColor = (count: number) => {
    if (count < 0) return theme.heatmapEmpty; // Render padding as empty cells
    if (count === 0) return theme.heatmapEmpty;
    if (count < 5) return theme.heatmapLow;
    if (count < 10) return theme.heatmapMid;
    if (count < 20) return theme.heatmapHigh;
    return theme.heatmapMax;
  };

  return (
    <div className="widget-card active-days">
      <div className="widget-header">
        <h3>Active Days</h3>
      </div>
      <div className="heatmap-container">
        <div className="heatmap-content">
          <div className="heatmap-months">
            {monthLabels.map((label, i) => (
                <span
                    key={i}
                    className="heatmap-month-label"
                    style={{ left: `${label.index * 14}px` }} // 10px width + 4px gap = 14px
                >
                    {label.text}
                </span>
            ))}
          </div>
          <div className="heatmap-body">
            <div className="heatmap-weekdays">
                <span>M</span>
                <span>W</span>
                <span>F</span>
            </div>
            <div className="heatmap-grid">
            {weeks.map((week, wIndex) => (
                <div key={wIndex} className="heatmap-col">
                {week.map((day) => (
                    // Only render rows 1 (Mon), 3 (Wed), 5 (Fri) for labels, but render all cells
                    // But here we are iterating columns (weeks) then rows (days)
                    // The days array is 0=Sun, 1=Mon, ...
                    // If we want Mon as start, we need to shift. Assuming Sun start for now as per standard JS Date
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
          <div className="heatmap-legend">
            <span>Less</span>
            <div className="legend-cells">
                <div className="heatmap-cell" style={{ backgroundColor: theme.heatmapEmpty }}></div>
                <div className="heatmap-cell" style={{ backgroundColor: theme.heatmapLow }}></div>
                <div className="heatmap-cell" style={{ backgroundColor: theme.heatmapMid }}></div>
                <div className="heatmap-cell" style={{ backgroundColor: theme.heatmapHigh }}></div>
                <div className="heatmap-cell" style={{ backgroundColor: theme.heatmapMax }}></div>
            </div>
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// 2. AI Code Accepted
const AICodeAcceptedWidget: React.FC<{ count: number, breakdown: Record<string, number>, theme: ThemeColors }> = ({ count, breakdown, theme }) => {
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
            <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: theme.textMuted }} interval={0} />
            <Tooltip
              contentStyle={{ backgroundColor: theme.tooltipBg, border: 'none', borderRadius: '4px', fontSize: '12px' }}
              itemStyle={{ color: theme.tooltipText }}
              cursor={{ fill: 'transparent' }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
                {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={theme.chartColors[index % theme.chartColors.length]} />
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
const ActivityPeriodWidget: React.FC<{ data: Record<string, number>, theme: ThemeColors }> = ({ data, theme }) => {
  const chartData = useMemo(() => {
    // 0-23 hours
    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      value: data[String(i)] || 0
    }));
  }, [data]);

  // Rotate to start from 06:00
  const rotatedData = useMemo(() => {
      return [...chartData.slice(6), ...chartData.slice(0, 6)].map((d) => ({
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
                <stop offset="5%" stopColor={theme.primary} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={theme.primary} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.gridStroke} opacity={0.5} />
            <XAxis
                dataKey="displayHour"
                tickFormatter={(tick) => `${String(tick).padStart(2, '0')}:00`}
                interval={5}
                tick={{ fill: theme.textMuted, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
            />
            <Tooltip
                contentStyle={{ backgroundColor: theme.tooltipBg, border: 'none', borderRadius: '4px' }}
                itemStyle={{ color: theme.primary }}
                labelStyle={{ color: theme.textMuted }}
            />
            <Area
                type="monotone"
                dataKey="value"
                stroke={theme.primary}
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
  const theme = useThemeColors();
  
  return (
    <div className="dashboard-widgets-grid">
      <div className="widget-row-full">
        <ActiveDaysWidget data={data.AiCnt365d} theme={theme} />
      </div>
      <div className="widget-row-split">
        <div className="widget-col">
            <AICodeAcceptedWidget count={data.CodeAiAcceptCnt7d} breakdown={data.CodeAiAcceptDiffLanguageCnt7d} theme={theme} />
            <ChatCountWidget count={data.CodeCompCnt7d} />
        </div>
        <div className="widget-col">
            <ModelPreferenceWidget data={data.CodeCompDiffModelCnt7d} />
        </div>
      </div>
      <div className="widget-row-full">
        <ActivityPeriodWidget data={data.IdeActiveDiffHourCnt7d} theme={theme} />
      </div>
    </div>
  );
};
