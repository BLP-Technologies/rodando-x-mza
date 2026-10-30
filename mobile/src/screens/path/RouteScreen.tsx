import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { BottomTabParamList, RouteScreenNavigationProp } from '@/navigation/types';
import { useStyles, Theme } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { MenuActionCard } from '@/components/common/MenuActionCard';
import { ScreenHeader } from '@/components/common/ScreenHeader';

type NavigationProp = BottomTabNavigationProp<BottomTabParamList, 'Recorrido'>;

export const RouteScreen = () => {
  const { styles, theme } = useStyles(getStyles);
  const navigation = useNavigation<RouteScreenNavigationProp>();

  const handleLogout = () => {
    console.log('Cerrar sesión');
  };

  const handleNewRoute = () => {
    navigation.navigate('NewRoute');
  };

  const handleMyRoutes = () => {
    navigation.navigate('MyRoutes');
    console.log('Navegar a Mis Recorridos');
  };

  const handleMyPlaces = () => {
    navigation.navigate('MyPlaces');
    console.log('Navegar a Mis Lugares');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader userInitial="C" onLogout={handleLogout} />

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >

        {/* Sección de Encabezado */}
        <ScreenHeader
            title="Recorridos"
            description="Encontrá rutas accesibles o volvé rápidamente a tus recorridos frecuentes."
        />

        {/* Lista de Acciones */}
        <View style={styles.cardsSection}>
          <MenuActionCard
            title="NUEVO RECORRIDO"
            subtitle="Busca una ruta accesible"
            iconName="add"
            onPress={handleNewRoute}
            accessibilityLabel="Nuevo recorrido, Busca una ruta accesible"
          />

          <MenuActionCard
            title="MIS RECORRIDOS"
            subtitle="Tus destinos frecuentes"
            iconName="star"
            onPress={handleMyRoutes}
            accessibilityLabel="Mis recorridos, Tus destinos frecuentes"
          />

          <MenuActionCard
            title="MIS LUGARES"
            subtitle="Administrá tus lugares guardados"
            iconName="location"
            onPress={handleMyPlaces}
            accessibilityLabel="Mis lugares, Administrá tus lugares guardados"
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
    width: theme.metrics.minTouch,       // 48 (WCAG touch target)
    height: theme.metrics.minTouch,
    justifyContent: 'center' as const,
    marginBottom: theme.spacing.md,      // 12
  },
  headerSection: {
    marginBottom: theme.spacing.xxl,     // 24
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
  title: {
    color: theme.colors.brand.navy,
    fontSize: theme.metrics.font.header.size,          // 28
    lineHeight: theme.metrics.font.header.lineHeight,  // 32
    fontWeight: '800' as const,
    marginBottom: theme.spacing.sm,                    // 8
  },
  description: {
    color: theme.colors.text.muted,
    fontSize: theme.metrics.font.body.size,            // 15
    lineHeight: theme.metrics.font.body.lineHeight,    // 22
    fontWeight: '400' as const,
  },
  cardsSection: {
    marginTop: theme.spacing.sm,                       // 8
  },
});