import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useStyles, Theme } from '@/theme';
import { TutorialsStackParamList } from '@/navigation/types';
import { useAuth } from '@/auth/AuthContext';

import { AppHeader } from '@/components/common/AppHeader';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { YouTubePlayerView } from '@/components/tutorials/YouTubePlayerView';

type DetailRouteProp = RouteProp<TutorialsStackParamList, 'TutorialDetail'>;

export const TutorialDetailScreen = () => {
  const { styles } = useStyles(getStyles);
  const route = useRoute<DetailRouteProp>();

  // Consumo de la sesión real
  const { isGuest, user, cerrarSesion } = useAuth();

  // Parámetros o fallback con el contenido de la maqueta
  const tutorial = route.params?.tutorial || {
    id: '1',
    title: 'Moverse por la ciudad',
    category: 'Movilidad urbana',
    duration: '3min',
    description:
      'Cómo resolver cordones y desniveles con asistencia y priorizando la seguridad.',
    youtubeId: 'pM_s_3a0K3Y', // ID de video de técnicas en silla de ruedas
  };

 const handleLogout = () => {
    cerrarSesion();
  };

  const userInitial = isGuest
    ? 'A'
    : user?.nombre?.[0]?.toUpperCase() || 'U';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. Header principal de la aplicación */}
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
        {/* 2. Header reutilizable con botón volver y título */}
        <ScreenHeader
          eyebrow="TU CIUDAD, A TU MANERA"
          title={tutorial.title}
          showBackButton={true}
        />

        {/* 3. Subtítulo específico (Categoría - Duración) */}
        <Text style={styles.categorySubhead}>
          {tutorial.category} - {tutorial.duration}
        </Text>

        {/* 4. Reproductor de video de YouTube */}
        <View style={styles.videoWrapper}>
          <YouTubePlayerView
            videoId={tutorial.youtubeId || 'dQw4w9WgXcQ'}
            title={tutorial.title}
          />
        </View>

        {/* 5. Descripción del tutorial */}
        <Text 
          style={styles.descriptionText}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={`Descripción: ${tutorial.description}`}
        >
          {tutorial.description}
        </Text>
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
    paddingBottom: 130, // Margen para despejar la barra de tabs
  },
  categorySubhead: {
    fontSize: theme.metrics.font.body.size + 1, // ~16px
    fontWeight: '800' as const,
    color: theme.colors.brand.teal,
    marginTop: -theme.spacing.sm, // Acercar al título del ScreenHeader
    marginBottom: theme.spacing.lg,
  },
  videoWrapper: {
    marginBottom: theme.spacing.xl,
  },
  descriptionText: {
    fontSize: theme.metrics.font.body.size, // ~15px
    lineHeight: theme.metrics.font.body.lineHeight + 2, // ~24px
    color: theme.colors.brand.navy,
    fontWeight: '500' as const,
  },
});