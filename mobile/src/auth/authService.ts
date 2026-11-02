import { guardarCuenta, leerCuenta, } from "./almacenamiento";
import { type DatosRegistro } from "./registro";
import { type DatosLogin } from "./login";


type Cuenta = {
    nombre: string;
    email: string;
}

type ResultadoLogin = Cuenta & { token: string };


export async function registrarCuenta(datos: DatosRegistro): Promise<Cuenta> {
    const cuenta = await leerCuenta();
    if (cuenta) {
        throw new Error('CONFLICT');
    }
    await guardarCuenta(datos);
    return { nombre: datos.nombre, email: datos.email };
}

export async function iniciarSesion(datos: DatosLogin): Promise<ResultadoLogin> {
    const cuenta = await leerCuenta();
    if (!cuenta || cuenta.email !== datos.email || cuenta.password !== datos.password) {
        throw new Error('UNAUTHENTICATED');
    }
    return { token: 'token-local', nombre: cuenta.nombre, email: cuenta.email };
}


export async function obtenerPerfil(token: string): Promise<Cuenta> {
    const cuenta = await leerCuenta();
    if (!cuenta) {
        throw new Error('UNAUTHENTICATED');
    }
    return { nombre: cuenta.nombre, email: cuenta.email };
}

export async function cerrarSesion(): Promise<void> {
    // await eliminarToken();
}