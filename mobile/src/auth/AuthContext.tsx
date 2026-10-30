import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

// Quién está usando la app. `null` = todavía no eligió cómo entrar (se muestra el flujo de auth)
export type Sesion =
  | { tipo: 'usuario'; nombre: string; email: string }
  | { tipo: 'invitado' }
  | null;

export type DatosSesion = { nombre: string; email: string };

interface AuthContextType {
  sesion: Sesion;
  iniciarSesion: (datos: DatosSesion) => void;
  entrarComoInvitado: () => void;
  cerrarSesion: () => void;
}

const AuthContext = createContext<AuthContextType>({
  sesion: null,
  iniciarSesion: () => {},
  entrarComoInvitado: () => {},
  cerrarSesion: () => {},
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

  const value = useMemo(
    () => ({ sesion, iniciarSesion, entrarComoInvitado, cerrarSesion }),
    [sesion, iniciarSesion, entrarComoInvitado, cerrarSesion],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
