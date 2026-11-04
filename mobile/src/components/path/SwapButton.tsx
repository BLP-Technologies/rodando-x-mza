import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, Theme } from '@/theme';

interface SwapButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export const SwapButton = ({ onPress, disabled = false }: SwapButtonProps) => {
  const { styles, theme } = useStyles(getStyles);

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel="Intercambiar origen y destino"
      accessibilityHint="Invierte el punto de partida y el punto de llegada seleccionados"
      accessibilityState={{ disabled }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons
        name="swap-vertical"
        size={24}
        color={disabled ? theme.colors.text.muted : theme.colors.brand.navy}
      />
    </TouchableOpacity>
  );
};

const getStyles = (theme: Theme) => ({
  button: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#7DBBB7',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    alignSelf: 'center' as const,
    marginVertical: -16,
    zIndex: 10,
    elevation: 4,
    shadowColor: theme.colors.brand.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
    backgroundColor: theme.colors.surface.subtle,
  },
});