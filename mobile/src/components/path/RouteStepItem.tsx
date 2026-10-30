import React from 'react';
import { View, Text } from 'react-native';
import { useStyles, Theme } from '@/theme';
import { RouteStep } from '@/navigation/types';
import { RouteStatusBadge } from './RouteStatusBadge';

interface RouteStepItemProps {
  step: RouteStep;
}

export const RouteStepItem = ({ step }: RouteStepItemProps) => {
  const { styles } = useStyles(getStyles);

  return (
    <View style={styles.container}>
      {/* 1. Indicador numérico */}
      <View style={styles.numberBadge}>
        <Text style={styles.numberText}>{step.stepNumber}</Text>
      </View>

      {/* 2. Instrucción y metadatos */}
      <View style={styles.content}>
        <Text style={styles.instructionText}>{step.instruction}</Text>

        {(step.distance || step.status) && (
          <View style={styles.metaRow}>
            {step.distance ? (
              <Text style={styles.distanceText}>{step.distance}</Text>
            ) : null}

            {step.status ? (
              <RouteStatusBadge status={step.status} />
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
};

const getStyles = (theme: Theme) => ({
  container: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    marginBottom: theme.spacing.xl,
  },
  numberBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.brand.navy,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginRight: theme.spacing.md,
  },
  numberText: {
    color: theme.colors.text.inverse,
    fontSize: theme.metrics.font.title.size,
    fontWeight: '800' as const,
  },
  content: {
    flex: 1,
    paddingTop: 2,
  },
  instructionText: {
    fontSize: theme.metrics.font.body.size + 2,
    lineHeight: 24,
    fontWeight: '700' as const,
    color: theme.colors.brand.navy,
    marginBottom: theme.spacing.xs,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.md,
    marginTop: 2,
  },
  distanceText: {
    fontSize: theme.metrics.font.header.size - 6,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
  },
});
