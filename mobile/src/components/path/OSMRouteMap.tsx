import React from 'react';
import { View, Platform } from 'react-native';
import { useStyles, Theme } from '@/theme';

let WebView: any = null;
if (Platform.OS !== 'web') {
  try {
    WebView = require('react-native-webview').WebView;
  } catch {
    console.warn('react-native-webview no está instalado. Usá: pnpm expo install react-native-webview');
  }
}

interface Point {
  label: string;
  latitude: number;
  longitude: number;
}

interface OSMRouteMapProps {
  origin: Point;
  destination: Point;
  height?: number;
}

const escapeString = (str: string): string => {
  return (str || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

export const OSMRouteMap = ({
  origin,
  destination,
  height = 240,
}: OSMRouteMapProps) => {
  const { styles } = useStyles(getStyles);

  const safeOriginLabel = escapeString(origin.label);
  const safeDestLabel = escapeString(destination.label);

  // Centro geométrico entre ambos puntos
  const centerLat = (origin.latitude + destination.latitude) / 2;
  const centerLon = (origin.longitude + destination.longitude) / 2;

  // HTML con Leaflet.js y azulejos oficiales de OpenStreetMap
  const leafletHtml = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background-color: #e5e3df; }
          .leaflet-control-attribution { font-size: 8px !important; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          const map = L.map('map', { zoomControl: false }).setView([${centerLat}, ${centerLon}], 14);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          // Marcadores
          const originMarker = L.marker([${origin.latitude}, ${origin.longitude}])
            .addTo(map)
            .bindPopup("<b>${safeOriginLabel}</b>");

          const destMarker = L.marker([${destination.latitude}, ${destination.longitude}])
            .addTo(map)
            .bindPopup("<b>${safeDestLabel}</b>");

          // Trazado de ruta accesible (color Teal / Celeste Rodando)
          const latlngs = [
            [${origin.latitude}, ${origin.longitude}],
            [${centerLat + 0.001}, ${centerLon - 0.001}],
            [${destination.latitude}, ${destination.longitude}]
          ];
          const polyline = L.polyline(latlngs, {
            color: '#00838F',
            weight: 5,
            opacity: 0.85,
            dashArray: '8, 6'
          }).addTo(map);

          // Ajustar zoom para que encuadre ambos puntos
          map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
        </script>
      </body>
    </html>
  `;

  return (
    <View
      style={[styles.container, { height }]}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={`Mapa de ruta trazada desde ${origin.label} hasta ${destination.label}`}
      accessibilityHint="Muestra visualmente el recorrido accesible recomendado entre ambos puntos"
    >
      {Platform.OS === 'web' ? (
        <iframe
          srcDoc={leafletHtml}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title={`Mapa interactivo de recorrido desde ${origin.label} hasta ${destination.label}`}
        />
      ) : WebView ? (
        <WebView
          originWhitelist={['*']}
          source={{ html: leafletHtml }}
          style={styles.webView}
          scrollEnabled={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.fallback} />
      )}
    </View>
  );
};

const getStyles = (theme: Theme) => ({
  container: {
    width: '100%' as const,
    borderRadius: theme.metrics.radius.card,
    overflow: 'hidden' as const,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    backgroundColor: '#e5e3df',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  fallback: {
    flex: 1,
    backgroundColor: theme.colors.surface.card,
  },
});