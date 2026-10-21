//Archivo barril: para centralizar y simplificar las importaciones del subsistema de estilos.

// Exportar tokens, paletas y sus tipos
export {
  staticTokens,
  lightColors,
  darkColors,
} from './tokens';
export type {
  Theme,
  ThemeColors,
  StaticTokens,
} from './tokens';

// Exportar el proveedor y el hook base del contexto
export {
  ThemeProvider,
  useTheme,
} from './ThemeContext';

// Exportar el hook generador de estilos reactivos
export {
  useStyles,
} from './useStyles';