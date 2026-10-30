import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, Theme } from '@/theme';

interface MenuActionCardProps {
  title: string;
  subtitle: string;
  iconName: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel?: string;
}

export const MenuActionCard = ({
  title,
  subtitle,
  iconName,
  onPress,
  accessibilityLabel,
}: MenuActionCardProps) => {
  const { styles, theme } = useStyles(getStyles);

  return (
    <TouchableOpacity
      style={styles.cardContainer}
      onPress={onPress}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || `${title}, ${subtitle}`}
    >
      <View style={styles.iconWrapper}>
        <Ionicons
          name={iconName}
          size={24}
          color={theme.colors.brand.white}
        />
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color={theme.colors.brand.navy}
      />
    </TouchableOpacity>
  );
};

const getStyles = (theme: Theme) => ({
  cardContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    backgroundColor: theme.colors.surface.card,
    borderRadius: theme.metrics.radius.card, // 20
    paddingVertical: theme.spacing.lg,       // 16 o 18
    paddingHorizontal: theme.spacing.lg,     // 16
    marginBottom: theme.spacing.lg,          // 16
    minHeight: 80,
    maxHeight: 100,
    maxWidth: 351,
  },
  iconWrapper: {
    width: theme.metrics.minTouch,           // 48 (WCAG touch target)
    height: theme.metrics.minTouch,          // 48
    borderRadius: theme.metrics.radius.input, // 12 o 14
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.colors.brand.orange,
    marginRight: theme.spacing.lg,           // 16
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: theme.colors.brand.navy,
    fontSize: theme.metrics.font.body.size,           // 15
    lineHeight: theme.metrics.font.body.lineHeight,   // 22
    fontWeight: '800' as const,
    letterSpacing: 0.5,
    marginBottom: theme.spacing.xs / 2,               // 2
  },
  subtitle: {
    color: theme.colors.text.secondary,
    fontSize: theme.metrics.font.caption.size,        // 13
    lineHeight: theme.metrics.font.caption.lineHeight,// 18
    fontWeight: '400' as const,
  },
});