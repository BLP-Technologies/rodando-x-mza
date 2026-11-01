import React, { useState, useCallback } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteStackParamList } from '@/navigation/types';
import { useStyles, Theme } from '@/theme';
import { useAuth } from '@/auth/AuthContext';

import { AppHeader } from '@/components/common/AppHeader';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { RouteCard } from '@/components/path/RouteCard';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { StatusModal } from '@/components/common/StatusModal';
import { routesService } from '@/services/routesService';
import { Route } from '@/types/routes';

type MyRoutesNavProp = NativeStackNavigationProp<RouteStackParamList, 'MyRoutes'>;

const formatLastConsulted = (dateStr?: string): string => {
  if (!dateStr) return 'Reciente';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays <= 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  return `Hace ${diffDays} días`;
};

export const MyRoutesScreen = () => {
  const { styles } = useStyles(getStyles);
  const navigation = useNavigation<MyRoutesNavProp>();

  // Consumimos el contexto global de sesión
  const { isGuest, user, cerrarSesion, irAAutenticacion } = useAuth();

  // Estado con el tipo de dominio oficial Route[]
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routeToDelete, setRouteToDelete] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);


  // Recarga automática al enfocar la pantalla
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      if (isGuest) {
        setShowAuthModal(true);
        return () => {
          isActive = false;
        };
      }

      routesService.getAll().then((data) => {
        if (isActive) {
          setRoutes(data);
        }
      });
      return () => {
        isActive = false;
      };
    }, [isGuest])
  );

  const handleLogout = () => cerrarSesion();

  const handleNewRoute = () => {
    navigation.navigate('NewRoute');
  };

  // Navega al mapa interactivo pasando las coordenadas inmutables
  const handleSearchRoute = (routeItem: Route) => {
    navigation.navigate('RouteResult', {
      origin: {
        label: routeItem.origin.name,
        latitude: routeItem.origin.latitude,
        longitude: routeItem.origin.longitude,
      },
      destination: {
        label: routeItem.destination.name,
        latitude: routeItem.destination.latitude,
        longitude: routeItem.destination.longitude,
      },
    });
  };

  const handleDeleteRoute = (id: string) => {
    setRouteToDelete(id);
  };

  // Borrado con persistencia en el servicio
  const handleConfirmDelete = async () => {
    if (routeToDelete) {
      const id = routeToDelete;
      setRouteToDelete(null);
      await routesService.delete(id);
      setRoutes((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const handleCloseAuthModal = () => {
    setShowAuthModal(false);
    navigation.goBack();
  };

  const userInitial = isGuest
    ? 'A'
    : user?.nombre?.[0]?.toUpperCase() || 'U';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader
        userInitial={userInitial}
        isGuest={isGuest}
        onLogout={handleLogout}
      />

      {/* SECCIÓN FIJA */}
      <View style={styles.fixedHeaderContainer}>
        <ScreenHeader
          eyebrow="TU CIUDAD, A TU MANERA"
          title="Mis recorridos"
          description="Guardamos origen y destino, la ruta se recalcula cada vez."
          showBackButton={true}
        />

        <PrimaryButton
          title="NUEVO RECORRIDO"
          onPress={handleNewRoute}
          style={styles.addButton}
          accessibilityLabel="Nuevo recorrido"
          accessibilityHint="Abre la pantalla para planificar y trazar una nueva ruta accesible"
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
        <View 
          style={styles.routesList}
          accessible={true}
          accessibilityRole="list"
          accessibilityLabel="Lista de recorridos guardados"
        >
          {routes.map((routeItem) => (
            <RouteCard
              key={routeItem.id}
              label={routeItem.name}
              origin={routeItem.origin.name}
              destination={routeItem.destination.name}
              lastConsulted={formatLastConsulted(routeItem.updatedAt || routeItem.createdAt)}
              onSearchRoute={() => handleSearchRoute(routeItem)}
              onDelete={() => handleDeleteRoute(routeItem.id)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Modal de confirmación para eliminar recorrido*/}
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

      {/* Modal restrictivo para usuarios invitados */}
      <StatusModal
        visible={showAuthModal}
        type="auth"
        title="Para ver tus recorridos necesitás una cuenta"
        message="Al registrarte podés consultar tus rutas habituales y planificarlas con un solo toque."
        onClose={handleCloseAuthModal}
        confirmText="CREAR CUENTA"
        onConfirm={() => {
          setShowAuthModal(false);
          irAAutenticacion();
        }}
        secondaryText="INICIAR SESIÓN"
        onSecondary={() => {
          setShowAuthModal(false);
          irAAutenticacion();
        }}
        dismissText="Ahora no"
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