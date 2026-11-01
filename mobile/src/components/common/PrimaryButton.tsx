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
  variant?: 'orange' | 'teal' | 'navy' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
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
  accessibilityHint
}: PrimaryButtonProps) => {
  const { styles, theme } = useStyles(getStyles);

  const isOutline = variant === 'outline';

  const getBackgroundColor = () => {
    if (disabled) return theme.colors.state.unverified;
    if (isOutline) return theme.colors.surface.card; //fondo blanco/card
    
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

  const getTextColor = () => {
    if (disabled) return theme.colors.text.muted;
    if (isOutline) return theme.colors.brand.teal;
    return theme.colors.text.inverse;
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: getBackgroundColor() },
        isOutline && styles.outlineButton,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
    >
      {loading ? (
        <ActivityIndicator 
          color={theme.colors.text.inverse} 
          size="small" />
      ) : (
        <Text style={[styles.text, textStyle]}>
          {title}
        </Text>
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
    marginBotton: theme.spacing.xl,
    // Sombra accesible
    shadowColor: theme.colors.brand.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  outlineButton: {
    borderWidth: 2,
    borderColor: theme.colors.brand.teal,
    shadowOpacity: 0,
    elevation: 0,
  },
  text: {
    //color: theme.colors.text.inverse,
    fontSize: theme.metrics.font.body.size,
    lineHeight: theme.metrics.font.body.lineHeight,
    fontWeight: '800' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
});