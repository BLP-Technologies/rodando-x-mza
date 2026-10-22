import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useStyles, Theme } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { PlaceCard } from '@/components/path/PlaceCard';

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
  { id: '4', title: 'CASA', address: 'Mi Dirección', iconName: 'home-outline' },
  { id: '5', title: 'ESCUELA', address: 'Mi Dirección', iconName: 'home-outline' },
  { id: '6', title: 'PLAZA', address: 'Mi Dirección', iconName: 'home-outline' },
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

      <ScrollView
        style={styles.scrollView} // <-- habilita de scrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        bounces={true}
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

        {/* Encabezado */}
        <View style={styles.headerSection}>
          <Text style={styles.eyebrow}>TU CIUDAD, A TU MANERA</Text>
          <Text style={styles.title}>Mis lugares</Text>
          <Text style={styles.description}>
            Guardá tus lugares frecuentes para encontrarlos rápidamente al crear un recorrido.
          </Text>
        </View>

        {/* Botón Reutilizable AGREGAR LUGAR */}
        <PrimaryButton
          title="AGREGAR LUGAR"
          onPress={handleAddPlace}
          style={styles.addButton}
        />

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
  scrollView: {
    flex: 1, // Permite que el área de scroll ocupe todo el espacio vertical disponible
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.xl, // 20
    paddingTop: theme.spacing.lg,        // 16
    paddingBottom: theme.spacing.xxl,    // 24
  },
  backButton: {
    width: theme.metrics.minTouch,
    height: theme.metrics.minTouch,
    justifyContent: 'center' as const,
    marginBottom: theme.spacing.md,
  },
  headerSection: {
    marginBottom: theme.spacing.xl,
  },
  eyebrow: {
    color: theme.colors.brand.teal,
    fontSize: theme.metrics.font.caption.size,
    lineHeight: theme.metrics.font.caption.lineHeight,
    fontWeight: '800' as const,
    letterSpacing: 0.8,
    marginBottom: theme.spacing.xs + 2,
    textTransform: 'uppercase' as const,
  },
  title: {
    color: theme.colors.brand.navy,
    fontSize: theme.metrics.font.header.size,
    lineHeight: theme.metrics.font.header.lineHeight,
    fontWeight: '800' as const,
    marginBottom: theme.spacing.sm,
  },
  description: {
    color: theme.colors.text.muted,
    fontSize: theme.metrics.font.body.size,
    lineHeight: theme.metrics.font.body.lineHeight,
    fontWeight: '400' as const,
  },
  addButton: {
    marginBottom: theme.spacing.xxl,
  },
  placesList: {
    gap: theme.spacing.lg, // 16
  },
});