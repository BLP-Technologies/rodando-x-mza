import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteStackParamList } from '@/navigation/types';
import { useStyles, Theme } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { RouteCard } from '@/components/path/RouteCard';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { StatusModal } from '@/components/common/StatusModal';

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

  // 1. Estado para almacenar el id del recorrido a eliminar
  const [routeToDelete, setRouteToDelete] = useState<string | null>(null);

  const handleLogout = () => console.log('Cerrar sesión');

  const handleNewRoute = () => {
    navigation.navigate('NewRoute');
  };

  const handleSearchRoute = (route: SavedRoute) => {
    console.log(`Buscando ruta accesible: ${route.origin} a ${route.destination}`);
  };

  // 2. Al presionar el tacho, activamos el modal guardando el ID
  const handleDeleteRoute = (id: string) => {
    setRouteToDelete(id);
  };

  // 3. Confirmación: borra el elemento y cierra el modal
  const handleConfirmDelete = () => {
    if (routeToDelete) {
      setRoutes((prev) => prev.filter((r) => r.id !== routeToDelete));
      setRouteToDelete(null);
    }
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
              onDelete={() => handleDeleteRoute(route.id)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Modal con layout horizontal y botones Cancelar/Confirmar alineados */}
      <StatusModal
        visible={routeToDelete !== null}
        type="warning"
        layout="row"
        buttonDirection="row"
        showCloseButton={false}
        title={'¿Seguro que querés\neliminar este\nrecorrido?'}
        cancelText="Cancelar"
        confirmText="Confirmar"
        onClose={() => setRouteToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </SafeAreaView>
  );
};

const getStyles = (theme: Theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.surface.welcome,
  },
  fixedHeaderContainer: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
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
    paddingBottom: 130,
  },
  routesList: {
    gap: theme.spacing.lg,
  },
});