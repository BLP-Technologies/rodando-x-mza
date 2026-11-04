export type FontScaleOption = 'normal' | 'large' | 'extraLarge';

export const FONT_SCALES: Record<FontScaleOption, number> = {
  normal: 1,
  large: 1.15,
  extraLarge: 1.3,
};

export const baseMetrics = {
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
  borderWidth: {
    thin: 1,
    medium: 1.5,
    thick: 2.5, // Útil para bordes en modo alto contraste
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

// Base tipográfica de referencia
const rawFontBase = {
  caption: { size: 13, lineHeight: 18 },
  body: { size: 15, lineHeight: 22 },
  title: { size: 18, lineHeight: 24 },
  header: { size: 28, lineHeight: 32 },
};

// Generador de fuentes escaladas
export const getScaledFonts = (scaleFactor: number = 1) => ({
  caption: {
    size: Math.round(rawFontBase.caption.size * scaleFactor),
    lineHeight: Math.round(rawFontBase.caption.lineHeight * scaleFactor),
  },
  body: {
    size: Math.round(rawFontBase.body.size * scaleFactor),
    lineHeight: Math.round(rawFontBase.body.lineHeight * scaleFactor),
  },
  title: {
    size: Math.round(rawFontBase.title.size * scaleFactor),
    lineHeight: Math.round(rawFontBase.title.lineHeight * scaleFactor),
  },
  header: {
    size: Math.round(rawFontBase.header.size * scaleFactor),
    lineHeight: Math.round(rawFontBase.header.lineHeight * scaleFactor),
  },
});

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

// Paleta de Alto Contraste (WCAG AAA - Relación > 7:1)
export const highContrastColors: typeof lightColors = {
  brand: {
    navy: '#000000',
    orange: '#FF5400',
    green: '#008000',
    teal: '#005F73',
    white: '#FFFFFF',
  },
  state: {
    danger: '#D90429',
    warning: '#FFD166',
    success: '#06D6A0',
    accessible: '#118AB2',
    unverified: '#4A4E69',
  },
  text: {
    main: '#000000',
    muted: '#1A1A1A',
    secondary: '#2B2D42',
    inverse: '#FFFFFF',
  },
  surface: {
    background: '#FFFFFF',
    card: '#FFFFFF',
    subtle: '#EFEFEF',
    welcome: '#FFFFFF',
  },
  border: {
    default: '#000000',
    focus: '#000000',
    subtle: '#000000',
  },
};

export type ThemeColors = typeof lightColors;

export interface Theme {
  isDark: boolean;
  isHighContrast: boolean;
  fontScale: FontScaleOption;
  colors: ThemeColors;
  spacing: typeof spacing;
  metrics: typeof baseMetrics & {
    font: ReturnType<typeof getScaledFonts>;
  };
}

// export const staticTokens = {
//   spacing: {
//     xs: 4,
//     sm: 8,
//     md: 12,
//     lg: 16,
//     xl: 20,
//     xxl: 24,
//   },
//   metrics: {
//     minTouch: 48, // A11y WCAG 2.5.5
//     radius: {
//       input: 12,
//       card: 24,
//       pill: 9999,
//     },
//     btnHeight: {
//       sm: 36,
//       md: 48,
//       lg: 52,
//     },
//     font: {
//       caption: { size: 14, lineHeight: 18 },
//       body: { size: 16, lineHeight: 22 },
//       title: { size: 18, lineHeight: 24 },
//       header: { size: 28, lineHeight: 32 },
//     },
//   },
// } as const;

// export const lightColors = {
//   brand: {
//     navy: '#0F172A',
//     orange: '#EA580C',
//     green: '#16A34A',
//     teal: '#0D9488',
//     white: '#FFFFFF',
//   },
//   state: {
//     danger: '#BE123C',
//     warning: '#EA580C',
//     success: '#16A34A',
//     accessible: '#0D9488',
//     unverified: '#6B7280',
//   },
//   text: {
//     main: '#0F172A',
//     muted: '#334155',
//     secondary: '#6B7280',
//     inverse: '#FFFFFF',
//   },
//   surface: {
//     background: '#FAF7F2',
//     card: '#FFFFFF',
//     subtle: '#F1F5F9',
//     welcome: '#FAF7F2',
//   },
//   border: {
//     default: '#94A3B8',
//     focus: '#0F172A',
//     subtle: '#E2E8F0',
//   },
// };

// export const darkColors: typeof lightColors = {
//   brand: {
//     navy: '#F8FAFC',
//     orange: '#FB923C',
//     green: '#4ADE80',
//     teal: '#2DD4BF',
//     white: '#FFFFFF',
//   },
//   state: {
//     danger: '#F43F5E',
//     warning: '#FB923C',
//     success: '#4ADE80',
//     accessible: '#2DD4BF',
//     unverified: '#9CA3AF',
//   },
//   text: {
//     main: '#F8FAFC',
//     muted: '#CBD5E1',
//     secondary: '#94A3B8',
//     inverse: '#0F172A',
//   },
//   surface: {
//     background: '#0B0F19',
//     card: '#1E293B',
//     subtle: '#334155',
//     welcome: '#111827',
//   },
//   border: {
//     default: '#475569',
//     focus: '#38BDF8',
//     subtle: '#334155',
//   },
// };

// export type ThemeColors = typeof lightColors;
// export type StaticTokens = typeof staticTokens;
// export type Theme = {
//   isDark: boolean;
//   colors: ThemeColors;
// } & StaticTokens;


