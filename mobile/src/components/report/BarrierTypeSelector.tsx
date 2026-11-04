import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useStyles, Theme } from '@/theme';

export interface BarrierTypeOption {
  id: string;
  label: string;
}

export const DEFAULT_BARRIER_OPTIONS: BarrierTypeOption[] = [
  { id: 'vereda_rota', label: 'Vereda rota' },
  { id: 'falta_rampa', label: 'Falta de rampa' },
  { id: 'otro', label: 'Otro' },
  { id: 'rampa_bloqueada', label: 'Rampa bloqueada' },
  { id: 'obstaculo_vereda', label: 'Obstáculo en la vereda' },
  { id: 'cruce_inaccesible', label: 'Cruce inaccesible' },
  { id: 'entrada_inaccesible', label: 'Entrada no accesible' },
];

interface BarrierTypeSelectorProps {
  options?: BarrierTypeOption[];
  selectedValue: string | null;
  onSelect: (id: string) => void;
}

export const BarrierTypeSelector = ({
  options = DEFAULT_BARRIER_OPTIONS,
  selectedValue,
  onSelect,
}: BarrierTypeSelectorProps) => {
  const { styles } = useStyles(getStyles);

  return (
    <View style={styles.container}>
      <Text
        style={styles.sectionLabel}
        accessible={true}
        accessibilityRole="header"
      >
        TIPO DE BARRERA
      </Text>
      <View
        style={styles.chipsRow}
        accessible={true}
        accessibilityRole="radiogroup"
        accessibilityLabel="Opciones de tipo de barrera"
      >
        {options.map((option) => {
          const isSelected = selectedValue === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => onSelect(option.id)}
              accessible={true}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={option.label}
              accessibilityHint={
                isSelected
                  ? 'Opción actualmente seleccionada'
                  : 'Toca dos veces para seleccionar este tipo de barrera'
              }
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text
                style={[styles.chipText, isSelected && styles.chipTextSelected]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const getStyles = (theme: Theme) => ({
  container: {
    marginBottom: theme.spacing.xl,
  },
  sectionLabel: {
    fontSize: theme.metrics.font.caption.size,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase' as const,
  },
  chipsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  },
  chip: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.metrics.radius.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    backgroundColor: theme.colors.surface.card,
    minHeight: 40,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  chipSelected: {
    backgroundColor: theme.colors.brand.teal,
    borderColor: theme.colors.brand.teal,
  },
  chipText: {
    fontSize: theme.metrics.font.caption.size + 1,
    color: theme.colors.text.main,
    fontWeight: '500' as const,
  },
  chipTextSelected: {
    color: theme.colors.text.inverse,
    fontWeight: '700' as const,
  },
});