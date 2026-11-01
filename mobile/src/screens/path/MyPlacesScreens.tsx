import React, { useState, useCallback } from 'react';
import { View, ScrollView,  Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PlaceCategory, Place } from '@/types/places';
import { RouteStackParamList } from '@/navigation/types';
import { useStyles, Theme } from '@/theme';
import { placesService } from '@/services/placesService';
import { useAuth } from '@/auth/AuthContext';

import { AppHeader } from '@/components/common/AppHeader';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { PlaceCard } from '@/components/path/PlaceCard';
import { StatusModal } from '@/components/common/StatusModal';


//Función Auxiliar para mapear categoría a íconos
const getCategoryIcon = (category: PlaceCategory): keyof typeof Ionicons.glyphMap => {
  switch (category) {
    case 'CASA':
      return 'home-outline';
    case 'TRABAJO':
      return 'briefcase-outline';
    case 'ESTUDIO':
      return 'school-outline';
    case 'MEDICO':
      return 'medkit-outline';
    case 'RECREATIVO':
      return 'bicycle-outline';
    case 'OTRO':
    default:
      return 'location-outline';
  }
};


//tipo
type MyPlacesNavProp = NativeStackNavigationProp<RouteStackParamList, 'MyPlaces'>;



export const MyPlacesScreen = () => {
  const { styles } = useStyles(getStyles);
  const navigation = useNavigation<MyPlacesNavProp>();
  
  // Consumimos la sesión global y las acciones de autenticación
  const { isGuest, user, cerrarSesion, irAAutenticacion } = useAuth();


  const [places, setPlaces] = useState<Place[]>([]);
  const [placeToDelete, setPlaceToDelete] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  // Cargar y refrescar los lugares cada vez que la pantalla toma foco
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      if (isGuest) {
        setShowAuthModal(true);
        return () => {
          isActive = false;
        };
      }

      placesService.getAll().then((data) => {
        if (isActive) {
          setPlaces(data);
          console.log('📌 LUGARES GUARDADOS EN EL JSON:', JSON.stringify(data, null, 2));
        }
      });
      return () => {
        isActive = false;
      };
    }, [isGuest])
  );


  const handleLogout = () => {
    cerrarSesion();
  };

  //Enlace hacia la pantalla Crear Lugar
  const handleAddPlace = () => {
    console.log('Abrir formulario o modal para agregar lugar');
    navigation.navigate('CreatePlace');
  };

  //Enlace hacia la pantalla Editar Lugar
  const handleEditPlace = (placeId: string) => {
    navigation.navigate('EditPlace', { placeId });
  };

  //Manejo de la eliminación de un lugar
 const handleDeletePlace = (id: string) => {
    setPlaceToDelete(id);
  };

  const handleConfirmDelete = async () => {
    if (placeToDelete) {
      await placesService.delete(placeToDelete);
      setPlaces((prev) => prev.filter((p) => p.id !== placeToDelete));
      setPlaceToDelete(null);
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

      <View style={styles.fixedHeaderContainer}> 

        {/* Encabezado */}
          <ScreenHeader
              eyebrow="TU CIUDAD, A TU MANERA"
              title="Mis lugares"
              description="Guardá tus lugares frecuentes para encontrarlos rápidamente al crear un recorrido."
              showBackButton={true}
          />

        {/* Botón Reutilizable AGREGAR LUGAR */}
        <PrimaryButton
          title="AGREGAR LUGAR"
          onPress={handleAddPlace}
          style={styles.addButton}
          accessibilityLabel="Agregar lugar"
          accessibilityHint="Abre el formulario para guardar una nueva dirección frecuente"
        />
      </View>  

      <ScrollView
        style={styles.scrollView} // <-- habilita de scrollView
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={true}
      >
        {/* Lista de Tarjetas Reutilizables PlaceCard */}
        <View 
          style={styles.placesList}
          accessible={true}
          accessibilityRole="list"
          accessibilityLabel="Lista de lugares frecuentes guardados"
        >
          {places.map((place) => (
            <PlaceCard
              key={place.id}
              title={place.name}
              address={place.address}
              iconName={getCategoryIcon(place.category)}
              onEdit={() => handleEditPlace(place.id)}
              onDelete={() => handleDeletePlace(place.id)}
            />
          ))}
        </View>
      </ScrollView>
      
      {/* Modal de confirmación para eliminar */}
      <StatusModal
        visible={placeToDelete !== null}
        type="warning"
        layout="row"
        buttonDirection="row"
        showCloseButton={false}
        title={'¿Seguro que querés\neliminar este\nlugar?'}
        cancelText="Cancelar"
        confirmText="Confirmar"
        onClose={() => setPlaceToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Modal restrictivo para usuarios invitados */}
      <StatusModal
        visible={showAuthModal}
        type="auth"
        title="Para administrar lugares necesitás una cuenta"
        message="Al registrarte podés guardar tu casa, trabajo o destinos frecuentes para elegirlos con un solo toque."
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
    paddingHorizontal: theme.spacing.xl, // 20px de margen a los lados
    paddingTop: theme.spacing.md,        // 12px de separación con AppHeader
    paddingBottom: theme.spacing.sm,     // 8px antes de la lista
  },

  addButton: {
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,      // Margen inferior del botón
    minHeight: theme.metrics.minTouch,
  },
  scrollView: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: theme.spacing.xl, // 20px idéntico a fixedHeaderContainer
    paddingTop: theme.spacing.md,        // 12px de aire arriba para que las cards no toquen el botón
    paddingBottom: 130,                  // Margen inferior para librar el Bottom Tab
  },
  placesList: {
    gap: theme.spacing.lg,               // 16px
  },
});