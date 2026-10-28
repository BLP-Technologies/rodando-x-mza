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

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, value === 'current' && styles.buttonActive]}
        onPress={() => onChange('current')}
        disabled={isLoading}
        accessibilityRole="tab"
        accessibilityState={{ selected: value === 'current' }}
        accessibilityLabel="Seleccionar ubicación actual"
      >
        <Text style={[styles.text, value === 'current' && styles.textActive]}>
          {isLoading && value === 'current' ? 'Buscando GPS...' : 'Ubicación actual'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, value === 'map' && styles.buttonActive]}
        onPress={() => onChange('map')}
        disabled={isLoading}
        accessibilityRole="tab"
        accessibilityState={{ selected: value === 'map' }}
        accessibilityLabel="Seleccionar ubicación en el mapa"
      >
        <Text style={[styles.text, value === 'map' && styles.textActive]}>
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
    paddingVertical: theme.spacing.sm + 2,
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