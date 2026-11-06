import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, Theme } from '@/theme';
import { RouteStackParamList, RouteStep } from '@/navigation/types';
import { useAuth } from '@/auth/AuthContext';
import { AppHeader } from '@/components/common/AppHeader';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { RouteStepItem } from '@/components/path/RouteStepItem';
import { RouteLeg } from '@/services/routesService';

let Speech: any = null;
try {
  Speech = require('expo-speech');
} catch {
  // Fallback silencioso si no está instalado
}

type DetailRouteProp = RouteProp<RouteStackParamList, 'RouteDetail'>;

const DEFAULT_STEPS: RouteStep[] = [
  {
    id: '1',
    stepNumber: 1,
    instruction: 'Avanza por la vereda.',
    distance: '180 m',
    status: 'accessible',
  },
  {
    id: '2',
    stepNumber: 2,
    instruction: 'Cruce peatonal.',
    distance: '40 m',
    status: 'unverified',
  },
  {
    id: '3',
    stepNumber: 3,
    instruction: 'Llegaste a tu destino.',
    status: 'accessible',
  },
];

export const RouteDetailScreen = () => {
  const { styles } = useStyles(getStyles);
  const route = useRoute<DetailRouteProp>();
  const { isGuest, user, cerrarSesion } = useAuth();

  const originLabel = route.params?.originLabel || 'Origen';
  const destinationLabel = route.params?.destinationLabel || 'Destino';
  const rawLegs: RouteLeg[] = (route.params as any)?.legs || [];
  const explicitSteps: RouteStep[] = (route.params as any)?.steps;

  // Convertimos los legs del backend en RouteSteps numerados para la UI
  const steps: RouteStep[] = useMemo(() => {
    if (explicitSteps && explicitSteps.length > 0) {
      return explicitSteps;
    }

    if (!rawLegs || rawLegs.length === 0) {
      return DEFAULT_STEPS;
    }

    const formatDist = (meters: number) => {
      if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
      return `${Math.round(meters)} m`;
    };

    const generated: RouteStep[] = rawLegs.map((leg, index) => {
      const isSidewalk = leg.element_kind === 'sidewalk';
      const distText = formatDist(leg.meters);

      let status: RouteStep['status'] = 'accessible';
      if (!leg.is_verified || leg.level === null) {
        status = 'unverified';
      } else if (leg.level === 'PARTIAL') {
        status = 'partially_accessible';
      } else if (leg.level === 'NOT_ACCESSIBLE') {
        status = 'partially_accessible';
      }

      let instruction = '';
      if (isSidewalk) {
        instruction = leg.is_verified
          ? 'Avanzá por vereda verificada.'
          : 'Avanzá por vereda (tramo sin relevamiento reciente).';
      } else {
        instruction = leg.is_verified
          ? 'Realizá el cruce peatonal por la senda/rampa.'
          : 'Cruce peatonal en esquina (precaución en cordón).';
      }

      return {
        id: `step_${index + 1}`,
        stepNumber: index + 1,
        instruction,
        distance: distText,
        status,
      };
    });

    // Agregamos el paso final de llegada
    generated.push({
      id: `step_${generated.length + 1}`,
      stepNumber: generated.length + 1,
      instruction: `Llegaste a tu destino: ${destinationLabel}.`,
      status: 'accessible',
    });

    return generated;
  }, [rawLegs, explicitSteps, destinationLabel]);

  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if (Speech && isSpeaking) {
        Speech.stop();
      }
    };
  }, [isSpeaking]);

  const handleLogout = () => {
    if (Speech && isSpeaking) {
      Speech.stop();
    }
    cerrarSesion();
  };

  const handleSpeakDirections = () => {
    if (Speech) {
      if (isSpeaking) {
        Speech.stop();
        setIsSpeaking(false);
        return;
      }

      setIsSpeaking(true);
      const textToRead = steps
        .map((s) => `Paso ${s.stepNumber}: ${s.instruction} ${s.distance ? `durante ${s.distance}` : ''}`)
        .join('. ');

      Speech.speak(`Recorrido de ${originLabel} a ${destinationLabel}. ${textToRead}`, {
        language: 'es-AR',
        onDone: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } else {
      Alert.alert(
        'Indicaciones por voz',
        'Reproduciendo indicaciones paso a paso para personas con baja visión.'
      );
    }
  };

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
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="TU CIUDAD, A TU MANERA"
          title="Detalle del recorrido"
          showBackButton={true}
        />

        {/* Fila: Resumen de origen/destino y botón de lectura por voz */}
        <View style={styles.subHeaderRow}>
          <Text
            style={styles.routeSummaryText}
            accessible={true}
            accessibilityLabel={`Trayecto desde ${originLabel} hacia ${destinationLabel}`}
          >
            {originLabel} → {destinationLabel}
          </Text>

          <TouchableOpacity
            style={styles.voiceButton}
            onPress={handleSpeakDirections}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              isSpeaking
                ? 'Detener lectura por voz de las indicaciones'
                : 'Escuchar indicaciones por voz'
            }
            accessibilityHint="Lee en voz alta las indicaciones paso a paso del trayecto"
            accessibilityLiveRegion="polite"
          >
            <View style={styles.voiceIconWrapper}>
              <Ionicons
                name={isSpeaking ? 'volume-high' : 'volume-medium-outline'}
                size={22}
                color="#00838F"
              />
            </View>
            <Text style={styles.voiceButtonText}>
              {isSpeaking ? 'Detener voz' : 'Escuchar\nindicaciones'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Lista de pasos numerados */}
        <View
          style={styles.stepsList}
          accessible={true}
          accessibilityRole="list"
          accessibilityLabel="Lista de indicaciones paso a paso"
        >
          {steps.map((step) => (
            <RouteStepItem key={step.id} step={step} />
          ))}
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    paddingBottom: 130, // Margen para el BottomTab
  },
  subHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: theme.spacing.xl,
    marginTop: -theme.spacing.sm,
  },
  routeSummaryText: {
    fontSize: theme.metrics.font.body.size + 1, // ~16px
    fontWeight: '700' as const,
    color: theme.colors.text.muted,
    flex: 1,
    marginRight: theme.spacing.md,
  },
  voiceButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#7DBBB7', // Color teal suave de la maqueta
    borderRadius: theme.metrics.radius.card - 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  voiceIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.surface.card,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  voiceButtonText: {
    fontSize: theme.metrics.font.caption.size,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
    lineHeight: 15,
  },
  stepsList: {
    marginTop: theme.spacing.sm,
  },
});