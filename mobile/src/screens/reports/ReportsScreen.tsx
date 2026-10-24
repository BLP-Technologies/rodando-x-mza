import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { ReportStackParamList, BottomTabParamList } from '@/navigation/types';
import { useStyles, Theme } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { FormInput } from '@/components/common/FormInput';
import { StatusModal } from '@/components/common/StatusModal';
import { LocationModeSelector, LocationMode } from '@/components/report/LocationModeSelector';
import {
  BarrierTypeSelector,
  DEFAULT_BARRIER_OPTIONS,
} from '@/components/report/BarrierTypeSelector';
import { PhotoUploader } from '@/components/report/PhotoUploader';

type ReportScreenNavProp = NativeStackNavigationProp<ReportStackParamList, 'ReportForm'>;

export const ReportsScreen = () => {
  const { styles } = useStyles(getStyles);
  const navigation = useNavigation<ReportScreenNavProp>();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [locationMode, setLocationMode] = useState<LocationMode>('current');
  const [selectedBarrier, setSelectedBarrier] = useState<string | null>(null);
  const [description, setDescription] = useState('');

  const [validationModalVisible, setValidationModalVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);

  const handleLogout = () => console.log('Cerrar sesión');

  const handleResetForm = () => {
    setPhotoUri(null);
    setLocationMode('current');
    setSelectedBarrier(null);
    setDescription('');
  };

  const handleContinue = () => {
    if (!selectedBarrier) {
      setValidationModalVisible(true);
      return;
    }

    // Buscamos la etiqueta legible correspondiente al ID seleccionado
    const barrierItem = DEFAULT_BARRIER_OPTIONS.find(
      (b) => b.id === selectedBarrier
    );

    // Navegación hacia ConfirmReport pasando todos los datos cargados
    navigation.navigate('ConfirmReport', {
      locationMode,
      barrierId: selectedBarrier,
      barrierLabel: barrierItem?.label || 'Barrera reportada',
      photoUri,
      description,
    });
  };


  // Confirmación de cancelación: limpia datos y va a Inicio
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

        {/* 1. Selector de modo de ubicación */}
        <LocationModeSelector
          value={locationMode}
          onChange={setLocationMode}
        />

        {/* 2. Selector de tipos de barrera */}
        <BarrierTypeSelector
          selectedValue={selectedBarrier}
          onSelect={setSelectedBarrier}
        />

        {/* 3. Subir foto funcional */}
        <PhotoUploader imageUri={photoUri} onImageChange={setPhotoUri} />

        {/* 4. Input multilínea accesible con botón de voz */}
        <FormInput
          label="DESCRIPCIÓN (OPCIONAL)"
          placeholder="Escribí detalles adicionales sobre la barrera..."
          value={description}
          onChangeText={setDescription}
          multiline={true}
          numberOfLines={4}
          enableVoiceInput={true}
        />

        {/* 5. Botón Continuar */}
        <PrimaryButton
          title="CONTINUAR"
          onPress={handleContinue}
          style={styles.Button}
        />
        <PrimaryButton
            title="CANCELAR"
            variant="outline"
            onPress={() => setCancelModalVisible(true)}
            style={styles.Button}
        />
      </ScrollView>

     {/* Modal de advertencia si no seleccionó tipo de barrera */}
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
    paddingBottom: 130, // Espacio para librar el BottomTab
  },
  Button: {
    marginTop: theme.spacing.xxl,
  },
});