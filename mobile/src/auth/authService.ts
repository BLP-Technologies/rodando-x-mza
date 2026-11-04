import { leerToken } from "./almacenamiento";
import { type DatosRegistro } from "./registro";
import { type DatosLogin } from "./login";

type Cuenta = {
    nombre: string;
    email: string;
}

type ResultadoLogin = Cuenta & { token: string };

// Lo que devuelve la API (docs/18). Acá se traduce `name` a `nombre`.
type UsuarioApi = {
    id: number;
    name: string;
    email: string;
    is_moderator: boolean;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

// Hace el pedido. Si la API responde un error, lanza su código (CONFLICT, UNAUTHENTICATED...).
async function pedir<T>(ruta: string, metodo: string, cuerpo?: unknown, token?: string): Promise<T> {
    const headers: Record<string, string> = {};
    if (cuerpo !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const respuesta = await fetch(`${API_URL}/api/auth${ruta}`, {
        method: metodo,
        headers,
        ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}),
    });

    if (!respuesta.ok) {
        const datos = (await respuesta.json().catch(() => null)) as { error?: { code?: string } } | null;
        throw new Error(datos?.error?.code ?? "INTERNAL_ERROR");
    }

    // 204 (logout) no trae cuerpo
    if (respuesta.status === 204) return undefined as T;
    return (await respuesta.json()) as T;
}

function aCuenta(usuario: UsuarioApi): Cuenta {
    return { nombre: usuario.name, email: usuario.email };
}

export async function registrarCuenta(datos: DatosRegistro): Promise<Cuenta> {
    const { user } = await pedir<{ user: UsuarioApi }>("/register", "POST", {
        name: datos.nombre,
        email: datos.email,
        password: datos.password,
    });
    return aCuenta(user);
}

export async function iniciarSesion(datos: DatosLogin): Promise<ResultadoLogin> {
    const { token, user } = await pedir<{ token: string; user: UsuarioApi }>("/login", "POST", {
        email: datos.email,
        password: datos.password,
    });
    return { ...aCuenta(user), token };
}

export async function obtenerPerfil(token: string): Promise<Cuenta> {
    const { user } = await pedir<{ user: UsuarioApi }>("/me", "GET", undefined, token);
    return aCuenta(user);
}

export async function cerrarSesion(): Promise<void> {
    const token = await leerToken();
    if (!token) return;
    await pedir<void>("/logout", "POST", undefined, token);
}
