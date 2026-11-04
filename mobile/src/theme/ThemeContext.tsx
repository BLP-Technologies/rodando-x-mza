import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

export interface AccessibilityPreferences {
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
  setScreenReaderEnabled: (enabled: boolean) => void;
}

const STORAGE_KEY = '@rodando_mza:accessibility_preferences';

const defaultPreferences: AccessibilityPreferences = {
  themeMode: 'system',
  highContrast: false,
  fontScale: 'normal',
  reduceMotion: false,
  screenReaderEnabled: false,
  readingGuide: false,
};

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
  preferences: defaultPreferences,
  setThemeMode: () => {},
  setHighContrast: () => {},
  setFontScale: () => {},
  setReduceMotion: () => {},
  setReadingGuide: () => {},
  setScreenReaderEnabled: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();

  const [preferences, setPreferences] = useState<AccessibilityPreferences>(defaultPreferences);

  // 1. Cargar preferencias guardadas al iniciar
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setPreferences((prev) => ({
            ...prev,
            ...JSON.parse(stored),
          }));
        }
      } catch (error) {
        console.error('Error al cargar preferencias de accesibilidad:', error);
      }
    })();
  }, []);

  // Función genérica para actualizar el estado y persistir
  const updatePreference = <K extends keyof AccessibilityPreferences>(
    key: K,
    value: AccessibilityPreferences[K]
  ) => {
    setPreferences((prev) => {
      const updated = { ...prev, [key]: value };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch((err) =>
        console.error('Error guardando preferencia de accesibilidad:', err)
      );
      return updated;
    });
  };

  const isDark = useMemo(() => {
    if (preferences.themeMode === 'system') return systemScheme === 'dark';
    return preferences.themeMode === 'dark';
  }, [preferences.themeMode, systemScheme]);

  const activeColors = useMemo(() => {
    if (preferences.highContrast) return highContrastColors;
    return isDark ? darkColors : lightColors;
  }, [preferences.highContrast, isDark]);

  const theme = useMemo<Theme>(() => ({
    isDark,
    isHighContrast: preferences.highContrast,
    fontScale: preferences.fontScale,
    colors: activeColors,
    spacing,
    metrics: {
      ...baseMetrics,
      font: getScaledFonts(FONT_SCALES[preferences.fontScale] || 1),
    },
  }), [isDark, preferences.highContrast, preferences.fontScale, activeColors]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        preferences,
        setThemeMode: (mode) => updatePreference('themeMode', mode),
        setHighContrast: (val) => updatePreference('highContrast', val),
        setFontScale: (scale) => updatePreference('fontScale', scale),
        setReduceMotion: (val) => updatePreference('reduceMotion', val),
        setReadingGuide: (val) => updatePreference('readingGuide', val),
        setScreenReaderEnabled: (val) => updatePreference('screenReaderEnabled', val),
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