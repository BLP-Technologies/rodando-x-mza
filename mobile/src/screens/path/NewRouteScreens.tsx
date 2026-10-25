import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStyles, Theme } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { RoutePointCard } from '@/components/path/RoutePointCard';
import { SwapButton } from '@/components/path/SwapButton';
import { AddressSearchModal } from '@/components/path/AddressSearchModal';
import { PlaceSuggestion } from '@/services/geocoding';

interface RoutePoint {
  label: string;
  latitude: number | null;
  longitude: number | null;
}


export const NewRouteScreen = () => {
  const { styles } = useStyles(getStyles);
  const navigation = useNavigation<any>();

// Estados con nombre y coordenadas
  const [origin, setOrigin] = useState<RoutePoint>({
    label: 'Mi ubicación',
    latitude: -32.8895, // Mendoza centro default
    longitude: -68.8458,
  });

  const [destination, setDestination] = useState<RoutePoint>({
    label: 'Mi destino',
    latitude: null,
    longitude: null,
  });

  const [searchTarget, setSearchTarget] = useState<'origin' | 'destination' | null>(null);
 
  const handleLogout = () => console.log('Cerrar sesión');

  // Intercambiar origen y destino
  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const handleSelectPlace = (place: PlaceSuggestion) => {
    const pointData: RoutePoint = {
      label: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
    };

    if (searchTarget === 'origin') {
      setOrigin(pointData);
    } else if (searchTarget === 'destination') {
      setDestination(pointData);
    }
  };

  const handleSearchAccessibleRoute = () => {
    if (!destination.latitude || !destination.longitude || destination.label === 'Mi destino') {
      Alert.alert('Atención', 'Por favor elegí un destino válido.');
      return;
    }

    if (!origin.latitude || !origin.longitude) {
      Alert.alert('Atención', 'Por favor elegí un origen válido.');
      return;
    }

    console.log('Recorrido listo para trazar:', {
      origin,
      destination,
    });

    // Navegación con los datos listos
    navigation.navigate('RouteResult', {
      origin: {
        label: origin.label,
        latitude: origin.latitude,
        longitude: origin.longitude,
      },
      destination: {
        label: destination.label,
        latitude: destination.latitude,
        longitude: destination.longitude,
      },
    });
  };

  const handleManagePlaces = () => {
    // Navegar a la pantalla de Mis Lugares
    navigation.navigate('MyPlaces');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader userInitial="C" onLogout={handleLogout} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="TU CIUDAD, A TU MANERA"
          title="Nuevo Recorrido"
          description="Elegí un lugar guardado o ingresá otra dirección"
          showBackButton={true}
        />

        {/* Bloque de selección Origen / Destino con botón Swap superpuesto */}
        <View style={styles.routeCardGroup}>
          <RoutePointCard
            label="ORIGEN"
            value={origin.label}
            onPress={() => setSearchTarget('origin')}
          />

          <SwapButton onPress={handleSwap} />

          <RoutePointCard
            label="DESTINO"
            value={destination.label}
            onPress={() => setSearchTarget('destination')}
          />
        </View>

        {/* Botón Buscar Recorrido Accesible */}
        <PrimaryButton
          title="BUSCAR RECORRIDO ACCESIBLE"
          onPress={handleSearchAccessibleRoute}
          style={styles.searchButton}
        />

        {/* Enlace Administrar mis lugares */}
        <TouchableOpacity
          onPress={handleManagePlaces}
          style={styles.managePlacesContainer}
          accessibilityRole="link"
          accessibilityLabel="Administrar mis lugares guardados"
        >
          <Text style={styles.managePlacesText}>Administrar mis lugares</Text>
        </TouchableOpacity>
      </ScrollView>

        {/* Modal buscador de direcciones autocompletadas */}
        <AddressSearchModal
            visible={searchTarget !== null}
            title={searchTarget === 'origin' ? 'Elegir origen' : 'Elegir destino'}
            onClose={() => setSearchTarget(null)}
            onSelect={handleSelectPlace}
        />


    </SafeAreaView>
  );
};

const getStyles = (theme: Theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.surface.welcome,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    paddingBottom: 130,
  },
  routeCardGroup: {
    marginBottom: theme.spacing.xxl,
  },
  searchButton: {
    marginBottom: theme.spacing.xl,
  },
  managePlacesContainer: {
    alignSelf: 'center' as const,
    paddingVertical: theme.spacing.xs,
  },
  managePlacesText: {
    fontSize: theme.metrics.font.caption.size + 1,
    fontWeight: '700' as const,
    color: theme.colors.brand.teal,
    textDecorationLine: 'underline' as const,
  },
});