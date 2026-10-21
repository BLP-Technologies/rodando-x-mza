import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';

interface AppHeaderProps {
  userInitial?: string;
  onLogout: () => void;
}

export const AppHeader = ({ userInitial = 'C', onLogout }: AppHeaderProps) => {
  const theme = useTheme();
  const colorNavy = theme.colors.brand?.navy || '#002B49';
  const colorTeal = theme.colors.brand?.teal || '#17A2B8';

  return (
    <View style={styles.headerContainer}>
      {/* Reemplazá con tu asset real de logo: require('@/assets/images/logo.png') */}
      <View style={styles.logoPlaceholder}>
        <Text style={[styles.logoText, { color: colorNavy }]}>
          RODANDO<Text style={{ color: colorTeal }}>XMZA</Text>
        </Text>
      </View>

      <TouchableOpacity
        style={styles.profileBadge}
        onPress={onLogout}
        accessibilityRole="button"
        accessibilityLabel="Cerrar sesión"
      >
        <View style={[styles.avatarCircle, { backgroundColor: colorTeal }]}>
          <Text style={styles.avatarText}>{userInitial}</Text>
        </View>
        <View style={styles.logoutButton}>
          <Ionicons name="exit-outline" size={18} color={colorNavy} />
          <Text style={[styles.logoutText, { color: colorNavy }]}>Salir</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  logoPlaceholder: {
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6EFF5',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#002B49',
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 8,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 4,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '700',
  },
});