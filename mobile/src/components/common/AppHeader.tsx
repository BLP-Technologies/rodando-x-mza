import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useStyles, Theme } from '@/theme';
import { LogoutConfirmModal } from '@/components/common/LogoutConfirmModal';

interface AppHeaderProps {
  userInitial?: string;
  isGuest?: boolean;
  onLogout?: () => void;
  onPressProfile?: () => void;
}

export const AppHeader = ({
  userInitial = 'C',
  isGuest = false,
  onLogout,
  onPressProfile,
}: AppHeaderProps) => {
  const { styles, theme } = useStyles(getStyles);
  const navigation = useNavigation<any>();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleProfilePress = () => {
    if (onPressProfile) {
      onPressProfile();
    } else {
      // Navegación predeterminada a la pestaña o pantalla Perfil
      navigation.navigate('Perfil');
    }
  };

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    if (onLogout) {
      onLogout();
    }
  };

  // Color de avatar según tipo de usuario: orange para invitado, teal para registrado
  const avatarBgColor = isGuest
    ? theme.colors.brand.orange
    : theme.colors.brand.teal;

  return (
    <>
      <View style={styles.headerContainer} accessible={false}>
        {/* Logotipo */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Inicio')}
          style={styles.logoPlaceholder}
          accessible={true}
          accessibilityRole="header"
          accessibilityLabel="Rodando por Mendoza, ir al inicio"
        >
          <Text style={styles.logoText}>
            RODANDO<Text style={{ color: theme.colors.state.warning }}>X</Text>
            <Text style={{ color: theme.colors.brand.teal }}>MZA</Text>
          </Text>
        </TouchableOpacity>

        {/* Acciones de usuario: botones separados */}
        <View style={styles.userActionsWrapper}>
          {/* Avatar -> Perfil */}
          <TouchableOpacity
            onPress={handleProfilePress}
            style={[styles.avatarCircle, { backgroundColor: avatarBgColor }]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Perfil de usuario, inicial ${userInitial}`}
            accessibilityHint="Abre la pantalla de perfil"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.avatarText}>{userInitial}</Text>
          </TouchableOpacity>

          {/* Salir */}
          <TouchableOpacity
            onPress={() => setShowLogoutModal(true)}
            style={styles.logoutButton}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Salir"
            accessibilityHint={isGuest ? 'Finaliza el modo invitado' : 'Cierra tu sesión'}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="exit-outline" size={18} color={theme.colors.brand.navy} />
            <Text style={styles.logoutText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal dedicado de salida */}
      <LogoutConfirmModal
        visible={showLogoutModal}
        isGuest={isGuest}
        onConfirm={handleConfirmLogout}
        onClose={() => setShowLogoutModal(false)}
      />
    </>
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
    backgroundColor: theme.colors.surface.card,
  },
  logoPlaceholder: {
    justifyContent: 'center' as const,
    minHeight: theme.metrics.minTouch,
  },
  logoText: {
    fontSize: theme.metrics.font.title.size,
    lineHeight: theme.metrics.font.title.lineHeight,
    fontWeight: '900' as const,
    letterSpacing: 0.5,
  },
  userActionsWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12, // Separación clara entre avatar y salir
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  avatarText: {
    color: theme.colors.text.inverse,
    fontWeight: '800' as const,
    fontSize: theme.metrics.font.body.size,
    lineHeight: theme.metrics.font.body.lineHeight,
  },
  logoutButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: theme.metrics.radius.pill,
    backgroundColor: theme.colors.surface.subtle,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  logoutText: {
    fontSize: theme.metrics.font.caption.size,
    fontWeight: '700' as const,
    lineHeight: theme.metrics.font.caption.lineHeight,
    color: theme.colors.brand.navy,
  },
});