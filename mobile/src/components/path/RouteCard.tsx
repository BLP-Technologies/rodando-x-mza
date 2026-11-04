import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, Theme } from '@/theme';
import { PrimaryButton } from '@/components/common/PrimaryButton';

export interface RouteCardProps {
  label: string;
  origin: string;
  destination: string;
  lastConsulted: string;
  onSearchRoute: () => void;
  onDelete: () => void;
}

export const RouteCard = ({
  label,
  origin,
  destination,
  lastConsulted,
  onSearchRoute,
  onDelete,
}: RouteCardProps) => {
  const { styles, theme } = useStyles(getStyles);

  return (
    <View style={styles.cardContainer}>
      {/* Fila superior: información y botón eliminar */}
      <View style={styles.topRow}>
        <View
          style={styles.infoCol}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={`Recorrido ${label}: desde ${origin} hacia ${destination}. Última consulta: ${lastConsulted}.`}
        >
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.routeTitle}>
            {origin} <Text style={styles.arrow}>→</Text> {destination}
          </Text>
          <Text style={styles.lastConsulted}>Última consulta: {lastConsulted}</Text>
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={onDelete}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Eliminar recorrido ${label}`}
          accessibilityHint="Abre el diálogo de confirmación para borrar este recorrido de tu lista"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={20} color={theme.colors.text.inverse} />
        </TouchableOpacity>
      </View>

      {/* Botón de acción Buscar Ruta*/}
      <PrimaryButton
        title="BUSCAR RUTA ACCESIBLE AHORA"
        variant="teal"
        onPress={onSearchRoute}
        style={styles.actionButton}
        textStyle={styles.actionButtonText}
        accessibilityLabel={`Buscar ruta accesible para ${label}`}
        accessibilityHint="Calcula y traza en el mapa el recorrido accesible entre ambos puntos"
      />
    </View>
  );
};

const getStyles = (theme: Theme) => ({
  cardContainer: {
    backgroundColor: theme.colors.surface.card,
    borderRadius: theme.metrics.radius.card,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    padding: theme.spacing.lg,
  },
  topRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    marginBottom: theme.spacing.lg,
  },
  infoCol: {
    flex: 1,
    paddingRight: theme.spacing.md,
  },
  label: {
    color: theme.colors.text.muted,
    fontSize: theme.metrics.font.caption.size,
    lineHeight: theme.metrics.font.caption.lineHeight,
    fontWeight: '500' as const,
    marginBottom: theme.spacing.xs / 2,
  },
  routeTitle: {
    color: theme.colors.brand.navy,
    fontSize: theme.metrics.font.body.size + 1,
    lineHeight: theme.metrics.font.body.lineHeight,
    fontWeight: '800' as const,
    marginBottom: theme.spacing.xs,
  },
  arrow: {
    color: theme.colors.brand.teal,
    fontWeight: '900' as const,
  },
  lastConsulted: {
    color: theme.colors.text.muted,
    fontSize: theme.metrics.font.caption.size,
    lineHeight: theme.metrics.font.caption.lineHeight,
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: theme.metrics.radius.pill,
    backgroundColor: theme.colors.state.danger,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  actionButton: {
    minHeight: 48,
    borderRadius: theme.metrics.radius.card - 4,
  },
  actionButtonText: {
    fontSize: theme.metrics.font.caption.size + 1,
    letterSpacing: 0.5,
  },
});