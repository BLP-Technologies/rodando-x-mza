import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Bienvenida } from './src/auth/bienvenida';
import { Registro } from './src/auth/registro';

type PantallaActual = "bienvenida" | "registro" | "login" | "invitado";

export default function App() {
  const [pantallaActual, setPantallaActual] = useState<PantallaActual>(
    "bienvenida"
  );
  return (
    <SafeAreaProvider>
      {pantallaActual === "bienvenida" ? (
        <Bienvenida
          onInvitado={() => console.log("Invitado")}
          onRegistro={() => setPantallaActual("registro")}
          onLogin={() => setPantallaActual("login")} 
        />
      ) : pantallaActual === "registro" ? (
        <Registro
          onVolver={() => setPantallaActual("bienvenida")} 
          onRegistro={() => console.log("Guardar registro")}
          onLogin={() => setPantallaActual("login")}
        />
      ) : (
        // Más adelante acá irá <Login />
        null
      )}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}