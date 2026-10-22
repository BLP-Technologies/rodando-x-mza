import React, { createContext, useContext, useState, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import {
  lightColors,
  darkColors,
  highContrastColors,
  spacing,
  baseMetrics,
  getScaledFonts,
  Theme,
  FontScaleOption,
  FONT_SCALES,
} from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';

interface AccessibilityPreferences {
  themeMode: ThemeMode;
  highContrast: boolean;
  fontScale: FontScaleOption;
  reduceMotion: boolean;
  screenReaderEnabled: boolean;
  readingGuide: boolean;
}

interface ThemeContextType {
  theme: Theme;
  preferences: AccessibilityPreferences;
  setThemeMode: (mode: ThemeMode) => void;
  setHighContrast: (enabled: boolean) => void;
  setFontScale: (scale: FontScaleOption) => void;
  setReduceMotion: (enabled: boolean) => void;
  setReadingGuide: (enabled: boolean) => void;
}



const defaultTheme: Theme = {
  isDark: false,
  isHighContrast: false,
  fontScale: 'normal',
  colors: lightColors,
  spacing,
  metrics: {
    ...baseMetrics,
    font: getScaledFonts(1),
  },
};

const ThemeContext = createContext<ThemeContextType>({
  theme: defaultTheme,
  preferences: {
    themeMode: 'system',
    highContrast: false,
    fontScale: 'normal',
    reduceMotion: false,
    screenReaderEnabled: false,
    readingGuide: false,
  },
  setThemeMode: () => {},
  setHighContrast: () => {},
  setFontScale: () => {},
  setReduceMotion: () => {},
  setReadingGuide: () => {},
});



export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();

  // Estados de configuración de accesibilidad
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const [fontScale, setFontScale] = useState<FontScaleOption>('normal');
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);
  const [screenReaderEnabled] = useState<boolean>(false);
  const [readingGuide, setReadingGuide] = useState<boolean>(false);

  const isDark = useMemo(() => {
    if (themeMode === 'system') return systemScheme === 'dark';
    return themeMode === 'dark';
  }, [themeMode, systemScheme]);

  const activeColors = useMemo(() => {
    if (highContrast) return highContrastColors;
    return isDark ? darkColors : lightColors;
  }, [highContrast, isDark]);

  const theme = useMemo<Theme>(() => ({
    isDark,
    isHighContrast: highContrast,
    fontScale,
    colors: activeColors,
    spacing,
    metrics: {
      ...baseMetrics,
      font: getScaledFonts(FONT_SCALES[fontScale]),
    },
  }), [isDark, highContrast, fontScale, activeColors]);

  const preferences: AccessibilityPreferences = {
    themeMode,
    highContrast,
    fontScale,
    reduceMotion,
    screenReaderEnabled,
    readingGuide,
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        preferences,
        setThemeMode,
        setHighContrast,
        setFontScale,
        setReduceMotion,
        setReadingGuide,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): Theme => {
  const context = useContext(ThemeContext);
  return context?.theme || defaultTheme;
};

export const useAccessibility = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAccessibility must be used within a ThemeProvider');
  }
  return context;
};