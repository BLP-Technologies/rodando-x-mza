import React, { useState } from 'react';
import {
  View,
  Platform,
  Image,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, Theme } from '@/theme';

let WebView: any = null;
if (Platform.OS !== 'web') {
  try {
    WebView = require('react-native-webview').WebView;
  } catch {
    // Fallback si no está instalado react-native-webview
  }
}

interface YouTubePlayerViewProps {
  videoId: string;
  title: string;
}

export const YouTubePlayerView = ({ videoId, title }: YouTubePlayerViewProps) => {
  const { styles, theme } = useStyles(getStyles);
  const [isPlaying, setIsPlaying] = useState(false);

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  const handleOpenYouTube = () => {
    Linking.openURL(videoUrl).catch(() => {
      console.warn('No se pudo abrir el enlace de YouTube');
    });
  };

  // Render en Web mediante iframe embebido
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?rel=0`}
          title={`Reproductor de video: ${title}`}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </View>
    );
  }

  // Render en móvil: Si el usuario tocó play y tenemos WebView, embebemos el reproductor
  if (isPlaying && WebView) {
    return (
      <View
        style={styles.container}
        accessible={true}
        accessibilityLabel={`Reproduciendo video tutorial: ${title}`}
      >
        <WebView
          source={{ uri: embedUrl }}
          style={styles.webView}
          allowsFullscreenVideo
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <ActivityIndicator
              size="large"
              color={theme.colors.brand.orange}
              style={styles.loader}
              accessible={true}
              accessibilityLabel="Cargando reproductor de video"
            />
          )}
        />
      </View>
    );
  }

  // Vista previa con Thumbnail + Botón Play de YouTube
  return (
    <View style={styles.container}>
      <Image
        source={{ uri: thumbnailUrl }}
        style={styles.thumbnail}
        resizeMode="cover"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden={true}
      />
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.playButton}
          onPress={() => (WebView ? setIsPlaying(true) : handleOpenYouTube())}
          activeOpacity={0.8}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Reproducir video de ${title}`}
          accessibilityHint="Comienza la reproducción del video explicativo dentro de la aplicación"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="play" size={32} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Badge inferior para abrir en YouTube */}
        <TouchableOpacity
          style={styles.youtubeBadge}
          onPress={handleOpenYouTube}
          activeOpacity={0.8}
          accessible={true}
          accessibilityRole="link"
          accessibilityLabel="Abrir video en YouTube"
          accessibilityHint="Abre la aplicación de YouTube o el navegador externo para ver el video completo"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="logo-youtube" size={16} color="#FF0000" />
          <View
            style={styles.badgeTextWrapper}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden={true}
          >
            <Ionicons name="play-outline" size={12} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const getStyles = (theme: Theme) => ({
  container: {
    width: '100%' as const,
    height: 220,
    borderRadius: theme.metrics.radius.card,
    overflow: 'hidden' as const,
    backgroundColor: '#000000',
    position: 'relative' as const,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
  },
  thumbnail: {
    width: '100%' as const,
    height: '100%' as const,
  },
  overlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  playButton: {
    width: theme.metrics.minTouch + 20,
    height: theme.metrics.minTouch,
    borderRadius: theme.metrics.radius.card - 6,
    backgroundColor: '#E62117',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  youtubeBadge: {
    position: 'absolute' as const,
    bottom: 12,
    right: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(28, 28, 28, 0.85)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.spacing.xs + 2,
    gap: theme.spacing.xs,
  },
  badgeTextWrapper: {
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  webView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loader: {
    position: 'absolute' as const,
    top: '45%' as const,
    left: '45%' as const,
  },
});