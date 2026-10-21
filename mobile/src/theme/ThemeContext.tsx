import React, { createContext, useContext } from 'react';
import { tokens, ThemeTokens } from './tokens';

const ThemeContext = createContext<ThemeTokens>(tokens);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ThemeContext.Provider value={tokens}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);