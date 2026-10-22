import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { BottomTabParamList } from '@/navigation/types';
import { useStyles, Theme } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { MenuActionCard } from '@/components/common/MenuActionCard';

type NavigationProp = BottomTabNavigationProp<BottomTabParamList, 'Inicio'>;

export const HomeScreen = () => {
  const { styles, theme } = useStyles(getStyles);
  const navigation = useNavigation<NavigationProp>();

  const handleLogout = () => {
    // Llamada al método logout() de AuthContext cuando esté integrado
    console.log('Cerrar sesión');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader userInitial="C" onLogout={handleLogout} />

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Botón Volver */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Volver atrás"
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={theme.colors.brand.navy}
          />
        </TouchableOpacity>

        {/* Sección de Saludo */}
        <View style={styles.greetingContainer}>
          <Text style={styles.eyebrow}>
            TU CIUDAD, A TU MANERA
          </Text>
          <Text style={styles.greetingTitle}>
            ¡Hola, Ciro! 👋
          </Text>
          <Text style={styles.greetingSubtitle}>
            ¿A dónde querés ir hoy?
          </Text>
        </View>

        {/* Tarjetas de Navegación Rápida */}
        <View style={styles.cardsSection}>
          <MenuActionCard
            title="RECORRIDOS ACCESIBLES"
            subtitle="Encontrá el mejor camino"
            iconName="search"
            onPress={() => navigation.navigate('Recorrido', { screen: 'RouteHome' })}
          />

          <MenuActionCard
            title="REPORTAR UNA BARRERA"
            subtitle="Ayudá a mejorar la ciudad"
            iconName="alert-circle"
            onPress={() => navigation.navigate('Reportar')}
          />

          <MenuActionCard
            title="TUTORIALES"
            subtitle="Consejos para tu autonomía"
            iconName="play"
            onPress={() => navigation.navigate('Tutoriales')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme: Theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.surface.welcome,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.xl, // 20
    paddingTop: theme.spacing.lg,        // 16
    paddingBottom: theme.spacing.xxl,    // 24
  },
  backButton: {
    width: theme.metrics.minTouch,       // 48 (accesibilidad táctil)
    height: theme.metrics.minTouch,
    justifyContent: 'center' as const,
    marginBottom: theme.spacing.md,      // 12
  },
  greetingContainer: {
    marginBottom: theme.spacing.xxl + theme.spacing.xs, // 28
  },
  eyebrow: {
    color: theme.colors.brand.teal,
    fontSize: theme.metrics.font.caption.size,         // 13
    lineHeight: theme.metrics.font.caption.lineHeight, // 18
    fontWeight: '800' as const,
    letterSpacing: 0.8,
    marginBottom: theme.spacing.xs + 2,                // 6
    textTransform: 'uppercase' as const,
  },
  greetingTitle: {
    color: theme.colors.brand.navy,
    fontSize: theme.metrics.font.header.size - 2,      // 26
    lineHeight: theme.metrics.font.header.lineHeight,  // 32
    fontWeight: '800' as const,
    marginBottom: theme.spacing.xs,                    // 4
  },
  greetingSubtitle: {
    color: theme.colors.brand.navy,
    fontSize: theme.metrics.font.title.size + 4,       // 22
    lineHeight: theme.metrics.font.title.lineHeight + 4,
    fontWeight: '700' as const,
  },
  cardsSection: {
    marginTop: theme.spacing.sm, // 8
  },
});