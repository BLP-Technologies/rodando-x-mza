import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, Theme } from '@/theme';
import { PrimaryButton } from './PrimaryButton';

export type StatusType = 'success' | 'error' | 'warning' | 'auth';

interface StatusModalProps {
  visible: boolean;
  type?: StatusType;
  title: string;
  message?: string;
  onClose: () => void;
  confirmText?: string;
  onConfirm?: () => void;
  cancelText?: string;
  secondaryText?: string;
  onSecondary?: () => void;
  dismissText?: string;
  layout?: 'center' | 'row'; 
  buttonDirection?: 'column' | 'row';
  showCloseButton?: boolean;
}

export const StatusModal = ({
  visible,
  type = 'success',
  title,
  message,
  onClose,
  confirmText,
  onConfirm,
  cancelText,
  secondaryText,
  onSecondary,
  dismissText,
  layout = 'row',
  buttonDirection = 'column',
  showCloseButton = true,
}: StatusModalProps) => {
  const { styles, theme } = useStyles(getStyles);

  const isAuthModal = type === 'auth';

  const getIconDetails = () => {
    switch (type) {
      case 'warning':
        return {
          color: theme.colors.brand.orange,
          bgColor: theme.colors.brand.navy,
          iconColor: theme.colors.text.inverse,
          name: 'alert' as const,
        };
      case 'error':
        return {
          color: theme.colors.state.danger || '#991B1B',
          bgColor: theme.colors.surface.card,
          iconColor: theme.colors.state.danger || '#991B1B',
          name: 'close' as const,
        };
      case 'success':
      default:
        return {
          color: theme.colors.brand.teal,
          bgColor: theme.colors.surface.card,
          iconColor: theme.colors.brand.teal,
          name: 'checkmark' as const,
        };
    }
  };

  const { color: borderColor, bgColor, iconColor, name: iconName } = getIconDetails();
  const isRowLayout = !isAuthModal && layout === 'row';

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
              accessibilityLabel={`${title}. ${message || ''}`}
            >
              {/* Botón X de cierre (oculto en modales de autenticación) */}
              {showCloseButton && !isAuthModal && (
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar ventana de alerta"
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={theme.colors.brand.navy}
                  />
                </TouchableOpacity>
              )}

              {/* Contenedor principal: Ícono + Textos */}
              <View
                style={
                  isAuthModal
                    ? styles.authHeader
                    : isRowLayout
                    ? styles.rowHeader
                    : styles.centerHeader
                }
              >
                {/* Ícono circular solo si no es modal auth */}
                {!isAuthModal && (
                  <View 
                    style={[
                      styles.iconCircle, 
                      { 
                        borderColor: iconColor, 
                        backgroundColor: bgColor,
                      },
                      isRowLayout && styles.iconCircleRow,
                    ]}
                  >
                    <Ionicons name={iconName} size={36} color={iconColor} />
                  </View>
                )}

                {/* Textos */}
                <View
                  style={
                    isAuthModal
                      ? styles.authTextContainer
                      : isRowLayout
                      ? styles.rowTextContainer
                      : styles.centerTextContainer
                  }
                >
                  <Text 
                    style={[
                      styles.title,
                      (isRowLayout || isAuthModal) && styles.titleLeft,
                    ]}
                  >
                    {title}
                  </Text>
                  {message ? (
                    <Text 
                      style={[
                        styles.message,
                        (isRowLayout || isAuthModal) && styles.messageLeft,
                      ]}  
                    >
                      {message}
                    </Text>
                  ) : null}
                </View> 
              </View>  

              {/* Flujo Auth (3 opciones en columna): Crear Cuenta + Iniciar Sesión + Ahora no */}
              {isAuthModal && (
                <View style={styles.authButtonsContainer}>
                  {onConfirm && (
                    <PrimaryButton
                      title={confirmText || 'CREAR CUENTA'}
                      variant="orange"
                      onPress={onConfirm}
                      accessibilityLabel={confirmText || 'CREAR CUENTA'}
                      accessibilityHint="Abre la pantalla para registrar una cuenta nueva"
                    />
                  )}

                  {onSecondary && (
                    <PrimaryButton
                      title={secondaryText || 'INICIAR SESIÓN'}
                      variant="outline"
                      onPress={onSecondary}
                      accessibilityLabel={secondaryText || 'INICIAR SESIÓN'}
                      accessibilityHint="Abre la pantalla de inicio de sesión"
                    />
                  )}

                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.dismissButton}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={dismissText || 'Ahora no'}
                    accessibilityHint="Cierra este aviso y vuelve a la pantalla previa"
                  >
                    <Text style={styles.dismissText}>
                      {dismissText || 'Ahora no'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Botones habituales de confirmación */}
              {!isAuthModal && onConfirm && (
                <View
                  style={
                    buttonDirection === 'row'
                      ? styles.buttonGroupRow
                      : styles.buttonGroupColumn
                  }
                >
                  <PrimaryButton
                    title={confirmText || 'CONFIRMAR'}
                    variant="orange"
                    onPress={onConfirm}
                    style={buttonDirection === 'row' ? styles.halfBtn : undefined}
                  />
                  {cancelText && (
                    <PrimaryButton
                      title={cancelText}
                      variant="outline"
                      onPress={onClose}
                      style={buttonDirection === 'row' ? styles.halfBtn : undefined}
                    />
                  )}
                </View>
              )}
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
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center' as const,
    position: 'relative' as const,
    shadowColor: theme.colors.brand.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute' as const,
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    zIndex: 10,
  },
  rowHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingRight: theme.spacing.lg,
  },
  centerHeader: {
    alignItems: 'center' as const,
  },
  authHeader: {
    width: '100%' as const,
    alignItems: 'flex-start' as const,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: theme.spacing.lg,
    marginTop: theme.spacing.xs,
  },
  iconCircleRow: {
    marginRight: theme.spacing.lg,
  },
  rowTextContainer: {
    flex: 1,
  },
  centerTextContainer: {
    alignItems: 'center' as const,
    marginTop: theme.spacing.md,
  },
  authTextContainer: {
    width: '100%' as const,
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.metrics.font.title.size - 2,
    lineHeight: theme.metrics.font.title.lineHeight,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
    textAlign: 'center' as const,
    marginBottom: theme.spacing.xs,
  },
  titleLeft: {
    textAlign: 'left' as const,
  },
  message: {
    fontSize: theme.metrics.font.body.size - 1,
    lineHeight: theme.metrics.font.body.lineHeight,
    color: theme.colors.brand.navy,
    textAlign: 'center' as const,
    fontWeight: '500' as const,
    marginBottom: theme.spacing.sm,
  },
  messageLeft: {
    textAlign: 'left' as const,
  },
  buttonGroupRow: {
    flexDirection: 'row' as const,
    width: '100%' as const,
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  buttonGroupColumn: {
    width: '100%' as const,
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  halfBtn: {
    flex: 1,
    minHeight: theme.metrics.minTouch,
  },
  authButtonsContainer: {
    width: '100%' as const,
    gap: theme.spacing.md,
  },
  dismissButton: {
    alignSelf: 'center' as const,
    paddingVertical: theme.spacing.xs,
    minHeight: theme.metrics.minTouch,
    justifyContent: 'center' as const,
  },
  dismissText: {
    fontSize: theme.metrics.font.body.size,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
    textDecorationLine: 'underline' as const,
  },
});