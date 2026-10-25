import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, Theme } from '@/theme';
import { RouteStackParamList } from '@/navigation/types';
import { AppHeader } from '@/components/common/AppHeader';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { FormInput } from '@/components/common/FormInput';
import { OSMRouteMap } from '@/components/path/OSMRouteMap';
import { ActionButton } from '@/components/common/ActionButton';

type RouteResultProp = RouteProp<RouteStackParamList, 'RouteResult'>;

export const RouteResultScreen = () => {
  const { styles, theme } = useStyles(getStyles);
  const navigation = useNavigation<any>();
  const route = useRoute<RouteResultProp>();

  // Parámetros recibidos de NewRouteScreen (con fallback por si se abre directo)
  const { origin, destination } = route.params || {
    origin: { label: 'Casa', latitude: -32.8895, longitude: -68.8458 },
    destination: { label: 'Escuela', latitude: -32.8791, longitude: -68.8412 },
  };

  const [customName, setCustomName] = useState('');

  // Simulación de cálculo de ruta (Mock para conectar luego al backend)
  const routeMetrics = {
    distance: '340 m',
    duration: '16 min aprox.',
    warningMessage: 'Hay un tramo de vereda sin verificar.',
  };

  const handleLogout = () => console.log('Cerrar sesión');

  const handleViewDetail = () => {
    Alert.alert('Detalle de ruta', 'Próximamente: Lista paso a paso de calles y accesos.');
  };

  const handleSaveRoute = () => {
    const finalName = customName.trim() || `${origin.label} a ${destination.label}`;
    Alert.alert(
      'Recorrido guardado',
      `"${finalName}" se agregó a tu lista de Mis Recorridos.`,
      [{ text: 'Aceptar', onPress: () => navigation.navigate('MyRoutes') }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader userInitial="C" onLogout={handleLogout} />

      {/* Botón Volver */}
      <View style={styles.backButtonContainer}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Volver atrás"
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
        <View style={styles.mapWrapper}>
          <OSMRouteMap
            origin={origin}
            destination={destination}
            height={230}
          />
          {/* Badge de advertencia sobre el mapa */}
          <View style={styles.mapWarningBadge}>
            <Ionicons name="warning-outline" size={16} color="#7A4D00" />
            <Text style={styles.mapWarningText}>Tramo sin verificar</Text>
          </View>
        </View>

        {/* Sección Informativa */}
        <View style={styles.infoSection}>
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

          {/* Banner de alerta de accesibilidad */}
          <View style={styles.alertBanner}>
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
            />
            <ActionButton
              title="GUARDAR RECORRIDO"
              variant="primary"
              onPress={handleSaveRoute}
              style={styles.flexButton}
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
          />
        </View>
      </ScrollView>
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
    paddingBottom: 130, // Margen para el BottomTab
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
  mapContainer: {
    height: 220,
    borderRadius: theme.metrics.radius.card,
    overflow: 'hidden' as const,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    position: 'relative' as const,
    backgroundColor: '#E5E7EB',
    marginBottom: theme.spacing.lg,
  },
  mapImage: {
    width: '100%' as const,
    height: '100%' as const,
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
    fontSize: theme.metrics.font.header.size - 4, // ~24
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
    backgroundColor: '#E79CAE', // Tono rosado de la maqueta
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
  actionBtn: {
    flex: 1,
    paddingHorizontal: 4,
  },
  flexButton: {
    flex: 1,
  },
  inputSection: {
    marginTop: theme.spacing.xs,
  },
  inputLabel: {
    fontSize: theme.metrics.font.title.size - 2,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
    marginBottom: theme.spacing.sm,
  },
  inputWrapper: {
    backgroundColor: theme.colors.surface.card,
    borderRadius: theme.metrics.radius.card - 4,
    borderWidth: 1.5,
    borderColor: theme.colors.brand.teal,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  textInput: {
    fontSize: theme.metrics.font.body.size,
    color: theme.colors.brand.navy,
  },
  
});