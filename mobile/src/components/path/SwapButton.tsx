import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, Theme } from '@/theme';

interface SwapButtonProps {
  onPress: () => void;
}

export const SwapButton = ({ onPress }: SwapButtonProps) => {
  const { styles, theme } = useStyles(getStyles);

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Intercambiar origen y destino"
    >
      <Ionicons
        name="swap-vertical"
        size={24}
        color={theme.colors.brand.navy}
      />
    </TouchableOpacity>
  );
};

const getStyles = (theme: Theme) => ({
  button: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#7DBBB7', // Tono verde azulado suave del diseño
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    alignSelf: 'center' as const,
    marginVertical: -16, // Superposición centrada entre las dos tarjetas
    zIndex: 10,
    elevation: 4,
    shadowColor: theme.colors.brand.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});