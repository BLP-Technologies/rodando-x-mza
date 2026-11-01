import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useStyles, Theme } from '@/theme';

interface ActionButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const ActionButton = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
}: ActionButtonProps) => {
  const { styles, theme } = useStyles(getStyles);

  const getBackgroundColor = () => {
    if (disabled) return theme.colors.state.unverified;
    if (variant === 'outline') return theme.colors.surface.card;
    if (variant === 'secondary') return theme.colors.brand.teal;
    return theme.colors.brand.orange;
  };

  const getTextColor = () => {
    if (disabled) return theme.colors.text.muted;
    if (variant === 'outline') return theme.colors.brand.teal;
    return theme.colors.text.inverse;
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: getBackgroundColor() },
        variant === 'outline' && styles.outlineBorder,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <Text style={[styles.text, { color: getTextColor() }, textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const getStyles = (theme: Theme) => ({
  button: {
    minHeight: theme.metrics.btnHeight.lg,
    borderRadius: theme.metrics.radius.card - 4, // 16px
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: theme.spacing.sm, // 8px para pantallas chicas
    paddingVertical: theme.spacing.xs,
    shadowColor: theme.colors.brand.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  outlineBorder: {
    borderWidth: 2,
    borderColor: theme.colors.brand.teal,
    elevation: 0,
    shadowOpacity: 0,
  },
  text: {
    fontSize: theme.metrics.font.caption.size + 1, // ~14px
    lineHeight: 18,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const, 
  },
});