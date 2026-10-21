import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';

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
  const theme = useTheme();

  const colorNavy = theme.colors.brand?.navy || '#002B49';
  const colorOrange = theme.colors.brand?.orange || '#E67E22';
  const colorBorder = theme.colors.border?.default || '#B0C4DE';
  const colorSubtext = theme.colors.text?.secondary || '#6B7280';

  return (
    <TouchableOpacity
      style={[
        styles.cardContainer,
        {
          borderColor: colorBorder,
          backgroundColor: theme.colors.surface?.card || '#FFFFFF',
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || `${title}, ${subtitle}`}
    >
      <View style={[styles.iconWrapper, { backgroundColor: colorOrange }]}>
        <Ionicons name={iconName} size={24} color="#FFFFFF" />
      </View>

      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: colorNavy }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colorSubtext }]}>
          {subtitle}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color={colorNavy} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 16,
    minHeight: 80,
    maxHeight: 100,
    maxWidth: 351,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
  },
});