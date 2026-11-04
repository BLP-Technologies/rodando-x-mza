import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";
import { eliminarToken, guardarToken, leerToken } from "./almacenamiento";
import * as authService from "./authService";
// Quién está usando la app. `null` = todavía no eligió cómo entrar (se muestra el flujo de auth)
export type Sesion =
  | { tipo: "usuario"; nombre: string; email: string; token: string }
  | { tipo: "invitado" }
  | null;

export type DatosSesion = { nombre: string; email: string; token: string };

interface AuthContextType {
  sesion: Sesion;
  isGuest: boolean;
  cargando: boolean;
  user: { nombre: string; email: string } | null;
  iniciarSesion: (datos: DatosSesion) => void;
  entrarComoInvitado: () => void;
  cerrarSesion: () => void;
  irAAutenticacion: () => void;
}

const AuthContext = createContext<AuthContextType>({
  sesion: null,
  isGuest: false, //
  cargando: true,
  user: null, //
  iniciarSesion: () => {},
  entrarComoInvitado: () => {},
  cerrarSesion: () => {},
  irAAutenticacion: () => {}, //
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [sesion, setSesion] = useState<Sesion>(null);
  const [cargando, setCargando] = useState(true);

  const iniciarSesion = useCallback((datos: DatosSesion) => {
    setSesion({
      tipo: "usuario",
      nombre: datos.nombre,
      email: datos.email,
      token: datos.token,
    });
    guardarToken(datos.token).catch((error) => {
      console.log("Error al guardar el token", error);
    });
  }, []);

  const entrarComoInvitado = useCallback(() => {
    setSesion({ tipo: "invitado" });
  }, []);

  const cerrarSesion = useCallback(() => {
    authService
      .cerrarSesion()
      .catch((error) => {
        console.log("Error al cerrar la sesión en el servidor", error);
      })
      .finally(() => {
        eliminarToken().catch((error) => {
          console.log("Error al eliminar el token", error);
        });
      });
    setSesion(null);
  }, []);

  // Al abrir la app, si hay un token guardado, recupera la sesión
  useEffect(() => {
    const restaurar = async () => {
      try {
        const token = await leerToken();
        if (token) {
          const perfil = await authService.obtenerPerfil(token);
          setSesion({
            tipo: "usuario",
            nombre: perfil.nombre,
            email: perfil.email,
            token,
          });
        }
      } catch (error) {
        console.log("Error al restaurar la sesión", error);
// Solo se borra si el servidor lo rechazó: sin conexión, el token sigue siendo válido
        if (error instanceof Error && error.message === "UNAUTHENTICATED") {
          eliminarToken().catch((e) => {
            console.log("Error al eliminar el token", e);
          });
        }
      } finally {
        setCargando(false);
      }
    };
    restaurar();
  }, []);

  const isGuest = sesion?.tipo === "invitado";
  const user =
    sesion?.tipo === "usuario"
      ? { nombre: sesion.nombre, email: sesion.email }
      : null;

  const value = useMemo(
    () => ({
      sesion,
      cargando,
      isGuest,
      user,
      iniciarSesion,
      entrarComoInvitado,
      cerrarSesion,
      irAAutenticacion: cerrarSesion,
    }),
    [
      sesion,
      cargando,
      isGuest,
      user,
      iniciarSesion,
      entrarComoInvitado,
      cerrarSesion,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
