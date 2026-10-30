import React, { useState } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { MapLocationPickerModal } from '@/components/report/MapLocationPickerModal';
import { ReportStackParamList, BottomTabParamList } from '@/navigation/types';
import { useStyles, Theme } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { FormInput } from '@/components/common/FormInput';
import { StatusModal, StatusType } from '@/components/common/StatusModal';
import { LocationModeSelector, LocationMode } from '@/components/report/LocationModeSelector';
import {
  BarrierTypeSelector,
  DEFAULT_BARRIER_OPTIONS,
} from '@/components/report/BarrierTypeSelector';
import { PhotoUploader } from '@/components/report/PhotoUploader';
import { reverseGeocode } from '@/services/geocoding';

type ReportScreenNavProp = NativeStackNavigationProp<ReportStackParamList, 'ReportForm'>;

export const ReportsScreen = () => {
  const { styles, theme } = useStyles(getStyles);
  const navigation = useNavigation<ReportScreenNavProp>();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [locationMode, setLocationMode] = useState<LocationMode>('current');
  const [selectedBarrier, setSelectedBarrier] = useState<string | null>(null);
  const [description, setDescription] = useState('');

  // Estados para geolocalización y dirección
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // Estados para modales de feedback
  const [statusModalConfig, setStatusModalConfig] = useState<{
    visible: boolean;
    type: StatusType;
    title: string;
    message?: string;
  }>({
    visible: false,
    type: 'warning',
    title: '',
  });

  const [validationModalVisible, setValidationModalVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);

  //Estado para abrir o cerrar mapa
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);

  const handleLogout = () => console.log('Cerrar sesión');

  // Obtener ubicación GPS real y resolver la dirección con Photon
  const fetchCurrentLocation = async () => {
    try {
      setIsLoadingLocation(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setStatusModalConfig({
          visible: true,
          type: 'warning',
          title: 'Permiso necesario',
          message: 'Necesitamos acceso a la ubicación para detectar dónde está la barrera.',
        });
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest, // Fuerza uso de GPS satelital puro
        timeInterval: 1000,
        mayShowUserSettingsDialog: true, // Si el GPS está en modo bajo consumo, sugiere activarlo al máximo
      });

      const { latitude, longitude } = position.coords;
      setCoordinates({ latitude, longitude });

      // Reverse geocoding con Photon
      const resolvedAddress = await reverseGeocode(latitude, longitude);
      setAddress(resolvedAddress || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    } catch (error: any) {
      console.error('Error al obtener ubicación actual:', error);
      setStatusModalConfig({
        visible: true,
        type: 'error',
        title: 'Error de ubicación',
        message: 'No pudimos obtener tu ubicación actual. Verificá si el GPS está activado.',
      });
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleLocationModeChange = (mode: LocationMode) => {
    setLocationMode(mode);
    if (mode === 'current') {
      fetchCurrentLocation();
    } else if (mode === 'map') {
      //Abrir selector interactivo de mapa
      setIsMapModalVisible(true);
    }
  };

  //Función para recibir punto confirmado del modal Mapa
  const handleMapLocationConfirmed = (data: {
    latitude: number;
    longitude: number;
    address: string;
  }) => {
    setCoordinates({ latitude: data.latitude, longitude: data.longitude });
    setAddress(data.address);
  };


  const handleResetForm = () => {
    setPhotoUri(null);
    setLocationMode('current');
    setSelectedBarrier(null);
    setDescription('');
    setAddress('');
    setCoordinates(null);
  };

  const handleContinue = () => {
    if (!selectedBarrier) {
      setValidationModalVisible(true);
      return;
    }

    const barrierItem = DEFAULT_BARRIER_OPTIONS.find(
      (b) => b.id === selectedBarrier
    );

    navigation.navigate('ConfirmReport', {
      locationMode,
      barrierId: selectedBarrier,
      barrierLabel: barrierItem?.label || 'Barrera reportada',
      photoUri,
      description,
      address,
      latitude: coordinates?.latitude,
      longitude: coordinates?.longitude,
    });
  };

  const handleConfirmCancel = () => {
    setCancelModalVisible(false);
    handleResetForm();
    navigation.getParent<BottomTabNavigationProp<BottomTabParamList>>()?.navigate('Inicio');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader userInitial="C" onLogout={handleLogout} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          eyebrow="TU CIUDAD, A TU MANERA"
          title="Reportar una barrera"
          description="Tu aporte puede ayudar a otras personas."
          showBackButton={true}
        />

        {/* 1. Input de Ubicación */}
        <View style={styles.inputContainer}>
          <FormInput
            label="UBICACIÓN"
            placeholder="Ej. Av. España y Espejo"
            value={address}
            onChangeText={setAddress}
            multiline={false}
            numberOfLines={1}
            enableVoiceInput={true}
          />
          {isLoadingLocation && (
            <View style={styles.loaderWrapper}>
              <ActivityIndicator size="small" color={theme.colors.brand.teal} />
            </View>
          )}
        </View>

        {/* 2. Selector de modo de ubicación */}
        <LocationModeSelector
          value={locationMode}
          onChange={handleLocationModeChange}
        />

        {/* 3. Selector de tipos de barrera */}
        <BarrierTypeSelector
          selectedValue={selectedBarrier}
          onSelect={setSelectedBarrier}
        />

        {/* 4. Subir foto funcional */}
        <PhotoUploader imageUri={photoUri} onImageChange={setPhotoUri} />

        {/* 5. Input multilínea accesible con botón de voz */}
        <FormInput
          label="DESCRIPCIÓN (OPCIONAL)"
          placeholder="Escribí detalles adicionales sobre la barrera..."
          value={description}
          onChangeText={setDescription}
          multiline={true}
          numberOfLines={4}
          enableVoiceInput={true}
        />

        {/* 6. Botones de acción */}
        <PrimaryButton
          title="CONTINUAR"
          onPress={handleContinue}
          style={styles.button}
        />
        <PrimaryButton
          title="CANCELAR"
          variant="outline"
          onPress={() => setCancelModalVisible(true)}
          style={styles.buttonSecondary}
        />
      </ScrollView>

      {/* Modal de información y errores de geolocalización */}
      <StatusModal
        visible={statusModalConfig.visible}
        type={statusModalConfig.type}
        title={statusModalConfig.title}
        message={statusModalConfig.message}
        onClose={() => setStatusModalConfig((prev) => ({ ...prev, visible: false }))}
      />

      {/* Modal de validación de barrera */}
      <StatusModal
        visible={validationModalVisible}
        type="error"
        title="Dato obligatorio"
        message="Por favor, seleccioná el tipo de barrera antes de continuar."
        onClose={() => setValidationModalVisible(false)}
      />

      {/* Modal de Cancelación */}
      <StatusModal
        visible={cancelModalVisible}
        type="warning"
        title="¿Cancelar reporte?"
        message="Se perderán los datos que hayas completado hasta el momento."
        confirmText="SÍ, CANCELAR"
        cancelText="VOLVER"
        onConfirm={handleConfirmCancel}
        onClose={() => setCancelModalVisible(false)}
      />

      {/* Modal interactivo para marcar en el mapa */}
      <MapLocationPickerModal
        visible={isMapModalVisible}
        initialLatitude={coordinates?.latitude || -32.8895}
        initialLongitude={coordinates?.longitude || -68.8458}
        onConfirm={handleMapLocationConfirmed}
        onClose={() => setIsMapModalVisible(false)}
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
  scrollContentContainer: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    paddingBottom: 130,
  },
  inputContainer: {
    position: 'relative' as const,
  },
  loaderWrapper: {
    position: 'absolute' as const,
    right: 48,
    top: 38,
  },
  button: {
    marginTop: theme.spacing.xxl,
  },
  buttonSecondary: {
    marginTop: theme.spacing.sm,
  },
});