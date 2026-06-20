/**
 * Modern Design System - Colors, spacing, and styling constants
 */

// Primary brand colors
export const COLORS = {
  // Secondary accent colors (blue) - NOTE: distinct from the CSS --color-brand-* (teal)
  // theme defined in src/index.css. Named "secondary" here to avoid collision.
  secondary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c3d66',
  },

  // Success/Telemedicine colors
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#145231',
  },

  // Telemedicine specific (teal/cyan)
  telemed: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
    800: '#134e4a',
    900: '#0f3d3a',
  },

  // Warning colors
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },

  // Danger colors
  danger: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },

  // Neutral colors
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    150: '#f0f0f0',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },

  // Slate colors (background)
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
}

// Chart colors - modern, accessible palette
export const CHART_COLORS = {
  primary: COLORS.telemed[600], // #0d9488 - Telemedicine main (matches CSS --color-brand-600)
  secondary: COLORS.secondary[600], // #0284c7 - Blue
  tertiary: COLORS.warning[500], // #f59e0b - Amber
  success: COLORS.success[600], // #16a34a
  danger: COLORS.danger[600], // #dc2626

  // Multi-series charts
  series: [
    COLORS.telemed[600], // Teal
    COLORS.secondary[600], // Blue
    COLORS.warning[500], // Amber
    COLORS.success[600], // Green
    COLORS.danger[500], // Red
    COLORS.secondary[400], // Light Blue
    COLORS.telemed[500], // Light Teal
  ],

  // Pie chart colors
  pie: [
    COLORS.telemed[600],
    COLORS.secondary[600],
    COLORS.warning[500],
    COLORS.success[600],
    COLORS.danger[500],
  ],
}

// Status indicators
export const STATUS = {
  excellent: {
    color: COLORS.success[600],
    lightColor: COLORS.success[50],
    label: '✓ ดี',
    threshold: 5,
  },
  good: {
    color: COLORS.secondary[600],
    lightColor: COLORS.secondary[50],
    label: '≈ ปานกลาง',
    threshold: 2,
  },
  needsImprovement: {
    color: COLORS.warning[600],
    lightColor: COLORS.warning[50],
    label: '! ต้องปรับปรุง',
    threshold: 0,
  },
}

// Spacing system (Tailwind-based)
export const SPACING = {
  xs: '0.25rem', // 4px
  sm: '0.5rem', // 8px
  md: '1rem', // 16px
  lg: '1.5rem', // 24px
  xl: '2rem', // 32px
  '2xl': '2.5rem', // 40px
  '3xl': '3rem', // 48px
}

// Border radius
export const RADIUS = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.25rem',
  full: '9999px',
}

// Shadows
export const SHADOWS = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
}

// Typography
export const TYPOGRAPHY = {
  heading1: 'text-4xl font-bold',
  heading2: 'text-3xl font-bold',
  heading3: 'text-2xl font-bold',
  heading4: 'text-xl font-semibold',
  heading5: 'text-lg font-semibold',
  heading6: 'text-base font-semibold',
  body: 'text-base',
  bodySmall: 'text-sm',
  bodySm: 'text-xs',
  label: 'text-sm font-medium',
  caption: 'text-xs text-slate-500',
}

// Card styling
export const CARD = {
  base: 'rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow',
  base2: 'rounded-2xl border border-slate-200 bg-white shadow-sm',
  elevated: 'rounded-xl border border-slate-100 bg-white shadow-lg',
  compact: 'rounded-lg border border-slate-200 bg-white shadow-sm p-4',
}

// Table styling
export const TABLE = {
  header: 'bg-gradient-to-r from-slate-50 to-slate-50 text-slate-600',
  headerCell: 'px-4 py-3 font-semibold text-sm',
  row: 'border-b border-slate-100 hover:bg-slate-50 transition-colors',
  cell: 'px-4 py-3 text-sm',
  summaryRow: 'border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-800',
}

// Button styling
export const BUTTON = {
  primary: 'bg-brand-600 hover:bg-brand-700 text-white',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800',
  danger: 'bg-danger-600 hover:bg-danger-700 text-white',
  outline: 'border border-slate-300 hover:bg-slate-100 text-slate-800',
}
