import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useStyles, Theme } from '@/theme';
import { RouteStackParamList } from '@/navigation/types';
import { PlaceCategory, PlaceSchema } from '@/navigation/types';
import { placesService } from '@/services/placesService';
import { AppHeader } from '@/components/common/AppHeader';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { FormInput } from '@/components/common/FormInput';
import { CategoryDropdown } from '@/components/path/places/CategoryDropDown';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { StatusModal, StatusType } from '@/components/common/StatusModal';

type PlaceFormRouteProp = RouteProp<RouteStackParamList, 'EditPlace'>;

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
  const [coordinates, setCoordinates] = useState({
    latitude: -32.8942,
    longitude: -68.8475,
  });

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
          setCoordinates({ latitude: place.latitude, longitude: place.longitude });
        }
      });
    }
  }, [placeId]);

  const handleLogout = () => console.log('Cerrar sesión');

  const handleSubmit = async () => {
    // 1. Validación con Zod
    const validation = PlaceSchema.safeParse({
      name,
      address,
      category,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
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

    // if (!validation.success) {
    //   const formErrors = validation.error.flatten();
    //   const firstError =
    //     formErrors.formErrors[0] ||
    //     Object.values(formErrors.fieldErrors)[0]?.[0] ||
    //     'Verifica los datos ingresados';

    //   setModalConfig({
    //     visible: true,
    //     type: 'error',
    //     title: 'Datos incompletos',
    //     message: firstError,
    //   });
    //   return;
    // }


    // 2. Persistir en el almacenamiento JSON
    try {
      if (isEditing && placeId) {
        await placesService.update(placeId, {
          name,
          address,
          category,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
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
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
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
          <FormInput
            label="DIRECCIÓN"
            placeholder="Ej. Brasil 1550"
            value={address}
            onChangeText={setAddress}
            multiline={false}
            numberOfLines={1}
            enableVoiceInput={false}
          />

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
  submitButton: {
    marginTop: theme.spacing.lg,
    minHeight: 52,
    borderRadius: theme.metrics.radius.card - 2,
  },
});