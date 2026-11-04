//Archivo barril: para centralizar y simplificar las importaciones del subsistema de estilos.

// Exportar tokens, paletas y sus tipos
export {
  spacing,
  baseMetrics,
  lightColors,
  darkColors,
  highContrastColors,
  getScaledFonts,
  FONT_SCALES,
} from './tokens';


export type {
  Theme,
  ThemeColors,
  FontScaleOption,
} from './tokens';

// Exportar el proveedor y el hook base del contexto
export {
  ThemeProvider,
  useTheme,
  useAccessibility,
} from './ThemeContext';

export type { ThemeMode } from './ThemeContext';

// Exportar el hook generador de estilos reactivos
export {
  useStyles,
} from './useStyles';