import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';

interface UseSpeechRecognitionOptions {
  onResult: (transcript: string) => void;
  lang?: string;
}

export function useSpeechRecognition({ onResult, lang = 'es-AR' }: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const isSupported =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const stopListening = useCallback(() => {
    if (Platform.OS === 'web' && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // En caso de que ya haya cerrado la conexión
      }
      setIsListening(false);
    }
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) {
      console.warn('El reconocimiento de voz no está soportado en este navegador.');
      return;
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      const recognition = new SpeechRecognition();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          onResult(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Error en reconocimiento de voz:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('No se pudo iniciar el reconocimiento de voz:', err);
      setIsListening(false);
    }
  }, [isSupported, lang, onResult]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Cleanup seguro
        }
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