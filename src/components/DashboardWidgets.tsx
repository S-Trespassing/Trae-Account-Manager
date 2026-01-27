import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell
} from 'recharts';
import type { UserStatisticData } from '../types';
import { useThemeColors, ThemeColors } from '../hooks/useThemeColors';

interface DashboardWidgetsProps {
  data: UserStatisticData;
}

// Custom Info Icon Component with Tooltip
const InfoIcon: React.FC<{ content: string, theme: ThemeColors }> = ({ content, theme }) => {
  const [hovered, setHovered] = React.useState<{ x: number, y: number } | null>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHovered({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  };

  const handleMouseLeave = () => {
    setHovered(null);
  };

  return (
    <>
      <span 
        className="info-icon" 
        onMouseEnter={handleMouseEnter} 
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'help' }}
      >
        ⓘ
      </span>
      {hovered && createPortal(
        <div
            style={{
              position: 'fixed',
              top: hovered.y,
              left: hovered.x,
              transform: 'translate(-95%, -100%)', // Shift mostly to the left
              backgroundColor: theme.tooltipBg,
              color: theme.tooltipText,
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              pointerEvents: 'none',
              zIndex: 1000,
              border: `1px solid ${theme.gridStroke}`,
              maxWidth: '200px',
              width: 'max-content',
              marginTop: '-8px', // Space for arrow
              lineHeight: '1.5',
              textAlign: 'left',
              whiteSpace: 'normal'
            }}
          >
            {content}
            {/* Arrow */}
            <div style={{
                position: 'absolute',
                bottom: '-5px',
                right: '10px', // Position arrow on the right side
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: `5px solid ${theme.gridStroke}`
            }} />
            <div style={{
                position: 'absolute',
                bottom: '-4px',
                right: '10px',
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: `5px solid ${theme.tooltipBg}`
            }} />
          </div>,
        document.body
      )}
    </>
  );
};

// 1. Active Days Heatmap (Custom Implementation)
const ActiveDaysWidget: React.FC<{ data: Record<string, number>, theme: ThemeColors }> = ({ data, theme }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);

  React.useEffect(() => {
    if (!containerRef.current) return;
    
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Generate last 365 days
  const days = useMemo(() => {
    const result = [];
    const today = new Date();
    // We will calculate how many days to show based on width later
    // For now, generate a full year
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

  // Group by weeks for vertical layout
  const weeks = useMemo(() => {
    const weeksArr = [];
    const firstDate = days[0].date;
    const startDayOfWeek = firstDate.getDay(); 
    const lastDate = days[days.length - 1].date;
    const endDayOfWeek = lastDate.getDay(); 

    const fullList = [];
    for (let i = startDayOfWeek; i > 0; i--) {
        const d = new Date(firstDate);
        d.setDate(d.getDate() - i);
        fullList.push({ date: d, count: -1, key: `pre-${d.toISOString()}` });
    }
    fullList.push(...days);
    for (let i = 1; i <= 6 - endDayOfWeek; i++) {
        const d = new Date(lastDate);
        d.setDate(d.getDate() + i);
        fullList.push({ date: d, count: -1, key: `post-${d.toISOString()}` });
    }

    for (let i = 0; i < fullList.length; i += 7) {
        weeksArr.push(fullList.slice(i, i + 7));
    }
    return weeksArr;
  }, [days]);

  // Determine how many weeks to show based on container width
  const visibleWeeks = useMemo(() => {
    if (containerWidth === 0) return weeks; // Default to all if width unknown
    
    // Each week column is roughly 14px (10px width + 4px gap)
    // Legend and padding take some space, let's say 40px padding + 30px labels width
    const availableWidth = containerWidth - 60; 
    const maxWeeks = Math.floor(availableWidth / 14);
    
    // Return the LAST maxWeeks weeks
    return weeks.slice(-maxWeeks);
  }, [weeks, containerWidth]);

  // Generate Month Labels based on visible weeks
  const monthLabels = useMemo(() => {
      const labels: { text: string, index: number }[] = [];

      visibleWeeks.forEach((week, index) => {
          const firstDayOfMonth = week.find(day => day.date.getDate() === 1);
          if (firstDayOfMonth) {
              labels.push({
                  text: firstDayOfMonth.date.toLocaleString('default', { month: 'short' }),
                  index
              });
          }
      });

      if (labels.length > 1) {
          const first = labels[0];
          const last = labels[labels.length - 1];
          if (first.text === last.text) {
              labels.shift();
          }
      }

      return labels;
  }, [visibleWeeks]);

  const getColor = (count: number) => {
    if (count < 0) return theme.heatmapEmpty;
    if (count === 0) return theme.heatmapEmpty;
    if (count < 5) return theme.heatmapLow;
    if (count < 10) return theme.heatmapMid;
    if (count < 20) return theme.heatmapHigh;
    return theme.heatmapMax;
  };

  // State for custom tooltip
  const [hoveredData, setHoveredData] = React.useState<{ x: number, y: number, date: string, count: number } | null>(null);

  const handleMouseEnter = (e: React.MouseEvent, day: { date: Date, count: number }) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredData({
      x: rect.left + rect.width / 2,
      y: rect.top, // Use exact top, we will handle offset in CSS
      date: day.date.toLocaleDateString(),
      count: day.count
    });
  };

  const handleMouseLeave = () => {
    setHoveredData(null);
  };

  return (
    <div className="widget-card active-days">
      <div className="widget-header">
        <h3>活跃天数</h3>
        <InfoIcon content="用户在TRAE中AI使用频次" theme={theme} />
      </div>
      <div className="heatmap-container" ref={containerRef}>
        <div className="heatmap-content">
          <div className="heatmap-months">
            {monthLabels.map((label, i) => (
                <span
                    key={i}
                    className="heatmap-month-label"
                    style={{ left: `${label.index * 14}px` }}
                >
                    {label.text}
                </span>
            ))}
          </div>
          <div className="heatmap-body">
            <div className="heatmap-weekdays">
                <span>一</span>
                <span>三</span>
                <span>五</span>
            </div>
            <div className="heatmap-grid">
            {visibleWeeks.map((week, wIndex) => (
                <div key={wIndex} className="heatmap-col">
                {week.map((day) => (
                    <div
                    key={day.key}
                    className="heatmap-cell"
                    style={{ backgroundColor: getColor(day.count) }}
                    onMouseEnter={(e) => handleMouseEnter(e, day)}
                    onMouseLeave={handleMouseLeave}
                    />
                ))}
                </div>
            ))}
            </div>
          </div>
          <div className="heatmap-legend">
            <span>少</span>
            <div className="legend-cells">
                <div className="heatmap-cell" style={{ backgroundColor: theme.heatmapEmpty }}></div>
                <div className="heatmap-cell" style={{ backgroundColor: theme.heatmapLow }}></div>
                <div className="heatmap-cell" style={{ backgroundColor: theme.heatmapMid }}></div>
                <div className="heatmap-cell" style={{ backgroundColor: theme.heatmapHigh }}></div>
                <div className="heatmap-cell" style={{ backgroundColor: theme.heatmapMax }}></div>
            </div>
            <span>多</span>
          </div>
        </div>
        {hoveredData && createPortal(
          <div
            style={{
              position: 'fixed',
              top: hoveredData.y,
              left: hoveredData.x,
              transform: 'translate(-50%, -100%)',
              backgroundColor: theme.tooltipBg,
              color: theme.tooltipText,
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              pointerEvents: 'none',
              zIndex: 1000,
              border: `1px solid ${theme.gridStroke}`,
              whiteSpace: 'nowrap',
              marginTop: '-12px', // Space for arrow
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>{hoveredData.date}</div>
            <div>{hoveredData.count > 0 ? `使用AI ${hoveredData.count} 次` : '无'}</div>
            {/* Arrow */}
            <div style={{
                position: 'absolute',
                bottom: '-5px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: `5px solid ${theme.gridStroke}`
            }} />
            <div style={{
                position: 'absolute',
                bottom: '-4px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: `5px solid ${theme.tooltipBg}`
            }} />
          </div>,
          document.body
        )}
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

  const [hoveredBar, setHoveredBar] = React.useState<{ x: number, y: number, name: string, value: number } | null>(null);

  const handleBarMouseEnter = (data: any, _index: number, e: React.MouseEvent) => {
    // e.currentTarget is the path element of the bar
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredBar({
      x: rect.right, // Position at the end of the bar
      y: rect.top + rect.height / 2, // Center vertically
      name: data.name,
      value: data.value
    });
  };

  const handleBarMouseLeave = () => {
    setHoveredBar(null);
  };

  return (
    <div className="widget-card">
      <div className="widget-header">
        <h3>近期生成代码采纳次数</h3>
        <InfoIcon content="用户采纳 AI 生成代码的总次数（含补全）" theme={theme} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '15px' }}>
        {/* Left Side: Total Count */}
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            paddingLeft: '20px',
            paddingRight: '20px',
            borderRight: `1px solid ${theme.gridStroke}`,
            minWidth: '100px'
        }}>
            <div className="widget-stat-big" style={{ lineHeight: 1, marginBottom: '4px' }}>{count}</div>
            <div style={{ fontSize: '12px', color: theme.textMuted }}>总次数</div>
        </div>
        
        {/* Right Side: Chart */}
        <div style={{ flex: 1, height: '120px' }}>
            <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={chartData} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                <XAxis type="number" hide />
                <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={70} 
                    tick={{ fontSize: 11, fill: theme.textMuted }} 
                    interval={0} 
                    axisLine={false}
                    tickLine={false}
                />
                <Bar 
                    dataKey="value" 
                    radius={[0, 4, 4, 0]} 
                    barSize={14}
                    onMouseEnter={handleBarMouseEnter}
                    onMouseLeave={handleBarMouseLeave}
                    background={{ fill: theme.gridStroke }} // Add background track
                >
                    {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={theme.chartColors[index % theme.chartColors.length]} />
                    ))}
                </Bar>
            </BarChart>
            </ResponsiveContainer>
        </div>
      </div>
        {hoveredBar && createPortal(
          <div
            style={{
              position: 'fixed',
              top: hoveredBar.y,
              left: hoveredBar.x,
              transform: 'translate(10px, -50%)', // Move to right of bar
              backgroundColor: theme.tooltipBg,
              color: theme.tooltipText,
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              pointerEvents: 'none',
              zIndex: 1000,
              border: `1px solid ${theme.gridStroke}`,
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>{hoveredBar.name}</div>
            <div>接纳 {hoveredBar.value} 次</div>
             {/* Left Arrow */}
             <div style={{
                position: 'absolute',
                top: '50%',
                left: '-5px',
                transform: 'translateY(-50%)',
                width: 0,
                height: 0,
                borderTop: '5px solid transparent',
                borderBottom: '5px solid transparent',
                borderRight: `5px solid ${theme.gridStroke}`
            }} />
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '-4px',
                transform: 'translateY(-50%)',
                width: 0,
                height: 0,
                borderTop: '5px solid transparent',
                borderBottom: '5px solid transparent',
                borderRight: `5px solid ${theme.tooltipBg}`
            }} />
          </div>,
          document.body
        )}
    </div>
  );
};

// 3. Chat Count
const ChatCountWidget: React.FC<{ count: number, theme: ThemeColors }> = ({ count, theme }) => {
  return (
    <div className="widget-card">
      <div className="widget-header">
        <h3>近期对话次数</h3>
        <InfoIcon content="用户在侧边栏与 AI 或智能体对话总次数" theme={theme} />
      </div>
      <div className="widget-stat-row" style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
          <div className="widget-stat-big" style={{ lineHeight: 1 }}>{count}</div>
          <div className="widget-subtext" style={{ margin: 0 }}>次对话</div>
      </div>
      <div style={{ marginTop: '15px' }}>
          {/* Agent Row */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: theme.textPrimary, marginRight: '8px' }}>Agent</span>
            <span style={{ fontSize: '12px', color: theme.textMuted, marginLeft: 'auto' }}>100%</span>
          </div>
          {/* Progress Bar */}
          <div className="progress-bar-bg" style={{ position: 'relative', height: '8px', backgroundColor: theme.gridStroke, borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  width: '100%', 
                  height: '100%', 
                  backgroundColor: theme.primary, 
                  borderRadius: '4px' 
              }} />
          </div>
      </div>
    </div>
  );
};

// 5. Recent Model Invocation Preference
const ModelPreferenceWidget: React.FC<{ data: Record<string, number>, theme: ThemeColors }> = ({ data, theme }) => {
  const chartData = useMemo(() => {
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  return (
    <div className="widget-card">
      <div className="widget-header">
        <h3>近期模型调用偏好</h3>
        <InfoIcon content="用户在发起问答时使用各模型的调用频次" theme={theme} />
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

// 6. Coding Activity Periods (Sine Wave Style)
const ActivityPeriodWidget: React.FC<{ data: Record<string, number>, theme: ThemeColors }> = ({ data, theme }) => {
  const chartData = useMemo(() => {
    // 0-23 hours
    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      value: data[String(i)] || 0
    }));
  }, [data]);


  // Max value for opacity calculation
  const maxValue = useMemo(() => {
    return Math.max(...chartData.map(d => d.value), 1);
  }, [chartData]);

  // SVG dimensions
  const width = 800;
  const height = 240; // Increased height to accommodate larger amplitude
  const padding = { top: 40, bottom: 40, left: 100, right: 100 }; // Increased side padding to shorten the line
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  const centerY = padding.top + graphHeight / 2;
  const amplitude = graphHeight / 2 + 20; // Increased amplitude for taller peaks

  // State for custom tooltip
  const [hoveredData, setHoveredData] = React.useState<{ x: number, y: number, hour: number, value: number } | null>(null);

  const handleMouseEnter = (e: React.MouseEvent, d: { hour: number, value: number }) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredData({
      x: rect.left + rect.width / 2,
      y: rect.top,
      hour: d.hour,
      value: d.value
    });
  };

  const handleMouseLeave = () => {
    setHoveredData(null);
  };

  // Generate sine wave path
  const generatePath = () => {
    let d = `M ${padding.left} ${centerY}`;
    for (let x = 0; x <= graphWidth; x++) {
      // Map x to angle: 0 -> 0, Width -> 2*PI
      const angle = (x / graphWidth) * 2 * Math.PI;
      // -sin because Y grows downwards
      const y = centerY - amplitude * Math.sin(angle);
      d += ` L ${padding.left + x} ${y}`;
    }
    return d;
  };

  // Get coordinates for a specific hour (0-23)
  // We want the chart to start at 06:00
  const getPointForHour = (hour: number) => {
    // Shift hour so 06:00 is at index 0
    let shiftedIndex = hour - 6;
    if (shiftedIndex < 0) shiftedIndex += 24;
    
    const x = padding.left + (shiftedIndex / 24) * graphWidth;
    const angle = (shiftedIndex / 24) * 2 * Math.PI;
    const y = centerY - amplitude * Math.sin(angle);
    return { x, y };
  };

  const timeLabels = [
    { label: '06:00', icon: '🌅', hour: 6 },
    { label: '12:00', icon: '☀️', hour: 12 },
    { label: '18:00', icon: '🌇', hour: 18 },
    { label: '24:00', icon: '🌙', hour: 0 }, // 0 is 24
    { label: '06:00', icon: '🌅', hour: 6, isEnd: true }
  ];

  return (
    <div className="widget-card full-width">
      <div className="widget-header">
        <h3>编码时段</h3>
        <InfoIcon content="用户近7日每日 IDE 活跃时间" theme={theme} />
      </div>
      <div className="chart-container-lg" style={{ height: 'auto', padding: '10px 0' }}>
        <div style={{ width: '100%', overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: '600px', height: 'auto' }}>
            {/* Center Line (Horizon) */}
            <line 
                x1={padding.left} 
                y1={centerY} 
                x2={width - padding.right} 
                y2={centerY} 
                stroke={theme.gridStroke} 
                strokeDasharray="4 4" 
                strokeWidth="1"
            />

            {/* Sine Wave Path */}
            <path 
                d={generatePath()} 
                fill="none" 
                stroke={theme.gridStroke} 
                strokeWidth="2" 
                opacity="0.5"
            />

            {/* Time Labels and Icons */}
            {timeLabels.map((item, index) => {
                const x = padding.left + (index / 4) * graphWidth;
                
                // Place time labels below the line
                const labelY = centerY + 20;
                // Place icons above the line (fixed position)
                const iconY = centerY - 20;

                return (
                <g key={index}>
                    {/* Vertical Grid Line for major ticks */}
                    <line 
                        x1={x} y1={centerY - 5} 
                        x2={x} y2={centerY + 5} 
                        stroke={theme.textMuted} 
                        strokeWidth="1"
                    />
                    <text 
                        x={x} 
                        y={labelY} 
                        textAnchor="middle" 
                        fill={theme.textMuted} 
                        fontSize="12"
                    >
                        {item.label}
                    </text>
                    {/* Icon */}
                    <text 
                        x={x} 
                        y={iconY} 
                        textAnchor="middle" 
                        fontSize="14"
                        dominantBaseline="middle"
                    >
                        {item.icon}
                    </text>
                </g>
                );
            })}

            {/* Data Points */}
            {chartData.map((d) => {
                if (d.value === 0) return null;
                const point = getPointForHour(d.hour);
                // Calculate opacity: 0.3 to 1.0 based on value
                const opacity = 0.3 + 0.7 * (d.value / maxValue);
                
                return (
                <g key={d.hour} className="activity-point" style={{ cursor: 'pointer' }}
                   onMouseEnter={(e) => handleMouseEnter(e, d)}
                   onMouseLeave={handleMouseLeave}>
                    <circle 
                        cx={point.x} 
                        cy={point.y} 
                        r={6 + (d.value / maxValue) * 4} // Radius 6 to 10
                        fill={theme.primary} 
                        fillOpacity={opacity}
                        stroke={theme.bgCard}
                        strokeWidth="1"
                    >
                    </circle>
                </g>
                );
            })}
            </svg>
            {hoveredData && createPortal(
              <div
                style={{
                  position: 'fixed',
                  top: hoveredData.y,
                  left: hoveredData.x,
                  transform: 'translate(-50%, -100%)',
                  backgroundColor: theme.tooltipBg,
                  color: theme.tooltipText,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  pointerEvents: 'none',
                  zIndex: 1000,
                  border: `1px solid ${theme.gridStroke}`,
                  whiteSpace: 'nowrap',
                  marginTop: '-12px'
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '2px' }}>{String(hoveredData.hour).padStart(2, '0')}:00</div>
                <div>活跃 {hoveredData.value} 天</div>
                {/* Arrow */}
                <div style={{
                    position: 'absolute',
                    bottom: '-5px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 0,
                    height: 0,
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderTop: `5px solid ${theme.gridStroke}`
                }} />
                <div style={{
                    position: 'absolute',
                    bottom: '-4px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 0,
                    height: 0,
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderTop: `5px solid ${theme.tooltipBg}`
                }} />
              </div>,
              document.body
            )}
        </div>
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
            <ChatCountWidget count={data.CodeCompCnt7d} theme={theme} />
        </div>
        <div className="widget-col">
            <ModelPreferenceWidget data={data.CodeCompDiffModelCnt7d} theme={theme} />
        </div>
      </div>
      <div className="widget-row-full">
        <ActivityPeriodWidget data={data.IdeActiveDiffHourCnt7d} theme={theme} />
      </div>
    </div>
  );
};
