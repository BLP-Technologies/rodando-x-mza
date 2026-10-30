import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useStyles, Theme } from '@/theme';

interface AppHeaderProps {
  userInitial?: string;
  onLogout?: () => void;
  onPressProfile?: () => void;
}

export const AppHeader = ({
  userInitial = 'C',
  onLogout,
  onPressProfile,
}: AppHeaderProps) => {
  const { styles, theme } = useStyles(getStyles);
  const navigation = useNavigation<any>();

  const handleProfilePress = () => {
    if (onPressProfile) {
      onPressProfile();
    } else {
      // Navegación predeterminada a la pestaña o pantalla Perfil
      navigation.navigate('Perfil');
    }
  };

  const handleLogoutPress = (e: any) => {
    e.stopPropagation?.(); // Evita disparar el click del contenedor si estuviera anidado
    if (onLogout) {
      onLogout();
    } else {
      console.log('Cerrar sesión');
    }
  };

  return (
    <View style={styles.headerContainer}>
      {/* Logotipo */}
      <View style={styles.logoPlaceholder}>
        <Text style={styles.logoText}>
          RODANDO<Text style={{ color: theme.colors.state.warning }}>X</Text>
          <Text style={{ color: theme.colors.brand.teal }}>MZA</Text>
        </Text>
      </View>

      {/* Contenedor del Perfil + Botón Salir */}
      <View style={styles.profileBadge}>
        {/* Tocar el avatar navega a la pantalla de Perfil */}
        <TouchableOpacity
          onPress={handleProfilePress}
          style={styles.avatarCircle}
          accessibilityRole="button"
          accessibilityLabel="Ir al perfil y preferencias de accesibilidad"
        >
          <Text style={styles.avatarText}>{userInitial}</Text>
        </TouchableOpacity>

        {/* Tocar Salir dispara el logout */}
        <TouchableOpacity
          onPress={handleLogoutPress}
          style={styles.logoutButton}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
        >
          <Ionicons name="exit-outline" size={18} color={theme.colors.brand.navy} />
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const getStyles = (theme: Theme) => ({
  headerContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
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
    paddingVertical: 4,
    paddingHorizontal: theme.spacing.xs + 2,
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
    gap: 4,
    paddingRight: theme.spacing.xs,
    paddingVertical: 4,
  },
  logoutText: {
    fontSize: theme.metrics.font.caption.size,
    fontWeight: '700' as const,
    lineHeight: theme.metrics.font.caption.lineHeight,
    color: theme.colors.brand.navy,
  },
});