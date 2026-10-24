import React, { useState } from 'react';
import { View, Text, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ReportStackParamList, BottomTabParamList } from '@/navigation/types';
import { useStyles, Theme } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { StatusModal, StatusType } from '@/components/common/StatusModal';

type ConfirmScreenRouteProp = RouteProp<ReportStackParamList, 'ConfirmReport'>;

// Permite navegar tanto en el stack de reportes como saltar al tab Inicio
type ConfirmScreenNavProp = CompositeNavigationProp<
  NativeStackNavigationProp<ReportStackParamList, 'ConfirmReport'>,
  BottomTabNavigationProp<BottomTabParamList>
>;

export const ConfirmReportScreen = () => {
  const { styles } = useStyles(getStyles);
  const navigation = useNavigation<ConfirmScreenNavProp>();
  const route = useRoute<ConfirmScreenRouteProp>();

  const { locationMode, barrierLabel, photoUri, description } = route.params;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    type: StatusType;
    title: string;
    message: string;
  }>({
    type: 'success',
    title: '¡Gracias por colaborar!',
    message: 'Tu reporte fue registrado',
  });

  const handleLogout = () => console.log('Cerrar sesión');

  const handleCancel = () => {
    navigation.goBack();
  };

  const handleSendReport = async () => {
    setIsSubmitting(true);

    try {
      // Simulación de envío: podés cambiar esta condición para probar éxito o error
      const mockSuccess = true;

      setTimeout(() => {
        setIsSubmitting(false);

        if (mockSuccess) {
          setModalConfig({
            type: 'success',
            title: '¡Gracias por colaborar!',
            message: 'Tu reporte fue registrado',
          });
        } else {
          setModalConfig({
            type: 'error',
            title: 'No se pudo enviar',
            message: 'Ocurrió un problema de conexión. Revisá tus datos e intentalo de nuevo.',
          });
        }
        setModalVisible(true);
      }, 700);
    } catch {
      setIsSubmitting(false);
      setModalConfig({
        type: 'error',
        title: 'Error inesperado',
        message: 'No pudimos registrar tu reporte. Por favor volvé a intentar.',
      });
      setModalVisible(true);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    if (modalConfig.type === 'success') {
      // Si fue exitoso,  resetea stack y vuelve a la pantalla inicial de la app
      navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'ReportForm' }],
      })
    );
      navigation.navigate('Inicio');
    }
    // Si fue error, no navega: se queda en Confirmar Reporte para editar o reintentar
  };

  const locationText =
    locationMode === 'current'
      ? 'Ubicación Actual'
      : 'Punto marcado en el mapa';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader userInitial="C" onLogout={handleLogout} />

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="TU CIUDAD, A TU MANERA"
          title="Confirmar reporte"
          showBackButton={true}
        />

        {/* Tarjeta de Resumen */}
        <View style={styles.card}>
          <View style={styles.itemGroup}>
            <Text style={styles.label}>Ubicación</Text>
            <Text style={styles.value}>{locationText}</Text>
          </View>

          <View style={styles.itemGroup}>
            <Text style={styles.label}>Tipo</Text>
            <Text style={styles.value}>{barrierLabel}</Text>
          </View>

          <View style={styles.itemGroup}>
            <Text style={styles.label}>Foto / Imagen</Text>
            {photoUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image
                  source={{ uri: photoUri }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
              </View>
            ) : (
              <Text style={styles.value}>Sin foto / imagen</Text>
            )}
          </View>

          <View style={[styles.itemGroup, styles.noBorder]}>
            <Text style={styles.label}>Descripción</Text>
            <Text style={description ? styles.value : styles.valueMuted}>
              {description.trim() ? description.trim() : 'Sin descripción'}
            </Text>
          </View>
        </View>

        {/* Botones de acción */}
        <View style={styles.actionsContainer}>
          <PrimaryButton
            title="ENVIAR REPORTE"
            variant="orange"
            onPress={handleSendReport}
            loading={isSubmitting}
            accessibilityLabel="Confirmar y enviar reporte"
          />

          <PrimaryButton
            title="CANCELAR"
            variant="outline"
            onPress={handleCancel}
            disabled={isSubmitting}
            accessibilityLabel="Cancelar y volver a editar reporte"
          />
        </View>
      </ScrollView>

      {/* Modal de Estado (Éxito / Error) */}
      <StatusModal
        visible={modalVisible}
        type={modalConfig.type}
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
  contentContainer: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    paddingBottom: 130,
  },
  card: {
    backgroundColor: theme.colors.surface.card,
    borderRadius: theme.metrics.radius.card,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xxl,
  },
  itemGroup: {
    marginBottom: theme.spacing.lg,
  },
  noBorder: {
    marginBottom: 0,
  },
  label: {
    fontSize: theme.metrics.font.caption.size + 1,
    color: theme.colors.text.muted,
    marginBottom: 4,
  },
  value: {
    fontSize: theme.metrics.font.body.size,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
    lineHeight: 22,
  },
  valueMuted: {
    fontSize: theme.metrics.font.body.size,
    fontWeight: '700' as const,
    color: theme.colors.brand.navy,
  },
  imagePreviewContainer: {
    marginTop: theme.spacing.xs,
    height: 140,
    borderRadius: theme.metrics.radius.card - 4,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  imagePreview: {
    width: '100%' as const,
    height: '100%' as const,
  },
  actionsContainer: {
    gap: theme.spacing.md,
  },
});