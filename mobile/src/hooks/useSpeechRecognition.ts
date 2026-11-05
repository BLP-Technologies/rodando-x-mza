import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';

// Importación condicional o segura para entornos nativos
let Voice: any = null;
if (Platform.OS !== 'web') {
  try {
    Voice = require('@react-native-voice/voice').default;
  } catch (error) {
    console.warn('No se pudo cargar @react-native-voice/voice:', error);
  }
}

interface UseSpeechRecognitionOptions {
  onResult: (transcript: string) => void;
  lang?: string;
}

export function useSpeechRecognition({ onResult, lang = 'es-AR' }: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const isSupported =
    Platform.OS === 'web'
      ? typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
      : Voice !== null;
// Manejo de eventos nativos con @react-native-voice/voice
  useEffect(() => {
    if (Platform.OS === 'web' || !Voice) return;

    Voice.onSpeechStart = () => {
      setIsListening(true);
    };

    Voice.onSpeechEnd = () => {
      setIsListening(false);
    };

    Voice.onSpeechError = (e: any) => {
      console.warn('Error en reconocimiento nativo:', e?.error);
      setIsListening(false);
    };

    Voice.onSpeechResults = (e: any) => {
      const texts = e.value;
      if (texts && texts.length > 0) {
        onResult(texts[0]);
      }
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners).catch(() => {});
    };
  }, [onResult]);


// Detener escucha
  const stopListening = useCallback(async () => {
    if (Platform.OS === 'web') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
    } else if (Voice) {
      try {
        await Voice.stop();
      } catch (err) {
        console.warn('Error deteniendo escucha nativa:', err);
      } finally {
        setIsListening(false);
      }
    }
  }, []);

// Iniciar escucha
  const startListening = useCallback(async () => {
    if (!isSupported) {
      console.warn('El reconocimiento de voz no está disponible en esta plataforma.');
      return;
    }

    if (Platform.OS === 'web') {
      try {
        const SpeechRecognition =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        const recognition = new SpeechRecognition();
        recognition.lang = lang;
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);

        recognition.onresult = (event: any) => {
          const transcript = event.results?.[0]?.[0]?.transcript;
          if (transcript) {
            onResult(transcript);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.error('Error iniciando reconocimiento web:', err);
        setIsListening(false);
      }
    } else if (Voice) {
      try {
        // Formato estándar para Android (ej: es-AR o es_AR)
        const locale = lang.replace('-', '_');
        await Voice.start(locale);
      } catch (err) {
        console.error('Error iniciando reconocimiento nativo:', err);
        setIsListening(false);
      }
    }
  }, [isSupported, lang, onResult]);

  // Limpieza en desmontaje
  useEffect(() => {
    return () => {
      if (Platform.OS === 'web' && recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
  };
}