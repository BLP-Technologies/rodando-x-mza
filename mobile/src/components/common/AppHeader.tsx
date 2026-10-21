import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, useTheme, Theme } from '@/theme';

interface AppHeaderProps {
  userInitial?: string;
  onLogout: () => void;
}

export const AppHeader = ({ userInitial = 'C', onLogout }: AppHeaderProps) => {
  
  const { styles, theme } = useStyles(getStyles);


  
  const colorNavy = theme.colors.brand?.navy || '#002B49';
  const colorTeal = theme.colors.brand?.teal || '#17A2B8';

  return (
    <View style={styles.headerContainer}>
      {/* Reemplazar con asset real de logo: require('@/assets/images/logo.png') */}
      <View style={styles.logoPlaceholder}>
        <Text style={styles.logoText}>
          RODANDO<Text style={{ color: theme.colors.brand.teal }}>XMZA</Text>
        </Text>
      </View>

      <TouchableOpacity
        style={styles.profileBadge}
        onPress={onLogout}
        accessibilityRole="button"
        accessibilityLabel="Cerrar sesión"
      >
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{userInitial}</Text>
        </View>
        <View style={styles.logoutButton}>
          <Ionicons name="exit-outline" size={18} color={theme.colors.brand.navy} />
          <Text style={styles.logoutText}>Salir</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (theme: Theme) => ({
  headerContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: theme.spacing.xl||20,
    paddingTop: theme.spacing.sm||8,
    paddingBottom: theme.spacing.md||12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surface.subtle, 
  },
  logoPlaceholder: {
    justifyContent: 'center' as const,
  },
  logoText: {
    fontSize: theme.metrics.font.title.size,
    lineHeight: theme.metrics.font.title.lineHeight,
    fontWeight: '900' as const,
    letterSpacing: 0.5,
  },
  profileBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: theme.colors.surface.subtle,
    borderRadius: theme.metrics.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border.focus,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    gap: theme.spacing.sm,
    minHeight: theme.metrics.btnHeight.sm,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: theme.metrics.radius.pill,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.colors.brand.teal,
  },
  avatarText: {
    color: theme.colors.text.inverse,
    fontWeight: '700' as const,
    fontSize: theme.metrics.font.body.size,
    lineHeight: theme.metrics.font.body.lineHeight,
  },
  logoutButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    paddingRight: theme.spacing.xs,
  },
  logoutText: {
    fontSize: theme.metrics.font.caption.size,
    fontWeight: '700' as const,
    lineHeight: theme.metrics.font.caption.lineHeight,
    color: theme.colors.brand.navy,
  },
});