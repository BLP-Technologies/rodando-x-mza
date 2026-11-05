import React, { useMemo, useEffect, useRef } from 'react';
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

export interface OSMRouteMapProps {
  origin: { label: string; latitude: number | null; longitude: number | null };
  destination: { label: string; latitude: number | null; longitude: number | null };
  coordinates: [number, number][]; // [lat, lon]
  height?: number;
  userLocation?: { latitude: number; longitude: number } | null;
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
  coordinates,
  height = 240,
  userLocation,
}: OSMRouteMapProps) => {
  const { styles } = useStyles(getStyles);
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const origLat = origin.latitude ?? -32.8895;
  const origLon = origin.longitude ?? -68.8458;
  const destLat = destination.latitude ?? -32.8929;
  const destLon = destination.longitude ?? -68.8420;

  const safeOriginLabel = escapeString(origin.label);
  const safeDestLabel = escapeString(destination.label);

  const centerLat = (origLat + destLat) / 2;
  const centerLon = (origLon + destLon) / 2;

  const routePolylineCoords = useMemo(() => {
    if (coordinates && coordinates.length > 0) {
      return JSON.stringify(coordinates);
    }
    return JSON.stringify([
      [origLat, origLon],
      [destLat, destLon],
    ]);
  }, [coordinates, origLat, origLon, destLat, destLon]);

  // Transmitir posición al mapa sin recargar la vista
  useEffect(() => {
    if (userLocation?.latitude && userLocation?.longitude) {
      const payload = JSON.stringify({
        type: 'UPDATE_USER_LOCATION',
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      });

      if (Platform.OS === 'web' && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(payload, '*');
      } else if (webViewRef.current) {
        webViewRef.current.postMessage(payload);
      }
    }
  }, [userLocation?.latitude, userLocation?.longitude]);

  const leafletHtml = useMemo(
    () => `
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
          .user-pulse-marker {
            width: 18px;
            height: 18px;
            background-color: #0284C7;
            border: 3px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 0 8px rgba(2, 132, 199, 0.7);
          }
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

          // Marcadores origen y destino
          L.marker([${origLat}, ${origLon}])
            .addTo(map)
            .bindPopup("<b>${safeOriginLabel}</b>");

          L.marker([${destLat}, ${destLon}])
            .addTo(map)
            .bindPopup("<b>${safeDestLabel}</b>");

          // Traza de recorrido accesible
          const latlngs = ${routePolylineCoords};
          const polyline = L.polyline(latlngs, {
            color: '#00838F',
            weight: 5,
            opacity: 0.85
          }).addTo(map);

          map.fitBounds(polyline.getBounds(), { padding: [35, 35] });

          // Marcador dinámico del usuario
          let userMarker = null;
          const userIcon = L.divIcon({
            className: 'user-pulse-container',
            html: '<div class="user-pulse-marker"></div>',
            iconSize: [18, 18],
            iconAnchor: [9, 9]
          });

          function handleLocationMessage(payloadText) {
            try {
              const data = typeof payloadText === 'string' ? JSON.parse(payloadText) : payloadText;
              if (data && data.type === 'UPDATE_USER_LOCATION') {
                const targetPos = [data.latitude, data.longitude];
                if (!userMarker) {
                  userMarker = L.marker(targetPos, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
                } else {
                  userMarker.setLatLng(targetPos);
                }
              }
            } catch (err) {}
          }

          // Escuchar eventos según la plataforma (Web, Android, iOS)
          window.addEventListener('message', function(event) {
            handleLocationMessage(event.data);
          });
          document.addEventListener('message', function(event) {
            handleLocationMessage(event.data);
          });
        </script>
      </body>
    </html>
  `,
    [centerLat, centerLon, origLat, origLon, destLat, destLon, safeOriginLabel, safeDestLabel, routePolylineCoords]
  );

  return (
    <View
      style={[styles.container, { height }]}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={`Mapa de ruta trazada desde ${origin.label} hasta ${destination.label}`}
      accessibilityHint="Muestra visualmente el recorrido accesible recomendado y tu ubicación actual si está activa"
    >
      {Platform.OS === 'web' ? (
        <iframe
          ref={iframeRef}
          srcDoc={leafletHtml}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title={`Mapa interactivo de recorrido desde ${origin.label} hasta ${destination.label}`}
        />
      ) : WebView ? (
        <WebView
          ref={webViewRef}
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