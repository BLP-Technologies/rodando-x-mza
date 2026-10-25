import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, Theme } from '@/theme';

interface RoutePointCardProps {
  label: string;
  value: string;
  onPress: () => void;
  accessibilityLabel?: string;
}

export const RoutePointCard = ({
  label,
  value,
  onPress,
  accessibilityLabel,
}: RoutePointCardProps) => {
  const { styles, theme } = useStyles(getStyles);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.selector}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="combobox"
        accessibilityLabel={accessibilityLabel || `${label}: ${value}`}
      >
        <Text style={styles.valueText} numberOfLines={1}>
          {value}
        </Text>
        <Ionicons
          name="chevron-down"
          size={20}
          color={theme.colors.brand.navy}
        />
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (theme: Theme) => ({
  card: {
    backgroundColor: theme.colors.surface.card,
    borderRadius: theme.metrics.radius.card,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    padding: theme.spacing.lg,
  },
  label: {
    fontSize: theme.metrics.font.caption.size + 1,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
    letterSpacing: 0.6,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase' as const,
  },
  selector: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    borderRadius: theme.metrics.radius.card - 4,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface.card,
    minHeight: 48,
  },
  valueText: {
    fontSize: theme.metrics.font.body.size,
    fontWeight: '700' as const,
    color: theme.colors.brand.navy,
    flex: 1,
    marginRight: theme.spacing.sm,
  },
});