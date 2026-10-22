// src/screens/route/MyRoutesScreen.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useStyles, Theme } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { RouteCard } from '@/components/path/RouteCard';
import { ScreenHeader } from '@/components/common/ScreenHeader';

interface SavedRoute {
  id: string;
  label: string;
  origin: string;
  destination: string;
  lastConsulted: string;
}

const INITIAL_ROUTES: SavedRoute[] = [
  {
    id: '1',
    label: 'Camino a la Escuela',
    origin: 'Casa',
    destination: 'Escuela',
    lastConsulted: 'Hoy',
  },
  {
    id: '2',
    label: 'Recorrido Frecuente',
    origin: 'Casa',
    destination: 'Plaza',
    lastConsulted: 'Ayer',
  },
  {
    id: '3',
    label: 'Visita Médica',
    origin: 'Casa',
    destination: 'Hospital Notti',
    lastConsulted: 'Hace 3 días',
  },
];

export const MyRoutesScreen = () => {
  const { styles, theme } = useStyles(getStyles);
  const navigation = useNavigation();
  const [routes, setRoutes] = useState<SavedRoute[]>(INITIAL_ROUTES);

  const handleLogout = () => console.log('Cerrar sesión');
  const handleNewRoute = () => console.log('Navegar a Nuevo Recorrido');

  const handleSearchRoute = (route: SavedRoute) => {
    console.log(`Buscando ruta accesible: ${route.origin} a ${route.destination}`);
  };

  const handleDeleteRoute = (id: string, label: string) => {
    Alert.alert(
      'Eliminar recorrido',
      `¿Estás seguro de que querés eliminar "${label}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => setRoutes((prev) => prev.filter((r) => r.id !== id)),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader userInitial="C" onLogout={handleLogout} />

      {/* SECCIÓN FIJA */}
      <View style={styles.fixedHeaderContainer}>
        <ScreenHeader
            title="Mis recorridos"
            description="Guardamos origen y destino, la ruta se recalcula cada vez."
        />

        <PrimaryButton
          title="NUEVO RECORRIDO"
          onPress={handleNewRoute}
          style={styles.addButton}
        />
      </View>

      {/* SECCIÓN SCROLL */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={true}
      >
        <View style={styles.routesList}>
          {routes.map((route) => (
            <RouteCard
              key={route.id}
              label={route.label}
              origin={route.origin}
              destination={route.destination}
              lastConsulted={route.lastConsulted}
              onSearchRoute={() => handleSearchRoute(route)}
              onDelete={() => handleDeleteRoute(route.id, route.label)}
            />
          ))}
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
  fixedHeaderContainer: {
    paddingHorizontal: theme.spacing.xl, // 20
    paddingTop: theme.spacing.md,        // 12
    paddingBottom: theme.spacing.sm,     // 8
  },
  backButton: {
    width: theme.metrics.minTouch,
    height: theme.metrics.minTouch,
    justifyContent: 'center' as const,
    marginBottom: theme.spacing.xs,
  },
  headerSection: {
    marginBottom: theme.spacing.lg,
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
  addButton: {
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    paddingBottom: 130, // Margen para el BottomTab
  },
  routesList: {
    gap: theme.spacing.lg, // 16
  },
});