import React, { useState, useEffect } from 'react';
import { useAuth } from '@/auth/AuthContext';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, Theme } from '@/theme';
import { RouteStackParamList } from '@/navigation/types';
import { AppHeader } from '@/components/common/AppHeader';
import { FormInput } from '@/components/common/FormInput';
import { OSMRouteMap } from '@/components/path/OSMRouteMap';
import { ActionButton } from '@/components/common/ActionButton';
import { StatusModal, StatusType } from '@/components/common/StatusModal';
import { routesService } from '@/services/routesService';
import { CreateRouteInput } from '@/types/routes';

type RouteResultProp = RouteProp<RouteStackParamList, 'RouteResult'>;

export const RouteResultScreen = () => {
  const { styles, theme } = useStyles(getStyles);
  const navigation = useNavigation<any>();
  const route = useRoute<RouteResultProp>();


  // Consumimos el contexto global:
  const { isGuest, user, cerrarSesion, irAAutenticacion } = useAuth();

  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');

  

  // Parámetros recibidos de NewRouteScreen (con fallback)
  const { origin, destination } = route.params || {
    origin: { label: 'Casa', latitude: -32.8895, longitude: -68.8458 },
    destination: { label: 'Escuela', latitude: -32.8791, longitude: -68.8412 },
  };

  // Solo busca rutas guardadas si el usuario no es visitante
  useEffect(() => {
    let isActive = true;
    if (!isGuest) {
      routesService.getAll().then((existingRoutes) => {
        if (!isActive) return;
        const alreadyExists = existingRoutes.some(
          (r) =>
            r.origin.latitude === origin.latitude &&
            r.origin.longitude === origin.longitude &&
            r.destination.latitude === destination.latitude &&
            r.destination.longitude === destination.longitude
        );
        if (alreadyExists) {
          setIsSaved(true);
        }
      });
    }
    return () => {
      isActive = false;
    };
  }, [isGuest, origin.latitude, origin.longitude, destination.latitude, destination.longitude]);

  // Modal para éxito o error al guardar
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

  const routeMetrics = {
    distance: '340 m',
    duration: '16 min aprox.',
    warningMessage: 'Hay un tramo de vereda sin verificar.',
  };

  const handleLogout = () => {
    cerrarSesion();
  };

  const handleViewDetail = () => {
    navigation.navigate('RouteDetail', {
      originLabel: origin.label,
      destinationLabel: destination.label,
    });
  };

  const handleSaveRoute = async () => {
    // Si es visitante, abre el modal de solicitud de inicio/registro
    if (isGuest) {
      setShowAuthModal(true);
      return;
    }

    if (isSaved) return;

    try {
      const trimmedCustom = customName.trim();
      const finalName =
        trimmedCustom.length >= 3
          ? trimmedCustom
          : `${origin.label} a ${destination.label}`;

      const newRoutePayload: CreateRouteInput = {
        name: finalName,
        origin: {
          name: origin.label,
          latitude: origin.latitude,
          longitude: origin.longitude,
          placeId: null,
        },
        destination: {
          name: destination.label,
          latitude: destination.latitude,
          longitude: destination.longitude,
          placeId: null,
        },
        distanceMeters: 340,
        durationMinutes: 16,
        accessibilityScore: 85,
        coordinates: [
          [origin.latitude, origin.longitude],
          [destination.latitude, destination.longitude],
        ],
      };

      await routesService.create(newRoutePayload);

      setIsSaved(true);
      setModalConfig({
        visible: true,
        type: 'success',
        title: 'Recorrido guardado\nexitosamente',
      });
    } catch (err: any) {
      console.error('Error al guardar recorrido:', err);
      setModalConfig({
        visible: true,
        type: 'error',
        title: 'No se pudo guardar\nel recorrido',
        message: err?.message || 'Revisá los datos ingresados e intentalo de nuevo.',
      });
    }
  };

  const handleCloseStatusModal = () => {
    const wasSuccess = modalConfig.type === 'success';
    setModalConfig((prev) => ({ ...prev, visible: false }));
    if (wasSuccess) {
      navigation.navigate('MyRoutes');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader
        userInitial={isGuest ? 'A' : (user?.nombre?.[0]?.toUpperCase() || 'U')}
        isGuest={isGuest}
        onLogout={handleLogout}
      />

      {/* Botón Volver con Touch Target accesible */}
      <View style={styles.backButtonContainer}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Volver atrás"
          accessibilityHint="Regresa a la selección de puntos de recorrido"
        >
          <Ionicons name="chevron-back" size={28} color={theme.colors.brand.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Vista previa del Mapa */}
        <View
          style={styles.mapWrapper}
          accessible={true}
          accessibilityRole="image"
          accessibilityLabel={`Mapa de ruta accesible desde ${origin.label} hasta ${destination.label}`}
        >
          <OSMRouteMap
            origin={origin}
            destination={destination}
            height={230}
          />
          {/* Badge de advertencia sobre el mapa */}
          <View
            style={styles.mapWarningBadge}
            accessible={true}
            accessibilityRole="alert"
            accessibilityLabel="Advertencia: Tramo sin verificar sobre el mapa"
          >
            <Ionicons name="warning-outline" size={16} color="#7A4D00" />
            <Text style={styles.mapWarningText}>Tramo sin verificar</Text>
          </View>
        </View>

        {/* Sección Informativa agrupada para lectores de pantalla */}
        <View style={styles.infoSection}>
          <View
            accessible={true}
            accessibilityRole="summary"
            accessibilityLabel={`Ruta accesible encontrada: desde ${origin.label} hasta ${destination.label}. Distancia: ${routeMetrics.distance}, duración estimada: ${routeMetrics.duration}`}
          >
            <Text style={styles.eyebrow}>RUTA ACCESIBLE ENCONTRADA</Text>

            <View style={styles.titleRow}>
              <Text style={styles.pointTitle}>{origin.label}</Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={theme.colors.brand.navy}
                style={styles.arrowIcon}
              />
              <Text style={styles.pointTitle}>{destination.label}</Text>
            </View>

            <Text style={styles.metricsText}>
              {routeMetrics.distance} | {routeMetrics.duration}
            </Text>
          </View>

          {/* Banner de alerta de accesibilidad */}
          <View
            style={styles.alertBanner}
            accessible={true}
            accessibilityRole="alert"
            accessibilityLabel={routeMetrics.warningMessage}
          >
            <Ionicons name="help-circle-outline" size={18} color="#9C3B53" />
            <Text style={styles.alertText}>{routeMetrics.warningMessage}</Text>
          </View>

          {/* Botones de acción */}
          <View style={styles.actionsRow}>
            <ActionButton
              title="VER DETALLE"
              variant="primary"
              onPress={handleViewDetail}
              style={styles.flexButton}
              accessibilityLabel="Ver detalle"
              accessibilityHint="Abre la lista de indicaciones paso a paso de este trayecto"
            />
            <ActionButton
              title={isSaved ? 'RECORRIDO GUARDADO' : 'GUARDAR RECORRIDO'}
              variant="primary"
              onPress={handleSaveRoute}
              disabled={isSaved}
              style={{
                ...styles.flexButton,
                ...(isSaved ? styles.disabledButton : {}),
              }}
              accessibilityLabel={isSaved ? 'Recorrido guardado' : 'Guardar recorrido'}
              accessibilityHint={
                isGuest
                  ? 'Abre aviso para registrarse o iniciar sesión antes de guardar'
                  : 'Guarda esta ruta en tu lista de recorridos frecuentes'
              }
            />
          </View>

          {/* Input para guardar con nombre opcional */}
          <FormInput
            label="NOMBRE (OPCIONAL)"
            placeholder="Ej. Camino a la escuela"
            value={customName}
            onChangeText={setCustomName}
            multiline={false}
            numberOfLines={1}
            enableVoiceInput={true}
            accessibilityLabel="Nombre opcional para el recorrido"
            accessibilityHint="Ingresá un nombre personalizado para identificar fácilmente esta ruta"
          />
        </View>
      </ScrollView>

      {/* Modal de confirmación o error (éxito al guardar) */}
      <StatusModal
        visible={modalConfig.visible}
        type={modalConfig.type}
        layout="row"
        title={modalConfig.title}
        message={modalConfig.message}
        onClose={handleCloseStatusModal}
      />

      {/* Modal de autenticación requerida para visitantes */}
      <StatusModal
        visible={showAuthModal}
        type="auth"
        title="Para guardar un recorrido necesitás una cuenta"
        message="Al iniciar sesión podemos asociar el recorrido a tu cuenta y podrás consultarlos más adelante."
        onClose={() => setShowAuthModal(false)}
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
  backButtonContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
  },
  backButton: {
    width: theme.metrics.minTouch,
    height: theme.metrics.minTouch,
    justifyContent: 'center' as const,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: 130,
  },
  mapWrapper: {
    position: 'relative' as const,
    marginBottom: theme.spacing.lg,
  },
  mapWarningBadge: {
    position: 'absolute' as const,
    bottom: 12,
    alignSelf: 'center' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 6,
    elevation: 3,
  },
  mapWarningText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#7A4D00',
  },
  infoSection: {
    marginTop: theme.spacing.xs,
  },
  eyebrow: {
    fontSize: theme.metrics.font.caption.size,
    fontWeight: '800' as const,
    color: theme.colors.brand.teal,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    marginBottom: 6,
  },
  pointTitle: {
    fontSize: theme.metrics.font.header.size - 4,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
  },
  arrowIcon: {
    marginHorizontal: 8,
  },
  metricsText: {
    fontSize: theme.metrics.font.body.size,
    color: theme.colors.brand.navy,
    fontWeight: '600' as const,
    marginBottom: theme.spacing.md,
  },
  alertBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#E79CAE',
    borderRadius: theme.metrics.radius.card - 6,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    gap: 8,
  },
  alertText: {
    fontSize: theme.metrics.font.caption.size + 1,
    fontWeight: '700' as const,
    color: '#4A1521',
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  disabledButton: {
    opacity: 0.55,
  },
  flexButton: {
    flex: 1,
    paddingHorizontal: 4,
  },
});