import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Bienvenida } from './src/auth/bienvenida';
import { Registro, type DatosRegistro } from './src/auth/registro';
import { Login, type DatosLogin} from './src/auth/login' 

type PantallaActual = "bienvenida" | "registro" | "login" | "invitado";

export default function App() {
  const [pantallaActual, setPantallaActual] = useState<PantallaActual>(
    "bienvenida"
  );

  const handleRegistro = (datos: DatosRegistro) => {
    // *! CREAR EL REGISTRO
    console.log("Guardar registro", { nombre: datos.nombre, email: datos.email });
  };


  const handleLogin = (datos: DatosLogin) => {
   //TODO: VINCULAR BIEN EL LOGIN
    console.log('Inicio Exitoso');
  };

  const renderPantalla = () => {
    switch (pantallaActual) {
      case "bienvenida":
        return (
          <Bienvenida
            onInvitado={() => console.log("Invitado")}
            onRegistro={() => setPantallaActual("registro")}
            onLogin={() => setPantallaActual("login")}
          />
        );
      case "registro":
        return (
          <Registro
            onVolver={() => setPantallaActual("bienvenida")}
            onRegistro={handleRegistro}
            onLogin={() => setPantallaActual("login")}
          />
        );
      case "login":
        return ( 
        <Login
          onVolver={() => setPantallaActual("bienvenida")}
            onRegistro={() => setPantallaActual("registro")}
            onLogin={handleLogin}
            />
        );
      case "invitado":
        // Más adelante acá irán <Login /> y la pantalla de invitado
        return null;
      default: {
        // Si se agrega una pantalla nueva y no se maneja, TypeScript da error acá
        const _exhaustivo: never = pantallaActual;
        return _exhaustivo;
      }
    }
  };

  return (
    <SafeAreaProvider>
      {renderPantalla()}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
