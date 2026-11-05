import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, Theme } from '@/theme';

interface LogoutConfirmModalProps {
  visible: boolean;
  isGuest?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  visible,
  isGuest = false,
  onConfirm,
  onClose,
}) => {
  const { styles, theme } = useStyles(getStyles);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal={true}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={styles.card}
              accessible={true}
              accessibilityRole="alert"
              accessibilityLabel="Confirmar salida"
            >
              {/* Botón cerrar X */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Cerrar ventana"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={theme.colors.brand.navy} />
              </TouchableOpacity>

              {/* Encabezado con ícono de advertencia */}
              <View style={styles.headerRow}>
                <View style={styles.iconCircle}>
                  <Ionicons name="alert" size={32} color={theme.colors.brand.white} />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.title}>
                    ¿Seguro que querés salir?
                  </Text>
                  <Text style={styles.message}>
                    {isGuest
                      ? 'Vas a volver a la pantalla de bienvenida.'
                      : 'Se cerrará tu sesión activa en este dispositivo.'}
                  </Text>
                </View>
              </View>

              {/* Botones de acción */}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.cancelBtn]}
                  onPress={onClose}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Cancelar"
                >
                  <Text style={styles.cancelBtnText}>CANCELAR</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.confirmBtn]}
                  onPress={onConfirm}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Confirmar salida"
                >
                  <Text style={styles.confirmBtnText}>SALIR</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const getStyles = (theme: Theme) => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 42, 58, 0.45)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: theme.spacing.xl,
  },
  card: {
    width: '100%' as const,
    maxWidth: 340,
    backgroundColor: theme.colors.surface.card,
    borderRadius: theme.metrics.radius.card,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    padding: theme.spacing.xl,
    position: 'relative' as const,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  closeButton: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: theme.spacing.lg,
    paddingRight: theme.spacing.md,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.brand.navy,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginRight: theme.spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: theme.metrics.font.header.size - 6,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
    marginBottom: 4,
  },
  message: {
    fontSize: theme.metrics.font.caption.size + 1,
    color: theme.colors.text.muted,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: theme.metrics.radius.pill,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  cancelBtn: {
    borderWidth: 2,
    borderColor: theme.colors.brand.teal,
    backgroundColor: 'transparent',
  },
  cancelBtnText: {
    color: theme.colors.brand.teal,
    fontWeight: '800' as const,
    fontSize: 13,
  },
  confirmBtn: {
    backgroundColor: theme.colors.brand.orange,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '800' as const,
    fontSize: 13,
  },
});