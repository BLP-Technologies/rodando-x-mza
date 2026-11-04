import React, { useState, useEffect } from 'react';
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

// Opcional: pnpm expo install expo-speech para lectura de voz real
let Speech: any = null;
try {
  Speech = require('expo-speech');
} catch {
  // Fallback si no está instalado aún
}

type DetailRouteProp = RouteProp<RouteStackParamList, 'RouteDetail'>;

//¿Debería recibir un json con los detalles de los pasos?
const DEFAULT_STEPS: RouteStep[] = [
  {
    id: '1',
    stepNumber: 1,
    instruction: 'Avanza por Recorrido local por la vereda de tu izquierda.',
    distance: '180 m',
    status: 'accessible',
  },
  {
    id: '2',
    stepNumber: 2,
    instruction: 'Cruce con rampa en reparación reportada recientemente.',
    distance: '40 m',
    status: 'unverified',
  },
  {
    id: '3',
    stepNumber: 3,
    instruction: 'Continúa por calle secundaria con desnivel moderado.',
    distance: '120 m',
    status: 'partially_accessible',
  },
  {
    id: '4',
    stepNumber: 4,
    instruction: 'Llegaste a tu destino.',
    status: 'accessible',
  },
];

export const RouteDetailScreen = () => {
  const { styles } = useStyles(getStyles);
  const route = useRoute<DetailRouteProp>();

  // Consumo de sesión global
  const { isGuest, user, cerrarSesion } = useAuth();

  const originLabel = route.params?.originLabel || 'Casa';
  const destinationLabel = route.params?.destinationLabel || 'Escuela';
  const steps = route.params?.steps || DEFAULT_STEPS;

  const [isSpeaking, setIsSpeaking] = useState(false);

  // Detener la reproducción de voz al salir o desmontar la pantalla
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