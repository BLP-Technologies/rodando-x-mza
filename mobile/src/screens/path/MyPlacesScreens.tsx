import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useStyles, Theme } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { PlaceCard } from '@/components/path/PlaceCard';
import { ScreenHeader } from '@/components/common/ScreenHeader';

interface SavedPlace {
  id: string;
  title: string;
  address: string;
  iconName: keyof typeof Ionicons.glyphMap;
}

const INITIAL_PLACES: SavedPlace[] = [
  { id: '1', title: 'CASA', address: 'Mi Dirección', iconName: 'home-outline' },
  { id: '2', title: 'ESCUELA', address: 'Mi Dirección', iconName: 'home-outline' },
  { id: '3', title: 'PLAZA', address: 'Mi Dirección', iconName: 'home-outline' },
  { id: '4', title: 'TRABAJO', address: 'Av. San Martín 1234', iconName: 'home-outline' },
  { id: '5', title: 'GIMNASIO', address: 'Calle Belgrano 567', iconName: 'home-outline' },
  { id: '6', title: 'CLUB', address: 'Paso de los Andes 890', iconName: 'home-outline' },
];

export const MyPlacesScreen = () => {
  const { styles, theme } = useStyles(getStyles);
  const navigation = useNavigation();
  const [places, setPlaces] = useState<SavedPlace[]>(INITIAL_PLACES);

  const handleLogout = () => {
    console.log('Cerrar sesión');
  };

  const handleAddPlace = () => {
    console.log('Abrir formulario o modal para agregar lugar');
  };

  const handleEditPlace = (place: SavedPlace) => {
    console.log('Editar lugar:', place.title);
  };

  const handleDeletePlace = (id: string, title: string) => {
    Alert.alert(
      'Eliminar lugar',
      `¿Estás seguro de que querés eliminar "${title}" de tus lugares guardados?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setPlaces((prev) => prev.filter((p) => p.id !== id));
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader userInitial="C" onLogout={handleLogout} />


        {/* Botón Volver */}
      <View style={styles.fixedHeaderContainer}> 

        {/* Encabezado */}
          <ScreenHeader
              title="Mis lugares"
              description="Guardá tus lugares frecuentes para encontrarlos rápidamente al crear un recorrido."
          />

        {/* Botón Reutilizable AGREGAR LUGAR */}
        <PrimaryButton
          title="AGREGAR LUGAR"
          onPress={handleAddPlace}
          style={styles.addButton}
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
        <View style={styles.placesList}>
          {places.map((place) => (
            <PlaceCard
              key={place.id}
              title={place.title}
              address={place.address}
              iconName={place.iconName}
              onEdit={() => handleEditPlace(place)}
              onDelete={() => handleDeletePlace(place.id, place.title)}
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
    paddingHorizontal: theme.spacing.xl, // 20px de margen a los lados
    paddingTop: theme.spacing.md,        // 12px de separación con AppHeader
    paddingBottom: theme.spacing.sm,     // 8px antes de la lista
  },
  backButton: {
    width: theme.metrics.minTouch,       // 48px
    height: theme.metrics.minTouch,
    justifyContent: 'center' as const,
    marginBottom: theme.spacing.xs,
  },
  headerSection: {
    marginBottom: theme.spacing.lg,      // 16px
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
    marginBottom: theme.spacing.sm,      // Margen inferior del botón
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