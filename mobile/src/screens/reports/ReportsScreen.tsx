import React, { useState } from 'react';
import { Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, Theme } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { FormInput } from '@/components/common/FormInput';
import { LocationModeSelector, LocationMode } from '@/components/report/LocationModeSelector';
import { BarrierTypeSelector } from '@/components/report/BarrierTypeSelector';

export const ReportsScreen = () => {
  const { styles, theme } = useStyles(getStyles);

  const [locationMode, setLocationMode] = useState<LocationMode>('current');
  const [selectedBarrier, setSelectedBarrier] = useState<string | null>(null);
  const [description, setDescription] = useState('');

  const handleLogout = () => console.log('Cerrar sesión');

  const handlePickPhoto = () => {
    Alert.alert('Subir foto', 'Abre selector de imágenes o cámara.');
  };

  const handleContinue = () => {
    if (!selectedBarrier) {
      Alert.alert('Atención', 'Por favor seleccioná el tipo de barrera.');
      return;
    }
    console.log('Reporte enviado:', {
      locationMode,
      selectedBarrier,
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

        {/* 1. Modo de ubicación específico del reporte */}
        <LocationModeSelector
          value={locationMode}
          onChange={setLocationMode}
        />

        {/* 2. Selector de tipos de barrera específico del reporte */}
        <BarrierTypeSelector
          selectedValue={selectedBarrier}
          onSelect={setSelectedBarrier}
        />

        {/* 3. Subir foto */}
        <TouchableOpacity
          style={styles.photoUploadBox}
          onPress={handlePickPhoto}
          accessibilityRole="button"
          accessibilityLabel="Agregar foto del obstáculo"
        >
          <Ionicons
            name="images-outline"
            size={22}
            color={theme.colors.brand.teal}
          />
          <Text style={styles.photoUploadText}>Agregar foto</Text>
        </TouchableOpacity>

        {/* 4. Input multilínea común */}
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
    paddingBottom: 130,
  },
  photoUploadBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    borderStyle: 'dashed' as const,
    borderRadius: theme.metrics.radius.card,
    backgroundColor: theme.colors.surface.card,
    paddingVertical: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  photoUploadText: {
    fontSize: theme.metrics.font.body.size,
    fontWeight: '600' as const,
    color: theme.colors.brand.navy,
  },
  continueButton: {
    marginTop: theme.spacing.xs,
  },
});