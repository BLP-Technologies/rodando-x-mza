import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useStyles, Theme } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { RouteStackParamList } from '@/navigation/types';
import { PlaceCategory, PlaceSchema } from '@/navigation/types';
import { placesService } from '@/services/placesService';
import { searchAddressSuggestions, PlaceSuggestion } from '@/services/geocoding';
import { AppHeader } from '@/components/common/AppHeader';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { FormInput } from '@/components/common/FormInput';
import { CategoryDropdown } from '@/components/path/places/CategoryDropDown';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { StatusModal, StatusType } from '@/components/common/StatusModal';

type PlaceFormRouteProp = RouteProp<RouteStackParamList, 'EditPlace'>;
type CoordinatesState = {
  latitude: number | null;
  longitude: number | null;
};


export const PlaceFormScreen = () => {
  const { styles, theme } = useStyles(getStyles);
  const navigation = useNavigation<any>();
  const route = useRoute<PlaceFormRouteProp>();

  // Si viene placeId, estamos editando; si no, estamos creando
  const placeId = route.params?.placeId;
  const isEditing = Boolean(placeId);

  // Estados del Formulario
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<PlaceCategory>('CASA');

  // Coordenadas simuladas/fijas para Mendoza
  const [coordinates, setCoordinates] = useState<CoordinatesState>({
    latitude: null,
    longitude: null,
  });

  // Estados para sugerencias de Photon
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal de feedback (éxito o error)
  const [modalConfig, setModalConfig] = useState<{
    visible: boolean;
    type: StatusType;
    title: string;
    message?: string;
  }>({
    visible: false,
    type: 'success',
    title: '',
  });

  // Si edita, cargar datos existentes
  useEffect(() => {
    if (placeId) {
      placesService.getById(placeId).then((place) => {
        if (place) {
          setName(place.name);
          setAddress(place.address);
          setCategory(place.category);
          setCoordinates({ 
            latitude: place.latitude, 
            longitude: place.longitude });
        }
      });
    }
  }, [placeId]);

// Manejo de búsqueda en tiempo real con debounce
  const handleAddressChange = (text: string) => {
    setAddress(text);
    setCoordinates({ latitude: null, longitude: null });

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (text.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoadingSuggestions(false);
      return;
    }

    setIsLoadingSuggestions(true);
    setShowSuggestions(true);

    debounceTimer.current = setTimeout(async () => {
      const results = await searchAddressSuggestions(text);
      setSuggestions(results);
      setIsLoadingSuggestions(false);
    }, 400);
  };

  // Al tocar una sugerencia del listado
  const handleSelectSuggestion = (suggestion: PlaceSuggestion) => {
    setAddress(suggestion.fullAddress || suggestion.name);
    setCoordinates({
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
    setSuggestions([]);
    setShowSuggestions(false);
  };


  const handleLogout = () => console.log('Cerrar sesión');

  const handleSubmit = async () => {

// 1. Obtener coordenadas exactas usando Photon si no están fijadas
    let lat = coordinates.latitude;
    let lon = coordinates.longitude;

    if (!lat || !lon) {
      const suggestions = await searchAddressSuggestions(address);
      if (suggestions.length > 0) {
        lat = suggestions[0].latitude;
        lon = suggestions[0].longitude;
      } else {
        // Fallback geográfico dentro del Gran Mendoza
        lat = -32.8895;
        lon = -68.8458;
      }
    }

    // 2. Validación con Zod
    const validation = PlaceSchema.safeParse({
      name,
      address,
      category,
      latitude: lat,
      longitude: lon,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Verifica los datos ingresados';
      setModalConfig({
        visible: true,
        type: 'error',
        title: 'Datos incompletos',
        message: firstError,
      });
      return;
    }


    // 3. Persistir en el almacenamiento JSON con las coordenadas exactas
    try {
      if (isEditing && placeId) {
        await placesService.update(placeId, {
          name,
          address,
          category,
          latitude: lat,
          longitude: lon,
        });
        setModalConfig({
          visible: true,
          type: 'success',
          title: 'Lugar actualizado\nexitosamente',
        });
      } else {
        await placesService.create({
          name,
          address,
          category,
          latitude: lat,
          longitude: lon,
        });
        setModalConfig({
          visible: true,
          type: 'success',
          title: 'Lugar guardado\nexitosamente',
        });
      }
    } catch {
      setModalConfig({
        visible: true,
        type: 'error',
        title: 'Error al guardar',
        message: 'No se pudo guardar la información en este momento.',
      });
    }
  };

  const handleCloseModal = () => {
    const wasSuccess = modalConfig.type === 'success';
    setModalConfig((prev) => ({ ...prev, visible: false }));
    if (wasSuccess) {
      navigation.goBack(); // Vuelve a Mis Lugares con la lista actualizada
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader userInitial="C" onLogout={handleLogout} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          eyebrow="TU CIUDAD, A TU MANERA"
          title={isEditing ? 'Editar lugar' : 'Crear lugar'}
          description="La posición en el mapa es simulada y permanecerá fija."
          showBackButton={true}
        />

        <View style={styles.formContainer}>
          {/* Nombre del lugar */}
          <FormInput
            label="NOMBRE DEL LUGAR"
            placeholder="Ej. Casa"
            value={name}
            onChangeText={setName}
            multiline={false}
            numberOfLines={1}
            enableVoiceInput={false}
          />

          {/* Dirección */}
          <View style={styles.addressInputWrapper}>
            <FormInput
              label="DIRECCIÓN"
              placeholder="Ej. Brasil 1550"
              value={address}
              onChangeText={handleAddressChange}
              multiline={false}
              numberOfLines={1}
              enableVoiceInput={false}
            />

            {/* Spinner mientras busca en Photon */}
            {isLoadingSuggestions && (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="small" color={theme.colors.brand.teal} />
              </View>
            )}

            {/* Desplegable de Sugerencias de Photon */}
            {showSuggestions && suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {suggestions.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.suggestionItem}
                    onPress={() => handleSelectSuggestion(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="location-outline"
                      size={20}
                      color={theme.colors.brand.teal}
                      style={styles.suggestionIcon}
                    />
                    <View style={styles.suggestionTextContainer}>
                      <Text style={styles.suggestionName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                        {item.fullAddress}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Selector de Categoría */}
          <CategoryDropdown value={category} onSelect={setCategory} />

          {/* Botón Guardar / Modificar en color naranja */}
          <PrimaryButton
            title="GUARDAR LUGAR"
            variant="orange"
            onPress={handleSubmit}
            style={styles.submitButton}
          />
        </View>
      </ScrollView>

      {/* Modal de confirmación de guardado o error */}
      <StatusModal
        visible={modalConfig.visible}
        type={modalConfig.type}
        layout="row"
        title={modalConfig.title}
        message={modalConfig.message}
        onClose={handleCloseModal}
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
  formContainer: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  addressInputWrapper: {
    position: 'relative' as const,
    zIndex: 10,
  },
  loaderContainer: {
    position: 'absolute' as const,
    right: theme.spacing.md,
    top: 38,
  },
  suggestionsContainer: {
    backgroundColor: theme.colors.surface.card,
    borderRadius: theme.metrics.radius.card - 8,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    marginTop: theme.spacing.xs,
    overflow: 'hidden' as const,
    elevation: 3,
  },
  suggestionItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  suggestionIcon: {
    marginRight: theme.spacing.sm,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionName: {
    fontSize: theme.metrics.font.body.size,
    fontWeight: '700' as const,
    color: theme.colors.text.main,
  },
  suggestionSubtitle: {
    fontSize: theme.metrics.font.caption.size,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  submitButton: {
    marginTop: theme.spacing.lg,
    minHeight: 52,
    borderRadius: theme.metrics.radius.card - 2,
  },
});