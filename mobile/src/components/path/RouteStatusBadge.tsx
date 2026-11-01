import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, Theme } from '@/theme';
import { RouteStepStatus } from '@/navigation/types';

interface RouteStatusBadgeProps {
  status: RouteStepStatus;
}

const STATUS_CONFIG: Record<
  RouteStepStatus,
  { label: string; icon: keyof typeof Ionicons.glyphMap; bg: string; border: string; text: string }
> = {
  accessible: {
    label: 'Accesible',
    icon: 'checkmark-circle',
    bg: '#D7EDE7',
    border: '#98D0C3',
    text: '#0E5A4B',
  },
  unverified: {
    label: 'Sin verificar',
    icon: 'help-circle',
    bg: '#FEF3C7',
    border: '#FDE68A',
    text: '#92400E',
  },
  partially_accessible: {
    label: 'Precaución',
    icon: 'warning',
    bg: '#FFEDD5',
    border: '#FDBA74',
    text: '#C2410C',
  },
  not_accessible: {
    label: 'No accesible',
    icon: 'close-circle',
    bg: '#FEE2E2',
    border: '#FCA5A5',
    text: '#991B1B',
  },
};

export const RouteStatusBadge = ({ status }: RouteStatusBadgeProps) => {
  const { styles } = useStyles(getStyles);
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.accessible;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bg, borderColor: config.border },
      ]}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`Estado del tramo: ${config.label}`}
    >
      <View
        style={styles.innerRow}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden={true}
      >
        <Ionicons name={config.icon} size={14} color={config.text} style={styles.icon} />
        <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
      </View>
    </View>
    
  );
};

const getStyles = (theme: Theme) => ({
  badge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start' as const,
  },
  innerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontSize: theme.metrics.font.caption.size,
    fontWeight: '700' as const,
  },
});