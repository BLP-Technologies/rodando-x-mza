import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, Theme } from '@/theme';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { reverseGeocode } from '@/services/geocoding';

interface MapLocationPickerModalProps {
  visible: boolean;
  initialLatitude?: number;
  initialLongitude?: number;
  onConfirm: (data: { latitude: number; longitude: number; address: string }) => void;
  onClose: () => void;
}

export const MapLocationPickerModal = ({
  visible,
  initialLatitude = -32.8895, // Mendoza Centro por defecto
  initialLongitude = -68.8458,
  onConfirm,
  onClose,
}: MapLocationPickerModalProps) => {
  const { styles, theme } = useStyles(getStyles);

  const [currentCoords, setCurrentCoords] = useState<{
    latitude: number;
    longitude: number;
  }>({
    latitude: initialLatitude,
    longitude: initialLongitude,
  });

  const [isResolving, setIsResolving] = useState(false);

  // Sincronizar coordenadas cuando el modal se vuelve a abrir o cambian las iniciales
  useEffect(() => {
    if (visible) {
      setCurrentCoords({
        latitude: initialLatitude,
        longitude: initialLongitude,
      });
    }
  }, [visible, initialLatitude, initialLongitude]);

  // Escuchar mensajes en entorno Web
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleWebMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'CENTER_CHANGED') {
          setCurrentCoords({
            latitude: data.latitude,
            longitude: data.longitude,
          });
        }
      } catch (e) {
        // Ignorar mensajes que no sean del mapa
      }
    };

    window.addEventListener('message', handleWebMessage);
    return () => window.removeEventListener('message', handleWebMessage);
  }, []);

  // HTML con Leaflet configurado para notificar el centro cada vez que el usuario mueve el mapa
  const leafletHTML = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body, html, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #E5E7EB; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          const map = L.map('map', {
            zoomControl: false,
            attributionControl: false
          }).setView([${initialLatitude}, ${initialLongitude}], 16);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
          }).addTo(map);

          map.on('moveend', function() {
            const center = map.getCenter();
            const payload = JSON.stringify({
              type: 'CENTER_CHANGED',
              latitude: center.lat,
              longitude: center.lng
            });

            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(payload);
            }
            if (window.parent) {
              window.parent.postMessage(payload, '*');
            }
          });
        </script>
      </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'CENTER_CHANGED') {
        setCurrentCoords({
          latitude: data.latitude,
          longitude: data.longitude,
        });
      }
    } catch (e) {
      console.error('Error parseando mensaje del mapa:', e);
    }
  };

  const handleConfirmLocation = async () => {
    try {
      setIsResolving(true);
      const resolvedAddress = await reverseGeocode(
        currentCoords.latitude,
        currentCoords.longitude
      );

      onConfirm({
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
        address:
          resolvedAddress ||
          `${currentCoords.latitude.toFixed(5)}, ${currentCoords.longitude.toFixed(5)}`,
      });
      onClose();
    } catch (err) {
      console.error('Error al resolver la dirección seleccionada:', err);
      onConfirm({
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
        address: `${currentCoords.latitude.toFixed(5)}, ${currentCoords.longitude.toFixed(5)}`,
      });
      onClose();
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal={true}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Cabecera del selector */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Cerrar selector de mapa"
            accessibilityHint="Descarta los cambios y regresa a la pantalla anterior"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={26} color={theme.colors.brand.navy} />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text
              style={styles.headerTitle}
              accessible={true}
              accessibilityRole="header"
            >
              Marcar en el mapa
            </Text>
            <Text style={styles.headerSubtitle}>
              Mové el mapa hasta situar el pin sobre la barrera
            </Text>
          </View>
        </View>

        {/* Contenedor del Mapa con Pin Central */}
        <View
          style={styles.mapContainer}
          accessible={true}
          accessibilityLabel="Mapa interactivo para marcar la ubicación del reporte. Arrastra el mapa para situar el pin sobre la barrera."
        >
          {Platform.OS === 'web' ? (
            <iframe
              srcDoc={leafletHTML}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              title="Selector de ubicación en mapa"
            />
          ) : (
            <WebView
              originWhitelist={['*']}
              source={{ html: leafletHTML }}
              onMessage={handleMessage}
              style={styles.webView}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
          )}

          {/* Marcador fijo en el centro */}
          <View
            pointerEvents="none"
            style={styles.markerFixed}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden={true}
          >
            <Ionicons name="location" size={42} color={theme.colors.brand.teal} />
            <View style={styles.pinShadow} />
          </View>
        </View>

        {/* Barra inferior para confirmar */}
        <View style={styles.footer}>
          <PrimaryButton
            title={isResolving ? 'OBTENIENDO DIRECCIÓN...' : 'CONFIRMAR ESTA UBICACIÓN'}
            onPress={handleConfirmLocation}
            disabled={isResolving}
            loading={isResolving}
            accessibilityLabel="Confirmar esta ubicación seleccionada"
            accessibilityHint="Guarda las coordenadas marcadas en el centro del mapa y resuelve la dirección"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const getStyles = (theme: Theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.surface.welcome,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.default,
  },
  closeButton: {
    padding: theme.spacing.xs,
    marginRight: theme.spacing.sm,
    minWidth: theme.metrics.minTouch - 4,
    minHeight: theme.metrics.minTouch - 4,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: theme.metrics.font.header.size - 6,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
  },
  headerSubtitle: {
    fontSize: theme.metrics.font.caption.size,
    color: theme.colors.text.muted,
  },
  mapContainer: {
    flex: 1,
    position: 'relative' as const,
  },
  webView: {
    flex: 1,
  },
  markerFixed: {
    position: 'absolute' as const,
    top: '50%' as const,
    left: '50%' as const,
    marginLeft: -21,
    marginTop: -42,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  pinShadow: {
    width: 8,
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginTop: -2,
  },
  footer: {
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.default,
  },
});