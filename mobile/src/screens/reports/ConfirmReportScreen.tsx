import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, CommonActions, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ReportStackParamList, BottomTabParamList } from '@/navigation/types';
import { useStyles, Theme } from '@/theme';
import { useAuth } from '@/auth/AuthContext';
import { AppHeader } from '@/components/common/AppHeader';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { StatusModal, StatusType } from '@/components/common/StatusModal';
import { reportsService } from '@/services/reportsService';
import { ObstacleType } from '@/types/reports';

type ConfirmScreenRouteProp = RouteProp<ReportStackParamList, 'ConfirmReport'>;

type ConfirmScreenNavProp = CompositeNavigationProp<
  NativeStackNavigationProp<ReportStackParamList, 'ConfirmReport'>,
  BottomTabNavigationProp<BottomTabParamList>
>;

export const ConfirmReportScreen = () => {
  const { styles } = useStyles(getStyles);
  const navigation = useNavigation<ConfirmScreenNavProp>();
  const route = useRoute<ConfirmScreenRouteProp>();

  // Consumo del estado global de sesión y navegación hacia autenticación
  const { isGuest, user, cerrarSesion, irAAutenticacion } = useAuth();

  // Extraemos todos los parámetros que viajaron desde ReportsScreen
  const {
    locationMode,
    barrierId,
    barrierLabel,
    photoUri,
    description,
    address,
    latitude,
    longitude,
  } = route.params;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    type: StatusType;
    title: string;
    message: string;
  }>({
    type: 'success',
    title: '¡Gracias por colaborar!',
    message: 'Tu reporte fue registrado exitosamente.',
  });

  // Verificación de acceso al enfocar la pantalla
  useFocusEffect(
    useCallback(() => {
      if (isGuest) {
        setShowAuthModal(true);
      }
    }, [isGuest])
  );

  const handleLogout = () => {
    cerrarSesion();
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const handleSendReport = async () => {
    if (isGuest) {
      setShowAuthModal(true);
      return;
    }
    
    setIsSubmitting(true);

    try {
      // Coordenadas con fallback a Mendoza Centro si viniera vacío
      const finalLat = latitude ?? -32.8895;
      const finalLon = longitude ?? -68.8458;

      // Persistencia real en AsyncStorage con el formato de la tabla OBSTACLES
      await reportsService.create({
        type: (barrierId as ObstacleType) || 'OTRO',
        latitude: finalLat,
        longitude: finalLon,
        address: address || 'Ubicación seleccionada en Mendoza',
        description: description?.trim() || undefined,
        photoUri: photoUri || null,
      });

      setModalConfig({
        type: 'success',
        title: '¡Gracias por colaborar!',
        message: 'Tu reporte fue registrado exitosamente.',
      });
      setModalVisible(true);
    } catch (error) {
      console.error('Error al guardar reporte de obstáculo:', error);
      setModalConfig({
        type: 'error',
        title: 'No se pudo enviar',
        message: 'Ocurrió un problema al guardar tu reporte. Por favor, volvé a intentar.',
      });
      setModalVisible(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    if (modalConfig.type === 'success') {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'ReportForm' }],
        })
      );
      navigation.navigate('Inicio');
    }
  };

  const handleCloseAuthModal = () => {
    setShowAuthModal(false);
    navigation.goBack();
  };

  const modeBadgeText =
    locationMode === 'current'
      ? 'Ubicación actual (GPS)'
      : 'Punto marcado en el mapa';

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
        <View 
          style={styles.card}
          accessible={true}
          accessibilityRole="summary"
          accessibilityLabel="Resumen de datos del reporte de barrera"
        >
          {/* Ubicación y dirección */}
          <View style={styles.itemGroup}>
            <Text style={styles.label}>Ubicación</Text>
            <Text style={styles.value}>
              {address && address.trim().length > 0
                ? address
                : 'Ubicación seleccionada'}
            </Text>
            <Text style={styles.subtextMode}>{modeBadgeText}</Text>
          </View>

          {/* Tipo de barrera */}
          <View style={styles.itemGroup}>
            <Text style={styles.label}>Tipo</Text>
            <Text style={styles.value}>{barrierLabel}</Text>
          </View>

          {/* Foto adjunta */}
          <View style={styles.itemGroup}>
            <Text style={styles.label}>Foto / Imagen</Text>
            {photoUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image
                  source={{ uri: photoUri }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                  accessible={true}
                  accessibilityRole="summary"
                  accessibilityLabel="Resumen de datos del reporte de barrera"
                />
              </View>
            ) : (
              <Text style={styles.valueMuted}>Sin foto adjunta</Text>
            )}
          </View>

          {/* Descripción */}
          <View style={[styles.itemGroup, styles.noBorder]}>
            <Text style={styles.label}>Descripción</Text>
            <Text style={description?.trim() ? styles.value : styles.valueMuted}>
              {description?.trim() ? description.trim() : 'Sin descripción'}
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
            accessibilityHint="Registra la barrera en el sistema para alertar a la comunidad"
          />

          <PrimaryButton
            title="CANCELAR"
            variant="outline"
            onPress={handleCancel}
            disabled={isSubmitting}
            accessibilityLabel="Cancelar y volver"
            accessibilityHint="Regresa a la pantalla anterior para editar los datos del reporte"
          />
        </View>
      </ScrollView>

      {/* Modal de Estado */}
      <StatusModal
        visible={modalVisible}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        onClose={handleCloseModal}
      />

      {/* Modal restrictivo para usuarios invitados */}
      <StatusModal
        visible={showAuthModal}
        type="auth"
        title="Para reportar una barrera necesitás una cuenta"
        message="Al iniciar sesión podemos asociar el reporte a tu cuenta y permitir el seguimiento de su estado."
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
    fontWeight: '600' as const,
    color: theme.colors.text.muted,
  },
  subtextMode: {
    fontSize: 12,
    color: theme.colors.brand.teal,
    fontWeight: '600' as const,
    marginTop: 4,
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