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

export type StatusType = 'success' | 'error';

interface StatusModalProps {
  visible: boolean;
  type?: StatusType;
  title: string;
  message: string;
  onClose: () => void;
}

export const StatusModal = ({
  visible,
  type = 'success',
  title,
  message,
  onClose,
}: StatusModalProps) => {
  const { styles, theme } = useStyles(getStyles);

  const isSuccess = type === 'success';
  const iconColor = isSuccess ? theme.colors.brand.teal : theme.colors.state.danger;
  const iconName = isSuccess ? 'checkmark' : 'alert';

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
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cerrar modal"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.brand.navy}
                />
              </TouchableOpacity>

              {/* Ícono de Estado */}
              <View
                style={[
                  styles.iconCircle,
                  { borderColor: iconColor },
                ]}
              >
                <Ionicons name={iconName} size={36} color={iconColor} />
              </View>

              {/* Textos */}
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>
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
    backgroundColor: 'rgba(23, 42, 58, 0.45)', // Overlay semitransparente con el navy institucional
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: theme.spacing.xl, // 20
  },
  card: {
    width: '100%' as const,
    maxWidth: 340,
    backgroundColor: theme.colors.surface.card,
    borderRadius: theme.metrics.radius.card, // 20
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    paddingVertical: theme.spacing.xxl, // 24
    paddingHorizontal: theme.spacing.xl, // 20
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
  title: {
    fontSize: theme.metrics.font.title.size - 2, // ~18-20
    lineHeight: theme.metrics.font.title.lineHeight,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
    textAlign: 'center' as const,
    marginBottom: theme.spacing.xs,
  },
  message: {
    fontSize: theme.metrics.font.body.size - 1, // ~15
    lineHeight: theme.metrics.font.body.lineHeight,
    color: theme.colors.brand.navy,
    textAlign: 'center' as const,
    fontWeight: '500' as const,
  },
});