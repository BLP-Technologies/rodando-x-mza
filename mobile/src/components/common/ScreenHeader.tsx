import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useStyles, Theme } from '@/theme';

interface ScreenHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  style?: ViewStyle;
}

export const ScreenHeader = ({
  eyebrow = 'TU CIUDAD, A TU MANERA',
  title,
  description,
  showBackButton = true,
  onBackPress,
  style,
}: ScreenHeaderProps) => {
  const { styles, theme } = useStyles(getStyles);
  const navigation = useNavigation();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={[styles.container, style]}>
      {showBackButton && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Volver atrás"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={theme.colors.brand.navy}
          />
        </TouchableOpacity>
      )}

      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
};

const getStyles = (theme: Theme) => ({
  container: {
    marginBottom: theme.spacing.lg,
  },
  backButton: {
    width: theme.metrics.minTouch,
    height: theme.metrics.minTouch,
    justifyContent: 'center' as const,
    marginBottom: theme.spacing.xs,
  },
  eyebrow: {
    color: theme.colors.brand.teal,
    fontSize: theme.metrics.font.caption.size,
    lineHeight: theme.metrics.font.caption.lineHeight,
    fontWeight: '800' as const,
    letterSpacing: 0.8,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase' as const,
  },
  title: {
    color: theme.colors.brand.navy,
    fontSize: theme.metrics.font.header.size,
    lineHeight: theme.metrics.font.header.lineHeight,
    fontWeight: '800' as const,
    marginBottom: theme.spacing.xs,
  },
  description: {
    color: theme.colors.text.muted,
    fontSize: theme.metrics.font.body.size,
    lineHeight: theme.metrics.font.body.lineHeight,
    fontWeight: '400' as const,
  },
});