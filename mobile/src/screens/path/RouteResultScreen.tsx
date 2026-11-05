import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/auth/AuthContext';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
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
import { routesService, RouteCalculationResponse } from '@/services/routesService';
import { CreateRouteInput } from '@/types/routes';
import { FullScreenRouteMapModal } from '@/components/path/FullScreenRouteMapModal';

type RouteResultProp = RouteProp<RouteStackParamList, 'RouteResult'>;

export const RouteResultScreen = () => {
  const { styles, theme } = useStyles(getStyles);
  const navigation = useNavigation<any>();
  const route = useRoute<RouteResultProp>();

  const { isGuest, user, cerrarSesion, irAAutenticacion } = useAuth();

  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');

  // Estados de cálculo de la ruta real desde el backend
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(true);
  const [calculationResult, setCalculationResult] = useState<RouteCalculationResponse | null>(null);

  // Parámetros recibidos de NewRouteScreen (con fallback)
  const { origin, destination } = route.params || {
    origin: { label: 'Casa', latitude: -32.8895, longitude: -68.8458 },
    destination: { label: 'Escuela', latitude: -32.8791, longitude: -68.8412 },
  };

  // Abrir/cerrar vista completa del mapa
  const [isMapExpanded, setIsMapExpanded] = useState<boolean>(false);

  // Modal para éxito o error
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

  // 1. Llamar al backend real para calcular la ruta
  useEffect(() => {
    let isActive = true;

    const fetchCalculatedRoute = async () => {
      if (!origin.latitude || !origin.longitude || !destination.latitude || !destination.longitude) {
        setIsLoadingRoute(false);
        setModalConfig({
          visible: true,
          type: 'error',
          title: 'Coordenadas incompletas',
          message: 'No se recibieron coordenadas válidas de origen y destino.',
        });
        return;
      }

      try {
        setIsLoadingRoute(true);
        const data = await routesService.calculateRoute({
          origin: { lat: origin.latitude, lon: origin.longitude },
          destination: { lat: destination.latitude, lon: destination.longitude },
        });

        if (isActive) {
          if (!data.found || !data.legs || data.legs.length === 0) {
            setModalConfig({
              visible: true,
              type: 'warning',
              title: 'Ruta no encontrada',
              message: 'No se encontró un camino accesible conectado entre estos dos puntos en la zona piloto.',
            });
          }
          setCalculationResult(data);
        }
      } catch (err: any) {
        if (isActive) {
          console.error('Error calculando ruta en backend:', err);
          setModalConfig({
            visible: true,
            type: 'error',
            title: 'Error de conexión',
            message: 'No pudimos conectar con el motor de rutas. Verificá que el backend esté corriendo.',
          });
        }
      } finally {
        if (isActive) {
          setIsLoadingRoute(false);
        }
      }
    };

    fetchCalculatedRoute();

    return () => {
      isActive = false;
    };
  }, [origin.latitude, origin.longitude, destination.latitude, destination.longitude]);

  // 2. Verificar si la ruta ya está guardada localmente
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

  // 3. Extraer polilínea unificada [lat, lon] a partir de los legs GeoJSON [lon, lat]
  const fullCoordinates: [number, number][] = useMemo(() => {
    if (!calculationResult?.legs) {
      return [
        [origin.latitude || 0, origin.longitude || 0],
        [destination.latitude || 0, destination.longitude || 0],
      ];
    }

    const coords: [number, number][] = [];
    calculationResult.legs.forEach((leg) => {
      leg.geometry.coordinates.forEach(([lon, lat]) => {
        coords.push([lat, lon]);
      });
    });
    return coords.length > 0
      ? coords
      : [
          [origin.latitude || 0, origin.longitude || 0],
          [destination.latitude || 0, destination.longitude || 0],
        ];
  }, [calculationResult, origin, destination]);

  // 4. Formatear métricas reales calculadas por el backend
  const routeMetrics = useMemo(() => {
    if (!calculationResult?.summary) {
      return {
        distanceMeters: 0,
        distanceText: 'Calculando...',
        durationMinutes: 0,
        durationText: 'Calculando...',
        hasUnverified: false,
        unverifiedMeters: 0,
        crossings: 0,
      };
    }

    const meters = Math.round(calculationResult.summary.meters);
    // Estimación para silla de ruedas / peatonal accesible: ~4.5 km/h ≈ 75 metros por minuto
    const estimatedMinutes = Math.max(1, Math.round(meters / 70));
    const unverified = Math.round(calculationResult.summary.unverified_meters || 0);

    return {
      distanceMeters: meters,
      distanceText: `${meters} m`,
      durationMinutes: estimatedMinutes,
      durationText: `${estimatedMinutes} min aprox.`,
      hasUnverified: unverified > 0,
      unverifiedMeters: unverified,
      crossings: calculationResult.summary.crossings || 0,
    };
  }, [calculationResult]);

  const handleLogout = () => {
    cerrarSesion();
  };

  const handleViewDetail = () => {
    navigation.navigate('RouteDetail', {
      originLabel: origin.label,
      destinationLabel: destination.label,
      legs: calculationResult?.legs || [],
      summary: calculationResult?.summary,
    });
  };

  const handleSaveRoute = async () => {
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
        distanceMeters: routeMetrics.distanceMeters,
        durationMinutes: routeMetrics.durationMinutes,
        accessibilityScore: routeMetrics.hasUnverified ? 75 : 95,
        coordinates: fullCoordinates,
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
            coordinates={fullCoordinates}
            height={230}
          />

          {/* Botón flotante para expandir a pantalla completa */}
          <TouchableOpacity
            style={styles.expandMapButton}
            onPress={() => setIsMapExpanded(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Ver mapa en pantalla completa"
            accessibilityHint="Abre el mapa ampliado para seguir la ruta con mayor detalle"
          >
            <Ionicons name="scan-outline" size={20} color="#0D2538" />
            <Text style={styles.expandMapButtonText}>Ampliar mapa</Text>
          </TouchableOpacity>

          {isLoadingRoute && (
            <View style={styles.mapLoadingOverlay}>
              <ActivityIndicator size="small" color={theme.colors.brand.teal} />
              <Text style={styles.mapLoadingText}>Calculando ruta accesible...</Text>
            </View>
          )}

          {/* Badge solo si hay advertencia de tramos sin verificar */}
          {routeMetrics.hasUnverified && !isLoadingRoute && (
            <View
              style={styles.mapWarningBadge}
              accessible={true}
              accessibilityRole="alert"
              accessibilityLabel={`Advertencia: Hay ${routeMetrics.unverifiedMeters} metros de vereda sin verificar sobre el mapa`}
            >
              <Ionicons name="warning-outline" size={16} color="#7A4D00" />
              <Text style={styles.mapWarningText}>
                {routeMetrics.unverifiedMeters}m de vereda sin verificar
              </Text>
            </View>
          )}
        </View>

        {/* Sección Informativa */}
        <View style={styles.infoSection}>
          <View
            accessible={true}
            accessibilityRole="summary"
            accessibilityLabel={`Ruta accesible: desde ${origin.label} hasta ${destination.label}. Distancia: ${routeMetrics.distanceText}, duración estimada: ${routeMetrics.durationText}, cruces accesibles: ${routeMetrics.crossings}`}
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
              {routeMetrics.distanceText} | {routeMetrics.durationText}
              {routeMetrics.crossings > 0 ? ` | ${routeMetrics.crossings} cruces` : ''}
            </Text>
          </View>

          {/* Banner de alerta si hay tramos sin verificar */}
          {routeMetrics.hasUnverified && (
            <View
              style={styles.alertBanner}
              accessible={true}
              accessibilityRole="alert"
              accessibilityLabel={`Aviso: Hay ${routeMetrics.unverifiedMeters} metros de vereda no verificados por la comunidad.`}
            >
              <Ionicons name="help-circle-outline" size={18} color="#9C3B53" />
              <Text style={styles.alertText}>
                Hay {routeMetrics.unverifiedMeters} m de vereda sin verificar.
              </Text>
            </View>
          )}

          {/* Botones de acción */}
          <View style={styles.actionsRow}>
            <ActionButton
              title="VER DETALLE"
              variant="primary"
              onPress={handleViewDetail}
              disabled={isLoadingRoute || !calculationResult?.found}
              style={{
                ...styles.flexButton,
                ...((isLoadingRoute || !calculationResult?.found) ? styles.disabledButton : {}),
              }}
              accessibilityLabel="Ver detalle"
              accessibilityHint="Abre la lista de indicaciones paso a paso de este trayecto"
            />
            <ActionButton
              title={isSaved ? 'RECORRIDO GUARDADO' : 'GUARDAR RECORRIDO'}
              variant="primary"
              onPress={handleSaveRoute}
              disabled={isSaved || isLoadingRoute || !calculationResult?.found}
              style={{
                ...styles.flexButton,
                ...(isSaved || isLoadingRoute || !calculationResult?.found
                  ? styles.disabledButton
                  : {}),
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

      {/* Modales */}
      <StatusModal
        visible={modalConfig.visible}
        type={modalConfig.type}
        layout="row"
        title={modalConfig.title}
        message={modalConfig.message}
        onClose={handleCloseStatusModal}
      />

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

      <FullScreenRouteMapModal
        visible={isMapExpanded}
        onClose={() => setIsMapExpanded(false)}
        origin={origin}
        destination={destination}
        coordinates={fullCoordinates}
        summaryText={`${routeMetrics.distanceText} | ${routeMetrics.durationText}`}
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
    borderRadius: theme.metrics.radius.card,
    overflow: 'hidden' as const,
  },
  mapLoadingOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  mapLoadingText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: theme.colors.brand.navy,
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
  expandMapButton: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  expandMapButtonText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: theme.colors.brand.navy,
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