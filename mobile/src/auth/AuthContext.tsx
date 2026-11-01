import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

// Quién está usando la app. `null` = todavía no eligió cómo entrar (se muestra el flujo de auth)
export type Sesion =
  | { tipo: 'usuario'; nombre: string; email: string }
  | { tipo: 'invitado' }
  | null;

export type DatosSesion = { nombre: string; email: string };

interface AuthContextType {
  sesion: Sesion;
  isGuest: boolean; //agregago
  user: { nombre: string; email: string } | null;//agregado
  iniciarSesion: (datos: DatosSesion) => void;
  entrarComoInvitado: () => void;
  cerrarSesion: () => void;
  irAAutenticacion: () => void;//Vuelve al flujo de auth si el invitado quiere registrarse
}

const AuthContext = createContext<AuthContextType>({
  sesion: null,
  isGuest:false,//
  user: null,//
  iniciarSesion: () => {},
  entrarComoInvitado: () => {},
  cerrarSesion: () => {},
  irAAutenticacion: () => {},//
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [sesion, setSesion] = useState<Sesion>(null);

  const iniciarSesion = useCallback((datos: DatosSesion) => {
    setSesion({ tipo: 'usuario', nombre: datos.nombre, email: datos.email });
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
    () => ({ sesion, isGuest, user, iniciarSesion, entrarComoInvitado, cerrarSesion, irAAutenticacion: cerrarSesion, }),
    [sesion, isGuest, user, iniciarSesion, entrarComoInvitado, cerrarSesion],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
