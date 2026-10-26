import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, Theme } from '@/theme';
import { Place, PlaceCategory } from '@/navigation/types';

interface RoutePointCardProps {
  label: 'ORIGEN' | 'DESTINO';
  value: string;
  isOpen: boolean;
  onToggleOpen: () => void;
  onPressText: () => void;
  savedPlaces: Place[];
  onSelectPlace: (place: Place) => void;
}

const getCategoryIcon = (category: PlaceCategory): keyof typeof Ionicons.glyphMap => {
  switch (category) {
    case 'CASA':
      return 'home-outline';
    case 'TRABAJO':
      return 'briefcase-outline';
    case 'ESTUDIO':
      return 'school-outline';
    case 'MEDICO':
      return 'medkit-outline';
    case 'RECREATIVO':
      return 'bicycle-outline';
    case 'OTRO':
    default:
      return 'location-outline';
  }
};

export const RoutePointCard = ({
  label,
  value,
  isOpen,
  onToggleOpen,
  onPressText,
  savedPlaces,
  onSelectPlace,
}: RoutePointCardProps) => {
  const { styles, theme } = useStyles(getStyles);

  return (
    <View style={styles.cardContainer}>
      <Text style={styles.label}>{label}</Text>

      {/* Fila del selector principal */}
      <View style={styles.selectorRow}>
        <TouchableOpacity
          style={styles.textTouchable}
          onPress={onPressText}
          activeOpacity={0.7}
        >
          <Text style={styles.valueText} numberOfLines={1}>
            {value}
          </Text>
        </TouchableOpacity>

        {/* Botón flecha para desplegar los lugares guardados */}
        <TouchableOpacity
          style={styles.chevronButton}
          onPress={onToggleOpen}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={theme.colors.brand.navy}
          />
        </TouchableOpacity>
      </View>

      {/* Subsección desplegable con los botones de lugares guardados */}
      {isOpen && (
        <View style={styles.dropdownContent}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScrollContainer}
          >
            {savedPlaces.map((place) => (
              <TouchableOpacity
                key={place.id}
                style={styles.placeCardButton}
                onPress={() => onSelectPlace(place)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={getCategoryIcon(place.category)}
                  size={24}
                  color={theme.colors.brand.navy}
                />
                <Text style={styles.placeCardButtonText} numberOfLines={1}>
                  {place.name.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const getStyles = (theme: Theme) => ({
  cardContainer: {
    backgroundColor: theme.colors.surface.card,
    borderRadius: theme.metrics.radius.card, // 24px
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  label: {
    fontSize: theme.metrics.font.caption.size,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
    letterSpacing: 1,
    marginBottom: theme.spacing.xs,
  },
  selectorRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    minHeight: 44,
  },
  textTouchable: {
    flex: 1,
    justifyContent: 'center' as const,
  },
  valueText: {
    fontSize: theme.metrics.font.body.size,
    fontWeight: '700' as const,
    color: theme.colors.text.main,
  },
  chevronButton: {
    padding: theme.spacing.xs,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  dropdownContent: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
  chipsScrollContainer: {
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  placeCardButton: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.colors.surface.welcome,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    borderRadius: theme.metrics.radius.card - 8,
    minWidth: 80,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    gap: 4,
  },
  placeCardButtonText: {
    fontSize: theme.metrics.font.caption.size - 1,
    fontWeight: '800' as const,
    color: theme.colors.text.main,
    letterSpacing: 0.5,
  },
});