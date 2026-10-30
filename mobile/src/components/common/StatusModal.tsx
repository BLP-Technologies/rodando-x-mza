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

export type StatusType = 'success' | 'error' | 'warning';

interface StatusModalProps {
  visible: boolean;
  type?: StatusType;
  title: string;
  message?: string;
  onClose: () => void;
  confirmText?: string;
  onConfirm?: () => void;
  cancelText?: string;
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
  layout = 'row',
  buttonDirection = 'column',
  showCloseButton = true,
}: StatusModalProps) => {
  const { styles, theme } = useStyles(getStyles);

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
  const isRowLayout = layout === 'row';


  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              {/* Botón X de cierre */}
              {showCloseButton && (
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar modal"
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.brand.navy}
                />
              </TouchableOpacity>
              )}

            {/* Contenedor principal: Fila horizontal o Columna centrada */}
              <View style={isRowLayout ? styles.rowHeader : styles.centerHeader}>
                {/* Ícono circular */}
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
                {/* Textos */}
                <View style={isRowLayout ? styles.rowTextContainer : styles.centerTextContainer}>
                  <Text 
                    style={[
                      styles.title,
                      isRowLayout && styles.titleLeft,
                    ]}
                  >
                    {title}
                  </Text>
                {message ? (
                  <Text 
                    style={[
                      styles.message,
                      isRowLayout && styles.messageLeft,
                    ]}  
                  >
                    {message}
                  </Text>
                ) : null}
                  
                </View> 
              </View>  


            {/* Botones de confirmación (si se especifican) */}
              {onConfirm && (
                <View style={styles.buttonGroupRow}>
                  <PrimaryButton
                    title={confirmText || 'CONFIRMAR'}
                    variant="orange"
                    onPress={onConfirm}
                    style={styles.halfBtn}
                  />
                  <PrimaryButton
                    title={cancelText || 'CANCELAR'}
                    variant="outline"
                    onPress={onClose}
                    style={styles.halfBtn}
                  />
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
    paddingVertical: theme.spacing.xxl,
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
    width: '100%' as const,
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  halfBtn: {
    minWidth: 105,
    minHeight: theme.metrics.minTouch,
  },
});