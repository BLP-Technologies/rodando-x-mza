import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from './ThemeContext';
import { Theme } from './tokens';

type StylesGenerator<T extends StyleSheet.NamedStyles<T>> = (theme: Theme) => T;

export const useStyles = <T extends StyleSheet.NamedStyles<T>>(
  generator: StylesGenerator<T>
): { styles: T; theme: Theme } => {
  const theme = useTheme();

  const styles = useMemo(() => {
    return StyleSheet.create(generator(theme));
  }, [theme]);

  return { styles, theme };
};