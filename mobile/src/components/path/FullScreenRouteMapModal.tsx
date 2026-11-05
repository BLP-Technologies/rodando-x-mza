import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { OSMRouteMap } from '@/components/path/OSMRouteMap';

interface FullScreenRouteMapModalProps {
  visible: boolean;
  onClose: () => void;
  origin: { label: string; latitude: number | null; longitude: number | null };
  destination: { label: string; latitude: number | null; longitude: number | null };
  coordinates: [number, number][];
  summaryText?: string;
}

export const FullScreenRouteMapModal: React.FC<FullScreenRouteMapModalProps> = ({
  visible,
  onClose,
  origin,
  destination,
  coordinates,
  summaryText,
}) => {
  const { height } = useWindowDimensions();
  // Restamos aproximadamente el alto de la barra superior (aprox. 70px)
  const mapHeight = Math.max(300, height - 70);


  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal={true}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Barra superior con botón volver y título */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Cerrar vista de mapa completo"
            accessibilityHint="Vuelve a la pantalla de resultados del recorrido"
          >
            <Ionicons name="close" size={26} color="#0D2538" />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {origin.label} → {destination.label}
            </Text>
            {summaryText ? (
              <Text style={styles.headerSubtitle}>{summaryText}</Text>
            ) : null}
          </View>
        </View>

        {/* Mapa ocupando toda la pantalla */}
        <View style={styles.mapContainer}>
          <OSMRouteMap
            origin={origin}
            destination={destination}
            coordinates={coordinates}
            height={mapHeight}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    zIndex: 10,
    elevation: 4,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D2538',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#0D9488',
    fontWeight: '700',
    marginTop: 2,
  },
  mapContainer: {
    flex: 1,
  },
});