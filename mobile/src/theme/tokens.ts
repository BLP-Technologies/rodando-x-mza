export const tokens = {
  colors: {
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
      card: '#FFFFFF',
      subtle: '#F1F5F9',
      welcome: '#FAF7F2',
    },
    border: {
      default: '#94A3B8',
      focus: '#0F172A',
    },
  },
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
      card: 20,
      pill: 9999,
    },
    btnHeight: {
      sm: 36,
      md: 48,
      lg: 52,
    },
    font: {
      caption: { size: 13, lineHeight: 18 },
      body: { size: 15, lineHeight: 22 },
      title: { size: 18, lineHeight: 24 },
      header: { size: 28, lineHeight: 32 },
    },
  },
} as const;

export type ThemeTokens = typeof tokens;