import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Reconocimiento de voz, en un solo hook.
 *
 * En **web** usa la Web Speech API del navegador (`SpeechRecognition`). En **nativo** usa
 * `expo-speech-recognition`, que envuelve el reconocedor de Android y el de iOS.
 *
 * Antes usaba `@react-native-voice/voice`, que quedó archivado y cuyo `build.gradle`
 * (de la era de AGP 3) ya no compila con el toolchain de Expo SDK 57. La interfaz de
 * abajo no cambió a propósito: `FormInput` y las pantallas consumen este hook y no saben
 * qué librería hay debajo.
 */

/** Lo que devuelve `addListener` para desuscribirse. */
type Subscription = { remove: () => void };

/** El resultado del reconocedor: con `interimResults: false` siempre llega final. */
type SpeechResultEvent = { isFinal: boolean; results: { transcript: string }[] };

/** El error del reconocedor: `not-allowed`, `no-speech`, `network`, `busy`... */
type SpeechErrorEvent = { error: string; message?: string };

/** La parte del módulo nativo que este hook usa; el resto no hace falta. */
type NativeSpeech = {
  start(options: { lang: string; interimResults: boolean; continuous: boolean }): void;
  stop(): void;
  abort(): void;
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  addListener(event: 'start' | 'end', listener: () => void): Subscription;
  addListener(event: 'result', listener: (event: SpeechResultEvent) => void): Subscription;
  addListener(event: 'error', listener: (event: SpeechErrorEvent) => void): Subscription;
};

// Se carga sólo en nativo: en web el hook sigue usando la API del navegador, y en un
// entorno sin el módulo nativo (Expo Go) queda en `null` en vez de romper el import.
let ExpoSpeechRecognition: NativeSpeech | null = null;
if (Platform.OS !== 'web') {
  try {
    ExpoSpeechRecognition = require('expo-speech-recognition')
      .ExpoSpeechRecognitionModule as NativeSpeech;
  } catch (error) {
    console.warn('No se pudo cargar expo-speech-recognition:', error);
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
      : ExpoSpeechRecognition !== null;

  // Eventos del reconocedor nativo. Cada `addListener` devuelve su desuscripción, así
  // que el cleanup las suelta todas juntas: sin esto, cada montaje dejaría un listener
  // vivo apuntando a un `setState` de un componente que ya no está.
  useEffect(() => {
    if (Platform.OS === 'web' || !ExpoSpeechRecognition) return;
    const speech = ExpoSpeechRecognition;

    const subscriptions = [
      speech.addListener('start', () => {
        setIsListening(true);
      }),
      speech.addListener('end', () => {
        setIsListening(false);
      }),
      speech.addListener('error', (event) => {
        console.warn('Error en reconocimiento nativo:', event.error);
        setIsListening(false);
      }),
      speech.addListener('result', (event) => {
        const transcript = event.results[0]?.transcript;
        if (transcript) {
          onResult(transcript);
        }
      }),
    ];

    return () => {
      for (const subscription of subscriptions) {
        subscription.remove();
      }
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
    } else if (ExpoSpeechRecognition) {
      try {
        ExpoSpeechRecognition.stop();
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
    } else if (ExpoSpeechRecognition) {
      try {
        // El permiso se pide antes de arrancar: si el usuario lo niega, el reconocedor
        // no emite ningún evento y `isListening` se quedaría mintiendo.
        const permission = await ExpoSpeechRecognition.requestPermissionsAsync();
        if (!permission.granted) {
          console.warn('Permiso de micrófono rechazado: no se puede dictar por voz.');
          return;
        }

        ExpoSpeechRecognition.start({
          // BCP-47 (`es-AR`), el formato que documenta la librería. La librería vieja
          // quería `es_AR` para Android; convertir acá rompería el idioma.
          lang,
          // Un solo transcript final, como antes: sin parciales ni dictado continuo.
          interimResults: false,
          continuous: false,
        });
      } catch (err) {
        console.error('Error iniciando reconocimiento nativo:', err);
        setIsListening(false);
      }
    }
  }, [isSupported, lang, onResult]);

  // Limpieza en desmontaje: se corta el reconocimiento para no dejar el micrófono tomado.
  useEffect(() => {
    return () => {
      if (Platform.OS === 'web' && recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      } else {
        try {
          ExpoSpeechRecognition?.abort();
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