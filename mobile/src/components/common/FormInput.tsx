import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, Theme } from '@/theme';

interface FormInputProps extends TextInputProps {
  label?: string;
  containerStyle?: ViewStyle;
  enableVoiceInput?: boolean;
  onVoiceInput?: () => void;
  isListening?: boolean;
}

export const FormInput = ({
  label,
  containerStyle,
  multiline = false,
  numberOfLines = 1,
  enableVoiceInput = false,
  onVoiceInput,
  isListening = false,
  style,
  onFocus,
  onBlur,
  ...rest
}: FormInputProps) => {
  const { styles, theme } = useStyles(getStyles);
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus: TextInputProps['onFocus'] = (e) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur: TextInputProps['onBlur'] = (e) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const handleVoicePress = () => {
    if (onVoiceInput) {
      onVoiceInput();
    } else {
      console.log(`Dictado por voz solicitado para: ${label || 'input'}`);
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text
          style={styles.label}
          accessible={true}
          accessibilityRole="header"
        >
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputWrapper,
          multiline && styles.multilineWrapper,
          isFocused && styles.inputWrapperFocused,
          isListening && styles.inputWrapperListening,
        ]}
      >
        <TextInput
          style={[styles.input, multiline && styles.multilineInput, style]}
          placeholderTextColor={theme.colors.text.muted}
          multiline={multiline}
          numberOfLines={numberOfLines}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={handleFocus}
          onBlur={handleBlur}
          accessible={true}
          accessibilityLabel={label || rest.placeholder || rest.accessibilityLabel}
          accessibilityState={{ disabled: rest.editable === false }}
          {...rest}
        />

        {enableVoiceInput && (
          <TouchableOpacity
            style={[
              styles.voiceButton,
              multiline && styles.voiceButtonMultiline,
              isListening && styles.voiceButtonListening,
            ]}
            onPress={handleVoicePress}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={
              isListening
                ? 'Detener dictado por voz'
                : `Dictar por voz para ${label || 'este campo'}`
            }
            accessibilityHint={
              isListening
                ? 'Finaliza la captura de voz e ingresa el texto dictado'
                : 'Activa el micrófono para dictar el contenido de este campo'
            }
            accessibilityState={{ selected: isListening }}
            accessibilityLiveRegion="polite"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isListening ? 'mic' : 'mic-outline'}
              size={22}
              color={
                isListening
                  ? theme.colors.state.danger
                  : theme.colors.brand.teal
              }
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const getStyles = (theme: Theme) => ({
  container: {
    marginBottom: theme.spacing.xl,
  },
  label: {
    fontSize: theme.metrics.font.caption.size,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase' as const,
  },
  inputWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: theme.colors.surface.card,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    borderRadius: theme.metrics.radius.card,
    minHeight: 48,
    paddingRight: theme.spacing.xs,
  },
  inputWrapperFocused: {
    borderColor: theme.colors.brand.teal,
  },
  inputWrapperListening: {
    borderColor: theme.colors.state.danger,
    backgroundColor: '#FFF5F5',
  },
  multilineWrapper: {
    alignItems: 'flex-start' as const,
    minHeight: 110,
    paddingTop: theme.spacing.xs,
  },
  input: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    fontSize: theme.metrics.font.body.size,
    color: theme.colors.text.main,
  },
  multilineInput: {
    minHeight: 100,
    paddingTop: theme.spacing.sm,
  },
  voiceButton: {
    width: theme.metrics.minTouch, // 48px para cumplir el área táctil mínima accesible
    height: theme.metrics.minTouch,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  voiceButtonMultiline: {
    alignSelf: 'flex-start' as const,
    marginTop: 2,
  },
  voiceButtonListening: {
    transform: [{ scale: 1.1 }],
  },
});