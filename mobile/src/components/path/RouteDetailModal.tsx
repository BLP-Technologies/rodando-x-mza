import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteCalculationResponse, RouteLeg } from '@/services/routesService';

interface RouteDetailModalProps {
  visible: boolean;
  onClose: () => void;
  routeData: RouteCalculationResponse | null;
  originName?: string;
  destinationName?: string;
  onSaveRoute?: () => void;
}

export const RouteDetailModal: React.FC<RouteDetailModalProps> = ({
  visible,
  onClose,
  routeData,
  originName = 'Origen',
  destinationName = 'Destino',
  onSaveRoute,
}) => {
  if (!routeData || !routeData.found) return null;

  const { summary, legs } = routeData;

  const formatDistance = (meters: number) => {
    if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
    return `${Math.round(meters)} m`;
  };

  // Estimación accesible aproximada (1.2 m/s promedio en silla)
  const estimatedMinutes = Math.max(1, Math.round((summary.meters / 70)));

  const getLevelBadge = (level: RouteLeg['level']) => {
    switch (level) {
      case 'ACCESSIBLE':
        return { label: 'Accesible', bg: '#DCFCE7', color: '#15803D' };
      case 'PARTIAL':
        return { label: 'Parcial', bg: '#FEF9C3', color: '#A16207' };
      case 'NOT_ACCESSIBLE':
        return { label: 'No accesible', bg: '#FEE2E2', color: '#B91C1C' };
      default:
        return { label: 'Sin relevar', bg: '#F1F5F9', color: '#64748B' };
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Detalle del Recorrido</Text>
              <Text style={styles.subtitle}>
                {originName} → {destinationName}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Cerrar detalle de recorrido"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Tarjetas de Resumen */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Ionicons name="time-outline" size={20} color="#0D9488" />
              <Text style={styles.summaryValue}>{estimatedMinutes} min</Text>
              <Text style={styles.summaryLabel}>Tiempo est.</Text>
            </View>

            <View style={styles.summaryCard}>
              <Ionicons name="navigate-outline" size={20} color="#0D9488" />
              <Text style={styles.summaryValue}>{formatDistance(summary.meters)}</Text>
              <Text style={styles.summaryLabel}>Distancia total</Text>
            </View>

            <View style={styles.summaryCard}>
              <Ionicons name="git-commit-outline" size={20} color="#0D9488" />
              <Text style={styles.summaryValue}>{summary.crossings}</Text>
              <Text style={styles.summaryLabel}>Cruces</Text>
            </View>
          </View>

          {/* Advertencia si hay tramos sin relevar */}
          {summary.unverified_meters > 0 && (
            <View style={styles.warningContainer}>
              <Ionicons name="alert-circle-outline" size={20} color="#D97706" />
              <Text style={styles.warningText}>
                {formatDistance(summary.unverified_meters)} de este trayecto aún no cuentan con verificación comunitaria.
              </Text>
            </View>
          )}

          {/* Desglose paso a paso */}
          <Text style={styles.sectionHeader}>Tramos e instrucciones</Text>
          <ScrollView style={styles.legsScroll} showsVerticalScrollIndicator={false}>
            {legs.map((leg, index) => {
              const isSidewalk = leg.element_kind === 'sidewalk';
              const badge = getLevelBadge(leg.level);

              return (
                <View key={`${leg.element_id}-${index}`} style={styles.legCard}>
                  <View style={styles.legIconContainer}>
                    <Ionicons
                      name={isSidewalk ? 'footsteps-outline' : 'git-compare-outline'}
                      size={20}
                      color={isSidewalk ? '#0F172A' : '#E0533C'}
                    />
                    {index < legs.length - 1 && <View style={styles.timelineConnector} />}
                  </View>

                  <View style={styles.legDetails}>
                    <View style={styles.legTopRow}>
                      <Text style={styles.legTitle}>
                        {isSidewalk ? 'Tramo de vereda' : 'Cruce de calle'}
                      </Text>
                      <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.badgeText, { color: badge.color }]}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.legSub}>
                      {formatDistance(leg.meters)}
                      {leg.is_verified ? ' • Verificado' : ' • No verificado'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Acciones */}
          {onSaveRoute && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={onSaveRoute}
                accessibilityRole="button"
                accessibilityLabel="Guardar este recorrido"
              >
                <Ionicons name="bookmark-outline" size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Guardar Recorrido</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#B45309',
    lineHeight: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  legsScroll: {
    maxHeight: 280,
  },
  legCard: {
    flexDirection: 'row',
    minHeight: 52,
  },
  legIconContainer: {
    alignItems: 'center',
    width: 32,
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    backgroundColor: '#CBD5E1',
    marginVertical: 4,
  },
  legDetails: {
    flex: 1,
    paddingLeft: 8,
    paddingBottom: 16,
  },
  legTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  legSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  footer: {
    marginTop: 14,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0D9488',
    height: 48,
    borderRadius: 12,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});