import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { userService } from '@/services/userServices';

// Quién está usando la app. `null` = todavía no eligió cómo entrar (se muestra el flujo de auth)
export type Sesion =
  | { tipo: 'usuario'; nombre: string; email: string }
  | { tipo: 'invitado' }
  | null;

export type DatosSesion = { nombre: string; email: string };

interface AuthContextType {
  sesion: Sesion;
  isGuest: boolean;
  user: { nombre: string; email: string } | null;
  iniciarSesion: (datos: DatosSesion) => void;
  actualizarNombre: (nuevoNombre: string) => Promise<void>;
  entrarComoInvitado: () => void;
  cerrarSesion: () => void;
  irAAutenticacion: () => void;
}

const AuthContext = createContext<AuthContextType>({
  sesion: null,
  isGuest: false,
  user: null,
  iniciarSesion: () => {},
  actualizarNombre: async () => {},
  entrarComoInvitado: () => {},
  cerrarSesion: () => {},
  irAAutenticacion: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [sesion, setSesion] = useState<Sesion>(null);

  const iniciarSesion = useCallback((datos: DatosSesion) => {
    setSesion({ tipo: 'usuario', nombre: datos.nombre, email: datos.email });
  }, []);

  const actualizarNombre = useCallback(async (nuevoNombre: string) => {
    // 1. Guarda en AsyncStorage o backend mediante el servicio
    const usuarioActualizado = await userService.updateCurrentUserName(nuevoNombre);

    // 2. Notifica a React actualizando el estado 'sesion'
    setSesion((prevSesion) => {
      if (prevSesion?.tipo === 'usuario') {
        return {
          ...prevSesion,
          nombre: usuarioActualizado.name,
        };
      }
      return prevSesion;
    });
  }, []);

  const entrarComoInvitado = useCallback(() => {
    setSesion({ tipo: 'invitado' });
  }, []);

  const cerrarSesion = useCallback(() => {
    setSesion(null);
  }, []);

  const isGuest = sesion?.tipo === 'invitado';
  const user = sesion?.tipo === 'usuario' ? { nombre: sesion.nombre, email: sesion.email } : null;

  const value = useMemo(
    () => ({
      sesion,
      isGuest,
      user,
      iniciarSesion,
      actualizarNombre,
      entrarComoInvitado,
      cerrarSesion,
      irAAutenticacion: cerrarSesion,
    }),
    [sesion, isGuest, user, iniciarSesion, actualizarNombre, entrarComoInvitado, cerrarSesion],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);