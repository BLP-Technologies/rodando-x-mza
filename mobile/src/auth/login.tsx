import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type DatosLogin = {
  email: string;
  password: string;
};

interface PantallaLogin {
  onVolver: () => void;
  onLogin: (datos: DatosLogin) => void;
  onRegistro: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validar(email: string, password: string): string | null {
  if (!email || !password) {
    return "Completá todos los campos.";
  }
  if (!EMAIL_REGEX.test(email)) {
    return "Ingresá un email válido.";
  }
  return null;
}

export function Login({ onVolver, onLogin, onRegistro }: PantallaLogin) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleLogin = () => {
    const emailLimpio = email.trim().toLowerCase();
    const mensaje = validar(emailLimpio, password);
    setError(mensaje);
    if (mensaje === null) {
      onLogin({ email: emailLimpio, password });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.header}>
              <Pressable
                style={styles.backButton}
                onPress={onVolver}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Volver"
              >
                <Text style={styles.backText}>← Volver</Text>
              </Pressable>
              <Text style={styles.tagline}>TU CIUDAD, A TU MANERA</Text>
              <Text style={styles.title} accessibilityRole="header">
                Iniciar sesión
              </Text>
              <Text style={styles.description}>
                Ingresá con el correo de la cuenta simulada creada en este
                dispositivo
              </Text>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Correo electrónico"
                accessibilityLabel="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                submitBehavior="submit"
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Contraseña</Text>
              <TextInput
                ref={passwordRef}
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Contraseña"
                accessibilityLabel="Contraseña"
                returnKeyType="done"
                autoComplete="password"
                textContentType="password"
                secureTextEntry
                autoCapitalize="none"
                submitBehavior="submit"
                onSubmitEditing={() => handleLogin()}
              />
            </View>
            {error !== null && (
              <Text
                style={styles.errorText}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {error}
              </Text>
            )}
            <Pressable
              style={styles.submitButton}
              onPress={handleLogin}
              accessibilityRole="button"
              accessibilityLabel="Iniciar sesión"
            >
              <Text style={styles.submitButtonText}>INICIAR SESIÓN</Text>
            </Pressable>
            <Pressable
              style={styles.linkButton}
              onPress={onRegistro}
              accessibilityRole="link"
              accessibilityLabel="Crear una cuenta"
            >
              <Text style={styles.linkText}>Crear una cuenta</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F3EE", // Fondo crema exterior
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: "center", // Centra la tarjeta verticalmente en la pantalla
  },
  card: {
    backgroundColor: "#FFFFFF", // Fondo blanco de la tarjeta
    borderRadius: 24, // Bordes bien redondeados del Figma
    paddingHorizontal: 24,
    paddingVertical: 26,
    // Sombra sutil para despegarla del fondo crema
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3, // Sombra para Android
  },
  header: {
    marginBottom: 18,
  },
  backButton: {
    alignSelf: "flex-start", // Para que el área táctil solo ocupe lo que mide el texto
    minHeight: 48, // Altura táctil accesible (WCAG AA)
    justifyContent: "center",
    paddingRight: 12,
    marginBottom: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F2942", // Azul marino oscuro
  },
  tagline: {
    color: "#169C98", // Turquesa característico de la app
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  title: {
    color: "#0F2942",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 6,
  },
  description: {
    color: "#64748B", // Gris suave para texto secundario
    fontSize: 12,
    lineHeight: 17,
  },
  fieldGroup: {
    marginBottom: 13,
    gap: 6, // Separa 6px la etiqueta del input
  },
  label: {
    color: "#0F2942",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#68B0AB", // Borde turquesa suave del Figma
    borderRadius: 12,
    minHeight: 48, // Altura táctil accesible (WCAG AA)
    paddingHorizontal: 16,
    fontSize: 14,
    color: "#0F2942",
    backgroundColor: "#FFFFFF",
  },
  errorText: {
    color: "#B42318", // Rojo con contraste AA sobre blanco
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  submitButton: {
    backgroundColor: "#EE8A27", // Naranja vibrante del Figma
    minHeight: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  submitButtonText: {
    color: "#0F2942",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  linkButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48, // Altura táctil accesible (WCAG AA)
  },
  linkText: {
    color: "#169C98", // Turquesa con subrayado
    fontSize: 13,
    textDecorationLine: "underline",
    fontWeight: "600",
  },
});
