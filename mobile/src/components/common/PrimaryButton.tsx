import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';

import { useStyles, Theme } from '@/theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'orange' | 'teal' | 'navy';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export const PrimaryButton = ({
  title,
  onPress,
  variant = 'orange',
  disabled = false,
  loading = false,
  style,
  textStyle,
  accessibilityLabel,
}: PrimaryButtonProps) => {
  const { styles, theme } = useStyles(getStyles);

  const getBackgroundColor = () => {
    if (disabled) return theme.colors.state.unverified;
    switch (variant) {
      case 'teal':
        return theme.colors.brand.teal;
      case 'navy':
        return theme.colors.brand.navy;
      case 'orange':
      default:
        return theme.colors.brand.orange;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: getBackgroundColor() },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      accessibilityLabel={accessibilityLabel || title}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.text.inverse} size="small" />
      ) : (
        <Text style={[styles.text, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const getStyles = (theme: Theme) => ({
  button: {
    minHeight: theme.metrics.btnHeight.lg, // 52px
    borderRadius: theme.metrics.radius.card, // 20px
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: theme.spacing.xl,
    // Sombra accesible
    shadowColor: theme.colors.brand.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  text: {
    color: theme.colors.text.inverse,
    fontSize: theme.metrics.font.body.size,
    lineHeight: theme.metrics.font.body.lineHeight,
    fontWeight: '800' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
});