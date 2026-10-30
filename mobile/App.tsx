import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Bienvenida } from './src/auth/bienvenida';
import { Registro, type DatosRegistro } from './src/auth/registro';
import { Login, type DatosLogin} from './src/auth/login' ;
import { guardarCuenta, leerCuenta } from './src/auth/almacenamiento';





type PantallaActual = "bienvenida" | "registro" | "login" | "invitado";

export default function App() {
  const [pantallaActual, setPantallaActual] = useState<PantallaActual>(
    "bienvenida"
  );

  const handleRegistro = async (datos: DatosRegistro) => {
   try{
      await guardarCuenta(datos);
      setPantallaActual("login")
    }catch{
      console.log('error');
      
    }
  };



const handleLogin = async (datos: DatosLogin): Promise<string | null> => {
  const MENSAJE_ERROR = "El email o la contraseña son incorrectos";
  try {
    const cuenta = await leerCuenta();
    if (
      cuenta === null ||
      cuenta.email !== datos.email ||
      cuenta.password !== datos.password
    ) {
      return MENSAJE_ERROR;
    }
    console.log("Inicio correcto");
    return null;
  } catch (error) {
    console.log("Error al iniciar sesión", error);
    return MENSAJE_ERROR;
  }
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
        // Más adelante acá  pantalla de invitado
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
