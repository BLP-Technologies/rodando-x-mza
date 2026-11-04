import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useStyles, Theme } from '@/theme';

export type LocationMode = 'current' | 'map';

interface LocationModeSelectorProps {
  value: LocationMode;
  onChange: (mode: LocationMode) => void;
  isLoading?: boolean;
}

export const LocationModeSelector = ({
  value,
  onChange,
  isLoading = false,
}: LocationModeSelectorProps) => {
  const { styles } = useStyles(getStyles);

  const isCurrent = value === 'current';
  const isMap = value === 'map';

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="tablist"
      accessibilityLabel="Método de selección de ubicación"
    >
      <TouchableOpacity
        style={[styles.button, isCurrent && styles.buttonActive]}
        onPress={() => onChange('current')}
        disabled={isLoading}
        accessible={true}
        accessibilityRole="tab"
        accessibilityState={{
          selected: isCurrent,
          disabled: isLoading,
        }}
        accessibilityLabel="Ubicación actual por GPS"
        accessibilityHint={
          isCurrent
            ? 'Opción activa. Consulta las coordenadas satelitales actuales'
            : 'Toca dos veces para obtener la ubicación actual por GPS'
        }
        accessibilityLiveRegion={isLoading ? 'polite' : 'none'}
      >
        <Text style={[styles.text, isCurrent && styles.textActive]}>
          {isLoading && isCurrent ? 'Buscando GPS...' : 'Ubicación actual'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, isMap && styles.buttonActive]}
        onPress={() => onChange('map')}
        disabled={isLoading}
        accessible={true}
        accessibilityRole="tab"
        accessibilityState={{
          selected: isMap,
          disabled: isLoading,
        }}
        accessibilityLabel="Marcar punto en el mapa"
        accessibilityHint={
          isMap
            ? 'Opción activa. Abre el mapa para seleccionar un punto'
            : 'Toca dos veces para elegir la ubicación directamente sobre el mapa'
        }
      >
        <Text style={[styles.text, isMap && styles.textActive]}>
          En el mapa
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (theme: Theme) => ({
  container: {
    flexDirection: 'row' as const,
    backgroundColor: theme.colors.surface.card,
    borderRadius: theme.metrics.radius.card,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    padding: 4,
    marginBottom: theme.spacing.xl,
  },
  button: {
    flex: 1,
    minHeight: theme.metrics.minTouch,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: theme.metrics.radius.card - 4,
  },
  buttonActive: {
    backgroundColor: theme.colors.brand.teal,
  },
  text: {
    fontSize: theme.metrics.font.body.size,
    color: theme.colors.text.muted,
    fontWeight: '600' as const,
  },
  textActive: {
    color: theme.colors.text.inverse,
    fontWeight: '800' as const,
  },
});