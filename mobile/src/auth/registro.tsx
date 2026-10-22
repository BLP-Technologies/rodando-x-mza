import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TextInput } from "react-native";

interface PantallaRegistro {
  onVolver: () => void;
  onRegistro: () => void;
  onLogin: () => void;
}

export function Registro({ onVolver, onRegistro, onLogin }: PantallaRegistro) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onVolver}>
            <Text style={styles.backText}>← Volver</Text>
          </Pressable>
          <Text style={styles.tagline}>TU CIUDAD, A TU MANERA</Text>
          <Text style={styles.title}>Crear Cuenta</Text>
          <Text style={styles.description}>
            Esta cuenta es simulada y se guarda únicamente en este dispositivo.
          </Text>
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Nombre</Text>
          <TextInput style={styles.input} placeholder="Nombre Completo" />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="Correo electronico"
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            secureTextEntry={true}
            placeholder="Contraseña"
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Confirmar Contraseña</Text>
          <TextInput
            style={styles.input}
            secureTextEntry={true}
            placeholder="Confirmar Contraseña"
          />
        </View>
        <Pressable  style={styles.submitButton} onPress={onRegistro}>
          <Text style={styles.submitButtonText}>CREAR CUENTA</Text>
        </Pressable>
        <Pressable style={styles.linkButton} onPress={onLogin}>
          <Text style={styles.linkText}>¿Ya tenés cuenta? Iniciar sesión</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F3EE', // Fondo crema exterior
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'center', // Centra la tarjeta verticalmente en la pantalla
  },
  card: {
    backgroundColor: '#FFFFFF', // Fondo blanco de la tarjeta
    borderRadius: 24,          // Bordes bien redondeados del Figma
    paddingHorizontal: 24,
    paddingVertical: 26,
    // Sombra sutil para despegarla del fondo crema
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,              // Sombra para Android
  },
  header: {
    marginBottom: 18,
  },
  backButton: {
    alignSelf: 'flex-start',   // Para que el área táctil solo ocupe lo que mide el texto
    paddingVertical: 4,
    paddingRight: 12,
    marginBottom: 12,
  },
  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F2942',          // Azul marino oscuro
  },
  tagline: {
    color: '#169C98',          // Turquesa característico de la app
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  title: {
    color: '#0F2942',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 6,
  },
  description: {
    color: '#64748B',          // Gris suave para texto secundario
    fontSize: 12,
    lineHeight: 17,
  },
  fieldGroup: {
    marginBottom: 13,
    gap: 6,                    // Separa 6px la etiqueta del input
  },
  label: {
    color: '#0F2942',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#68B0AB',    // Borde turquesa suave del Figma
    borderRadius: 12,
    minHeight: 48,             // Altura táctil accesible (WCAG AA)
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#0F2942',
    backgroundColor: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: '#EE8A27', // Naranja vibrante del Figma
    minHeight: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  submitButtonText: {
    color: '#0F2942',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  linkText: {
    color: '#169C98',          // Turquesa con subrayado
    fontSize: 13,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});

