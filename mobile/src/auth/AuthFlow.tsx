import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Bienvenida } from './bienvenida';
import { Registro, type DatosRegistro } from './registro';
import { Login, type DatosLogin } from './login';
import { useAuth } from './AuthContext';
import * as authService from './authService';

type PantallaActual = 'bienvenida' | 'registro' | 'login';


function mensajeDeError(error: unknown): string {
  if (error instanceof Error && error.message === 'CONFLICT') {
    return 'Ya existe una cuenta con ese correo';
  }
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
    return 'El correo o la contraseña son incorrectos';
  }
  return 'Error inesperado';
}


export function AuthFlow(){
  const { iniciarSesion, entrarComoInvitado } = useAuth();
  const [pantallaActual, setPantallaActual] = useState<PantallaActual>('bienvenida');

  const handleRegistro = async (datos: DatosRegistro): Promise<string | null> => {
    try {
      await authService.registrarCuenta(datos);
      setPantallaActual('login');
      return null
    } catch (error) {
      console.log('Error al guardar la cuenta', error);
      return mensajeDeError(error);
    }
  };

  
  const handleLogin = async (datos: DatosLogin): Promise<string | null> => {
    try {
      const cuenta = await authService.iniciarSesion(datos);
      iniciarSesion(cuenta);
      return null;
    } catch (error) {
      console.log('Error al iniciar sesión', error);
      return mensajeDeError(error);
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
