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
        <View>
          <Pressable onPress={onVolver}>
            <Text>← Volver</Text>
          </Pressable>
          <Text>TU CIUDAD, A TU MANERA</Text>
          <Text>Crear Cuenta</Text>
          <Text>
            Esta cuenta es simulada y se guarda únicamente en este dispositivo.
          </Text>
        </View>
        <View>
          <Text>Nombre</Text>
          <TextInput style={styles.input} placeholder="Nombre Completo" />
        </View>
        <View>
          <Text>Email</Text>
          <TextInput
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="Correo electronico"
          />
        </View>
        <View>
          <Text>Contraseña</Text>
          <TextInput
            style={styles.input}
            secureTextEntry={true}
            placeholder="Contraseña"
          />
        </View>
        <View>
          <Text>Confirmar Contraseña</Text>
          <TextInput
            style={styles.input}
            secureTextEntry={true}
            placeholder="Confirmar Contraseña"
          />
        </View>
        <Pressable onPress={onRegistro}>
          <Text>CREAR CUENTA</Text>
        </Pressable>
        <Pressable onPress={onLogin}>
          <Text>¿Ya tenés cuenta? Iniciar sesión</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
