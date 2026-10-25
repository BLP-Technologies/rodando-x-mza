import React, { useState } from 'react';
import { View, ScrollView,  Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteStackParamList } from '@/navigation/types';
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

type MyRoutesNavProp = NativeStackNavigationProp<RouteStackParamList, 'MyRoutes'>;

export const MyRoutesScreen = () => {
  const { styles } = useStyles(getStyles);
  const navigation = useNavigation<MyRoutesNavProp>();
  const [routes, setRoutes] = useState<SavedRoute[]>(INITIAL_ROUTES);

  const handleLogout = () => console.log('Cerrar sesión');
  
  const handleNewRoute = () => {
    navigation.navigate('NewRoute');
  }

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