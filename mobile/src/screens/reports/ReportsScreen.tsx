import React, { useState } from 'react';
import { ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ReportStackParamList } from '@/navigation/types';
import { useStyles, Theme } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { FormInput } from '@/components/common/FormInput';
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

  const handleLogout = () => console.log('Cerrar sesión');

  const handleContinue = () => {
    if (!selectedBarrier) {
      Alert.alert('Atención', 'Por favor seleccioná el tipo de barrera.');
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
          style={styles.continueButton}
        />
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
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    paddingBottom: 130, // Espacio para librar el BottomTab
  },
  continueButton: {
    marginTop: theme.spacing.xs,
  },
});