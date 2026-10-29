import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface PantallaBienvenida {
  onInvitado: () => void;
  onRegistro: () => void;
  onLogin: () => void;
}

export function Bienvenida({
  onInvitado,
  onRegistro,
  onLogin,
}: PantallaBienvenida) {
  return (
    <SafeAreaView style={styles.container}>
      {/*CONTENIDO CENTRAL*/}
      <View style={styles.content}>
        {/*LOGO*/}
        <View style={styles.logoPlaceHolder}>
          <Text style={styles.logoTitle}>RodandoXmza</Text>
          <Text style={styles.logoTagline}>
            — MENDOZA ACCESIBLE, PARA TODXS —
          </Text>
        </View>

        <Text style={styles.title} accessibilityRole="header">
          Movete por Mendoza de manera más accesible
        </Text>

        <Text style={styles.description}>
          Encontrá recorridos accesibles, guardá tus trayectos frecuentes y
          compartí información sobre barreras en el camino.
        </Text>
      </View>

      {/* BOTONES*/}

      <View style={styles.actions}>
        <Pressable
          style={styles.btnPrim}
          onPress={onInvitado}
          accessibilityRole="button"
          accessibilityLabel="Continuar sin cuenta"
        >
          <Text style={styles.btnPrimText}>CONTINUAR SIN CUENTA</Text>
        </Pressable>
        <Pressable
          style={styles.btnSec}
          onPress={onLogin}
          accessibilityRole="button"
          accessibilityLabel="Iniciar sesión"
        >
          <Text style={styles.btnSecText}>INICIAR SESIÓN</Text>
        </Pressable>
        <Pressable
          style={styles.btnTert}
          onPress={onRegistro}
          accessibilityRole="link"
          accessibilityLabel="Crear una cuenta"
        >
          <Text style={styles.btnTertText}>Crear una cuenta</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F3EE",
    paddingHorizontal: 28,
    paddingVertical: 24,
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoPlaceHolder: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoTitle: {
    fontSize: 36,
    fontWeight: "900",
    color: "#0F2942",
    letterSpacing: 1,
  },
  logoTagline: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0F2942",
    marginTop: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F2942",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 30,
  },
  description: {
    fontSize: 14,
    color: "#4A5568",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  actions: {
    gap: 14, // Espacio vertical entre cada botón
    paddingBottom: 12,
  },
  btnPrim: {
    backgroundColor: "#EE8A27",
    minHeight: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  btnPrimText: {
    color: "#0F2942",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  btnSec: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#169C98",
    minHeight: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  btnSecText: {
    color: "#0F2942",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  btnTert: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  btnTertText: {
    color: "#169C98",
    fontSize: 14,
    textDecorationLine: "underline",
  },
});