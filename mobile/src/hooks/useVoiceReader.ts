import { useCallback } from 'react';
import * as Speech from 'expo-speech';
import { useAccessibility } from '@/theme';

export const useVoiceReader = () => {
  const { preferences } = useAccessibility();

  /**
   * Lee un texto en voz alta si la opción está habilitada.
   * Si ya hay algo reproduciéndose, lo detiene y reproduce el nuevo mensaje.
   */
  const speak = useCallback(
    (text: string) => {
      if (!preferences.screenReaderEnabled || !text.trim()) return;

      Speech.stop();
      Speech.speak(text, {
        language: 'es-AR', // Español de Argentina (con fallback automático a español general)
        pitch: 1.0,
        rate: 0.90, // Velocidad apenas pausada para mayor claridad
      });
    },
    [preferences.screenReaderEnabled]
  );

  const stop = useCallback(() => {
    Speech.stop();
  }, []);

  return {
    speak,
    stop,
    isEnabled: preferences.screenReaderEnabled,
  };
};