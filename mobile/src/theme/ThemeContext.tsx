import React, { createContext, useContext, useState, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors, staticTokens, Theme } from './tokens';

const defaultTheme: Theme = {
  isDark: false,
  colors: lightColors,
  ...staticTokens,
};

const ThemeContext = createContext<Theme>(defaultTheme);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState<boolean>(systemScheme === 'dark');

  const theme = useMemo<Theme>(() => ({
    isDark,
    colors: isDark ? darkColors : lightColors,
    ...staticTokens,
  }), [isDark]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): Theme => {
  const context = useContext(ThemeContext);
  return context || defaultTheme;
};