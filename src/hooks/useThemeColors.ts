import { useEffect, useState } from 'react';

export interface ThemeColors {
  primary: string;
  secondary: string;
  colors: string[];
  chartColors: string[]; // Replaces BLUE_COLORS, follows theme
  bgCard: string;
  textPrimary: string;
  textMuted: string;
  tooltipBg: string;
  tooltipText: string;
  gridStroke: string;
  heatmapEmpty: string;
  heatmapLow: string;
  heatmapMid: string;
  heatmapHigh: string;
  heatmapMax: string;
}

export function useThemeColors() {
  const [themeColors, setThemeColors] = useState<ThemeColors>({
    primary: '#6366f1',
    secondary: '#e5e7eb',
    colors: ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef'],
    chartColors: ['#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8'],
    bgCard: '#ffffff',
    textPrimary: '#1e293b',
    textMuted: '#94a3b8',
    tooltipBg: '#16171A',
    tooltipText: '#F5F9FE',
    gridStroke: 'rgba(255, 255, 255, 0.1)',
    heatmapEmpty: '#e2e8f0',
    heatmapLow: '#0e4429',
    heatmapMid: '#006d32',
    heatmapHigh: '#26a641',
    heatmapMax: '#39d353'
  });

  useEffect(() => {
    const updateColors = () => {
      const styles = getComputedStyle(document.documentElement);
      const primary = styles.getPropertyValue('--accent').trim() || '#6366f1';
      const secondary = styles.getPropertyValue('--bg-active').trim() || '#e5e7eb';
      const bgCard = styles.getPropertyValue('--bg-card').trim() || '#ffffff';
      const textPrimary = styles.getPropertyValue('--text-primary').trim() || '#1e293b';
      const textMuted = styles.getPropertyValue('--text-muted').trim() || '#94a3b8';
      const tooltipText = styles.getPropertyValue('--text-primary').trim() || '#F5F9FE';
      
      // For dark mode compatibility
      const tooltipBg = styles.getPropertyValue('--bg-secondary').trim() || '#16171A';
      const gridStroke = styles.getPropertyValue('--border').trim() || 'rgba(255, 255, 255, 0.1)';

      const colors = [
        primary,
        styles.getPropertyValue('--accent-hover').trim() || '#8b5cf6',
        styles.getPropertyValue('--accent-light').trim() || '#a855f7',
        primary
      ];

      // Generate chart colors based on theme (light -> dark or vice versa)
      const chartColors = [
        styles.getPropertyValue('--accent-light').trim() || '#60a5fa',
        primary,
        styles.getPropertyValue('--accent-hover').trim() || '#2563eb',
        // Make a darker/lighter variant if needed, or reuse
        styles.getPropertyValue('--text-secondary').trim() || '#1d4ed8'
      ];
      
      setThemeColors({ 
        primary, 
        secondary, 
        colors, 
        chartColors,
        bgCard,
        textPrimary,
        textMuted,
        tooltipBg,
        tooltipText,
        gridStroke,
        heatmapEmpty: styles.getPropertyValue('--heatmap-empty').trim() || '#e2e8f0',
        heatmapLow: styles.getPropertyValue('--heatmap-low').trim() || '#0e4429',
        heatmapMid: styles.getPropertyValue('--heatmap-mid').trim() || '#006d32',
        heatmapHigh: styles.getPropertyValue('--heatmap-high').trim() || '#26a641',
        heatmapMax: styles.getPropertyValue('--heatmap-max').trim() || '#39d353'
      });
    };

    updateColors();

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

  return themeColors;
}
