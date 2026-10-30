import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, Theme } from '@/theme';

export interface PlaceCardProps {
  title: string;
  address: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  onEdit: () => void;
  onDelete: () => void;
}

export const PlaceCard = ({
  title,
  address,
  iconName = 'home-outline',
  onEdit,
  onDelete,
}: PlaceCardProps) => {
  const { styles, theme } = useStyles(getStyles);

  return (
    <View style={styles.cardContainer}>
      {/* Contenedor del ícono principal */}
      <View style={styles.iconBox}>
        <Ionicons
          name={iconName}
          size={36}
          color={theme.colors.brand.navy}
        />
      </View>

      {/* Información del lugar */}
      <View style={styles.infoContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.address}>{address}</Text>
      </View>

      {/* Acciones laterales: Editar y Borrar */}
      <View style={styles.actionsColumn}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Editar ${title}`}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons
            name="pencil-sharp"
            size={18}
            color={theme.colors.text.inverse}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`Eliminar ${title}`}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons
            name="trash-outline"
            size={18}
            color={theme.colors.text.inverse}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const getStyles = (theme: Theme) => ({
  cardContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: theme.colors.surface.card,
    borderRadius: theme.metrics.radius.card, // 24px
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    minHeight: 104,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: theme.metrics.radius.card, // 24px
    borderWidth: 1.5,
    borderColor: theme.colors.border.focus,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginRight: theme.spacing.lg,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center' as const,
  },
  title: {
    color: theme.colors.brand.teal,
    fontSize: theme.metrics.font.title.size,
    lineHeight: theme.metrics.font.title.lineHeight,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
    marginBottom: theme.spacing.xs / 2,
    textTransform: 'uppercase' as const,
  },
  address: {
    color: theme.colors.text.main,
    fontSize: theme.metrics.font.body.size - 1, // 16px
    lineHeight: theme.metrics.font.body.lineHeight,
    fontWeight: '500' as const,
  },
  actionsColumn: {
    gap: theme.spacing.sm,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginLeft: theme.spacing.sm,
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: theme.metrics.radius.pill,
    backgroundColor: theme.colors.brand.teal,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: theme.metrics.radius.pill,
    backgroundColor: theme.colors.state.danger,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
});