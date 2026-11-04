import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Bienvenida } from './bienvenida';
import { Registro, type DatosRegistro } from './registro';
import { Login, type DatosLogin } from './login';
import { guardarCuenta, leerCuenta } from './almacenamiento';
import { useAuth } from './AuthContext';

type PantallaActual = 'bienvenida' | 'registro' | 'login';

const MENSAJE_ERROR = 'El email o la contraseña son incorrectos';

// Flujo previo a tener sesión: Bienvenida, Registro y Login.
// Al iniciar sesión o entrar como invitado, App pasa a mostrar la navegación principal.
export function AuthFlow() {
  const { iniciarSesion, entrarComoInvitado } = useAuth();
  const [pantallaActual, setPantallaActual] = useState<PantallaActual>('bienvenida');

  const handleRegistro = async (datos: DatosRegistro) => {
    try {
      await guardarCuenta(datos);
      setPantallaActual('login');
    } catch (error) {
      console.log('Error al guardar la cuenta', error);
    }
  };

  // Devuelve el mensaje de error a mostrar en Login, o null si el inicio fue correcto
  const handleLogin = async (datos: DatosLogin): Promise<string | null> => {
    try {
      const cuenta = await leerCuenta();
      if (
        cuenta === null ||
        cuenta.email !== datos.email ||
        cuenta.password !== datos.password
      ) {
        return MENSAJE_ERROR;
      }
      iniciarSesion({ nombre: cuenta.nombre, email: cuenta.email });
      return null;
    } catch (error) {
      console.log('Error al iniciar sesión', error);
      return MENSAJE_ERROR;
    }
  };

  const renderPantalla = () => {
    switch (pantallaActual) {
      case 'bienvenida':
        return (
          <Bienvenida
            onInvitado={entrarComoInvitado}
            onRegistro={() => setPantallaActual('registro')}
            onLogin={() => setPantallaActual('login')}
          />
        );
      case 'registro':
        return (
          <Registro
            onVolver={() => setPantallaActual('bienvenida')}
            onRegistro={handleRegistro}
            onLogin={() => setPantallaActual('login')}
          />
        );
      case 'login':
        return (
          <Login
            onVolver={() => setPantallaActual('bienvenida')}
            onRegistro={() => setPantallaActual('registro')}
            onLogin={handleLogin}
          />
        );
      default: {
        // Si se agrega una pantalla nueva y no se maneja, TypeScript da error acá
        const _exhaustivo: never = pantallaActual;
        return _exhaustivo;
      }
    }
  };

  return (
    <>
      {renderPantalla()}
      <StatusBar style="dark" />
    </>
  );
}
