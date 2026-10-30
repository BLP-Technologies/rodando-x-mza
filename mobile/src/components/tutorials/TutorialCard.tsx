import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, Theme } from '@/theme';

export interface TutorialItem {
  id: string;
  title: string;
  category: string;
  duration: string;
  description: string;
  iconName: keyof typeof Ionicons.glyphMap;
}

interface TutorialCardProps {
  item: TutorialItem;
  onPress: () => void;
}

export const TutorialCard = ({ item, onPress }: TutorialCardProps) => {
  const { styles, theme } = useStyles(getStyles);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.category}, duración ${item.duration}`}
    >
      {/* Ícono contenedor */}
      <View style={styles.iconContainer}>
        <Ionicons name={item.iconName} size={24} color={theme.colors.brand.navy} />
      </View>

      {/* Contenido textual */}
      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.meta}>
          {item.category} | {item.duration}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      </View>

      {/* Flecha chevron */}
      <Ionicons
        name="chevron-forward"
        size={20}
        color={theme.colors.brand.navy}
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
};

const getStyles = (theme: Theme) => ({
  card: {
    backgroundColor: theme.colors.surface.card,
    borderRadius: theme.metrics.radius.card,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    padding: theme.spacing.lg,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    shadowColor: theme.colors.brand.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#7DBBB7', // Tono verde azulado de los íconos de la app
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginRight: theme.spacing.md,
  },
  textContainer: {
    flex: 1,
    marginRight: theme.spacing.xs,
  },
  title: {
    fontSize: theme.metrics.font.body.size + 1, // ~17px
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
    marginBottom: 2,
  },
  meta: {
    fontSize: theme.metrics.font.caption.size,
    color: theme.colors.text.muted,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  description: {
    fontSize: theme.metrics.font.caption.size + 1, // ~13-14px
    color: theme.colors.brand.navy,
    lineHeight: 18,
  },
  chevron: {
    marginLeft: 4,
  },
});