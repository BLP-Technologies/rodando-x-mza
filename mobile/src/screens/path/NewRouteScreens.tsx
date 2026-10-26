import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useStyles, Theme } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { RoutePointCard } from '@/components/path/RoutePointCard';
import { SwapButton } from '@/components/path/SwapButton';
import { AddressSearchModal } from '@/components/path/AddressSearchModal';
import { PlaceSuggestion } from '@/services/geocoding';
import { placesService } from '@/services/placesService';
import { Place } from '@/navigation/types';
import { StatusModal, StatusType } from '@/components/common/StatusModal';



interface RoutePoint {
  label: string;
  latitude: number | null;
  longitude: number | null;
}

export const NewRouteScreen = () => {
  const { styles } = useStyles(getStyles);
  const navigation = useNavigation<any>();

  const [origin, setOrigin] = useState<RoutePoint>({
    label: 'Mi ubicación',
    latitude: -32.8895,
    longitude: -68.8458,
  });

  const [destination, setDestination] = useState<RoutePoint>({
    label: 'Mi destino',
    latitude: null,
    longitude: null,
  });

  const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
  const [searchTarget, setSearchTarget] = useState<'origin' | 'destination' | null>(null);

  // Controla cuál acordeón está desplegado: 'origin', 'destination' o null
  const [openDropdown, setOpenDropdown] = useState<'origin' | 'destination' | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      placesService.getAll().then((data) => {
        if (isActive) {
          setSavedPlaces(data);
        }
      });
      return () => {
        isActive = false;
      };
    }, [])
  );


  //Estados para el modal
  const [modalConfig, setModalConfig] = useState<{
    visible: boolean;
    type: StatusType;
    title: string;
    message?: string;
  }>({
    visible: false,
    type: 'warning',
    title: '',
  });

  const handleLogout = () => console.log('Cerrar sesión');

  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const handleSelectModalPlace = (place: PlaceSuggestion) => {
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

  // Selección directa desde el chip del desplegable
  const handleSelectSavedPlace = (target: 'origin' | 'destination', place: Place) => {
    const pointData: RoutePoint = {
      label: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
    };

    if (target === 'origin') {
      setOrigin(pointData);
    } else {
      setDestination(pointData);
    }

    // Cerramos el acordeón al elegir
    setOpenDropdown(null);
  };


  const handleSearchAccessibleRoute = () => {
  if (!destination.latitude || !destination.longitude || destination.label === 'Mi destino') {
    setModalConfig({
      visible: true,
      type: 'warning',
      title: 'Destino no válido',
      message: 'Por favor elegí un destino para calcular el recorrido.',
    });
    return;
  }

  if (!origin.latitude || !origin.longitude) {
    setModalConfig({
      visible: true,
      type: 'warning',
      title: 'Origen no válido',
      message: 'Por favor elegí un punto de origen válido.',
    });
    return;
  }

  // Validación: Origen y destino no pueden ser el mismo
  const areCoordinatesEqual =
    origin.latitude === destination.latitude &&
    origin.longitude === destination.longitude;

  const areLabelsEqual =
    origin.label.trim().toLowerCase() === destination.label.trim().toLowerCase();

  if (areCoordinatesEqual || areLabelsEqual) {
    setModalConfig({
      visible: true,
      type: 'warning',
      title: 'Puntos coincidentes',
      message: 'El origen y el destino no pueden ser el mismo lugar. Elegí dos puntos diferentes para trazar la ruta.',
    });
    return;
  }

  // Navegación con los datos válidos
  navigation.navigate('RouteResult', {
    origin,
    destination,
  });
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

        {/* Grupo de selección Origen y Destino */}
        <View style={styles.routeCardGroup}>
          <RoutePointCard
            label="ORIGEN"
            value={origin.label}
            isOpen={openDropdown === 'origin'}
            onToggleOpen={() =>
              setOpenDropdown((prev) => (prev === 'origin' ? null : 'origin'))
            }
            onPressText={() => setSearchTarget('origin')}
            savedPlaces={savedPlaces}
            onSelectPlace={(place) => handleSelectSavedPlace('origin', place)}
          />

          <SwapButton onPress={handleSwap} />

          <RoutePointCard
            label="DESTINO"
            value={destination.label}
            isOpen={openDropdown === 'destination'}
            onToggleOpen={() =>
              setOpenDropdown((prev) => (prev === 'destination' ? null : 'destination'))
            }
            onPressText={() => setSearchTarget('destination')}
            savedPlaces={savedPlaces}
            onSelectPlace={(place) => handleSelectSavedPlace('destination', place)}
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
          onPress={() => navigation.navigate('MyPlaces')}
          style={styles.managePlacesContainer}
          accessibilityRole="link"
        >
          <Text style={styles.managePlacesText}>Administrar mis lugares</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal buscador manual */}
      <AddressSearchModal
        visible={searchTarget !== null}
        title={searchTarget === 'origin' ? 'Elegir origen' : 'Elegir destino'}
        onClose={() => setSearchTarget(null)}
        onSelect={handleSelectModalPlace}
      />

      {/* Modal de advertencia/validación */}
      <StatusModal
        visible={modalConfig.visible}
        type={modalConfig.type}
        layout="row"
        title={modalConfig.title}
        message={modalConfig.message}
        onClose={() => setModalConfig((prev) => ({ ...prev, visible: false }))}
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
    gap: theme.spacing.sm,
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