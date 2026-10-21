export const staticTokens = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  metrics: {
    minTouch: 48, // A11y WCAG 2.5.5
    radius: {
      input: 12,
      card: 24,
      pill: 9999,
    },
    btnHeight: {
      sm: 36,
      md: 48,
      lg: 52,
    },
    font: {
      caption: { size: 14, lineHeight: 18 },
      body: { size: 16, lineHeight: 22 },
      title: { size: 18, lineHeight: 24 },
      header: { size: 28, lineHeight: 32 },
    },
  },
} as const;

export const lightColors = {
  brand: {
    navy: '#0F172A',
    orange: '#EA580C',
    green: '#16A34A',
    teal: '#0D9488',
    white: '#FFFFFF',
  },
  state: {
    danger: '#BE123C',
    warning: '#EA580C',
    success: '#16A34A',
    accessible: '#0D9488',
    unverified: '#6B7280',
  },
  text: {
    main: '#0F172A',
    muted: '#334155',
    secondary: '#6B7280',
    inverse: '#FFFFFF',
  },
  surface: {
    background: '#FAF7F2',
    card: '#FFFFFF',
    subtle: '#F1F5F9',
    welcome: '#FAF7F2',
  },
  border: {
    default: '#94A3B8',
    focus: '#0F172A',
    subtle: '#E2E8F0',
  },
};

export const darkColors: typeof lightColors = {
  brand: {
    navy: '#F8FAFC',
    orange: '#FB923C',
    green: '#4ADE80',
    teal: '#2DD4BF',
    white: '#FFFFFF',
  },
  state: {
    danger: '#F43F5E',
    warning: '#FB923C',
    success: '#4ADE80',
    accessible: '#2DD4BF',
    unverified: '#9CA3AF',
  },
  text: {
    main: '#F8FAFC',
    muted: '#CBD5E1',
    secondary: '#94A3B8',
    inverse: '#0F172A',
  },
  surface: {
    background: '#0B0F19',
    card: '#1E293B',
    subtle: '#334155',
    welcome: '#111827',
  },
  border: {
    default: '#475569',
    focus: '#38BDF8',
    subtle: '#334155',
  },
};

export type ThemeColors = typeof lightColors;
export type StaticTokens = typeof staticTokens;
export type Theme = {
  isDark: boolean;
  colors: ThemeColors;
} & StaticTokens;


